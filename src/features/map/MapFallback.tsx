import type { MapMode } from './map-types'

export function MapFallback({ mode }: { mode: MapMode }) {
  return (
    <div className={`map-fallback map-fallback--${mode}`} aria-hidden="true">
      <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
        <path
          className="map-fallback__water"
          d="M0 0h1200v900H0z"
        />
        <path
          className="map-fallback__land"
          d="M-80 130c207-74 345-7 471 88 99 75 195 101 332 40 185-82 330-61 557 64v578H-80z"
        />
        <path
          className="map-fallback__river"
          d="M-20 660c250-118 428-98 603-1 154 85 315 69 648-80"
        />
        <path
          className="map-fallback__road"
          d="M74 284c194 71 317 40 454-37 172-96 331-88 608 45"
        />
        <path
          className="map-fallback__road map-fallback__road--minor"
          d="M228 90c26 239 109 369 286 478 151 93 272 164 318 362"
        />
        <path
          className="map-fallback__road map-fallback__road--minor"
          d="M806 20c-54 233-23 408 96 526 103 102 155 213 168 354"
        />
      </svg>
      <span className="map-fallback__place map-fallback__place--one">
        Higashiyama
      </span>
      <span className="map-fallback__place map-fallback__place--two">
        Kanazawa
      </span>
      <span className="map-fallback__place map-fallback__place--three">
        Teramachi
      </span>
    </div>
  )
}
