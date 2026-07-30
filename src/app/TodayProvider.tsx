import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { getRepository } from '../data/repository'
import { TodayContext, type TodayState } from './today-context'

export function TodayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TodayState>({
    status: 'loading',
    data: null,
    error: null,
  })

  useEffect(() => {
    let active = true

    getRepository()
      .getToday()
      .then((data) => {
        if (active) setState({ status: 'ready', data, error: null })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          status: 'error',
          data: null,
          error:
            error instanceof Error
              ? error
              : new Error('Anchorage could not load this moment.'),
        })
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => state, [state])

  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>
}
