import { describe, expect, it } from 'vitest'
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
})
