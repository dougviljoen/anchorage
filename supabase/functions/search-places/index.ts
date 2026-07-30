import { withSupabase } from 'npm:@supabase/server@1.4.1'
import {
  parseSearchPlacesRequest,
  RequestValidationError,
  type LatLng,
} from '../_shared/google-contracts.ts'
import {
  methodNotAllowed,
  noStoreJson,
  readJsonBody,
} from '../_shared/http.ts'

const endpoint = 'https://places.googleapis.com/v1/places:searchText'
const discoveryFields = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.businessStatus',
  'places.googleMapsUri',
]
const operationalFields = [
  ...discoveryFields,
  'places.currentOpeningHours',
  'places.regularOpeningHours',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.utcOffsetMinutes',
]

type GoogleOpeningHours = {
  openNow?: boolean
  nextOpenTime?: string
  nextCloseTime?: string
  weekdayDescriptions?: string[]
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: LatLng
  primaryType?: string
  primaryTypeDisplayName?: { text?: string }
  businessStatus?: string
  googleMapsUri?: string
  websiteUri?: string
  priceLevel?: string
  rating?: number
  userRatingCount?: number
  utcOffsetMinutes?: number
  currentOpeningHours?: GoogleOpeningHours
  regularOpeningHours?: GoogleOpeningHours
}

export default {
  fetch: withSupabase(
    { auth: ['user', 'publishable'] },
    async (request: Request) => {
      if (request.method !== 'POST') return methodNotAllowed()

      const requestId = crypto.randomUUID()
      const apiKey = Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY')

      if (!apiKey) {
        return noStoreJson(
          {
            error: {
              code: 'SERVER_NOT_CONFIGURED',
              message: 'Place discovery is not configured.',
              requestId,
            },
          },
          { status: 503 },
        )
      }

      try {
        const input = parseSearchPlacesRequest(await readJsonBody(request))
        const requestBody: Record<string, unknown> = {
          textQuery: input.query,
          pageSize: input.pageSize,
          languageCode: input.languageCode,
        }

        if (input.routePolyline) {
          requestBody.searchAlongRouteParameters = {
            polyline: { encodedPolyline: input.routePolyline },
          }
        } else if (input.center) {
          requestBody.locationBias = {
            circle: {
              center: input.center,
              radius: input.radiusMeters,
            },
          }
        }
        if (input.openNow !== undefined) {
          requestBody.openNow = input.openNow
        }
        if (input.includedType) {
          requestBody.includedType = input.includedType
          requestBody.strictTypeFiltering = true
        }
        if (input.minRating !== undefined) {
          requestBody.minRating = input.minRating
        }
        if (input.regionCode) {
          requestBody.regionCode = input.regionCode
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': (
              input.detailLevel === 'operational'
                ? operationalFields
                : discoveryFields
            ).join(','),
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(12_000),
        })

        const result = (await response.json().catch(() => null)) as {
          places?: GooglePlace[]
          error?: { status?: string }
        } | null

        if (!response.ok) {
          console.error('Google Places request failed', {
            requestId,
            status: response.status,
            providerCode: result?.error?.status,
          })
          return noStoreJson(
            {
              error: {
                code: 'PLACES_PROVIDER_FAILED',
                message: 'Places could not be searched.',
                requestId,
              },
            },
            { status: 502 },
          )
        }

        return noStoreJson({
          provider: 'google',
          fetchedAt: new Date().toISOString(),
          places: (result?.places ?? []).flatMap((place) => {
            if (!place.id || !place.displayName?.text || !place.location) {
              return []
            }

            const opening =
              place.currentOpeningHours ?? place.regularOpeningHours
            return [
              {
                id: place.id,
                name: place.displayName.text,
                languageCode: place.displayName.languageCode,
                formattedAddress: place.formattedAddress,
                shortAddress: place.shortFormattedAddress,
                location: place.location,
                primaryType: place.primaryType,
                category: place.primaryTypeDisplayName?.text,
                businessStatus: place.businessStatus,
                googleMapsUri: place.googleMapsUri,
                websiteUri: place.websiteUri,
                priceLevel: place.priceLevel,
                rating: place.rating,
                userRatingCount: place.userRatingCount,
                utcOffsetMinutes: place.utcOffsetMinutes,
                openingHours: opening
                  ? {
                      openNow: opening.openNow,
                      nextOpenTime: opening.nextOpenTime,
                      nextCloseTime: opening.nextCloseTime,
                      weekdayDescriptions: opening.weekdayDescriptions ?? [],
                    }
                  : undefined,
              },
            ]
          }),
        })
      } catch (error) {
        if (error instanceof RequestValidationError) {
          return noStoreJson(
            {
              error: {
                code: 'INVALID_REQUEST',
                message: error.message,
                requestId,
              },
            },
            { status: 400 },
          )
        }

        const code =
          error instanceof Error ? error.message : 'UNEXPECTED_ERROR'
        const status = code === 'REQUEST_TOO_LARGE' ? 413 : 400
        console.error('Places function rejected a request', {
          requestId,
          code,
        })
        return noStoreJson(
          {
            error: {
              code,
              message: 'The place request could not be processed.',
              requestId,
            },
          },
          { status },
        )
      }
    },
  ),
}
