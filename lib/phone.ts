// Teléfono España: exactamente 9 dígitos numéricos (regla heredada del legacy).
const PHONE_ES = /^\d{9}$/

/** Quita todo lo no numérico y recorta a 9 dígitos. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '').slice(0, 9)
}

export function isValidPhoneEs(phone: string): boolean {
  return PHONE_ES.test(phone)
}

/** Solo los dígitos de un teléfono (quita espacios, guiones, paréntesis, +…). */
function digits(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '')
}

/**
 * Normaliza a formato internacional para wa.me, asumiendo España (34) cuando vienen
 * 9 dígitos sin prefijo. Devuelve '' si no hay nada usable.
 */
export function intlPhone(phone?: string | null): string {
  const d = digits(phone)
  if (!d) return ''
  if (d.length === 9) return `34${d}` // ES local → +34
  if (d.length === 11 && d.startsWith('34')) return d
  if (d.length === 12 && d.startsWith('0034')) return d.slice(2)
  return d // ya trae prefijo de país u otro formato: se respeta
}

/** Enlace a WhatsApp (wa.me) con texto opcional. '' si el teléfono no es usable. */
export function waLink(phone?: string | null, text?: string): string {
  const p = intlPhone(phone)
  if (!p) return ''
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${p}${q}`
}

/** Enlace tel: para llamar. '' si no hay teléfono. */
export function telLink(phone?: string | null): string {
  const d = digits(phone)
  return d ? `tel:${d}` : ''
}
