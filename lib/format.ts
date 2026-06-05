import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatPrice(n?: number): string {
  return `${n ?? 0}€`
}

export function formatDuration(min?: number): string {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "jue 4" / "Jueves 4 de junio" / "17:30" usando date-fns con locale es. */
export function fmtDate(d: Date, pattern: string): string {
  return format(d, pattern, { locale: es })
}
