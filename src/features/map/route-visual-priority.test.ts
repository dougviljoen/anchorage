import { describe, expect, it } from 'vitest'
import { getRouteVisualPriority } from './route-visual-priority'

describe('getRouteVisualPriority', () => {
  it('gives the current leg stronger weight and contrast', () => {
    const current = getRouteVisualPriority(2, 2)
    const upcoming = getRouteVisualPriority(3, 2)

    expect(current.isCurrent).toBe(true)
    expect(current.opacity).toBeGreaterThan(upcoming.opacity)
    expect(current.strokeWeight).toBeGreaterThan(upcoming.strokeWeight)
    expect(current.casingWeight).toBeGreaterThan(upcoming.casingWeight)
    expect(current.zIndex).toBeGreaterThan(upcoming.zIndex)
  })

  it('keeps every upcoming leg equally significant', () => {
    const next = getRouteVisualPriority(3, 2)
    const muchLater = getRouteVisualPriority(12, 2)

    expect(muchLater).toEqual(next)
    expect(next.opacity).toBeGreaterThanOrEqual(0.7)
  })
})
