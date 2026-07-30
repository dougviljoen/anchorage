import { AlertCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useToday } from '../../app/today-context'
import { navigate } from '../../app/navigation'
import type { Coordinates, TodaySnapshot } from '../../domain/types'
import { MapCanvas } from './MapCanvas'
import { MapSheet } from './MapSheet'
import { MapTopBar } from './MapTopBar'
import type {
  LocationStatus,
  MapMode,
  PositionState,
} from './map-types'
import { useThreadRoute } from './use-thread-route'

const mapLabelsPreferenceKey = 'anchorage.map-labels'

const readMapLabelsPreference = () => {
  try {
    return localStorage.getItem(mapLabelsPreferenceKey) === 'true'
  } catch {
    return false
  }
}

const writeMapLabelsPreference = (value: boolean) => {
  try {
    localStorage.setItem(mapLabelsPreferenceKey, String(value))
  } catch {
    // The in-memory preference still works when storage is unavailable.
  }
}

export function MapExperience({
  mode,
  threadId,
}: {
  mode: MapMode
  threadId?: string
}) {
  const state = useToday()

  if (state.status === 'loading') {
    return (
      <div className="map-stage map-stage--loading">
        <span className="map-loading-mark" />
        <p>Finding your bearings</p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="map-stage map-stage--error">
        <AlertCircle size={24} />
        <h1>The map could not be composed.</h1>
        <p>{state.error.message}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    )
  }

  return (
    <ReadyMapExperience
      snapshot={state.data}
      mode={mode}
      threadId={threadId}
    />
  )
}

function ReadyMapExperience({
  snapshot,
  mode,
  threadId,
}: {
  snapshot: TodaySnapshot
  mode: MapMode
  threadId?: string
}) {
  const [position, setPosition] = useState<PositionState>({
    coordinates: snapshot.context.coordinates,
    source: 'trip',
  })
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>('idle')
  const [recenterVersion, setRecenterVersion] = useState(0)
  const [expanded, setExpanded] = useState(Boolean(threadId))
  const [heldThreadId, setHeldThreadId] = useState<string>()
  const [showMapLabels, setShowMapLabels] = useState(readMapLabelsPreference)
  const selectedThread = snapshot.threads.find(
    (thread) => thread.id === threadId,
  )
  const threadRoute = useThreadRoute({
    thread: selectedThread,
    origin: position.coordinates,
    nextAnchor: snapshot.context.nextAnchor,
  })

  const selectThread = useCallback((selectedId: string) => {
    setExpanded(true)
    navigate(`/threads/${encodeURIComponent(selectedId)}`)
  }, [])

  const clearThread = useCallback(() => {
    setExpanded(false)
    navigate('/')
  }, [])

  const changeMode = useCallback((nextMode: MapMode) => {
    const route: Record<MapMode, string> = {
      field: '/',
      journey: '/journey',
      memories: '/memories',
    }
    navigate(route[nextMode])
  }, [])

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }

    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const coordinates: Coordinates = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        }
        setPosition({
          coordinates,
          source: 'device',
          accuracyMeters: result.coords.accuracy,
        })
        setLocationStatus('located')
        setRecenterVersion((version) => version + 1)
      },
      () => setLocationStatus('unavailable'),
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    )
  }, [])

  const toggleMapLabels = useCallback(() => {
    setShowMapLabels((current) => {
      const next = !current
      writeMapLabelsPreference(next)
      return next
    })
  }, [])

  return (
    <main className={`map-stage map-stage--${mode}`}>
      <MapCanvas
        snapshot={snapshot}
        mode={mode}
        selectedThreadId={threadId}
        position={position}
        recenterVersion={recenterVersion}
        showMapLabels={showMapLabels}
        threadRoute={threadRoute}
        onSelectThread={selectThread}
      />
      <MapTopBar
        snapshot={snapshot}
        mode={mode}
        locationStatus={locationStatus}
        showMapLabels={showMapLabels}
        onModeChange={changeMode}
        onLocate={locate}
        onToggleMapLabels={toggleMapLabels}
      />
      <MapSheet
        snapshot={snapshot}
        mode={mode}
        selectedThread={selectedThread}
        position={position}
        expanded={expanded}
        heldThreadId={heldThreadId}
        threadRoute={threadRoute}
        onExpandedChange={setExpanded}
        onSelectThread={selectThread}
        onClearThread={clearThread}
        onHoldThread={(selectedId) =>
          setHeldThreadId((current) =>
            current === selectedId ? undefined : selectedId,
          )
        }
      />
      <div className="map-attribution-note">
        Opportunities are curated · crowd feel is estimated
      </div>
    </main>
  )
}
