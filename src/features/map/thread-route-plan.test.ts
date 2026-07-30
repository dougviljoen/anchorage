import { describe, expect, it } from 'vitest'
import { demoToday } from '../../data/demo/today'
import type { Thread } from '../../domain/types'
import { planThreadRoute } from './thread-route-plan'

const point = (offset: number) => ({
  latitude: 36.57 + offset,
  longitude: 136.66 + offset,
})

const thread = {
  stops: [1, 2, 3].map((index) => ({
    coordinates: point(index / 100),
    travelModeFromPrevious: 'WALK',
  })),
  travelModeToAnchor: 'WALK',
} as Thread

describe('planThreadRoute', () => {
  it('keeps a continuous walking thread to one route request', () => {
    const requests = planThreadRoute(thread, point(0), point(0.05))

    expect(requests).toHaveLength(1)
    expect(requests[0].input).toMatchObject({
      travelMode: 'WALK',
      intermediates: [point(0.01), point(0.02), point(0.03)],
    })
    expect(requests[0].fallbackSource).toBe('estimated')
  })

  it('splits transit into waypoint-free requests and preserves walking runs', () => {
    const requests = planThreadRoute(
      {
        ...thread,
        stops: [
          { ...thread.stops[0], travelModeFromPrevious: 'TRANSIT' },
          {
            ...thread.stops[1],
            travelModeFromPrevious: 'TRANSIT',
            transitModesFromPrevious: ['TRAIN'],
          },
          { ...thread.stops[2], travelModeFromPrevious: 'WALK' },
        ],
        travelModeToAnchor: 'TRANSIT',
      },
      point(0),
      point(0.05),
    )

    expect(requests.map((request) => request.travelMode)).toEqual([
      'TRANSIT',
      'TRANSIT',
      'WALK',
      'TRANSIT',
    ])
    expect(
      requests
        .filter((request) => request.travelMode === 'TRANSIT')
        .every((request) => request.input.intermediates === undefined),
    ).toBe(true)
    expect(requests[1].input.transitModes).toEqual(['TRAIN'])
  })

  it('uses explicit logistics and a curated rail trace when provided', () => {
    const railPath = [point(0.015), point(0.018)]
    const requests = planThreadRoute(
      {
        ...thread,
        routeWaypoints: [
          {
            id: 'station',
            coordinates: point(0.01),
            travelModeFromPrevious: 'WALK',
          },
          {
            id: 'final-stop',
            coordinates: point(0.02),
            travelModeFromPrevious: 'TRANSIT',
            transitModesFromPrevious: ['TRAIN'],
            curatedPathFromPrevious: railPath,
          },
        ],
      },
      point(0),
      point(0.05),
    )

    expect(requests).toHaveLength(3)
    expect(requests[1]).toMatchObject({
      fallbackSource: 'curated',
      travelMode: 'TRANSIT',
      fallbackPath: [
        point(0.01),
        ...railPath,
        point(0.02),
      ],
    })
  })

  it('keeps the Asanogawa train on detailed rail geometry', () => {
    const thread = demoToday.threads.find(
      ({ id }) => id === 'sea-at-the-end',
    )
    const destination = demoToday.context.nextAnchor.coordinates

    expect(thread).toBeDefined()
    expect(destination).toBeDefined()
    if (!thread || !destination) return

    const trainRequests = planThreadRoute(
      thread,
      demoToday.context.coordinates,
      destination,
    ).filter(
      (request) =>
        request.travelMode === 'TRANSIT' &&
        request.input.transitModes?.includes('TRAIN'),
    )

    expect(trainRequests).toHaveLength(2)
    expect(
      trainRequests.every(
        (request) =>
          request.fallbackSource === 'curated' &&
          request.fallbackPath.length > 60,
      ),
    ).toBe(true)
  })
})
