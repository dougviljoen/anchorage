import {
  opportunityMargin,
  rankOpportunities,
  scoreOpportunity,
  shouldInterrupt,
  type ScoredOpportunity,
} from './opportunity-engine'

const base: ScoredOpportunity = {
  id: 'base',
  interestMatch: 0.9,
  lastChanceUrgency: 0.8,
  weatherSuitability: 0.8,
  lightQuality: 0.7,
  geographicConvenience: 0.9,
  travelFriction: 0.2,
  expectedCrowding: 0.2,
  arrivalRisk: 0.15,
  evidenceConfidence: 0.95,
  futureBestScore: 45,
}

describe('opportunity engine', () => {
  it('scores every opportunity on a stable 0–100 scale', () => {
    expect(scoreOpportunity(base)).toBeGreaterThan(60)
    expect(
      scoreOpportunity({
        ...base,
        interestMatch: 4,
        weatherSuitability: -2,
      }),
    ).toBeLessThanOrEqual(100)
  })

  it('values a good current window over an equivalent future option', () => {
    expect(opportunityMargin(base)).toBeGreaterThan(18)
    expect(shouldInterrupt(base)).toBe(true)
  })

  it('ranks opportunity margin before generic quality', () => {
    const evergreen = {
      ...base,
      id: 'evergreen',
      lastChanceUrgency: 0.1,
      futureBestScore: 72,
    }

    expect(rankOpportunities([evergreen, base])[0]?.id).toBe('base')
  })

  it('will not interrupt on weak evidence', () => {
    expect(shouldInterrupt({ ...base, evidenceConfidence: 0.4 })).toBe(false)
  })
})
