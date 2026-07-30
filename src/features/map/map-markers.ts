import type { ThreadPalette } from '../../domain/types'

type MarkerKind =
  | 'current'
  | 'anchor'
  | 'soft-anchor'
  | 'opportunity'
  | 'stop'
  | 'base'
  | 'memory'

type MarkerContentOptions = {
  kind: MarkerKind
  label?: string
  meta?: string
  index?: number
  palette?: ThreadPalette
  active?: boolean
  turnaround?: boolean
}

export function createMarkerContent({
  kind,
  label,
  meta,
  index,
  palette = 'moss',
  active = false,
  turnaround = false,
}: MarkerContentOptions) {
  const root = document.createElement('div')
  root.className = `spatial-marker spatial-marker--${kind}${
    active ? ' is-active' : ''
  }${
    turnaround ? ' is-turnaround' : ''
  }`

  if (kind === 'current') {
    const core = document.createElement('span')
    core.className = 'spatial-marker__current-core'
    root.append(core)
    return root
  }

  if (kind === 'memory') {
    const image = document.createElement('span')
    image.className = `spatial-marker__memory-image marker-palette--${palette}`
    const pin = document.createElement('span')
    pin.className = 'spatial-marker__memory-pin'
    root.append(image, pin)
  } else {
    const symbol = document.createElement('span')
    symbol.className = 'spatial-marker__symbol'
    symbol.textContent =
      kind === 'stop'
        ? String(index ?? 1)
        : kind === 'opportunity'
          ? '·'
          : kind === 'base'
            ? '◆'
            : '⌁'
    root.append(symbol)
  }

  if (label) {
    const text = document.createElement('span')
    text.className = 'spatial-marker__label'
    const title = document.createElement('strong')
    title.textContent = label
    text.append(title)

    if (meta) {
      const detail = document.createElement('small')
      detail.textContent = meta
      text.append(detail)
    }

    root.append(text)
  }

  return root
}
