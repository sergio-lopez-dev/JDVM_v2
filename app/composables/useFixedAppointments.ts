import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { effectivePrice, effectiveDuration } from '~~/schemas'
import type { FixedAppointment, FixedAppointmentInput } from '~~/schemas'
import { toDate } from '~~/lib/datetime'

// Clave de fecha local (yyyy-MM-dd) para las excepciones de una serie.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Resultado de crear/editar una serie: la plantilla, cuántas citas se materializaron
// y qué días se omitieron por chocar con una cita ya existente.
export interface FixedResult {
  id: string
  created: number
  skipped: Date[]
}

// Horizonte (en semanas) hasta el que se materializan citas de una serie fija.
const WEEKS_AHEAD = 12

export function useFixedAppointments() {
  const db = useFirestore()
  const { services } = useServices()
  const col = collection(db, COL.fixed_appointments)
  const appts = collection(db, COL.appointments)

  const fixed = useCollection<FixedAppointment>(query(col, orderBy('createdAt', 'desc')))

  // weekday ('mon'..'sun') -> número de día JS (0=dom..6=sáb).
  const WEEKDAY_TO_JS: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  }

  // Genera las ocurrencias (con hora) dentro del horizonte para un weekday/hora,
  // saltando `intervalWeeks` semanas entre cada una (1 = cada semana, 2 = cada dos…).
  function occurrences(weekday: string, time: string, intervalWeeks = 1): { start: Date; end: Date }[] {
    const [h, m] = time.split(':').map(Number)
    const target = WEEKDAY_TO_JS[weekday] ?? 1
    const step = Math.max(1, intervalWeeks)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Primer día >= hoy que cae en ese weekday.
    const first = new Date(today)
    first.setDate(first.getDate() + ((target - first.getDay() + 7) % 7))
    const out: { start: Date; end: Date }[] = []
    // Mantiene el horizonte ~constante (WEEKS_AHEAD): menos ocurrencias si el intervalo
    // es mayor (p. ej. cada 2 semanas → 6 ocurrencias en 12 semanas).
    for (let week = 0; week < WEEKS_AHEAD; week += step) {
      const d = new Date(first)
      d.setDate(d.getDate() + week * 7)
      d.setHours(h ?? 0, m ?? 0, 0, 0)
      out.push({ start: d, end: d })
    }
    return out
  }

  // Crea la plantilla y materializa las citas de las próximas semanas, OMITIENDO
  // los días en los que el barbero ya tenga una cita que solape ese hueco (se
  // devuelven en `skipped` para avisar al admin). La serie se crea igualmente.
  // `allowDuplicate` lo usa update() (borra la serie y la recrea: no debe chocar
  // contra la plantilla que acaba de borrar, que aún puede seguir en la caché reactiva).
  async function create(input: FixedAppointmentInput, opts: { allowDuplicate?: boolean } = {}): Promise<FixedResult> {
    const svc = services.value.find((s) => s.id === input.serviceId)
    const dur = svc ? effectiveDuration(svc, input.barberId) : 30
    const price = svc ? effectivePrice(svc, input.barberId) : 0
    const exceptions = input.exceptions ?? []
    const interval = input.intervalWeeks ?? 1

    // Idempotencia: si ya existe una serie activa idéntica (mismo barbero, día, hora,
    // servicio y cliente), no se crea otra. Evita duplicar la serie (y sus citas) si el
    // formulario se envía dos veces o el admin reintenta tras un fallo de red.
    if (!opts.allowDuplicate) {
      const dupe = fixed.value.find(
        (f) =>
          f.active !== false &&
          f.barberId === input.barberId &&
          f.weekday === input.weekday &&
          f.time === input.time &&
          f.serviceId === input.serviceId &&
          (f.clientId || '') === (input.clientId || ''),
      )
      if (dupe) {
        throw new Error('Ya existe una cita fija idéntica (mismo barbero, día y hora). No se ha duplicado.')
      }
    }

    const slots = occurrences(input.weekday, input.time, interval).map(({ start }) => ({
      start,
      end: new Date(start.getTime() + dur * 60_000),
    }))
    // Ancla = primera ocurrencia (medianoche), para el cálculo de semanas que "tocan".
    const anchor = new Date(slots[0]!.start)
    anchor.setHours(0, 0, 0, 0)

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
      intervalWeeks: interval,
      anchorDate: anchor,
      active: input.active ?? true,
      ...(exceptions.length ? { exceptions } : {}),
      createdAt: serverTimestamp(),
    })

    const skipped: Date[] = []
    const toCreate = slots.filter((sl) => {
      // Días liberados manualmente (excepciones): no se materializan.
      if (exceptions.includes(dateKey(sl.start))) return false
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

  // Intervalos ocupados (no cancelados) de un barbero en un rango. Consulta por rango
  // de fecha (índice de campo único, sin índice compuesto) y filtra el barbero en
  // cliente: así funciona en prod aunque no se hayan desplegado índices compuestos.
  async function barberBusy(barberId: string, from: Date, to: Date) {
    const snap = await getDocs(
      query(appts, where('startsAt', '>=', from), where('startsAt', '<=', to)),
    )
    return snap.docs
      .map((d) => d.data())
      .filter((a) => a.barberId === barberId && a.status !== 'cancelled')
      .map((a) => ({ s: toDate(a.startsAt).getTime(), e: toDate(a.endsAt).getTime() }))
  }

  // Borra la plantilla y sus citas futuras (las pasadas quedan como histórico).
  // Consulta solo por fixedId (sin índice compuesto) y filtra "futuras" en cliente.
  async function removeSeries(id: string) {
    const snap = await getDocs(query(appts, where('fixedId', '==', id)))
    const now = Date.now()
    await Promise.all(
      snap.docs
        .filter((d) => toDate(d.data().startsAt).getTime() >= now)
        .map((d) => deleteDoc(d.ref)),
    )
    await deleteDoc(doc(db, COL.fixed_appointments, id))
  }

  // Editar = borrar la serie (plantilla + citas futuras) y volver a materializarla
  // con los nuevos datos. Las citas pasadas de la serie anterior quedan como histórico.
  // Se conservan las excepciones (días liberados) de la serie anterior.
  async function update(id: string, input: FixedAppointmentInput) {
    const prev = await getDoc(doc(db, COL.fixed_appointments, id))
    const prevExc = ((prev.data()?.exceptions as string[] | undefined) ?? []).filter(Boolean)
    await removeSeries(id)
    return create({ ...input, exceptions: [...new Set([...(input.exceptions ?? []), ...prevExc])] }, { allowDuplicate: true })
  }

  // Libera UN día concreto de la serie sin borrarla: marca la excepción en la
  // plantilla y elimina la cita materializada de ese día → el hueco queda libre para
  // reservas (la serie sigue activa el resto de días).
  async function cancelOccurrence(fixedId: string, date: Date) {
    await updateDoc(doc(db, COL.fixed_appointments, fixedId), { exceptions: arrayUnion(dateKey(date)) })
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const snap = await getDocs(query(appts, where('fixedId', '==', fixedId)))
    await Promise.all(
      snap.docs
        .filter((d) => {
          const s = toDate(d.data().startsAt)
          return s >= dayStart && s < dayEnd
        })
        .map((d) => deleteDoc(d.ref)),
    )
  }

  // Deshace la liberación de un día: quita la excepción y vuelve a materializar la
  // cita de ese día (si el hueco sigue libre).
  async function restoreOccurrence(fixedId: string, date: Date) {
    const tplSnap = await getDoc(doc(db, COL.fixed_appointments, fixedId))
    if (!tplSnap.exists()) return
    const f = tplSnap.data() as FixedAppointment
    await updateDoc(doc(db, COL.fixed_appointments, fixedId), { exceptions: arrayRemove(dateKey(date)) })

    const svc = services.value.find((s) => s.id === f.serviceId)
    const dur = svc ? effectiveDuration(svc, f.barberId) : 30
    const price = svc ? effectivePrice(svc, f.barberId) : 0
    const [h, m] = f.time.split(':').map(Number)
    const start = new Date(date)
    start.setHours(h ?? 0, m ?? 0, 0, 0)
    const end = new Date(start.getTime() + dur * 60_000)
    const busy = await barberBusy(f.barberId, new Date(start.getTime() - 4 * 3_600_000), end)
    if (busy.some((b) => start.getTime() < b.e && b.s < end.getTime())) return // hueco ya ocupado

    const manual: Record<string, string> = {}
    if (f.clientName) manual.clientName = f.clientName
    if (f.clientPhone) manual.clientPhone = f.clientPhone
    await addDoc(appts, {
      clientId: f.clientId,
      ...manual,
      barberId: f.barberId,
      serviceId: f.serviceId,
      startsAt: start,
      endsAt: end,
      status: 'booked',
      priceSnapshot: price,
      isRecurring: true,
      fixedId,
      createdAt: serverTimestamp(),
    })
  }

  return { fixed, create, update, removeSeries, cancelOccurrence, restoreOccurrence }
}
