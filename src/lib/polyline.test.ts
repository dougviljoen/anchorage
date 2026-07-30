import { describe, expect, it } from 'vitest'
import { decodePolyline } from './polyline'

describe('decodePolyline', () => {
  it('decodes the canonical Google encoded polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ])
  })

  it('accepts an empty path', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('rejects truncated paths', () => {
    expect(() => decodePolyline('_p~iF')).toThrow('Invalid encoded polyline')
  })
})
