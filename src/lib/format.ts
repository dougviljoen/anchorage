const timeFormatter = new Intl.DateTimeFormat('en-NZ', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Tokyo',
})

const dateFormatter = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Tokyo',
})

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value))
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60

  if (hours === 0) return `${remainder} min`
  if (remainder === 0) return `${hours} hr`
  return `${hours} hr ${remainder} min`
}

export function formatYen(value: number) {
  return `¥${new Intl.NumberFormat('en-NZ').format(value)}`
}
