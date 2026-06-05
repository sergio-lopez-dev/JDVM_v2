// Política de cancelación/reprogramación (decisión B): hasta 4 h antes del inicio.
// El admin siempre puede.
export const CANCELLATION_WINDOW_HOURS = 4

/** Momento límite para que el cliente cancele/reprograme. */
export function cancellationDeadline(startsAt: Date): Date {
  return new Date(startsAt.getTime() - CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000)
}

export function isCancellable(
  startsAt: Date,
  opts: { now?: Date; isAdmin?: boolean } = {},
): boolean {
  if (opts.isAdmin) return true
  const now = opts.now ?? new Date()
  return now.getTime() <= cancellationDeadline(startsAt).getTime()
}
