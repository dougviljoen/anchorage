import { useEffect, useMemo, useState } from 'react'
import type { Anchor, Coordinates, Thread } from '../../domain/types'
import { getTravelIntelligenceGateway } from '../../services/travel-intelligence'
import { buildThreadRouteOverlay } from './route-overlay'
import type { ThreadRouteState } from './map-types'
import { planThreadRoute } from './thread-route-plan'

type RouteResult = {
  key: string
  state: ThreadRouteState
}

const coordinateKey = ({ latitude, longitude }: Coordinates) =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}`

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
          ...thread.stops.flatMap((stop) => [
            stop.travelModeFromPrevious,
            coordinateKey(stop.coordinates),
          ]),
          thread.travelModeToAnchor,
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
          return { request, response: undefined }
        }
      }),
    ).then((responses) => {
      if (!active) return
      const hasLiveSegment = responses.some((response) => response.response)

      if (!hasLiveSegment) {
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
