import { createContext, useContext } from 'react'
import type { TodaySnapshot } from '../domain/types'

export type TodayState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: TodaySnapshot; error: null }
  | { status: 'error'; data: null; error: Error }

export const TodayContext = createContext<TodayState | null>(null)

export function useToday() {
  const value = useContext(TodayContext)

  if (!value) {
    throw new Error('useToday must be used inside TodayProvider.')
  }

  return value
}
