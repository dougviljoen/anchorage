import type {
  Coordinates,
  Thread,
  TravelMode,
} from '../../domain/types'
import type { ComputeRouteInput } from '../../services/travel-intelligence'

export type ThreadRouteRequest = {
  input: ComputeRouteInput
  fallbackPath: Coordinates[]
  fallbackSource: 'curated' | 'estimated'
  startLegIndex: number
  travelMode: TravelMode
}

const maximumIntermediates = 10

const sameCoordinates = (left: Coordinates, right: Coordinates) =>
  left.latitude === right.latitude &&
  left.longitude === right.longitude

const joinPath = (
  origin: Coordinates,
  curatedPath: Coordinates[] | undefined,
  destination: Coordinates,
) => {
  if (!curatedPath?.length) return [origin, destination]

  const path = [origin, ...curatedPath, destination]
  return path.filter(
    (point, index) =>
      index === 0 || !sameCoordinates(point, path[index - 1]),
  )
}

export function planThreadRoute(
  thread: Thread,
  origin: Coordinates,
  destination: Coordinates,
): ThreadRouteRequest[] {
  const waypoints = thread.routeWaypoints ?? thread.stops
  const points = [
    origin,
    ...waypoints.map((waypoint) => waypoint.coordinates),
    destination,
  ]
  const modes = [
    ...waypoints.map((waypoint) => waypoint.travelModeFromPrevious),
    thread.travelModeToAnchor,
  ]
  const transitModes = [
    ...waypoints.map((waypoint) => waypoint.transitModesFromPrevious),
    thread.transitModesToAnchor,
  ]
  const curatedPaths = [
    ...waypoints.map((waypoint) =>
      'curatedPathFromPrevious' in waypoint
        ? waypoint.curatedPathFromPrevious
        : undefined,
    ),
    undefined,
  ]
  const requests: ThreadRouteRequest[] = []

  let edgeIndex = 0
  while (edgeIndex < modes.length) {
    const travelMode = modes[edgeIndex]
    let finalEdgeIndex = edgeIndex

    if (travelMode !== 'TRANSIT') {
      while (
        finalEdgeIndex + 1 < modes.length &&
        modes[finalEdgeIndex + 1] === travelMode &&
        finalEdgeIndex - edgeIndex < maximumIntermediates
      ) {
        finalEdgeIndex += 1
      }
    }

    const curatedPath = curatedPaths[edgeIndex]
    const fallbackPath =
      edgeIndex === finalEdgeIndex
        ? joinPath(
            points[edgeIndex],
            curatedPath,
            points[finalEdgeIndex + 1],
          )
        : points.slice(edgeIndex, finalEdgeIndex + 2)
    requests.push({
      input: {
        origin: fallbackPath[0],
        destination: fallbackPath[fallbackPath.length - 1],
        intermediates:
          travelMode === 'TRANSIT'
            ? undefined
            : fallbackPath.slice(1, -1),
        travelMode,
        languageCode: 'en',
        ...(travelMode === 'TRANSIT'
          ? {
              transitPreference: 'LESS_WALKING' as const,
              transitModes: transitModes[edgeIndex],
            }
          : {}),
      },
      fallbackPath,
      fallbackSource: curatedPath ? 'curated' : 'estimated',
      startLegIndex: edgeIndex,
      travelMode,
    })

    edgeIndex = finalEdgeIndex + 1
  }

  return requests
}
