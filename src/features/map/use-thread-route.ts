import { useEffect, useMemo, useState } from 'react'
import type { Anchor, Coordinates, Thread } from '../../domain/types'
import {
  getTravelIntelligenceGateway,
  type ComputeRouteInput,
} from '../../services/travel-intelligence'
import { buildThreadRouteOverlay } from './route-overlay'
import type { ThreadRouteState } from './map-types'
import { planThreadRoute } from './thread-route-plan'

type RouteResult = {
  key: string
  state: ThreadRouteState
}

const coordinateKey = ({ latitude, longitude }: Coordinates) =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}`

const asRoadAlignedFallback = (
  input: ComputeRouteInput,
): ComputeRouteInput => ({
  origin: input.origin,
  destination: input.destination,
  travelMode: 'DRIVE',
  languageCode: input.languageCode,
})

const canUseRoadAlignedFallback = (input: ComputeRouteInput) =>
  input.travelMode === 'TRANSIT' &&
  input.transitModes?.length === 1 &&
  input.transitModes[0] === 'BUS'

export function useThreadRoute({
  thread,
  origin,
  nextAnchor,
}: {
  thread?: Thread
  origin: Coordinates
  nextAnchor: Anchor
}): ThreadRouteState {
  const gateway = getTravelIntelligenceGateway()
  const destination = nextAnchor.coordinates
  const canRequest =
    Boolean(thread) &&
    Boolean(destination) &&
    Boolean(gateway)

  const requestKey =
    thread && destination
      ? [
          thread.id,
          coordinateKey(origin),
          ...(thread.routeWaypoints ?? thread.stops).flatMap(
            (waypoint) => [
              waypoint.travelModeFromPrevious,
              waypoint.transitModesFromPrevious?.join(',') ?? '',
              coordinateKey(waypoint.coordinates),
              ...('curatedPathFromPrevious' in waypoint
                ? (waypoint.curatedPathFromPrevious ?? []).map(
                    coordinateKey,
                  )
                : []),
            ],
          ),
          thread.travelModeToAnchor,
          thread.transitModesToAnchor?.join(',') ?? '',
          coordinateKey(destination),
        ].join('|')
      : ''

  const requests = useMemo(() => {
    if (!canRequest || !thread || !destination) return undefined

    return planThreadRoute(thread, origin, destination)
  }, [canRequest, destination, origin, thread])

  const [result, setResult] = useState<RouteResult>({
    key: '',
    state: { status: 'idle' },
  })

  useEffect(() => {
    if (!gateway || !requests || !requestKey) return

    let active = true
    Promise.all(
      requests.map(async (request) => {
        try {
          return {
            request,
            response: await gateway.computeRoute(request.input),
          }
        } catch {
          if (
            request.fallbackSource !== 'curated' &&
            canUseRoadAlignedFallback(request.input)
          ) {
            try {
              return {
                request,
                response: undefined,
                estimatedResponse: await gateway.computeRoute(
                  asRoadAlignedFallback(request.input),
                ),
              }
            } catch {
              // The composed connector remains as the final fallback.
            }
          }

          return {
            request,
            response: undefined,
            estimatedResponse: undefined,
          }
        }
      }),
    ).then((responses) => {
      if (!active) return
      const hasRouteGeometry = responses.some(
        ({ request, response, estimatedResponse }) =>
          response ||
          estimatedResponse ||
          request.fallbackSource === 'curated',
      )

      if (!hasRouteGeometry) {
        setResult({ key: requestKey, state: { status: 'static' } })
        return
      }

      setResult({
        key: requestKey,
        state: {
          status: 'live',
          overlay: buildThreadRouteOverlay(responses),
        },
      })
    })

    return () => {
      active = false
    }
  }, [gateway, requests, requestKey])

  if (!thread) return { status: 'idle' }
  if (!canRequest) return { status: 'static' }
  if (result.key === requestKey) return result.state
  return { status: 'loading' }
}
