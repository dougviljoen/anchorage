import { useEffect, useRef, useState } from 'react'
import { env } from '../../config/env'
import type { Coordinates, TodaySnapshot } from '../../domain/types'
import { loadGoogleMaps } from './google-maps-loader'
import { MapFallback } from './MapFallback'
import { createMarkerContent } from './map-markers'
import { planThreadRoute } from './thread-route-plan'
import { buildThreadRouteOverlay } from './route-overlay'
import { getRouteVisualPriority } from './route-visual-priority'
import type {
  MapMode,
  PositionState,
  ThreadRouteState,
} from './map-types'

type MapCanvasProps = {
  snapshot: TodaySnapshot
  mode: MapMode
  selectedThreadId?: string
  position: PositionState
  recenterVersion: number
  showMapLabels: boolean
  threadRoute: ThreadRouteState
  onSelectThread: (threadId: string) => void
}

type Overlay = {
  setMap: (map: google.maps.Map | null) => void
}

const embeddedCalmBaseStyle: google.maps.MapTypeStyle[] = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#e9e8e1' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#e1e4dc' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#dddcd4' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#ebe9e1' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#cfd9d5' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#f8f6ef' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d8d5cc' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#e2dfd5' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#737a73' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#f1efe8' }, { weight: 3 }],
  },
]

const embeddedCalmLabelFreeStyle: google.maps.MapTypeStyle[] = [
  ...embeddedCalmBaseStyle,
  {
    featureType: 'all',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
]

const asLatLng = ({ latitude, longitude }: Coordinates) => ({
  lat: latitude,
  lng: longitude,
})

const distanceInMeters = (from: Coordinates, to: Coordinates) => {
  const earthRadius = 6_371_000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function MapCanvas({
  snapshot,
  mode,
  selectedThreadId,
  position,
  recenterVersion,
  showMapLabels,
  threadRoute,
  onSelectThread,
}: MapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const initialCoordinatesRef = useRef(snapshot.context.coordinates)
  const initialShowMapLabelsRef = useRef(showMapLabels)
  const mapRef = useRef<google.maps.Map | null>(null)
  const overlaysRef = useRef<Overlay[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>(
    'loading',
  )
  const showsCuratedGeometry = snapshot.threads
    .find((thread) => thread.id === selectedThreadId)
    ?.routeWaypoints?.some(
      (waypoint) => waypoint.curatedPathFromPrevious?.length,
    )

  useEffect(() => {
    let active = true
    const apiKey = env.VITE_GOOGLE_MAPS_BROWSER_API_KEY

    if (!apiKey || !hostRef.current) {
      setStatus('fallback')
      return
    }

    loadGoogleMaps(apiKey)
      .then(async () => {
        if (!active || !hostRef.current) return
        const { Map } = (await google.maps.importLibrary(
          'maps',
        )) as google.maps.MapsLibrary
        const mapId = env.VITE_GOOGLE_MAP_ID || undefined
        const useCloudStyle =
          env.VITE_GOOGLE_MAP_STYLE_MODE === 'cloud' && Boolean(mapId)

        mapRef.current = new Map(hostRef.current, {
          center: asLatLng(initialCoordinatesRef.current),
          zoom: 14.2,
          mapId: useCloudStyle ? mapId : undefined,
          styles: useCloudStyle
            ? undefined
            : initialShowMapLabelsRef.current
              ? embeddedCalmBaseStyle
              : embeddedCalmLabelFreeStyle,
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          keyboardShortcuts: true,
          backgroundColor: '#e8e7df',
          renderingType: useCloudStyle
            ? google.maps.RenderingType.VECTOR
            : google.maps.RenderingType.RASTER,
        })
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('fallback')
      })

    return () => {
      active = false
      overlaysRef.current.forEach((overlay) => {
        overlay.setMap(null)
      })
      overlaysRef.current = []
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (
      status !== 'ready' ||
      !mapRef.current ||
      env.VITE_GOOGLE_MAP_STYLE_MODE === 'cloud'
    ) {
      return
    }

    mapRef.current.setOptions({
      styles: showMapLabels
        ? embeddedCalmBaseStyle
        : embeddedCalmLabelFreeStyle,
    })
  }, [showMapLabels, status])

  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map) return

    overlaysRef.current.forEach((overlay) => {
      overlay.setMap(null)
    })
    overlaysRef.current = []

    const bounds = new google.maps.LatLngBounds()
    const addPointToBounds = (coordinates?: Coordinates) => {
      if (coordinates) bounds.extend(asLatLng(coordinates))
    }

    const addMarker = ({
      coordinates,
      content,
      title,
      zIndex = 1,
      onClick,
    }: {
      coordinates: Coordinates
      content: HTMLElement
      title: string
      zIndex?: number
      onClick?: () => void
    }) => {
      class SpatialMarkerOverlay extends google.maps.OverlayView {
        private readonly point = new google.maps.LatLng(
          coordinates.latitude,
          coordinates.longitude,
        )
        private readonly host = document.createElement('div')

        constructor() {
          super()
          this.host.className = 'spatial-marker-overlay'
          this.host.style.zIndex = String(zIndex)
          this.host.title = title
          this.host.append(content)

          if (onClick) {
            this.host.role = 'button'
            this.host.tabIndex = 0
            this.host.addEventListener('click', onClick)
            this.host.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            })
          }
        }

        onAdd() {
          this.getPanes()?.overlayMouseTarget.append(this.host)
        }

        draw() {
          const pixel = this.getProjection().fromLatLngToDivPixel(this.point)
          if (!pixel) return
          this.host.style.left = `${pixel.x}px`
          this.host.style.top = `${pixel.y}px`
        }

        onRemove() {
          this.host.remove()
        }
      }

      const marker = new SpatialMarkerOverlay()
      marker.setMap(map)
      overlaysRef.current.push(marker)
      addPointToBounds(coordinates)
    }

    const addPolyline = (
      path: Coordinates[],
      options: google.maps.PolylineOptions,
    ) => {
      const polyline = new google.maps.Polyline({
        map,
        path: path.map(asLatLng),
        geodesic: true,
        ...options,
      })
      overlaysRef.current.push(polyline)
      path.forEach(addPointToBounds)
    }

    const dashedLine: google.maps.Symbol = {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1,
      strokeWeight: 2,
      scale: 2.1,
    }

    if (mode === 'journey') {
      const currentIndex = snapshot.trip.bases.findIndex(
        (base) => base.id === snapshot.trip.currentBaseId,
      )
      const pastBases = snapshot.trip.bases.slice(0, currentIndex + 1)
      const futureBases = snapshot.trip.bases.slice(currentIndex)

      if (pastBases.length > 1) {
        addPolyline(
          pastBases.map((base) => base.coordinates),
          {
            strokeColor: '#29483a',
            strokeOpacity: 0.88,
            strokeWeight: 4,
            zIndex: 2,
          },
        )
      }

      if (futureBases.length > 1) {
        addPolyline(
          futureBases.map((base) => base.coordinates),
          {
            strokeOpacity: 0,
            strokeWeight: 0,
            icons: [{ icon: dashedLine, offset: '0', repeat: '13px' }],
            zIndex: 2,
          },
        )
      }

      snapshot.trip.bases.forEach((base, index) => {
        addMarker({
          coordinates: base.coordinates,
          content: createMarkerContent({
            kind: 'base',
            label: base.city,
            meta: `${base.nights} nights`,
            active: base.id === snapshot.trip.currentBaseId,
          }),
          title: `${base.city}, ${base.region}`,
          zIndex: base.id === snapshot.trip.currentBaseId ? 8 : 4,
        })
        if (index === currentIndex) addPointToBounds(position.coordinates)
      })
    } else if (mode === 'memories') {
      const travelledBases = snapshot.trip.bases.slice(
        0,
        snapshot.trip.bases.findIndex(
          (base) => base.id === snapshot.trip.currentBaseId,
        ) + 1,
      )

      if (travelledBases.length > 1) {
        addPolyline(
          travelledBases.map((base) => base.coordinates),
          {
            strokeColor: '#29483a',
            strokeOpacity: 0.58,
            strokeWeight: 3,
            zIndex: 1,
          },
        )
      }

      snapshot.journal.forEach((entry) => {
        if (!entry.coordinates) return
        addMarker({
          coordinates: entry.coordinates,
          content: createMarkerContent({
            kind: 'memory',
            label: entry.place,
            meta: entry.observation,
            palette: entry.palette,
          }),
          title: entry.observation,
          zIndex: 6,
        })
      })
    } else {
      const nextAnchor = snapshot.context.nextAnchor
      const stayAnchor = snapshot.anchors.find(
        (anchor) => anchor.kind === 'stay',
      )
      const selectedThread = snapshot.threads.find(
        (thread) => thread.id === selectedThreadId,
      )

      addMarker({
        coordinates: position.coordinates,
        content: createMarkerContent({ kind: 'current' }),
        title:
          position.source === 'device'
            ? 'Your current position'
            : 'Your position in the trip preview',
        zIndex: 20,
      })

      if (stayAnchor?.coordinates) {
        const stayIsDistinct =
          distanceInMeters(position.coordinates, stayAnchor.coordinates) > 150

        if (stayIsDistinct) {
          addMarker({
            coordinates: stayAnchor.coordinates,
            content: createMarkerContent({
              kind: 'soft-anchor',
              label: 'Your stay',
              meta: stayAnchor.locationName,
            }),
            title: stayAnchor.title,
            zIndex: 4,
          })
        }
      }

      if (nextAnchor.coordinates) {
        addMarker({
          coordinates: nextAnchor.coordinates,
          content: createMarkerContent({
            kind: 'anchor',
            label: nextAnchor.title,
            meta: '18:30 · fixed',
          }),
          title: nextAnchor.title,
          zIndex: 9,
        })
      }

      if (selectedThread) {
        const routeSegments =
          threadRoute.status === 'live'
            ? threadRoute.overlay.segments
            : nextAnchor.coordinates
              ? buildThreadRouteOverlay(
                  planThreadRoute(
                    selectedThread,
                    position.coordinates,
                    nextAnchor.coordinates,
                  ).map((request) => ({ request })),
                ).segments
              : []

        const activeLegIndex =
          routeSegments.reduce(
            (first, segment) => Math.min(first, segment.legIndex),
            Number.POSITIVE_INFINITY,
        )

        routeSegments.forEach((segment) => {
          const priority = getRouteVisualPriority(
            segment.legIndex,
            activeLegIndex,
          )
          const isCurrentLeg = priority.isCurrent
          const isTrain =
            segment.travelMode === 'TRANSIT' &&
            segment.transitModes?.some((mode) =>
              ['TRAIN', 'RAIL', 'LIGHT_RAIL', 'SUBWAY'].includes(mode),
            )
          const isBus =
            segment.travelMode === 'TRANSIT' &&
            segment.transitModes?.includes('BUS')
          const futureColor = isTrain
            ? '#516572'
            : isBus
              ? '#8a5a44'
              : segment.travelMode === 'WALK'
                ? '#485c52'
                : segment.travelMode === 'BICYCLE'
                  ? '#4f6f5d'
                  : '#6d655c'
          const color = isCurrentLeg ? '#1f573b' : futureColor
          const routeZIndex = priority.zIndex

          addPolyline(segment.path, {
            strokeColor: '#f4f0e5',
            strokeOpacity: priority.casingOpacity,
            strokeWeight: priority.casingWeight,
            zIndex: routeZIndex - 1,
          })

          if (
            (isTrain && segment.source !== 'estimated') ||
            segment.travelMode === 'DRIVE'
          ) {
            addPolyline(segment.path, {
              strokeColor: color,
              strokeOpacity: priority.opacity,
              strokeWeight: isTrain
                ? Math.max(priority.strokeWeight, 3.5)
                : priority.strokeWeight,
              zIndex: routeZIndex,
            })
          } else {
            const isWalking = segment.travelMode === 'WALK'
            addPolyline(segment.path, {
              strokeOpacity: 0,
              strokeWeight: 0,
              icons: [
                {
                  icon: {
                    ...dashedLine,
                    path: isWalking
                      ? google.maps.SymbolPath.CIRCLE
                      : dashedLine.path,
                    scale: isWalking
                      ? isCurrentLeg
                        ? 1.8
                        : 1.45
                      : isCurrentLeg
                        ? 2.35
                        : 2.05,
                    strokeColor: color,
                    strokeOpacity: priority.opacity,
                  },
                  offset: '0',
                  repeat: isWalking
                    ? isCurrentLeg
                      ? '9px'
                      : '10px'
                    : isBus
                      ? '17px'
                      : '13px',
                },
              ],
              zIndex: routeZIndex,
            })
          }

          if (isCurrentLeg) {
            addPolyline(segment.path, {
              strokeOpacity: 0,
              strokeWeight: 0,
              icons: [
                {
                  icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 2.2,
                    fillColor: color,
                    fillOpacity: 0.96,
                    strokeColor: '#f4f0e5',
                    strokeOpacity: 0.98,
                    strokeWeight: 1.2,
                  },
                  offset: '58%',
                },
              ],
              zIndex: routeZIndex + 1,
            })
          } else {
            addPolyline(segment.path, {
              strokeOpacity: 0,
              strokeWeight: 0,
              icons: [
                {
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 2,
                    fillColor: '#f4f0e5',
                    fillOpacity: 1,
                    strokeColor: color,
                    strokeOpacity: priority.opacity,
                    strokeWeight: 1.4,
                  },
                  offset: '0',
                },
              ],
              zIndex: routeZIndex + 1,
            })
          }
        })

        selectedThread.stops.forEach((stop, index) => {
          const isTurnaround =
            selectedThread.returnPlan?.kind === 'retrace' &&
            selectedThread.returnPlan.turnaroundStopId === stop.id

          addMarker({
            coordinates: stop.coordinates,
            content: createMarkerContent({
              kind: 'stop',
              label: stop.title,
              meta: isTurnaround
                ? `${stop.category} · turnaround`
                : stop.category,
              index: index + 1,
              active: true,
              turnaround: isTurnaround,
            }),
            title: stop.title,
            zIndex: 12,
          })
        })

        if (threadRoute.status === 'live' && !showMapLabels) {
          threadRoute.overlay.annotations.forEach((annotation) => {
            addMarker({
              coordinates: annotation.coordinates,
              content: createMarkerContent({
                kind: 'route-label',
                label: annotation.label,
              }),
              title: annotation.label,
              zIndex: 6,
            })
          })
        }
      } else {
        if (nextAnchor.coordinates) {
          addPolyline([position.coordinates, nextAnchor.coordinates], {
            strokeOpacity: 0,
            icons: [
              {
                icon: {
                  ...dashedLine,
                  strokeColor: '#65736a',
                  strokeOpacity: 0.55,
                },
                offset: '0',
                repeat: '15px',
              },
            ],
            zIndex: 1,
          })
        }

        snapshot.threads.forEach((thread) => {
          const firstStop = thread.stops[0]
          if (!firstStop) return
          addMarker({
            coordinates: firstStop.coordinates,
            content: createMarkerContent({
              kind: 'opportunity',
              label: thread.title,
              meta: thread.eyebrow,
              palette: thread.palette,
            }),
            title: thread.title,
            zIndex: 7,
            onClick: () => onSelectThread(thread.id),
          })
        })
      }
    }

    if (!bounds.isEmpty()) {
      const compact = window.innerWidth < 720
      map.fitBounds(bounds, {
        top: compact ? 120 : 100,
        right: compact ? 28 : 80,
        bottom: compact ? 330 : 100,
        left: compact ? 28 : 500,
      })
    }
  }, [
    mode,
    onSelectThread,
    position,
    recenterVersion,
    selectedThreadId,
    showMapLabels,
    snapshot,
    status,
    threadRoute,
  ])

  return (
    <div className="map-canvas" aria-label="Anchorage trip map">
      <div ref={hostRef} className="map-canvas__google" />
      {status !== 'ready' && <MapFallback mode={mode} />}
      {status === 'loading' && (
        <div className="map-canvas__loading" aria-live="polite">
          <span />
          Drawing your bearings
        </div>
      )}
      <div className="map-canvas__tone" />
      {showsCuratedGeometry && (
        <a
          className="map-canvas__route-credit"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          Rail geometry © OpenStreetMap contributors
        </a>
      )}
    </div>
  )
}
