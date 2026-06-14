import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { effectivePrice, effectiveDuration } from '~~/schemas'
import type { FixedAppointment, FixedAppointmentInput } from '~~/schemas'
import { toDate } from '~~/lib/datetime'

// Resultado de crear/editar una serie: la plantilla, cuántas citas se materializaron
// y qué días se omitieron por chocar con una cita ya existente.
export interface FixedResult {
  id: string
  created: number
  skipped: Date[]
}

// Cuántas semanas por delante se materializan al crear una cita fija.
const WEEKS_AHEAD = 12

export function useFixedAppointments() {
  const db = useFirestore()
  const { services } = useServices()
  const col = collection(db, COL.fixed_appointments)

  const fixed = useCollection<FixedAppointment>(query(col, orderBy('createdAt', 'desc')))

  // weekday ('mon'..'sun') -> número de día JS (0=dom..6=sáb).
  const WEEKDAY_TO_JS: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  }

  // Genera las fechas (con hora) de las próximas N semanas para un weekday/hora.
  function occurrences(weekday: string, time: string): { start: Date; end: Date }[] {
    const [h, m] = time.split(':').map(Number)
    const target = WEEKDAY_TO_JS[weekday] ?? 1
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Primer día >= hoy que cae en ese weekday.
    const first = new Date(today)
    first.setDate(first.getDate() + ((target - first.getDay() + 7) % 7))
    const out: { start: Date; end: Date }[] = []
    for (let i = 0; i < WEEKS_AHEAD; i++) {
      const d = new Date(first)
      d.setDate(d.getDate() + i * 7)
      d.setHours(h ?? 0, m ?? 0, 0, 0)
      out.push({ start: d, end: d })
    }
    return out
  }

  // Crea la plantilla y materializa las citas de las próximas semanas, OMITIENDO
  // los días en los que el barbero ya tenga una cita que solape ese hueco (se
  // devuelven en `skipped` para avisar al admin). La serie se crea igualmente.
  async function create(input: FixedAppointmentInput): Promise<FixedResult> {
    const svc = services.value.find((s) => s.id === input.serviceId)
    const dur = svc ? effectiveDuration(svc, input.barberId) : 30
    const price = svc ? effectivePrice(svc, input.barberId) : 0
    const appts = collection(db, COL.appointments)

    const slots = occurrences(input.weekday, input.time).map(({ start }) => ({
      start,
      end: new Date(start.getTime() + dur * 60_000),
    }))

    // Citas existentes del barbero en el rango (una sola consulta). Buffer inferior
    // para captar una cita que empiece antes pero solape el primer hueco.
    const busy = await barberBusy(
      input.barberId,
      new Date(slots[0]!.start.getTime() - 4 * 3_600_000),
      slots[slots.length - 1]!.end,
    )
    const clashes = (s: number, e: number) => busy.some((b) => s < b.e && b.s < e)

    // Datos de cliente NO registrado (walk-in). Se omiten si vacíos (Firestore no
    // admite undefined). Se guardan en la plantilla y en cada cita materializada.
    const manual: Record<string, string> = {}
    if (input.clientName) manual.clientName = input.clientName
    if (input.clientPhone) manual.clientPhone = input.clientPhone

    const tpl = await addDoc(col, {
      clientId: input.clientId,
      ...manual,
      barberId: input.barberId,
      serviceId: input.serviceId,
      weekday: input.weekday,
      time: input.time,
      active: input.active ?? true,
      // Color de la serie (solo agenda admin/barbero). Firestore no admite undefined.
      ...(input.color ? { color: input.color } : {}),
      createdAt: serverTimestamp(),
    })

    const skipped: Date[] = []
    const toCreate = slots.filter((sl) => {
      if (clashes(sl.start.getTime(), sl.end.getTime())) {
        skipped.push(sl.start)
        return false
      }
      return true
    })

    await Promise.all(
      toCreate.map((sl) =>
        addDoc(appts, {
          clientId: input.clientId,
          ...manual,
          barberId: input.barberId,
          serviceId: input.serviceId,
          startsAt: sl.start,
          endsAt: sl.end,
          status: 'booked',
          priceSnapshot: price,
          isRecurring: true,
          fixedId: tpl.id,
          createdAt: serverTimestamp(),
        }),
      ),
    )
    return { id: tpl.id, created: toCreate.length, skipped }
  }

  // Intervalos ocupados (no cancelados) de un barbero en un rango.
  async function barberBusy(barberId: string, from: Date, to: Date) {
    const appts = collection(db, COL.appointments)
    const snap = await getDocs(
      query(
        appts,
        where('barberId', '==', barberId),
        where('startsAt', '>=', from),
        where('startsAt', '<=', to),
      ),
    )
    return snap.docs
      .map((d) => d.data())
      .filter((a) => a.status !== 'cancelled')
      .map((a) => ({ s: toDate(a.startsAt).getTime(), e: toDate(a.endsAt).getTime() }))
  }

  // Borra la plantilla y sus citas futuras (las pasadas quedan como histórico).
  async function removeSeries(id: string) {
    const appts = collection(db, COL.appointments)
    const snap = await getDocs(
      query(appts, where('fixedId', '==', id), where('startsAt', '>=', new Date())),
    )
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    await deleteDoc(doc(db, COL.fixed_appointments, id))
  }

  // Editar = borrar la serie (plantilla + citas futuras) y volver a materializarla
  // con los nuevos datos. Las citas pasadas de la serie anterior quedan como histórico.
  async function update(id: string, input: FixedAppointmentInput) {
    await removeSeries(id)
    return create(input)
  }

  return { fixed, create, update, removeSeries }
}
