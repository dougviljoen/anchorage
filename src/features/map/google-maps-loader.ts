let mapsPromise: Promise<typeof google> | null = null

const callbackName = '__anchorageGoogleMapsReady'

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window.google !== 'undefined') {
    return Promise.resolve(window.google)
  }

  if (mapsPromise) return mapsPromise

  mapsPromise = new Promise((resolve, reject) => {
    const callbackHost = window as typeof window &
      Record<string, (() => void) | undefined>
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-anchorage-google-maps]',
    )

    callbackHost[callbackName] = () => {
      delete callbackHost[callbackName]
      resolve(window.google)
    }

    if (existing) {
      existing.addEventListener('error', () => {
        mapsPromise = null
        reject(new Error('Google Maps could not be loaded.'))
      })
      return
    }

    const script = document.createElement('script')
    const parameters = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: callbackName,
    })

    script.src = `https://maps.googleapis.com/maps/api/js?${parameters}`
    script.async = true
    script.dataset.anchorageGoogleMaps = 'true'
    script.onerror = () => {
      delete callbackHost[callbackName]
      mapsPromise = null
      reject(new Error('Google Maps could not be loaded.'))
    }
    document.head.append(script)
  })

  return mapsPromise
}
