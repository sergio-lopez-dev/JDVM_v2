import { sameDay } from '~~/lib/datetime'
import type { AdminAppointment } from '~/composables/useAdminAppointments'

// Datos del barbero logueado (su id de Auth = id de su doc barbers/{uid}).
// Una única consulta amplia [-180d, +60d] que enriquecemos y de la que
// derivamos hoy / semana / clientes / ingresos en cliente.
export function useBarber() {
  const user = useCurrentUser()
  const { forBarberInRange } = useAppointments()
  const { barbers } = useBarbers()
  const { reviews } = useReviews()

  const id = computed(() => user.value?.uid ?? null)

  const now = ref(new Date())
  if (import.meta.client) {
    const t = setInterval(() => (now.value = new Date()), 60_000)
    onScopeDispose(() => clearInterval(t))
  }
  const today = computed(() => {
    const d = new Date(now.value)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const rangeStart = computed(() => {
    const d = new Date(today.value)
    d.setDate(d.getDate() - 180)
    return d
  })
  const rangeEnd = computed(() => {
    const d = new Date(today.value)
    d.setDate(d.getDate() + 60)
    return d
  })

  const appts = forBarberInRange(id, rangeStart, rangeEnd)
  const { enriched } = useAdminAppointments(appts)

  const me = computed(() => barbers.value.find((b) => b.id === id.value) ?? null)
  const myReviews = computed(() => reviews.value.filter((r) => r.barberId === id.value))
  const rating = computed(() => {
    if (!myReviews.value.length) return 0
    return myReviews.value.reduce((s, r) => s + r.score, 0) / myReviews.value.length
  })

  // Citas activas de un día concreto, ordenadas.
  function onDay(day: Ref<Date>) {
    return computed(() =>
      enriched.value
        .filter((a) => a.status !== 'cancelled' && sameDay(a.startsAt, day.value))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    )
  }

  // ¿Cuál está en curso ahora?
  function isNow(a: AdminAppointment) {
    return a.status === 'booked' && a.startsAt <= now.value && a.endsAt > now.value
  }

  return { id, now, today, enriched, me, rating, myReviews, onDay, isNow, rangeStart, rangeEnd }
}
