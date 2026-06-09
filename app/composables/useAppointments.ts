import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Appointment, AppointmentInput, AppointmentStatus } from '~~/schemas'
import { isCancellable } from '~~/lib/cancellation'

export function useAppointments() {
  const db = useFirestore()
  const user = useCurrentUser()
  const { settings } = useSettings()
  const col = collection(db, COL.appointments)

  // Ventana de cancelación configurable (settings), 4 h por defecto.
  const cancelHours = () => settings.value?.cancellationWindowHours ?? 4

  // Citas del usuario logueado (más recientes primero).
  const mine = useCollection<Appointment>(
    computed(() =>
      user.value
        ? query(col, where('clientId', '==', user.value.uid), orderBy('startsAt', 'desc'))
        : null,
    ),
  )

  // Citas de un barbero para un día (para la agenda admin / barbero).
  function forBarberOnDay(barberId: string, day: Date) {
    const start = new Date(day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return useCollection<Appointment>(
      query(
        col,
        where('barberId', '==', barberId),
        where('startsAt', '>=', start),
        where('startsAt', '<', end),
        orderBy('startsAt', 'asc'),
      ),
    )
  }

  // Historial de un cliente (para su ficha en admin).
  function forClient(clientId: Ref<string | null>) {
    return useCollection<Appointment>(
      computed(() =>
        clientId.value
          ? query(col, where('clientId', '==', clientId.value), orderBy('startsAt', 'desc'))
          : null,
      ),
    )
  }

  // Citas de un barbero en un rango [start, end) — app del barbero.
  function forBarberInRange(barberId: Ref<string | null>, start: Ref<Date>, end: Ref<Date>) {
    return useCollection<Appointment>(
      computed(() =>
        barberId.value
          ? query(
              col,
              where('barberId', '==', barberId.value),
              where('startsAt', '>=', start.value),
              where('startsAt', '<', end.value),
              orderBy('startsAt', 'asc'),
            )
          : null,
      ),
    )
  }

  // Todas las citas de un día (todos los barberos) — agenda/Hoy admin.
  function onDay(day: Ref<Date>) {
    const q = computed(() => {
      const start = new Date(day.value)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      return query(
        col,
        where('startsAt', '>=', start),
        where('startsAt', '<', end),
        orderBy('startsAt', 'asc'),
      )
    })
    return useCollection<Appointment>(q)
  }

  // Todas las citas en un rango [start, end) — agenda semanal / reports.
  function inRange(start: Ref<Date>, end: Ref<Date>) {
    const q = computed(() =>
      query(
        col,
        where('startsAt', '>=', start.value),
        where('startsAt', '<', end.value),
        orderBy('startsAt', 'asc'),
      ),
    )
    return useCollection<Appointment>(q)
  }

  // Citas ocupadas (reactivas) de un barbero en un día — para generar slots.
  function busyFor(barberId: Ref<string | null>, day: Ref<Date>) {
    const q = computed(() => {
      if (!barberId.value) return null
      const start = new Date(day.value)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      return query(
        col,
        where('barberId', '==', barberId.value),
        where('startsAt', '>=', start),
        where('startsAt', '<', end),
        where('status', '==', 'booked'),
      )
    })
    return useCollection<Appointment>(q)
  }

  const create = (input: AppointmentInput) =>
    addDoc(col, { ...input, createdAt: serverTimestamp() })

  // Cancelar respetando la ventana configurable (admin siempre puede).
  async function cancel(id: string, startsAt: Date, opts: { isAdmin?: boolean } = {}) {
    const hours = cancelHours()
    if (!isCancellable(startsAt, { ...opts, hours })) {
      throw new Error(`Solo puedes cancelar hasta ${hours} h antes de la cita.`)
    }
    await updateDoc(doc(db, COL.appointments, id), { status: 'cancelled' })
  }

  async function reschedule(
    id: string,
    next: { startsAt: Date; endsAt: Date },
    currentStartsAt: Date,
    opts: { isAdmin?: boolean } = {},
  ) {
    const hours = cancelHours()
    if (!isCancellable(currentStartsAt, { ...opts, hours })) {
      throw new Error(`Solo puedes reprogramar hasta ${hours} h antes de la cita.`)
    }
    await updateDoc(doc(db, COL.appointments, id), { startsAt: next.startsAt, endsAt: next.endsAt })
  }

  // Cambio de estado libre (admin/barbero): completar, no-show, reactivar…
  const setStatus = (id: string, status: AppointmentStatus, patch: Partial<Appointment> = {}) =>
    updateDoc(doc(db, COL.appointments, id), { status, ...patch })

  const update = (id: string, patch: Partial<AppointmentInput>) =>
    updateDoc(doc(db, COL.appointments, id), patch)

  const remove = (id: string) => deleteDoc(doc(db, COL.appointments, id))

  return {
    mine,
    forBarberOnDay,
    forBarberInRange,
    forClient,
    onDay,
    inRange,
    busyFor,
    create,
    cancel,
    reschedule,
    setStatus,
    update,
    remove,
  }
}
