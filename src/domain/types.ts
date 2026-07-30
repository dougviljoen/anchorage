export type Id = string

export type Coordinates = {
  latitude: number
  longitude: number
}

export type Confidence = 'verified' | 'strong' | 'estimated'

export type Evidence = {
  label: string
  sourceUrl: string
  verifiedAt: string
  confidence: Confidence
}

export type AnchorKind =
  | 'stay'
  | 'reservation'
  | 'transport'
  | 'intention'

export type Anchor = {
  id: Id
  kind: AnchorKind
  title: string
  detail: string
  startsAt: string
  endsAt?: string
  locationName: string
  coordinates?: Coordinates
  fixed: boolean
}

export type Base = {
  id: Id
  city: string
  region: string
  stayName: string
  startsOn: string
  endsOn: string
  nights: number
  coordinates: Coordinates
}

export type Trip = {
  id: Id
  name: string
  country: string
  startsOn: string
  endsOn: string
  currentBaseId: Id
  bases: Base[]
}

export type WeatherContext = {
  temperatureC: number
  condition: string
  precipitationNow: boolean
  clearsAt?: string
  sunsetAt: string
}

export type DayContext = {
  observedAt: string
  locationName: string
  coordinates: Coordinates
  weather: WeatherContext
  energy: Energy
  nextAnchor: Anchor
  minutesUntilAnchor: number
}

export type Energy = 'quiet' | 'open' | 'full'
export type ThreadMode = 'drift' | 'follow' | 'go'
export type Atmosphere = 'quiet' | 'settled' | 'lively'
export type ThreadPalette = 'clay' | 'moss' | 'indigo'
export type TravelMode = 'WALK' | 'DRIVE' | 'BICYCLE' | 'TRANSIT'
export type TransitMode =
  | 'BUS'
  | 'SUBWAY'
  | 'TRAIN'
  | 'LIGHT_RAIL'
  | 'RAIL'

export type ThreadStop = {
  id: Id
  order: number
  title: string
  category: string
  travelModeFromPrevious: TravelMode
  transitModesFromPrevious?: TransitMode[]
  durationMinutes: number
  travelMinutesFromPrevious: number
  note: string
  openingNote: string
  coordinates: Coordinates
  evidence: Evidence[]
}

export type ThreadRouteWaypoint = {
  id: Id
  coordinates: Coordinates
  travelModeFromPrevious: TravelMode
  transitModesFromPrevious?: TransitMode[]
  curatedPathFromPrevious?: Coordinates[]
}

export type ThreadReturnPlan =
  | {
      kind: 'retrace'
      turnaroundStopId: Id
      summary: string
    }
  | {
      kind: 'loop' | 'alternate' | 'open-ended'
      summary: string
    }

export type PhraseCard = {
  id: Id
  context: string
  english: string
  japanese: string
  romanized: string
}

export type Thread = {
  id: Id
  mode: ThreadMode
  title: string
  eyebrow: string
  summary: string
  whyNow: string
  durationMinutes: number
  walkingMinutes: number
  walkingKm: number
  costYen: number
  atmosphere: Atmosphere
  energy: Energy
  weatherNote: string
  returnNote: string
  fallback: string
  palette: ThreadPalette
  tags: string[]
  stops: ThreadStop[]
  routeWaypoints?: ThreadRouteWaypoint[]
  returnPlan?: ThreadReturnPlan
  travelModeToAnchor: TravelMode
  transitModesToAnchor?: TransitMode[]
  phrases: PhraseCard[]
  evidence: Evidence[]
}

export type RadarSignal = {
  id: Id
  title: string
  body: string
  actionLabel: string
  threadId?: Id
  expiresAt: string
  relevance: number
  urgency: number
  convenience: number
  confidence: Confidence
}

export type JournalEntry = {
  id: Id
  occurredAt: string
  place: string
  observation: string
  object?: string
  palette: ThreadPalette
  coordinates?: Coordinates
}

export type TodaySnapshot = {
  trip: Trip
  context: DayContext
  radar: RadarSignal | null
  threads: Thread[]
  anchors: Anchor[]
  journal: JournalEntry[]
}
