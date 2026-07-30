import { env } from '../config/env'
import type { AnchorageRepository } from '../domain/repositories'
import { DemoAnchorageRepository } from './demo/demo-repository'

let repository: AnchorageRepository | undefined

export function getRepository(): AnchorageRepository {
  if (repository) return repository

  if (!env.VITE_DEMO_MODE) {
    // The live repository will be introduced when Supabase credentials are
    // supplied. Keeping repository selection here prevents UI features from
    // knowing which persistence strategy is active.
    throw new Error('Live mode requires the Supabase repository.')
  }

  repository = new DemoAnchorageRepository()
  return repository
}
