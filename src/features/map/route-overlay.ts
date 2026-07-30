import { decodePolyline } from '../../lib/polyline'
import type { TravelMode } from '../../domain/types'
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
    if (!label || seen.has(identity)) return []
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
}

const uniqueModes = (modes: TravelMode[]) => [...new Set(modes)]

const liveSegment = (
  route: LiveRoute,
  travelMode: TravelMode,
): ThreadRouteSegment | undefined => {
  try {
    const path = decodePolyline(route.encodedPolyline)
    if (path.length < 2) return undefined

    return { path, travelMode, source: 'live' }
  } catch {
    return undefined
  }
}

export function buildThreadRouteOverlay(
  results: ThreadRouteResult[],
): ThreadRouteOverlay {
  const segments = results.map(({ request, response }) => {
    if (response) {
      const segment = liveSegment(response.route, request.travelMode)
      if (segment) return segment
    }

    return {
      path: request.fallbackPath,
      travelMode: request.travelMode,
      source: 'estimated' as const,
    }
  })
  const liveResponses = results.flatMap(({ response }) =>
    response ? [response] : [],
  )
  const liveModes = segments.flatMap((segment) =>
    segment.source === 'live' ? [segment.travelMode] : [],
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
    estimatedModes: uniqueModes(estimatedModes),
    fullyLive: estimatedModes.length === 0,
    fetchedAt:
      liveResponses.at(-1)?.fetchedAt ?? new Date().toISOString(),
  }
}
