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
import { toDate } from '~~/lib/datetime'
import { buildEarnLots, computeLoyalty, type SpendEvent } from '~~/lib/loyalty'
import {
  DEFAULT_LOYALTY_CONFIG,
  type Reward,
  type RewardInput,
  type Redemption,
  type RedemptionStatus,
} from '~~/schemas'

// Capa de datos del programa de fidelización. Los puntos se DERIVAN de las citas
// completadas + los canjes (no hay colección de "movimientos"): así no se pueden
// falsear desde el cliente y funciona retroactivamente con el histórico.
export function useLoyalty() {
  const db = useFirestore()
  const user = useCurrentUser()
  const { client } = useCurrentClient()
  const { settings } = useSettings()

  const config = computed(() => settings.value?.loyalty ?? DEFAULT_LOYALTY_CONFIG)
  const enabled = computed(() => config.value.enabled === true)

  // — Catálogo de recompensas (lectura pública, escritura admin) —
  const rewardsCol = collection(db, COL.rewards)
  const rewards = useCollection<Reward>(rewardsCol)
  const activeRewards = computed(() =>
    rewards.value.filter((r) => r.active).sort((a, b) => a.pointsCost - b.pointsCost),
  )
  const createReward = (input: RewardInput) =>
    addDoc(rewardsCol, { ...input, createdAt: serverTimestamp() })
  const updateReward = (id: string, patch: Partial<RewardInput>) =>
    updateDoc(doc(db, COL.rewards, id), patch)
  const removeReward = (id: string) => deleteDoc(doc(db, COL.rewards, id))

  // — Canjes del usuario actual —
  const redemptionsCol = collection(db, COL.redemptions)
  const mineRedemptions = useCollection<Redemption>(
    computed(() =>
      user.value ? query(redemptionsCol, where('userId', '==', user.value.uid)) : null,
    ),
  )

  async function redeem(reward: Reward) {
    if (!user.value) throw new Error('Inicia sesión para canjear.')
    return addDoc(redemptionsCol, {
      userId: user.value.uid,
      userName: client.value?.name ?? user.value.displayName ?? '',
      rewardId: reward.id,
      rewardName: reward.name,
      pointsCost: reward.pointsCost,
      status: 'pending' as RedemptionStatus,
      createdAt: serverTimestamp(),
    })
  }
  const resolveRedemption = (id: string, status: 'fulfilled' | 'cancelled') =>
    updateDoc(doc(db, COL.redemptions, id), { status, resolvedAt: serverTimestamp() })

  // — Resumen del usuario actual (nivel, saldo, caducidad) —
  const { enriched } = useMyAppointments()
  function spendsFrom(reds: Redemption[]): SpendEvent[] {
    return reds
      .filter((r) => r.status !== 'cancelled')
      .map((r) => ({ points: r.pointsCost, at: r.createdAt ? toDate(r.createdAt) : new Date() }))
  }
  const mySummary = computed(() => {
    const visits = enriched.value
      .filter((a) => a.status === 'completed')
      .map((a) => ({ startsAt: a.startsAt, price: a.price }))
    return computeLoyalty(buildEarnLots(visits, config.value), spendsFrom(mineRedemptions.value), config.value)
  })

  // — Canjes para el panel admin (solo se suscribe quien lo invoque) —
  function adminRedemptions() {
    const all = useCollection<Redemption>(query(redemptionsCol, orderBy('createdAt', 'desc')))
    const pending = computed(() => all.value.filter((r) => r.status === 'pending'))
    return { all, pending }
  }

  // — Resumen de un cliente concreto, para su ficha en admin —
  function forClient(clientId: Ref<string | null>) {
    const { forClient: apptsForClient } = useAppointments()
    const { services } = useServices()
    const appts = apptsForClient(clientId)
    const reds = useCollection<Redemption>(
      computed(() =>
        clientId.value ? query(redemptionsCol, where('userId', '==', clientId.value)) : null,
      ),
    )
    const summary = computed(() => {
      const visits = appts.value
        .filter((a) => a.status === 'completed')
        .map((a) => ({
          startsAt: toDate(a.startsAt),
          price: a.priceSnapshot ?? services.value.find((s) => s.id === a.serviceId)?.basePrice ?? 0,
        }))
      return computeLoyalty(buildEarnLots(visits, config.value), spendsFrom(reds.value), config.value)
    })
    return { summary, redemptions: reds }
  }

  return {
    config,
    enabled,
    rewards,
    activeRewards,
    createReward,
    updateReward,
    removeReward,
    mineRedemptions,
    redeem,
    resolveRedemption,
    mySummary,
    adminRedemptions,
    forClient,
  }
}
