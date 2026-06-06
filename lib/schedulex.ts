import { Temporal } from 'temporal-polyfill'

// Adaptadores entre las fechas JS del dominio y los tipos Temporal que exige
// Schedule-X v4. Fijamos la zona del estudio (Granada) para coherencia.
export const STUDIO_TZ = 'Europe/Madrid'

/** JS Date -> Temporal.ZonedDateTime en la zona del estudio. */
export function toZdt(date: Date): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(STUDIO_TZ)
}

/** JS Date -> Temporal.PlainDate (para selectedDate / minDate). */
export function toPlainDate(date: Date): Temporal.PlainDate {
  return toZdt(date).toPlainDate()
}

/** Temporal.ZonedDateTime|PlainDate -> JS Date (al pulsar un evento). */
export function fromTemporal(value: Temporal.ZonedDateTime | Temporal.PlainDate): Date {
  if (value instanceof Temporal.PlainDate) {
    return new Date(value.toZonedDateTime(STUDIO_TZ).epochMilliseconds)
  }
  return new Date(value.epochMilliseconds)
}
