import type { AnchorageRepository } from '../../domain/repositories'
import type { TodaySnapshot } from '../../domain/types'
import { demoToday } from './today'

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export class DemoAnchorageRepository implements AnchorageRepository {
  async getToday(): Promise<TodaySnapshot> {
    await delay(180)
    return structuredClone(demoToday)
  }
}
