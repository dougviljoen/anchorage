import { decodePolyline } from '../../lib/polyline'
import type { Coordinates, TravelMode } from '../../domain/types'
import type {
  LiveRoute,
  LiveRouteResponse,
  LiveRouteStep,
} from '../../services/travel-intelligence'
import type {
  RouteAnnotation,
  ThreadRouteOverlay,
  ThreadRouteSegment,
} from './map-types'
import type { ThreadRouteRequest } from './thread-route-plan'

const maximumAnnotations = 4
const japaneseText =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

const conciseInstruction = (instruction: string) => {
  const routeName = instruction.match(
    /\b(?:onto|toward|on)\s+(.+?)(?:\s+for\s+|\s*\/|$)/i,
  )?.[1]
  const label = (routeName ?? instruction)
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]$/, '')
    .trim()

  return label.length > 42 ? `${label.slice(0, 39).trimEnd()}…` : label
}

const chooseAnnotations = (steps: LiveRouteStep[]): RouteAnnotation[] => {
  const seen = new Set<string>()
  const candidates = steps.flatMap((step) => {
    if (!step.instruction || !step.start || step.distanceMeters < 35) return []
    if (/\bdestination\b/i.test(step.instruction)) return []

    const label = conciseInstruction(step.instruction)
    const identity = label.toLocaleLowerCase()
    if (!label || japaneseText.test(label) || seen.has(identity)) return []
    seen.add(identity)

    return [{ coordinates: step.start, label }]
  })

  if (candidates.length <= maximumAnnotations) return candidates

  return Array.from({ length: maximumAnnotations }, (_, index) => {
    const candidateIndex = Math.round(
      (index * (candidates.length - 1)) / (maximumAnnotations - 1),
    )
    return candidates[candidateIndex]
  })
}

export type ThreadRouteResult = {
  request: ThreadRouteRequest
  response?: LiveRouteResponse
  estimatedResponse?: LiveRouteResponse
}

const uniqueModes = (modes: TravelMode[]) => [...new Set(modes)]

const sameCoordinates = (
  left: Coordinates,
  right: Coordinates,
) =>
  Math.abs(left.latitude - right.latitude) < 0.000001 &&
  Math.abs(left.longitude - right.longitude) < 0.000001

const stitchLogicalEndpoints = (
  path: Coordinates[],
  origin: Coordinates,
  destination: Coordinates,
) => {
  const stitched = [...path]

  if (!sameCoordinates(stitched[0], origin)) stitched.unshift(origin)
  if (!sameCoordinates(stitched[stitched.length - 1], destination)) {
    stitched.push(destination)
  }

  return stitched
}

const segmentFromPolyline = (
  encodedPolyline: string,
  request: ThreadRouteRequest,
  source: ThreadRouteSegment['source'],
  origin: Coordinates,
  destination: Coordinates,
): ThreadRouteSegment | undefined => {
  try {
    const path = decodePolyline(encodedPolyline)
    if (path.length < 2) return undefined

    return {
      path: stitchLogicalEndpoints(path, origin, destination),
      travelMode: request.travelMode,
      transitModes: request.input.transitModes,
      source,
    }
  } catch {
    return undefined
  }
}

const routeSegments = (
  route: LiveRoute,
  request: ThreadRouteRequest,
  source: ThreadRouteSegment['source'],
): ThreadRouteSegment[] => {
  const logicalPoints = request.fallbackPath
  if (
    route.legs.length === logicalPoints.length - 1 &&
    route.legs.every((leg) => leg.encodedPolyline)
  ) {
    return route.legs.flatMap((leg, index) => {
      const segment = segmentFromPolyline(
        leg.encodedPolyline,
        request,
        source,
        logicalPoints[index],
        logicalPoints[index + 1],
      )
      return segment ? [segment] : []
    })
  }

  const segment = segmentFromPolyline(
    route.encodedPolyline,
    request,
    source,
    request.input.origin,
    request.input.destination,
  )
  return segment ? [segment] : []
}

const fallbackSegments = (
  request: ThreadRouteRequest,
): ThreadRouteSegment[] => {
  const base = {
    travelMode: request.travelMode,
    transitModes: request.input.transitModes,
    source: request.fallbackSource,
  }

  if (
    request.fallbackSource === 'estimated' &&
    request.fallbackPath.length > 2
  ) {
    return request.fallbackPath.slice(1).map((destination, index) => ({
      ...base,
      path: [request.fallbackPath[index], destination],
    }))
  }

  return [{ ...base, path: request.fallbackPath }]
}

const distanceMeters = (left: Coordinates, right: Coordinates) => {
  const averageLatitude =
    ((left.latitude + right.latitude) / 2) * (Math.PI / 180)
  const latitudeMeters = (right.latitude - left.latitude) * 110_540
  const longitudeMeters =
    (right.longitude - left.longitude) *
    111_320 *
    Math.cos(averageLatitude)

  return Math.hypot(latitudeMeters, longitudeMeters)
}

const sameSegmentStyle = (
  left: ThreadRouteSegment,
  right: ThreadRouteSegment,
) =>
  left.travelMode === right.travelMode &&
  [...(left.transitModes ?? [])].sort().join(',') ===
    [...(right.transitModes ?? [])].sort().join(',')

const sampledPath = (path: Coordinates[]) => {
  const stride = Math.max(1, Math.floor(path.length / 20))
  return path.filter(
    (_, index) => index % stride === 0 || index === path.length - 1,
  )
}

const followsSameGeometry = (
  left: Coordinates[],
  right: Coordinates[],
) =>
  sampledPath(left).every(
    (point) =>
      Math.min(...right.map((candidate) => distanceMeters(point, candidate))) <
      35,
  )

const areReciprocal = (
  left: ThreadRouteSegment,
  right: ThreadRouteSegment,
) => {
  const leftStart = left.path[0]
  const leftEnd = left.path.at(-1)
  const rightStart = right.path[0]
  const rightEnd = right.path.at(-1)
  if (!leftEnd || !rightEnd) return false

  return (
    sameSegmentStyle(left, right) &&
    distanceMeters(leftStart, rightEnd) < 35 &&
    distanceMeters(leftEnd, rightStart) < 35 &&
    followsSameGeometry(left.path, right.path) &&
    followsSameGeometry(right.path, left.path)
  )
}

const sourceRank: Record<ThreadRouteSegment['source'], number> = {
  estimated: 0,
  curated: 1,
  live: 2,
}

const collapseReciprocalSegments = (
  segments: ThreadRouteSegment[],
): ThreadRouteSegment[] => {
  const consumed = new Set<number>()

  return segments.flatMap((segment, index) => {
    if (consumed.has(index)) return []

    const reciprocalIndex = segments.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        !consumed.has(candidateIndex) &&
        areReciprocal(segment, candidate),
    )
    if (reciprocalIndex < 0) return [segment]

    consumed.add(reciprocalIndex)
    const reciprocal = segments[reciprocalIndex]
    return [
      {
        ...segment,
        source:
          sourceRank[reciprocal.source] > sourceRank[segment.source]
            ? reciprocal.source
            : segment.source,
      },
    ]
  })
}

const sharedGeometryThresholdMeters = 8
const sharedGeometrySampleIntervalMeters = 6

const interpolateCoordinates = (
  start: Coordinates,
  end: Coordinates,
  fraction: number,
): Coordinates => ({
  latitude: start.latitude + (end.latitude - start.latitude) * fraction,
  longitude: start.longitude + (end.longitude - start.longitude) * fraction,
})

const pointToEdgeDistanceMeters = (
  point: Coordinates,
  start: Coordinates,
  end: Coordinates,
) => {
  const averageLatitude =
    ((point.latitude + start.latitude + end.latitude) / 3) *
    (Math.PI / 180)
  const longitudeScale = 111_320 * Math.cos(averageLatitude)
  const pointX = point.longitude * longitudeScale
  const pointY = point.latitude * 110_540
  const startX = start.longitude * longitudeScale
  const startY = start.latitude * 110_540
  const endX = end.longitude * longitudeScale
  const endY = end.latitude * 110_540
  const deltaX = endX - startX
  const deltaY = endY - startY
  const lengthSquared = deltaX ** 2 + deltaY ** 2
  const fraction =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((pointX - startX) * deltaX +
              (pointY - startY) * deltaY) /
              lengthSquared,
          ),
        )

  return Math.hypot(
    pointX - (startX + fraction * deltaX),
    pointY - (startY + fraction * deltaY),
  )
}

const pointToPathDistanceMeters = (
  point: Coordinates,
  path: Coordinates[],
) =>
  path.slice(1).reduce(
    (nearest, end, index) =>
      Math.min(
        nearest,
        pointToEdgeDistanceMeters(point, path[index], end),
      ),
    Number.POSITIVE_INFINITY,
  )

const edgeIsCovered = (
  start: Coordinates,
  end: Coordinates,
  paths: Coordinates[][],
) => {
  const sampleCount = Math.max(
    1,
    Math.ceil(
      distanceMeters(start, end) / sharedGeometrySampleIntervalMeters,
    ),
  )

  return Array.from({ length: sampleCount + 1 }, (_, index) =>
    interpolateCoordinates(start, end, index / sampleCount),
  ).every(
    (point) =>
      Math.min(
        ...paths.map((path) => pointToPathDistanceMeters(point, path)),
      ) < sharedGeometryThresholdMeters,
  )
}

const removeSharedGeometry = (
  segment: ThreadRouteSegment,
  existing: ThreadRouteSegment[],
): ThreadRouteSegment[] => {
  const sharedStylePaths = existing
    .filter((candidate) => sameSegmentStyle(segment, candidate))
    .map((candidate) => candidate.path)

  if (sharedStylePaths.length === 0) return [segment]

  const runs: Coordinates[][] = []
  let activeRun: Coordinates[] | undefined

  segment.path.slice(1).forEach((end, index) => {
    const start = segment.path[index]
    if (edgeIsCovered(start, end, sharedStylePaths)) {
      if (activeRun && activeRun.length > 1) runs.push(activeRun)
      activeRun = undefined
      return
    }

    if (!activeRun) activeRun = [start]
    activeRun.push(end)
  })

  if (activeRun && activeRun.length > 1) runs.push(activeRun)

  return runs.map((path) => ({ ...segment, path }))
}

const collapseSharedGeometry = (
  segments: ThreadRouteSegment[],
): ThreadRouteSegment[] =>
  segments.reduce<ThreadRouteSegment[]>((visible, segment) => {
    visible.push(...removeSharedGeometry(segment, visible))
    return visible
  }, [])

export function buildThreadRouteOverlay(
  results: ThreadRouteResult[],
): ThreadRouteOverlay {
  const rawSegments = results.flatMap(
    ({ request, response, estimatedResponse }) => {
      if (response) {
        const segments = routeSegments(response.route, request, 'live')
        if (segments.length > 0) return segments
      }
      if (estimatedResponse) {
        const segments = routeSegments(
          estimatedResponse.route,
          request,
          'estimated',
        )
        if (segments.length > 0) return segments
      }

      return fallbackSegments(request)
    },
  )
  const segments = collapseSharedGeometry(
    collapseReciprocalSegments(rawSegments),
  )
  const liveResponses = results.flatMap(({ response }) =>
    response ? [response] : [],
  )
  const liveModes = segments.flatMap((segment) =>
    segment.source === 'live' ? [segment.travelMode] : [],
  )
  const curatedModes = segments.flatMap((segment) =>
    segment.source === 'curated' ? [segment.travelMode] : [],
  )
  const estimatedModes = segments.flatMap((segment) =>
    segment.source === 'estimated' ? [segment.travelMode] : [],
  )
  const steps = liveResponses.flatMap(({ route }) =>
    route.legs.flatMap((leg) => leg.steps),
  )

  return {
    segments,
    annotations: chooseAnnotations(steps),
    encodedPolylines: liveResponses.map(
      ({ route }) => route.encodedPolyline,
    ),
    distanceMeters: liveResponses.reduce(
      (total, { route }) => total + route.distanceMeters,
      0,
    ),
    durationMinutes: Math.max(
      1,
      Math.round(
        liveResponses.reduce(
          (total, { route }) => total + route.durationSeconds,
          0,
        ) / 60,
      ),
    ),
    liveModes: uniqueModes(liveModes),
    curatedModes: uniqueModes(curatedModes),
    estimatedModes: uniqueModes(estimatedModes),
    fullyLive:
      curatedModes.length === 0 && estimatedModes.length === 0,
    fetchedAt:
      liveResponses.at(-1)?.fetchedAt ?? new Date().toISOString(),
  }
}
