import { z } from 'zod'
import type {
  Coordinates,
  TransitMode,
  TravelMode,
} from '../domain/types'
import {
  getSupabaseBrowserClient,
  hasSupabaseFunctions,
} from './supabase-client'

const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

const routeStepSchema = z.object({
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  encodedPolyline: z.string(),
  start: coordinatesSchema.optional(),
  end: coordinatesSchema.optional(),
  instruction: z.string().optional(),
  maneuver: z.string().optional(),
  travelMode: z.string(),
  transit: z
    .object({
      departureStop: z.string().optional(),
      arrivalStop: z.string().optional(),
      departureTime: z.string().optional(),
      arrivalTime: z.string().optional(),
      lineName: z.string().optional(),
      headsign: z.string().optional(),
      stopCount: z.number().optional(),
      vehicleType: z.string().optional(),
    })
    .optional(),
})

const routeResponseSchema = z.object({
  provider: z.literal('google'),
  fetchedAt: z.string(),
  route: z.object({
    distanceMeters: z.number().nonnegative(),
    durationSeconds: z.number().nonnegative(),
    encodedPolyline: z.string().min(1),
    legs: z.array(
      z.object({
        distanceMeters: z.number().nonnegative(),
        durationSeconds: z.number().nonnegative(),
        encodedPolyline: z.string(),
        steps: z.array(routeStepSchema),
      }),
    ),
  }),
})

const placeResponseSchema = z.object({
  provider: z.literal('google'),
  fetchedAt: z.string(),
  places: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      languageCode: z.string().optional(),
      formattedAddress: z.string().optional(),
      shortAddress: z.string().optional(),
      location: coordinatesSchema,
      primaryType: z.string().optional(),
      category: z.string().optional(),
      businessStatus: z.string().optional(),
      googleMapsUri: z.string().optional(),
      websiteUri: z.string().optional(),
      priceLevel: z.string().optional(),
      rating: z.number().optional(),
      userRatingCount: z.number().optional(),
      utcOffsetMinutes: z.number().optional(),
      openingHours: z
        .object({
          openNow: z.boolean().optional(),
          nextOpenTime: z.string().optional(),
          nextCloseTime: z.string().optional(),
          weekdayDescriptions: z.array(z.string()),
        })
        .optional(),
    }),
  ),
})

export type LiveRouteResponse = z.infer<typeof routeResponseSchema>
export type LiveRoute = LiveRouteResponse['route']
export type LiveRouteStep = z.infer<typeof routeStepSchema>
export type DiscoveredPlace = z.infer<
  typeof placeResponseSchema
>['places'][number]

export type ComputeRouteInput = {
  origin: Coordinates
  destination: Coordinates
  intermediates?: Coordinates[]
  travelMode?: TravelMode
  transitModes?: TransitMode[]
  languageCode?: string
  departureTime?: string
  transitPreference?: 'LESS_WALKING' | 'FEWER_TRANSFERS'
}

export type SearchPlacesInput = {
  query: string
  center?: Coordinates
  radiusMeters?: number
  routePolyline?: string
  pageSize?: number
  openNow?: boolean
  includedType?: string
  minRating?: number
  languageCode?: string
  regionCode?: string
  detailLevel?: 'discovery' | 'operational'
}

export class TravelIntelligenceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TravelIntelligenceError'
  }
}

export class TravelIntelligenceGateway {
  async computeRoute(input: ComputeRouteInput): Promise<LiveRouteResponse> {
    const client = getSupabaseBrowserClient()
    if (!client) {
      throw new TravelIntelligenceError(
        'Supabase function credentials are unavailable.',
      )
    }

    const { data, error } = await client.functions.invoke('compute-route', {
      body: input,
    })
    if (error) {
      throw new TravelIntelligenceError(
        'The route service is unavailable.',
        error,
      )
    }

    const parsed = routeResponseSchema.safeParse(data)
    if (!parsed.success) {
      throw new TravelIntelligenceError(
        'The route service returned an invalid response.',
        parsed.error,
      )
    }

    return parsed.data
  }

  async searchPlaces(input: SearchPlacesInput): Promise<DiscoveredPlace[]> {
    const client = getSupabaseBrowserClient()
    if (!client) {
      throw new TravelIntelligenceError(
        'Supabase function credentials are unavailable.',
      )
    }

    const { data, error } = await client.functions.invoke('search-places', {
      body: input,
    })
    if (error) {
      throw new TravelIntelligenceError(
        'The place service is unavailable.',
        error,
      )
    }

    const parsed = placeResponseSchema.safeParse(data)
    if (!parsed.success) {
      throw new TravelIntelligenceError(
        'The place service returned an invalid response.',
        parsed.error,
      )
    }

    return parsed.data.places
  }
}

let gateway: TravelIntelligenceGateway | undefined

export function getTravelIntelligenceGateway() {
  if (!hasSupabaseFunctions) return undefined
  gateway ??= new TravelIntelligenceGateway()
  return gateway
}
