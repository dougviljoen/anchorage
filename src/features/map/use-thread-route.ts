import { useEffect, useMemo, useState } from 'react'
import type { Anchor, Coordinates, Thread } from '../../domain/types'
import {
  getTravelIntelligenceGateway,
  type ComputeRouteInput,
} from '../../services/travel-intelligence'
import { buildThreadRouteOverlay } from './route-overlay'
import type { ThreadRouteState } from './map-types'

type RouteResult = {
  key: string
  state: ThreadRouteState
}

const isMixedModeThread = (thread: Thread) =>
  thread.tags.some((tag) => /\b(train|rail|bus|ferry)\b/i.test(tag)) ||
  thread.stops.some((stop) =>
    /\b(train|rail|bus|ferry)\b/i.test(stop.category),
  )

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
    Boolean(gateway) &&
    !isMixedModeThread(thread as Thread)

  const requestKey =
    thread && destination
      ? [
          thread.id,
          coordinateKey(origin),
          ...thread.stops.map((stop) => coordinateKey(stop.coordinates)),
          coordinateKey(destination),
        ].join('|')
      : ''

  const request = useMemo<ComputeRouteInput | undefined>(() => {
    if (!canRequest || !thread || !destination) return undefined

    return {
      origin,
      destination,
      intermediates: thread.stops.map((stop) => stop.coordinates),
      travelMode: 'WALK',
      languageCode: 'en',
    }
  }, [canRequest, destination, origin, thread])

  const [result, setResult] = useState<RouteResult>({
    key: '',
    state: { status: 'idle' },
  })

  useEffect(() => {
    if (!gateway || !request || !requestKey) return

    let active = true
    gateway
      .computeRoute(request)
      .then((response) => {
        if (!active) return
        setResult({
          key: requestKey,
          state: {
            status: 'live',
            overlay: buildThreadRouteOverlay(
              response.route,
              response.fetchedAt,
            ),
          },
        })
      })
      .catch(() => {
        if (!active) return
        setResult({ key: requestKey, state: { status: 'static' } })
      })

    return () => {
      active = false
    }
  }, [gateway, request, requestKey])

  if (!thread) return { status: 'idle' }
  if (!canRequest) return { status: 'static' }
  if (result.key === requestKey) return result.state
  return { status: 'loading' }
}
