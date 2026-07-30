import type {
  Coordinates,
  Thread,
  TravelMode,
} from '../../domain/types'
import type { ComputeRouteInput } from '../../services/travel-intelligence'

export type ThreadRouteRequest = {
  input: ComputeRouteInput
  fallbackPath: Coordinates[]
  travelMode: TravelMode
}

const maximumIntermediates = 10

export function planThreadRoute(
  thread: Thread,
  origin: Coordinates,
  destination: Coordinates,
): ThreadRouteRequest[] {
  const points = [
    origin,
    ...thread.stops.map((stop) => stop.coordinates),
    destination,
  ]
  const modes = [
    ...thread.stops.map((stop) => stop.travelModeFromPrevious),
    thread.travelModeToAnchor,
  ]
  const transitModes = [
    ...thread.stops.map((stop) => stop.transitModesFromPrevious),
    thread.transitModesToAnchor,
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

    const fallbackPath = points.slice(edgeIndex, finalEdgeIndex + 2)
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
      travelMode,
    })

    edgeIndex = finalEdgeIndex + 1
  }

  return requests
}
