import { TodayProvider } from './TodayProvider'
import { usePathname } from './navigation'
import { MapExperience } from '../features/map/MapExperience'
import type { MapMode } from '../features/map/map-types'

function AppRoutes() {
  const pathname = usePathname()
  const threadMatch = pathname.match(/^\/threads\/([^/]+)$/)

  let mode: MapMode = 'field'
  let threadId: string | undefined

  if (threadMatch?.[1]) {
    threadId = decodeURIComponent(threadMatch[1])
  } else if (pathname === '/journey' || pathname === '/anchors') {
    mode = 'journey'
  } else if (pathname === '/memories' || pathname === '/journal') {
    mode = 'memories'
  } else if (pathname !== '/') {
    window.history.replaceState(null, '', '/')
  }

  return <MapExperience mode={mode} threadId={threadId} />
}

export function App() {
  return (
    <TodayProvider>
      <AppRoutes />
    </TodayProvider>
  )
}
