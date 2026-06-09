import { doc } from 'firebase/firestore'
import { toDate } from '~~/lib/datetime'
import { initials } from '~~/lib/format'
import { effectiveDuration, type Appointment } from '~~/schemas'

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
  const db = useFirestore()
  const { mine } = useAppointments()
  const { services } = useServices()
  const { barbers } = useBarbers()

  // Enriquece un doc de cita crudo con servicio/barbero y fechas.
  function enrich(a: Appointment): EnrichedAppointment {
    const svc = services.value.find((s) => s.id === a.serviceId)
    const bb = barbers.value.find((b) => b.id === a.barberId)
    return {
      ...a,
      startsAt: toDate(a.startsAt),
      endsAt: toDate(a.endsAt),
      serviceName: svc?.name ?? 'Servicio',
      serviceDuration: svc ? effectiveDuration(svc, a.barberId) : 0,
      barberName: bb?.name ?? 'Barbero',
      barberInitials: initials(bb?.name),
      barberColor: bb?.color,
      price: a.priceSnapshot ?? svc?.basePrice ?? 0,
    }
  }

  const enriched = computed<EnrichedAppointment[]>(() => mine.value.map(enrich))

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

  // Detalle por id leyendo el DOC directamente (no depende de que la lista `mine`
  // esté cargada): así no falla en deep-link/recarga. Devuelve también `pending`
  // para distinguir "cargando" de "no existe" y no mostrar "cita no encontrada"
  // antes de tiempo.
  function byDocId(id: string) {
    const raw = useDocument<Appointment>(doc(db, COL.appointments, id))
    const appt = computed<EnrichedAppointment | null>(() => (raw.value ? enrich(raw.value) : null))
    return { appt, pending: raw.pending }
  }

  return { enriched, upcoming, past, next, byId, byDocId }
}
