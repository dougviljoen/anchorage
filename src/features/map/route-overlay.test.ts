import { describe, expect, it } from 'vitest'
import type { ThreadRouteRequest } from './thread-route-plan'
import { buildThreadRouteOverlay } from './route-overlay'

const walkingRequest: ThreadRouteRequest = {
  input: {
    origin: { latitude: 38.5, longitude: -120.2 },
    destination: { latitude: 40.701, longitude: -120.951 },
    travelMode: 'WALK',
  },
  fallbackPath: [
    { latitude: 38.5, longitude: -120.2 },
    { latitude: 40.701, longitude: -120.951 },
  ],
  fallbackSource: 'estimated',
  travelMode: 'WALK',
}

const transitRequest: ThreadRouteRequest = {
  input: {
    origin: { latitude: 40.7, longitude: -120.95 },
    destination: { latitude: 43.252, longitude: -126.453 },
    travelMode: 'TRANSIT',
    transitModes: ['TRAIN'],
  },
  fallbackPath: [
    { latitude: 40.7, longitude: -120.95 },
    { latitude: 42, longitude: -123 },
    { latitude: 43.252, longitude: -126.453 },
  ],
  fallbackSource: 'curated',
  travelMode: 'TRANSIT',
}

describe('buildThreadRouteOverlay', () => {
  it('keeps source-verified transit visible without calling it live', () => {
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
            legs: [
              {
                distanceMeters: 1_200,
                durationSeconds: 900,
                encodedPolyline: '_p~iF~ps|U_ulLnnqC',
                steps: [
                  {
                    distanceMeters: 200,
                    durationSeconds: 160,
                    encodedPolyline: '',
                    start: walkingRequest.input.origin,
                    instruction: 'Head north on 東大通り',
                    travelMode: 'WALK',
                  },
                  {
                    distanceMeters: 500,
                    durationSeconds: 380,
                    encodedPolyline: '',
                    start: {
                      latitude: 39.5,
                      longitude: -120.5,
                    },
                    instruction:
                      'Continue on Higashi Avenue for 500 m',
                    travelMode: 'WALK',
                  },
                ],
              },
            ],
          },
        },
      },
      { request: transitRequest },
    ])

    expect(overlay.fullyLive).toBe(false)
    expect(overlay.liveModes).toEqual(['WALK'])
    expect(overlay.curatedModes).toEqual(['TRANSIT'])
    expect(overlay.estimatedModes).toEqual([])
    expect(overlay.segments.map((segment) => segment.source)).toEqual([
      'live',
      'curated',
    ])
    expect(overlay.segments[0].path.at(-1)).toEqual(
      walkingRequest.input.destination,
    )
    expect(overlay.segments[1].path).toHaveLength(3)
    expect(overlay.segments[1].transitModes).toEqual(['TRAIN'])
    expect(overlay.annotations.map(({ label }) => label)).toEqual([
      'Higashi Avenue',
    ])
  })

  it('collapses a live out-and-back walk into one bidirectional path', () => {
    const request: ThreadRouteRequest = {
      ...walkingRequest,
      input: {
        ...walkingRequest.input,
        destination: walkingRequest.input.origin,
        intermediates: [
          { latitude: 40.7, longitude: -120.95 },
        ],
      },
      fallbackPath: [
        walkingRequest.input.origin,
        { latitude: 40.7, longitude: -120.95 },
        walkingRequest.input.origin,
      ],
    }
    const overlay = buildThreadRouteOverlay([
      {
        request,
        response: {
          provider: 'google',
          fetchedAt: '2026-07-30T04:00:00Z',
          route: {
            distanceMeters: 2_400,
            durationSeconds: 1_800,
            encodedPolyline: '_p~iF~ps|U_ulLnnqC',
            legs: [
              {
                distanceMeters: 1_200,
                durationSeconds: 900,
                encodedPolyline: '_p~iF~ps|U_ulLnnqC',
                steps: [],
              },
              {
                distanceMeters: 1_200,
                durationSeconds: 900,
                encodedPolyline: '_flwFn`faV~tlLonqC',
                steps: [],
              },
            ],
          },
        },
      },
    ])

    expect(overlay.segments).toHaveLength(1)
    expect(overlay.segments[0]).toMatchObject({
      travelMode: 'WALK',
      source: 'live',
      roundTrip: true,
    })
    expect(overlay.roundTripModes).toEqual(['WALK'])
  })

  it('collapses reciprocal curated train legs', () => {
    const returnRequest: ThreadRouteRequest = {
      ...transitRequest,
      input: {
        ...transitRequest.input,
        origin: transitRequest.input.destination,
        destination: transitRequest.input.origin,
      },
      fallbackPath: [...transitRequest.fallbackPath].reverse(),
    }
    const overlay = buildThreadRouteOverlay([
      { request: transitRequest },
      { request: returnRequest },
    ])

    expect(overlay.segments).toHaveLength(1)
    expect(overlay.segments[0]).toMatchObject({
      travelMode: 'TRANSIT',
      transitModes: ['TRAIN'],
      source: 'curated',
      roundTrip: true,
    })
    expect(overlay.roundTripModes).toEqual(['TRANSIT'])
  })

  it('uses road-aligned provider geometry only as an estimated bus path', () => {
    const busRequest: ThreadRouteRequest = {
      ...transitRequest,
      input: {
        ...transitRequest.input,
        transitModes: ['BUS'],
      },
      fallbackPath: [
        { latitude: 40.7, longitude: -120.95 },
        { latitude: 43.252, longitude: -126.453 },
      ],
      fallbackSource: 'estimated',
    }
    const overlay = buildThreadRouteOverlay([
      {
        request: busRequest,
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
    expect(overlay.liveModes).toEqual([])
    expect(overlay.curatedModes).toEqual([])
    expect(overlay.estimatedModes).toEqual(['TRANSIT'])
    expect(overlay.segments[0]).toMatchObject({
      source: 'estimated',
      transitModes: ['BUS'],
    })
    expect(overlay.segments[0].path).toHaveLength(4)
    expect(overlay.segments[0].path[0]).toEqual(busRequest.input.origin)
    expect(overlay.segments[0].path.at(-1)).toEqual(
      busRequest.input.destination,
    )
  })
})
