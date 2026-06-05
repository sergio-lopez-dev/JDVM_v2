// Teléfono España: exactamente 9 dígitos numéricos (regla heredada del legacy).
const PHONE_ES = /^\d{9}$/

/** Quita todo lo no numérico y recorta a 9 dígitos. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '').slice(0, 9)
}

export function isValidPhoneEs(phone: string): boolean {
  return PHONE_ES.test(phone)
}
