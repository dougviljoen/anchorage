import { decodePolyline } from '../../lib/polyline'
import type { LiveRoute, LiveRouteStep } from '../../services/travel-intelligence'
import type {
  RouteAnnotation,
  ThreadRouteOverlay,
} from './map-types'

const maximumAnnotations = 4

const conciseInstruction = (instruction: string) => {
  const routeName = instruction.match(
    /\b(?:onto|toward|on)\s+(.+?)(?:\s+for\s+|\s*\/|$)/i,
  )?.[1]
  const label = (routeName ?? instruction)
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]$/, '')
    .trim()

  return label.length > 42 ? `${label.slice(0, 39).trimEnd()}…` : label
}

const chooseAnnotations = (steps: LiveRouteStep[]): RouteAnnotation[] => {
  const seen = new Set<string>()
  const candidates = steps.flatMap((step) => {
    if (!step.instruction || !step.start || step.distanceMeters < 35) return []
    if (/\bdestination\b/i.test(step.instruction)) return []

    const label = conciseInstruction(step.instruction)
    const identity = label.toLocaleLowerCase()
    if (!label || seen.has(identity)) return []
    seen.add(identity)

    return [{ coordinates: step.start, label }]
  })

  if (candidates.length <= maximumAnnotations) return candidates

  return Array.from({ length: maximumAnnotations }, (_, index) => {
    const candidateIndex = Math.round(
      (index * (candidates.length - 1)) / (maximumAnnotations - 1),
    )
    return candidates[candidateIndex]
  })
}

export function buildThreadRouteOverlay(
  route: LiveRoute,
  fetchedAt: string,
): ThreadRouteOverlay {
  const path = decodePolyline(route.encodedPolyline)
  if (path.length < 2) {
    throw new Error('The live route did not contain a usable path.')
  }

  const steps = route.legs.flatMap((leg) => leg.steps)
  return {
    path,
    annotations: chooseAnnotations(steps),
    encodedPolyline: route.encodedPolyline,
    distanceMeters: route.distanceMeters,
    durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
    fetchedAt,
  }
}
