// Política de cancelación/reprogramación (decisión B): por defecto hasta 4 h antes
// del inicio, pero la ventana es CONFIGURABLE por el admin
// (settings.cancellationWindowHours). El admin siempre puede.
export const CANCELLATION_WINDOW_HOURS = 4

/** Momento límite para que el cliente cancele/reprograme. */
export function cancellationDeadline(
  startsAt: Date,
  hours: number = CANCELLATION_WINDOW_HOURS,
): Date {
  return new Date(startsAt.getTime() - hours * 60 * 60 * 1000)
}

export function isCancellable(
  startsAt: Date,
  opts: { now?: Date; isAdmin?: boolean; hours?: number } = {},
): boolean {
  if (opts.isAdmin) return true
  const now = opts.now ?? new Date()
  return now.getTime() <= cancellationDeadline(startsAt, opts.hours).getTime()
}
