import { toDate } from '~~/lib/datetime'
import { initials } from '~~/lib/format'
import type { Appointment } from '~~/schemas'

export interface EnrichedAppointment extends Omit<Appointment, 'startsAt' | 'endsAt'> {
  startsAt: Date
  endsAt: Date
  serviceName: string
  serviceDuration: number
  barberName: string
  barberInitials: string
  barberColor?: string
  price: number
}

// Citas del cliente enriquecidas con servicio/barbero y fechas convertidas.
export function useMyAppointments() {
  const { mine } = useAppointments()
  const { services } = useServices()
  const { barbers } = useBarbers()

  const enriched = computed<EnrichedAppointment[]>(() =>
    mine.value.map((a) => {
      const svc = services.value.find((s) => s.id === a.serviceId)
      const bb = barbers.value.find((b) => b.id === a.barberId)
      return {
        ...a,
        startsAt: toDate(a.startsAt),
        endsAt: toDate(a.endsAt),
        serviceName: svc?.name ?? 'Servicio',
        serviceDuration: svc?.durationMinutes ?? 0,
        barberName: bb?.name ?? 'Barbero',
        barberInitials: initials(bb?.name),
        barberColor: bb?.color,
        price: a.priceSnapshot ?? svc?.basePrice ?? 0,
      }
    }),
  )

  const upcoming = computed(() =>
    enriched.value
      .filter((a) => a.status === 'booked' && a.startsAt.getTime() > Date.now())
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
  )
  const past = computed(() =>
    enriched.value
      .filter((a) => a.status !== 'booked' || a.startsAt.getTime() <= Date.now())
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
  )
  const next = computed(() => upcoming.value[0] ?? null)
  const byId = (id: string) => computed(() => enriched.value.find((a) => a.id === id) ?? null)

  return { enriched, upcoming, past, next, byId }
}
