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
import type { Appointment, AppointmentInput } from '~~/schemas'
import { isCancellable } from '~~/lib/cancellation'

export function useAppointments() {
  const db = useFirestore()
  const user = useCurrentUser()
  const col = collection(db, 'appointments')

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

  // Cancelar respetando la ventana de 4 h (admin siempre puede).
  async function cancel(id: string, startsAt: Date, opts: { isAdmin?: boolean } = {}) {
    if (!isCancellable(startsAt, opts)) {
      throw new Error('Solo puedes cancelar hasta 4 h antes de la cita.')
    }
    await updateDoc(doc(db, 'appointments', id), { status: 'cancelled' })
  }

  async function reschedule(
    id: string,
    next: { startsAt: Date; endsAt: Date },
    currentStartsAt: Date,
    opts: { isAdmin?: boolean } = {},
  ) {
    if (!isCancellable(currentStartsAt, opts)) {
      throw new Error('Solo puedes reprogramar hasta 4 h antes de la cita.')
    }
    await updateDoc(doc(db, 'appointments', id), { startsAt: next.startsAt, endsAt: next.endsAt })
  }

  const remove = (id: string) => deleteDoc(doc(db, 'appointments', id))

  return { mine, forBarberOnDay, busyFor, create, cancel, reschedule, remove }
}
