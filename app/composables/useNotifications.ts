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
import type { Notification, NotificationInput } from '~~/schemas'

export function useNotifications() {
  const db = useFirestore()
  const user = useCurrentUser()
  const col = collection(db, COL.notifications)

  // Buzón personal (cliente o barbero): lo dirigido a mí.
  const mine = useCollection<Notification>(
    computed(() =>
      user.value
        ? query(col, where('targetUid', '==', user.value.uid), orderBy('createdAt', 'desc'))
        : null,
    ),
  )

  // Feed del panel admin: avisos de rol 'admin' (cancelaciones, nuevas citas…).
  const adminFeed = useCollection<Notification>(
    query(col, where('audience', '==', 'admin'), orderBy('createdAt', 'desc')),
  )

  const unreadMine = computed(() => mine.value.filter((n) => !n.read).length)

  const create = (input: NotificationInput) =>
    addDoc(col, { ...input, createdAt: serverTimestamp() })

  // Aviso de cancelación → al panel (admin) y al barbero afectado.
  async function notifyCancellation(opts: {
    barberId?: string
    clientName: string
    serviceName: string
    when: string
    appointmentId?: string
  }) {
    const base = {
      type: 'cita_cancelada' as const,
      title: 'Cita cancelada',
      body: `${opts.clientName} canceló ${opts.serviceName} · ${opts.when}.`,
      read: false,
      ...(opts.appointmentId ? { appointmentId: opts.appointmentId } : {}),
    }
    await create({ ...base, audience: 'admin' })
    if (opts.barberId) await create({ ...base, audience: 'barber', targetUid: opts.barberId })
  }

  // Campaña: anima a reservar a una lista de clientes.
  async function campaign(targetUids: string[], title: string, body: string) {
    await Promise.all(
      targetUids.map((uid) =>
        create({ type: 'campania', title, body, audience: 'client', targetUid: uid, read: false }),
      ),
    )
  }

  const markRead = (id: string) => updateDoc(doc(db, COL.notifications, id), { read: true })
  const remove = (id: string) => deleteDoc(doc(db, COL.notifications, id))

  return { mine, adminFeed, unreadMine, create, notifyCancellation, campaign, markRead, remove }
}
