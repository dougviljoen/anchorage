export type LatLng = {
  latitude: number
  longitude: number
}

export type RouteTravelMode = 'WALK' | 'DRIVE' | 'BICYCLE' | 'TRANSIT'
export type TransitTravelMode =
  | 'BUS'
  | 'SUBWAY'
  | 'TRAIN'
  | 'LIGHT_RAIL'
  | 'RAIL'

export type ComputeRouteRequest = {
  origin: LatLng
  destination: LatLng
  intermediates: LatLng[]
  travelMode: RouteTravelMode
  languageCode: string
  departureTime?: string
  transitPreference?: 'LESS_WALKING' | 'FEWER_TRANSFERS'
  transitModes: TransitTravelMode[]
}

export type SearchPlacesRequest = {
  query: string
  center?: LatLng
  radiusMeters?: number
  routePolyline?: string
  pageSize: number
  openNow?: boolean
  includedType?: string
  minRating?: number
  languageCode: string
  regionCode?: string
  detailLevel: 'discovery' | 'operational'
}

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RequestValidationError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const parseLatLng = (value: unknown, field: string): LatLng => {
  if (!isRecord(value)) {
    throw new RequestValidationError(`${field} must be a coordinate`)
  }

  const latitude = value.latitude
  const longitude = value.longitude

  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new RequestValidationError(`${field}.latitude is invalid`)
  }

  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new RequestValidationError(`${field}.longitude is invalid`)
  }

  return { latitude, longitude }
}

const parseLanguageCode = (value: unknown) => {
  if (value === undefined) return 'en'
  if (
    typeof value !== 'string' ||
    !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value)
  ) {
    throw new RequestValidationError('languageCode is invalid')
  }
  return value
}

const transitTravelModes = new Set<TransitTravelMode>([
  'BUS',
  'SUBWAY',
  'TRAIN',
  'LIGHT_RAIL',
  'RAIL',
])

export function parseComputeRouteRequest(
  value: unknown,
): ComputeRouteRequest {
  if (!isRecord(value)) {
    throw new RequestValidationError('Request body must be an object')
  }

  const travelMode = value.travelMode ?? 'WALK'
  if (
    travelMode !== 'WALK' &&
    travelMode !== 'DRIVE' &&
    travelMode !== 'BICYCLE' &&
    travelMode !== 'TRANSIT'
  ) {
    throw new RequestValidationError('travelMode is invalid')
  }

  const intermediatesValue = value.intermediates ?? []
  if (!Array.isArray(intermediatesValue)) {
    throw new RequestValidationError('intermediates must be an array')
  }
  if (intermediatesValue.length > 10) {
    throw new RequestValidationError('At most 10 intermediates are supported')
  }
  if (travelMode === 'TRANSIT' && intermediatesValue.length > 0) {
    throw new RequestValidationError(
      'Transit routes do not support intermediate stops',
    )
  }

  const departureTime = value.departureTime
  if (
    departureTime !== undefined &&
    (typeof departureTime !== 'string' ||
      !Number.isFinite(Date.parse(departureTime)))
  ) {
    throw new RequestValidationError('departureTime is invalid')
  }

  const transitPreference = value.transitPreference
  if (
    transitPreference !== undefined &&
    transitPreference !== 'LESS_WALKING' &&
    transitPreference !== 'FEWER_TRANSFERS'
  ) {
    throw new RequestValidationError('transitPreference is invalid')
  }
  if (transitPreference && travelMode !== 'TRANSIT') {
    throw new RequestValidationError(
      'transitPreference requires TRANSIT travel mode',
    )
  }

  const transitModesValue = value.transitModes ?? []
  if (!Array.isArray(transitModesValue)) {
    throw new RequestValidationError('transitModes must be an array')
  }
  if (
    transitModesValue.length > transitTravelModes.size ||
    transitModesValue.some(
      (mode) =>
        typeof mode !== 'string' ||
        !transitTravelModes.has(mode as TransitTravelMode),
    )
  ) {
    throw new RequestValidationError('transitModes contains an invalid mode')
  }
  const transitModes = [
    ...new Set(transitModesValue as TransitTravelMode[]),
  ]
  if (transitModes.length > 0 && travelMode !== 'TRANSIT') {
    throw new RequestValidationError(
      'transitModes requires TRANSIT travel mode',
    )
  }

  return {
    origin: parseLatLng(value.origin, 'origin'),
    destination: parseLatLng(value.destination, 'destination'),
    intermediates: intermediatesValue.map((coordinate, index) =>
      parseLatLng(coordinate, `intermediates[${index}]`),
    ),
    travelMode,
    languageCode: parseLanguageCode(value.languageCode),
    departureTime,
    transitPreference,
    transitModes,
  }
}

export function parseSearchPlacesRequest(
  value: unknown,
): SearchPlacesRequest {
  if (!isRecord(value)) {
    throw new RequestValidationError('Request body must be an object')
  }

  const query = value.query
  if (
    typeof query !== 'string' ||
    query.trim().length < 2 ||
    query.trim().length > 120
  ) {
    throw new RequestValidationError(
      'query must be between 2 and 120 characters',
    )
  }

  const routePolyline = value.routePolyline
  if (
    routePolyline !== undefined &&
    (typeof routePolyline !== 'string' ||
      routePolyline.length < 8 ||
      routePolyline.length > 20_000)
  ) {
    throw new RequestValidationError('routePolyline is invalid')
  }

  const center =
    value.center === undefined
      ? undefined
      : parseLatLng(value.center, 'center')
  if (center && routePolyline) {
    throw new RequestValidationError(
      'Use either center or routePolyline, not both',
    )
  }
  if (!center && !routePolyline) {
    throw new RequestValidationError(
      'A center or routePolyline is required',
    )
  }

  const radiusMeters = value.radiusMeters ?? 2_000
  if (
    typeof radiusMeters !== 'number' ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters < 50 ||
    radiusMeters > 50_000
  ) {
    throw new RequestValidationError(
      'radiusMeters must be between 50 and 50000',
    )
  }

  const pageSize = value.pageSize ?? 6
  if (
    typeof pageSize !== 'number' ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 10
  ) {
    throw new RequestValidationError('pageSize must be between 1 and 10')
  }

  const includedType = value.includedType
  if (
    includedType !== undefined &&
    (typeof includedType !== 'string' ||
      !/^[a-z][a-z0-9_]{1,62}$/.test(includedType))
  ) {
    throw new RequestValidationError('includedType is invalid')
  }

  const minRating = value.minRating
  if (
    minRating !== undefined &&
    (typeof minRating !== 'number' ||
      !Number.isFinite(minRating) ||
      minRating < 0 ||
      minRating > 5)
  ) {
    throw new RequestValidationError('minRating must be between 0 and 5')
  }

  const openNow = value.openNow
  if (openNow !== undefined && typeof openNow !== 'boolean') {
    throw new RequestValidationError('openNow must be a boolean')
  }

  const regionCode = value.regionCode
  if (
    regionCode !== undefined &&
    (typeof regionCode !== 'string' || !/^[A-Z]{2}$/.test(regionCode))
  ) {
    throw new RequestValidationError('regionCode is invalid')
  }

  const detailLevel = value.detailLevel ?? 'discovery'
  if (detailLevel !== 'discovery' && detailLevel !== 'operational') {
    throw new RequestValidationError('detailLevel is invalid')
  }

  return {
    query: query.trim(),
    center,
    radiusMeters,
    routePolyline,
    pageSize,
    openNow,
    includedType,
    minRating,
    languageCode: parseLanguageCode(value.languageCode),
    regionCode,
    detailLevel,
  }
}
