import { describe, expect, it } from 'vitest'
import type { ThreadRouteRequest } from './thread-route-plan'
import { buildThreadRouteOverlay } from './route-overlay'

const walkingRequest: ThreadRouteRequest = {
  input: {
    origin: { latitude: 38.5, longitude: -120.2 },
    destination: { latitude: 40.7, longitude: -120.95 },
    travelMode: 'WALK',
  },
  fallbackPath: [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.7, longitude: -120.95 },
  ],
  travelMode: 'WALK',
}

const transitRequest: ThreadRouteRequest = {
  input: {
    origin: { latitude: 40.7, longitude: -120.95 },
    destination: { latitude: 43.252, longitude: -126.453 },
    travelMode: 'TRANSIT',
  },
  fallbackPath: [
    { latitude: 40.7, longitude: -120.95 },
    { latitude: 43.252, longitude: -126.453 },
  ],
  travelMode: 'TRANSIT',
}

describe('buildThreadRouteOverlay', () => {
  it('keeps unavailable transit visible without calling it live', () => {
    const overlay = buildThreadRouteOverlay([
      {
        request: walkingRequest,
        response: {
          provider: 'google',
          fetchedAt: '2026-07-30T04:00:00Z',
          route: {
            distanceMeters: 1_200,
            durationSeconds: 900,
            encodedPolyline: '_p~iF~ps|U_ulLnnqC',
            legs: [],
          },
        },
      },
      {
        request: transitRequest,
        estimatedResponse: {
          provider: 'google',
          fetchedAt: '2026-07-30T04:00:01Z',
          route: {
            distanceMeters: 5_600,
            durationSeconds: 1_200,
            encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
            legs: [],
          },
        },
      },
    ])

    expect(overlay.fullyLive).toBe(false)
    expect(overlay.liveModes).toEqual(['WALK'])
    expect(overlay.estimatedModes).toEqual(['TRANSIT'])
    expect(overlay.segments.map((segment) => segment.source)).toEqual([
      'live',
      'estimated',
    ])
    expect(overlay.segments[1].path).toHaveLength(3)
  })
})
