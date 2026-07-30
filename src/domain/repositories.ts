import type { TodaySnapshot } from './types'

export interface AnchorageRepository {
  getToday(): Promise<TodaySnapshot>
}
