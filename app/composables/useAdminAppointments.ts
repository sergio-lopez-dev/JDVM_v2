import { toDate } from '~~/lib/datetime'
import { initials } from '~~/lib/format'
import { effectivePrice, effectiveDuration } from '~~/schemas'
import type { Appointment } from '~~/schemas'

export interface AdminAppointment extends Omit<Appointment, 'startsAt' | 'endsAt'> {
  startsAt: Date
  endsAt: Date
  serviceName: string
  serviceDuration: number
  barberName: string
  barberInitials: string
  barberColor?: string
  // Color del servicio (si el admin se lo asignó) — solo para la agenda.
  serviceColor?: string
  // Color con el que pintar la cita en la agenda admin/barbero, ya resuelto por
  // prioridad: color de la serie fija > color del servicio > color del barbero.
  eventColor: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  clientInitials: string
  price: number
}

// Color de respaldo (acento dorado) si ni la serie, ni el servicio, ni el barbero
// tienen color asignado.
const FALLBACK_EVENT_COLOR = '#C2A24E'

// Enriquece una lista reactiva de citas (cualquier cliente/barbero) con
// servicio, barbero y cliente. Para las pantallas admin (Hoy, Agenda, fichas).
export function useAdminAppointments(source: Ref<Appointment[]>) {
  const { services } = useServices()
  const { barbers } = useBarbers()
  const { clients } = useClients()
  // Series fijas: para que una cita recurrente pueda heredar el color de su serie.
  const { fixed } = useFixedAppointments()

  const enriched = computed<AdminAppointment[]>(() =>
    source.value.map((a) => {
      const svc = services.value.find((s) => s.id === a.serviceId)
      const bb = barbers.value.find((b) => b.id === a.barberId)
      const fixedColor =
        a.isRecurring && a.fixedId ? fixed.value.find((f) => f.id === a.fixedId)?.color : undefined
      // Cliente registrado (por clientId) o, si es un walk-in manual, los datos que
      // se guardaron en la propia cita (clientName/clientPhone).
      const cl = a.clientId ? clients.value.find((c) => c.id === a.clientId) : null
      const cname = cl?.name ?? a.clientName ?? 'Cliente'
      return {
        ...a,
        // VueFire añade el id como propiedad NO enumerable → el spread `...a` la
        // pierde. Lo preservamos o el enrutado (/staff/cita/{id}, etc.) va a undefined.
        id: a.id,
        startsAt: toDate(a.startsAt),
        endsAt: toDate(a.endsAt),
        serviceName: svc?.name ?? 'Servicio',
        serviceDuration: svc ? effectiveDuration(svc, a.barberId) : 0,
        barberName: bb?.name ?? 'Barbero',
        barberInitials: initials(bb?.name),
        barberColor: bb?.color,
        serviceColor: svc?.color,
        eventColor: fixedColor ?? svc?.color ?? bb?.color ?? FALLBACK_EVENT_COLOR,
        clientName: cname,
        clientPhone: cl?.phone ?? a.clientPhone,
        clientEmail: cl?.email,
        clientInitials: initials(cname),
        price: a.priceSnapshot ?? (svc ? effectivePrice(svc, a.barberId) : 0),
      }
    }),
  )

  return { enriched }
}
