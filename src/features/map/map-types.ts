import type {
  Coordinates,
  TransitMode,
  TravelMode,
} from '../../domain/types'

export type MapMode = 'field' | 'journey' | 'memories'

export type PositionState = {
  coordinates: Coordinates
  source: 'trip' | 'device'
  accuracyMeters?: number
}

export type RouteAnnotation = {
  coordinates: Coordinates
  label: string
}

export type ThreadRouteSegment = {
  path: Coordinates[]
  travelMode: TravelMode
  transitModes?: TransitMode[]
  source: 'live' | 'curated' | 'estimated'
}

export type ThreadRouteOverlay = {
  segments: ThreadRouteSegment[]
  annotations: RouteAnnotation[]
  encodedPolylines: string[]
  distanceMeters: number
  durationMinutes: number
  liveModes: TravelMode[]
  curatedModes: TravelMode[]
  estimatedModes: TravelMode[]
  fullyLive: boolean
  fetchedAt: string
}

export type ThreadRouteState =
  | { status: 'idle' | 'loading' | 'static' }
  | { status: 'live'; overlay: ThreadRouteOverlay }

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'located'
  | 'unavailable'
