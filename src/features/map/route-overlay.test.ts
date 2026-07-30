import { describe, expect, it } from 'vitest'
import type { ThreadRouteRequest } from './thread-route-plan'
import { buildThreadRouteOverlay } from './route-overlay'

const encodePolyline = (
  points: Array<{ latitude: number; longitude: number }>,
) => {
  let previousLatitude = 0
  let previousLongitude = 0

  const encodeValue = (value: number) => {
    let encoded = ''
    let shifted = value < 0 ? ~(value << 1) : value << 1

    while (shifted >= 0x20) {
      encoded += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63)
      shifted >>= 5
    }

    return encoded + String.fromCharCode(shifted + 63)
  }

  return points
    .map(({ latitude, longitude }) => {
      const nextLatitude = Math.round(latitude * 100_000)
      const nextLongitude = Math.round(longitude * 100_000)
      const encoded =
        encodeValue(nextLatitude - previousLatitude) +
        encodeValue(nextLongitude - previousLongitude)

      previousLatitude = nextLatitude
      previousLongitude = nextLongitude
      return encoded
    })
    .join('')
}

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
  startLegIndex: 0,
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
  startLegIndex: 1,
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
    expect(overlay.segments.map((segment) => segment.legIndex)).toEqual([
      0,
      1,
    ])
    expect(overlay.segments[0].path.at(-1)).toEqual(
      walkingRequest.input.destination,
    )
    expect(overlay.segments[1].path).toHaveLength(3)
    expect(overlay.segments[1].transitModes).toEqual(['TRAIN'])
  })

  it('collapses a live out-and-back walk into one shared path', () => {
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
      legIndex: 0,
      travelMode: 'WALK',
      source: 'live',
    })

    const fallbackOverlay = buildThreadRouteOverlay([{ request }])
    expect(fallbackOverlay.segments).toHaveLength(1)
    expect(fallbackOverlay.segments[0]).toMatchObject({
      travelMode: 'WALK',
      source: 'estimated',
    })
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
      legIndex: 1,
      travelMode: 'TRANSIT',
      transitModes: ['TRAIN'],
      source: 'curated',
    })
  })

  it('draws a partially merged walking route only once', () => {
    const south = { latitude: 36, longitude: 136 }
    const firstMerge = { latitude: 36.001, longitude: 136 }
    const secondMerge = { latitude: 36.002, longitude: 136 }
    const station = { latitude: 36.003, longitude: 136 }
    const dinner = { latitude: 36.001, longitude: 136.001 }
    const firstMergeOffset = {
      latitude: firstMerge.latitude,
      longitude: firstMerge.longitude + 0.00002,
    }
    const secondMergeOffset = {
      latitude: secondMerge.latitude,
      longitude: secondMerge.longitude + 0.00002,
    }
    const outboundPath = [south, firstMerge, secondMerge, station]
    const returnPath = [
      station,
      secondMergeOffset,
      firstMergeOffset,
      dinner,
    ]
    const outboundRequest: ThreadRouteRequest = {
      input: {
        origin: south,
        destination: station,
        travelMode: 'WALK',
      },
      fallbackPath: [south, station],
      fallbackSource: 'estimated',
      startLegIndex: 0,
      travelMode: 'WALK',
    }
    const returnRequest: ThreadRouteRequest = {
      input: {
        origin: station,
        destination: dinner,
        travelMode: 'WALK',
      },
      fallbackPath: [station, dinner],
      fallbackSource: 'estimated',
      startLegIndex: 1,
      travelMode: 'WALK',
    }
    const asResponse = (
      path: Array<{ latitude: number; longitude: number }>,
    ) => ({
      provider: 'google' as const,
      fetchedAt: '2026-07-30T04:00:00Z',
      route: {
        distanceMeters: 500,
        durationSeconds: 420,
        encodedPolyline: encodePolyline(path),
        legs: [
          {
            distanceMeters: 500,
            durationSeconds: 420,
            encodedPolyline: encodePolyline(path),
            steps: [],
          },
        ],
      },
    })

    const overlay = buildThreadRouteOverlay([
      { request: outboundRequest, response: asResponse(outboundPath) },
      { request: returnRequest, response: asResponse(returnPath) },
    ])

    expect(overlay.segments).toHaveLength(2)
    expect(overlay.segments[0].path).toEqual(outboundPath)
    expect(overlay.segments[1]).toMatchObject({
      legIndex: 1,
      path: [firstMergeOffset, dinner],
    })
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
