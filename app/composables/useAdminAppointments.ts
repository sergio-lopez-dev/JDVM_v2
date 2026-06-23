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
  // prioridad: color global de citas fijas (si es recurrente) > color del servicio >
  // color del barbero.
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
// Color (gris neutro) para los bloqueos de hueco (no son citas).
const BLOCK_COLOR = '#6B7280'

// Enriquece una lista reactiva de citas (cualquier cliente/barbero) con
// servicio, barbero y cliente. Para las pantallas admin (Hoy, Agenda, fichas).
export function useAdminAppointments(source: Ref<Appointment[]>) {
  const { services } = useServices()
  const { barbers } = useBarbers()
  const { clients } = useClients()
  // Color global de citas fijas (configurable en /admin/ajustes): TODAS las recurrentes
  // se pintan con él para distinguirlas de un vistazo.
  const { settings } = useSettings()

  const enriched = computed<AdminAppointment[]>(() =>
    source.value.map((a) => {
      const svc = services.value.find((s) => s.id === a.serviceId)
      const bb = barbers.value.find((b) => b.id === a.barberId)
      const fixedColor = a.isRecurring ? settings.value?.fixedAppointmentColor : undefined
      // Cliente registrado (por clientId) o, si es un walk-in manual, los datos que
      // se guardaron en la propia cita (clientName/clientPhone).
      const cl = a.clientId ? clients.value.find((c) => c.id === a.clientId) : null
      const cname = cl?.name ?? a.clientName ?? 'Cliente'
      // Un bloqueo no es una cita: sin cliente ni servicio. Se muestra como "Bloqueado"
      // (con el motivo) y se pinta en gris, para distinguirlo de un vistazo.
      const isBlock = a.type === 'block'
      return {
        ...a,
        // VueFire añade el id como propiedad NO enumerable → el spread `...a` la
        // pierde. Lo preservamos o el enrutado (/staff/cita/{id}, etc.) va a undefined.
        id: a.id,
        startsAt: toDate(a.startsAt),
        endsAt: toDate(a.endsAt),
        serviceName: isBlock ? (a.note || 'No disponible') : (svc?.name ?? 'Servicio'),
        serviceDuration: svc ? effectiveDuration(svc, a.barberId) : 0,
        barberName: bb?.name ?? 'Barbero',
        barberInitials: initials(bb?.name),
        barberColor: bb?.color,
        serviceColor: svc?.color,
        eventColor: isBlock ? BLOCK_COLOR : (fixedColor ?? svc?.color ?? bb?.color ?? FALLBACK_EVENT_COLOR),
        clientName: isBlock ? 'Bloqueado' : cname,
        clientPhone: isBlock ? undefined : (cl?.phone ?? a.clientPhone),
        clientEmail: isBlock ? undefined : cl?.email,
        clientInitials: isBlock ? '🔒' : initials(cname),
        price: isBlock ? 0 : (a.priceSnapshot ?? (svc ? effectivePrice(svc, a.barberId) : 0)),
      }
    }),
  )

  return { enriched }
}
