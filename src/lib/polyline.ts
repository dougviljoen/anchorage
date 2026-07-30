import type { Coordinates } from '../domain/types'

export function decodePolyline(encoded: string): Coordinates[] {
  const coordinates: Coordinates[] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  const decodeValue = () => {
    let result = 0
    let shift = 0
    let byte: number

    do {
      if (index >= encoded.length) {
        throw new Error('Invalid encoded polyline')
      }
      byte = encoded.charCodeAt(index) - 63
      index += 1
      if (byte < 0 || byte > 63) {
        throw new Error('Invalid encoded polyline')
      }
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    latitude += decodeValue()
    longitude += decodeValue()
    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    })
  }

  return coordinates
}
