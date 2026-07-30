import {
  Anchor,
  CloudRain,
  Compass,
  Crosshair,
  Images,
  LoaderCircle,
  Route,
} from 'lucide-react'
import type { TodaySnapshot } from '../../domain/types'
import { formatTime } from '../../lib/format'
import type { LocationStatus, MapMode } from './map-types'

const modes = [
  { value: 'field', label: 'Field', icon: Compass },
  { value: 'journey', label: 'Journey', icon: Route },
  { value: 'memories', label: 'Memory', icon: Images },
] satisfies Array<{
  value: MapMode
  label: string
  icon: typeof Compass
}>

export function MapTopBar({
  snapshot,
  mode,
  locationStatus,
  showMapLabels,
  onModeChange,
  onLocate,
  onToggleMapLabels,
}: {
  snapshot: TodaySnapshot
  mode: MapMode
  locationStatus: LocationStatus
  showMapLabels: boolean
  onModeChange: (mode: MapMode) => void
  onLocate: () => void
  onToggleMapLabels: () => void
}) {
  const currentBase = snapshot.trip.bases.find(
    (base) => base.id === snapshot.trip.currentBaseId,
  )

  return (
    <>
      <header className="map-topbar">
        <div className="map-brand" aria-label="Anchorage">
          <span className="map-brand__mark">
            <Anchor size={17} strokeWidth={1.8} />
          </span>
          <span className="map-brand__word">Anchorage</span>
        </div>

        <div className="map-context">
          <div>
            <strong>{currentBase?.city ?? snapshot.context.locationName}</strong>
            <span>{formatTime(snapshot.context.observedAt)} · Thursday</span>
          </div>
          <span className="map-context__weather">
            <CloudRain size={14} />
            {snapshot.context.weather.temperatureC}°
          </span>
        </div>

        <button
          className={
            locationStatus === 'located'
              ? 'map-control is-active'
              : 'map-control'
          }
          onClick={onLocate}
          aria-label="Locate me"
          title="Locate me"
        >
          {locationStatus === 'requesting' ? (
            <LoaderCircle className="is-spinning" size={18} />
          ) : (
            <Crosshair size={18} />
          )}
        </button>
      </header>

      <nav className="map-mode-dock" aria-label="Map view and labels">
        {modes.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={mode === value ? 'is-active' : ''}
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
          >
            <Icon size={17} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
        <span className="map-mode-dock__divider" aria-hidden="true" />
        <button
          className={
            showMapLabels
              ? 'map-label-toggle is-active'
              : 'map-label-toggle'
          }
          onClick={onToggleMapLabels}
          aria-pressed={showMapLabels}
          title={showMapLabels ? 'Hide map names' : 'Show map names'}
        >
          <b className="map-label-toggle__glyph" aria-hidden="true">
            Aa
          </b>
          <span>{showMapLabels ? 'Hide names' : 'Show names'}</span>
        </button>
      </nav>
    </>
  )
}
