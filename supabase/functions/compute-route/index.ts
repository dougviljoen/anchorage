import { withSupabase } from 'npm:@supabase/server@1.4.1'
import {
  parseComputeRouteRequest,
  RequestValidationError,
  type LatLng,
} from '../_shared/google-contracts.ts'
import {
  methodNotAllowed,
  noStoreJson,
  readJsonBody,
} from '../_shared/http.ts'

const endpoint = 'https://routes.googleapis.com/directions/v2:computeRoutes'
const fieldMask = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.polyline.encodedPolyline',
  'routes.legs.distanceMeters',
  'routes.legs.duration',
  'routes.legs.polyline.encodedPolyline',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.polyline.encodedPolyline',
  'routes.legs.steps.startLocation',
  'routes.legs.steps.endLocation',
  'routes.legs.steps.navigationInstruction',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.transitDetails',
].join(',')

type GoogleLocation = {
  latLng?: LatLng
}

type GoogleRouteStep = {
  distanceMeters?: number
  staticDuration?: string
  polyline?: { encodedPolyline?: string }
  startLocation?: GoogleLocation
  endLocation?: GoogleLocation
  navigationInstruction?: {
    maneuver?: string
    instructions?: string
  }
  travelMode?: string
  transitDetails?: {
    stopDetails?: {
      arrivalStop?: { name?: string; location?: GoogleLocation }
      departureStop?: { name?: string; location?: GoogleLocation }
      arrivalTime?: string
      departureTime?: string
    }
    transitLine?: {
      name?: string
      nameShort?: string
      color?: string
      textColor?: string
      vehicle?: { name?: { text?: string }; type?: string }
    }
    headsign?: string
    stopCount?: number
  }
}

type GoogleRouteLeg = {
  distanceMeters?: number
  duration?: string
  polyline?: { encodedPolyline?: string }
  steps?: GoogleRouteStep[]
}

type GoogleRoute = {
  distanceMeters?: number
  duration?: string
  polyline?: { encodedPolyline?: string }
  legs?: GoogleRouteLeg[]
}

const asWaypoint = (coordinate: LatLng) => ({
  location: { latLng: coordinate },
})

const durationSeconds = (duration?: string) => {
  if (!duration) return 0
  const seconds = Number(duration.replace(/s$/, ''))
  return Number.isFinite(seconds) ? Math.round(seconds) : 0
}

const normalizeStep = (step: GoogleRouteStep) => ({
  distanceMeters: step.distanceMeters ?? 0,
  durationSeconds: durationSeconds(step.staticDuration),
  encodedPolyline: step.polyline?.encodedPolyline ?? '',
  start: step.startLocation?.latLng,
  end: step.endLocation?.latLng,
  instruction: step.navigationInstruction?.instructions,
  maneuver: step.navigationInstruction?.maneuver,
  travelMode: step.travelMode ?? 'WALK',
  transit: step.transitDetails
    ? {
        departureStop: step.transitDetails.stopDetails?.departureStop?.name,
        arrivalStop: step.transitDetails.stopDetails?.arrivalStop?.name,
        departureTime: step.transitDetails.stopDetails?.departureTime,
        arrivalTime: step.transitDetails.stopDetails?.arrivalTime,
        lineName:
          step.transitDetails.transitLine?.nameShort ??
          step.transitDetails.transitLine?.name,
        headsign: step.transitDetails.headsign,
        stopCount: step.transitDetails.stopCount,
        vehicleType: step.transitDetails.transitLine?.vehicle?.type,
      }
    : undefined,
})

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
              message: 'Route service is not configured.',
              requestId,
            },
          },
          { status: 503 },
        )
      }

      try {
        const input = parseComputeRouteRequest(await readJsonBody(request))
        const requestBody: Record<string, unknown> = {
          origin: asWaypoint(input.origin),
          destination: asWaypoint(input.destination),
          intermediates: input.intermediates.map(asWaypoint),
          travelMode: input.travelMode,
          computeAlternativeRoutes: false,
          languageCode: input.languageCode,
          units: 'METRIC',
          polylineQuality: 'HIGH_QUALITY',
        }

        if (input.departureTime) {
          requestBody.departureTime = input.departureTime
        }
        if (
          input.transitPreference ||
          input.transitModes.length > 0
        ) {
          requestBody.transitPreferences = {
            ...(input.transitPreference
              ? { routingPreference: input.transitPreference }
              : {}),
            ...(input.transitModes.length > 0
              ? { allowedTravelModes: input.transitModes }
              : {}),
          }
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': fieldMask,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(12_000),
        })

        const result = (await response.json().catch(() => null)) as {
          routes?: GoogleRoute[]
          error?: { status?: string }
        } | null

        if (!response.ok) {
          console.error('Google Routes request failed', {
            requestId,
            status: response.status,
            providerCode: result?.error?.status,
          })
          return noStoreJson(
            {
              error: {
                code: 'ROUTE_PROVIDER_FAILED',
                message: 'A route could not be calculated.',
                requestId,
              },
            },
            { status: 502 },
          )
        }

        const route = result?.routes?.[0]
        if (!route?.polyline?.encodedPolyline) {
          return noStoreJson(
            {
              error: {
                code: 'ROUTE_NOT_FOUND',
                message: 'No feasible route was found.',
                requestId,
              },
            },
            { status: 404 },
          )
        }

        return noStoreJson({
          provider: 'google',
          fetchedAt: new Date().toISOString(),
          route: {
            distanceMeters: route.distanceMeters ?? 0,
            durationSeconds: durationSeconds(route.duration),
            encodedPolyline: route.polyline.encodedPolyline,
            legs: (route.legs ?? []).map((leg) => ({
              distanceMeters: leg.distanceMeters ?? 0,
              durationSeconds: durationSeconds(leg.duration),
              encodedPolyline: leg.polyline?.encodedPolyline ?? '',
              steps: (leg.steps ?? []).map(normalizeStep),
            })),
          },
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
        console.error('Route function rejected a request', {
          requestId,
          code,
        })
        return noStoreJson(
          {
            error: {
              code,
              message: 'The route request could not be processed.',
              requestId,
            },
          },
          { status },
        )
      }
    },
  ),
}
