import { describe, expect, it } from 'vitest'
import {
  parseComputeRouteRequest,
  parseSearchPlacesRequest,
} from '../../supabase/functions/_shared/google-contracts'

const origin = { latitude: 36.5726, longitude: 136.6663 }
const destination = { latitude: 36.5551, longitude: 136.6538 }

describe('Google server request contracts', () => {
  it('normalizes a bounded walking route request', () => {
    expect(
      parseComputeRouteRequest({
        origin,
        destination,
        intermediates: [{ latitude: 36.5712, longitude: 136.6651 }],
      }),
    ).toMatchObject({
      origin,
      destination,
      travelMode: 'WALK',
      languageCode: 'en',
    })
  })

  it('rejects transit requests with intermediate stops', () => {
    expect(() =>
      parseComputeRouteRequest({
        origin,
        destination,
        travelMode: 'TRANSIT',
        intermediates: [origin],
      }),
    ).toThrow('Transit routes do not support intermediate stops')
  })

  it('requires a bounded place-search geography', () => {
    expect(() =>
      parseSearchPlacesRequest({ query: 'kissaten' }),
    ).toThrow('A center or routePolyline is required')
  })

  it('keeps operational place fields an explicit choice', () => {
    expect(
      parseSearchPlacesRequest({
        query: 'ceramics',
        center: origin,
        radiusMeters: 1800,
        detailLevel: 'operational',
      }),
    ).toMatchObject({
      query: 'ceramics',
      center: origin,
      pageSize: 6,
      detailLevel: 'operational',
    })
  })
})
