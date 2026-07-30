export type OpportunityFactors = {
  interestMatch: number
  lastChanceUrgency: number
  weatherSuitability: number
  lightQuality: number
  geographicConvenience: number
  travelFriction: number
  expectedCrowding: number
  arrivalRisk: number
  evidenceConfidence: number
}

export type ScoredOpportunity = OpportunityFactors & {
  id: string
  futureBestScore: number
}

const weights: Record<keyof OpportunityFactors, number> = {
  interestMatch: 0.25,
  lastChanceUrgency: 0.18,
  weatherSuitability: 0.12,
  lightQuality: 0.07,
  geographicConvenience: 0.15,
  travelFriction: -0.08,
  expectedCrowding: -0.06,
  arrivalRisk: -0.06,
  evidenceConfidence: 0.11,
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function scoreOpportunity(factors: OpportunityFactors): number {
  const raw = Object.entries(weights).reduce((score, [factor, weight]) => {
    return score + clamp(factors[factor as keyof OpportunityFactors]) * weight
  }, 0)

  return Math.round(clamp(raw) * 100)
}

export function opportunityMargin(opportunity: ScoredOpportunity): number {
  const current = scoreOpportunity(opportunity)
  const urgencyLift = clamp(opportunity.lastChanceUrgency) * 12
  return Math.round(current - opportunity.futureBestScore + urgencyLift)
}

export function rankOpportunities(
  opportunities: ScoredOpportunity[],
): ScoredOpportunity[] {
  return [...opportunities].sort((left, right) => {
    const margin = opportunityMargin(right) - opportunityMargin(left)
    if (margin !== 0) return margin
    return scoreOpportunity(right) - scoreOpportunity(left)
  })
}

export function shouldInterrupt(opportunity: ScoredOpportunity): boolean {
  return (
    opportunityMargin(opportunity) >= 18 &&
    opportunity.interestMatch >= 0.7 &&
    opportunity.evidenceConfidence >= 0.72 &&
    opportunity.arrivalRisk <= 0.45
  )
}
