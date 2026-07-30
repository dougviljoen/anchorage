import type { Coordinates } from '../../domain/types'

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

export type ThreadRouteOverlay = {
  path: Coordinates[]
  annotations: RouteAnnotation[]
  encodedPolyline: string
  distanceMeters: number
  durationMinutes: number
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
