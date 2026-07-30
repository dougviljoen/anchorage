export type RouteVisualPriority = {
  isCurrent: boolean
  opacity: number
  casingOpacity: number
  casingWeight: number
  strokeWeight: number
  zIndex: number
}

export function getRouteVisualPriority(
  legIndex: number,
  activeLegIndex: number,
): RouteVisualPriority {
  const isCurrent = legIndex === activeLegIndex

  return isCurrent
    ? {
        isCurrent,
        opacity: 0.96,
        casingOpacity: 0.98,
        casingWeight: 10,
        strokeWeight: 4.5,
        zIndex: 7,
      }
    : {
        isCurrent,
        opacity: 0.76,
        casingOpacity: 0.9,
        casingWeight: 7.5,
        strokeWeight: 3,
        zIndex: 4,
      }
}
