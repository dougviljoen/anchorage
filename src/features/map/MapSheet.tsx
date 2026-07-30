import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  ChevronUp,
  Clock3,
  Footprints,
  MapPin,
  Radar,
  Route,
  Sparkles,
} from 'lucide-react'
import type {
  JournalEntry,
  Thread,
  TodaySnapshot,
  TravelMode,
} from '../../domain/types'
import {
  formatDuration,
  formatTime,
  formatYen,
} from '../../lib/format'
import type {
  MapMode,
  PositionState,
  ThreadRouteState,
} from './map-types'

type MapSheetProps = {
  snapshot: TodaySnapshot
  mode: MapMode
  selectedThread?: Thread
  position: PositionState
  expanded: boolean
  heldThreadId?: string
  threadRoute: ThreadRouteState
  onExpandedChange: (expanded: boolean) => void
  onSelectThread: (threadId: string) => void
  onClearThread: () => void
  onHoldThread: (threadId: string) => void
}

const modeLabel: Record<Thread['mode'], string> = {
  drift: 'Gentle',
  follow: 'Curious',
  go: 'Make a day of it',
}

const travelModeLabel: Record<TravelMode, string> = {
  WALK: 'walking',
  TRANSIT: 'transit',
  DRIVE: 'driving',
  BICYCLE: 'cycling',
}

export function MapSheet({
  snapshot,
  mode,
  selectedThread,
  position,
  expanded,
  heldThreadId,
  threadRoute,
  onExpandedChange,
  onSelectThread,
  onClearThread,
  onHoldThread,
}: MapSheetProps) {
  return (
    <aside
      className={`map-sheet${expanded ? ' is-expanded' : ''}${
        selectedThread ? ' has-thread' : ''
      }`}
      aria-label="Map context"
    >
      <button
        className="map-sheet__grabber"
        onClick={() => onExpandedChange(!expanded)}
        aria-label={expanded ? 'Collapse details' : 'Expand details'}
      >
        <span />
        <ChevronUp size={14} />
      </button>

      <div className="map-sheet__scroll">
        {mode === 'field' && !selectedThread && (
          <FieldOverview
            snapshot={snapshot}
            position={position}
            onSelectThread={onSelectThread}
          />
        )}
        {mode === 'field' && selectedThread && (
          <ThreadOverview
            thread={selectedThread}
            nextAnchorTime={snapshot.context.nextAnchor.startsAt}
            held={heldThreadId === selectedThread.id}
            threadRoute={threadRoute}
            onBack={onClearThread}
            onHold={() => onHoldThread(selectedThread.id)}
          />
        )}
        {mode === 'journey' && <JourneyOverview snapshot={snapshot} />}
        {mode === 'memories' && <MemoryOverview snapshot={snapshot} />}
      </div>
    </aside>
  )
}

function FieldOverview({
  snapshot,
  position,
  onSelectThread,
}: {
  snapshot: TodaySnapshot
  position: PositionState
  onSelectThread: (threadId: string) => void
}) {
  return (
    <div className="sheet-view sheet-view--field">
      <div className="sheet-kicker">
        <span className="sheet-kicker__pulse" />
        {position.source === 'device'
          ? 'Using your current position'
          : 'Trip preview position'}
      </div>

      <div className="sheet-heading">
        <div>
          <p>Until the next anchor</p>
          <h1>{formatDuration(snapshot.context.minutesUntilAnchor)}</h1>
        </div>
        <div className="sheet-heading__anchor">
          <span>{formatTime(snapshot.context.nextAnchor.startsAt)}</span>
          <strong>{snapshot.context.nextAnchor.title}</strong>
        </div>
      </div>

      {snapshot.radar && (
        <button
          className="sheet-radar"
          onClick={() =>
            snapshot.radar?.threadId &&
            onSelectThread(snapshot.radar.threadId)
          }
        >
          <span className="sheet-radar__icon">
            <Radar size={16} />
          </span>
          <span>
            <small>Opportunity radar</small>
            <strong>{snapshot.radar.title}</strong>
          </span>
          <ArrowUpRight size={16} />
        </button>
      )}

      <div className="sheet-section-label">
        <span>Three ways into the day</span>
        <small>Chosen for right now</small>
      </div>

      <div className="spatial-thread-list">
        {snapshot.threads.map((thread) => (
          <button
            className={`spatial-thread spatial-thread--${thread.palette}`}
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
          >
            <span className="spatial-thread__mark" />
            <span className="spatial-thread__copy">
              <small>{modeLabel[thread.mode]}</small>
              <strong>{thread.title}</strong>
              <span>{thread.weatherNote}</span>
            </span>
            <span className="spatial-thread__time">
              {formatDuration(thread.durationMinutes)}
              <ArrowUpRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ThreadOverview({
  thread,
  nextAnchorTime,
  held,
  threadRoute,
  onBack,
  onHold,
}: {
  thread: Thread
  nextAnchorTime: string
  held: boolean
  threadRoute: ThreadRouteState
  onBack: () => void
  onHold: () => void
}) {
  return (
    <div className="sheet-view sheet-view--thread">
      <button className="sheet-back" onClick={onBack}>
        <ArrowLeft size={15} />
        Possibilities
      </button>

      <p className="sheet-kicker">{thread.eyebrow}</p>
      <h1>{thread.title}</h1>
      <p className="sheet-thread-summary">{thread.summary}</p>

      <div className="sheet-facts">
        <span>
          <Clock3 size={14} />
          {formatDuration(thread.durationMinutes)}
        </span>
        <span>
          <Footprints size={14} />
          {thread.walkingKm} km
        </span>
        <span>{formatYen(thread.costYen)}</span>
      </div>

      {threadRoute.status === 'loading' && (
        <p className="sheet-live-route">
          <span className="sheet-live-route__pulse" />
          Checking the route
        </p>
      )}
      {threadRoute.status === 'live' && (
        <p className="sheet-live-route is-live">
          <span className="sheet-live-route__pulse" />
          {threadRoute.overlay.fullyLive ? (
            <>
              Live route ·{' '}
              {(threadRoute.overlay.distanceMeters / 1000).toFixed(1)} km ·{' '}
              {formatDuration(threadRoute.overlay.durationMinutes)} travel
            </>
          ) : (
            <>
              Route checked ·{' '}
              {threadRoute.overlay.liveModes
                .map((mode) => travelModeLabel[mode])
                .join(' + ')}{' '}
              live ·{' '}
              {threadRoute.overlay.estimatedModes
                .map((mode) => travelModeLabel[mode])
                .join(' + ')}{' '}
              estimated
            </>
          )}
        </p>
      )}

      <div className="sheet-why">
        <Sparkles size={16} />
        <div>
          <small>Why now</small>
          <p>{thread.whyNow}</p>
        </div>
      </div>

      <div className="sheet-route">
        <div className="sheet-section-label">
          <span>The thread</span>
          <small>Returns before {formatTime(nextAnchorTime)}</small>
        </div>
        {thread.stops.map((stop, index) => (
          <div className="sheet-stop" key={stop.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <strong>{stop.title}</strong>
              <small>
                {stop.category} · {formatDuration(stop.durationMinutes)}
              </small>
            </div>
            <MapPin size={14} />
          </div>
        ))}
      </div>

      <button
        className={held ? 'sheet-primary is-held' : 'sheet-primary'}
        onClick={onHold}
      >
        {held ? (
          <>
            <Check size={16} />
            Route held
          </>
        ) : (
          <>
            <Route size={16} />
            Hold this route
          </>
        )}
      </button>
    </div>
  )
}

function JourneyOverview({ snapshot }: { snapshot: TodaySnapshot }) {
  return (
    <div className="sheet-view sheet-view--journey">
      <p className="sheet-kicker">The shape of the journey</p>
      <div className="sheet-heading">
        <div>
          <p>{snapshot.trip.country}</p>
          <h1>21 nights</h1>
        </div>
        <div className="sheet-heading__anchor">
          <span>Four quiet bases</span>
          <strong>5–26 November</strong>
        </div>
      </div>

      <p className="sheet-intro">
        What is behind you stays inked. What lies ahead remains open.
      </p>

      <div className="journey-list">
        {snapshot.trip.bases.map((base, index) => {
          const current = base.id === snapshot.trip.currentBaseId
          return (
            <div
              className={current ? 'journey-stop is-current' : 'journey-stop'}
              key={base.id}
            >
              <div className="journey-stop__rail">
                <span>{index + 1}</span>
              </div>
              <div>
                <small>{current ? 'You are here' : base.region}</small>
                <strong>{base.city}</strong>
                <span>
                  {base.nights} nights · {base.stayName}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MemoryOverview({ snapshot }: { snapshot: TodaySnapshot }) {
  return (
    <div className="sheet-view sheet-view--memory">
      <p className="sheet-kicker">The travelled map</p>
      <div className="sheet-heading">
        <div>
          <p>Field notes</p>
          <h1>{snapshot.journal.length} moments</h1>
        </div>
        <div className="sheet-heading__anchor">
          <Camera size={16} />
          <strong>One image. One thought.</strong>
        </div>
      </div>

      <p className="sheet-intro">
        The route remembers where each observation belongs.
      </p>

      <div className="memory-list">
        {snapshot.journal.map((entry) => (
          <MemoryRow entry={entry} key={entry.id} />
        ))}
      </div>
    </div>
  )
}

function MemoryRow({ entry }: { entry: JournalEntry }) {
  return (
    <article className="memory-row">
      <span className={`memory-row__image memory-row__image--${entry.palette}`} />
      <div>
        <small>{entry.place}</small>
        <strong>{entry.observation}</strong>
        {entry.object && <span>{entry.object}</span>}
      </div>
      <MapPin size={14} />
    </article>
  )
}
