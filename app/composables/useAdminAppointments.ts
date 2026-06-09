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
  clientName: string
  clientPhone?: string
  clientEmail?: string
  clientInitials: string
  price: number
}

// Enriquece una lista reactiva de citas (cualquier cliente/barbero) con
// servicio, barbero y cliente. Para las pantallas admin (Hoy, Agenda, fichas).
export function useAdminAppointments(source: Ref<Appointment[]>) {
  const { services } = useServices()
  const { barbers } = useBarbers()
  const { clients } = useClients()

  const enriched = computed<AdminAppointment[]>(() =>
    source.value.map((a) => {
      const svc = services.value.find((s) => s.id === a.serviceId)
      const bb = barbers.value.find((b) => b.id === a.barberId)
      const cl = clients.value.find((c) => c.id === a.clientId)
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
        clientName: cl?.name ?? 'Cliente',
        clientPhone: cl?.phone,
        clientEmail: cl?.email,
        clientInitials: initials(cl?.name),
        price: a.priceSnapshot ?? (svc ? effectivePrice(svc, a.barberId) : 0),
      }
    }),
  )

  return { enriched }
}
