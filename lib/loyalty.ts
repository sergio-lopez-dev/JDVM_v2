import { addMonths } from 'date-fns'
import type { LoyaltyConfig, LoyaltyTier } from '~~/schemas'

// Lógica pura de fidelización: ganancia derivada de citas, caducidad de puntos y
// niveles. Sin estado ni Firestore → testeable de forma aislada.
//
// Modelo de caducidad: cada cita completada genera una "bolsa" de puntos que
// caduca a los `expiryMonths`. El saldo gastable se consume FIFO (primero las
// bolsas más antiguas que aún no han caducado). El nivel (Bronce/Plata/Oro) se
// calcula sobre los puntos BRUTOS aún no caducados (los ganados en la ventana),
// para que canjear no te baje de nivel.

export interface EarnLot {
  points: number
  at: Date
  expiresAt: Date
}
export interface SpendEvent {
  points: number
  at: Date
}

export interface LoyaltySummary {
  enabled: boolean
  balance: number // puntos gastables ahora mismo
  earned: number // puntos brutos activos (métrica de nivel)
  tier: LoyaltyTier
  nextTier: LoyaltyTier | null
  toNextTier: number // puntos que faltan para el siguiente nivel
  progress: number // 0..1 hacia el siguiente nivel
  nextExpiry: { points: number; at: Date } | null // próxima caducidad con saldo
}

export function pointsForPrice(price: number, pointsPerEuro: number): number {
  return Math.max(0, Math.floor((price || 0) * (pointsPerEuro || 0)))
}

// Bolsas de puntos a partir de las visitas completadas (precio + fecha).
export function buildEarnLots(
  visits: { startsAt: Date; price: number }[],
  config: LoyaltyConfig,
): EarnLot[] {
  return visits
    .map((v) => ({
      points: pointsForPrice(v.price, config.pointsPerEuro),
      at: v.startsAt,
      expiresAt: addMonths(v.startsAt, config.expiryMonths),
    }))
    .filter((l) => l.points > 0)
}

// Nivel actual y siguiente a partir de los puntos brutos activos.
export function tierFor(
  earned: number,
  tiers: LoyaltyTier[],
): { tier: LoyaltyTier; nextTier: LoyaltyTier | null } {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints)
  const first = sorted[0]
  if (!first) return { tier: { key: 'base', name: 'Socio', minPoints: 0 }, nextTier: null }
  let idx = 0
  for (let i = 0; i < sorted.length; i++) {
    if (earned >= sorted[i]!.minPoints) idx = i
  }
  return { tier: sorted[idx]!, nextTier: sorted[idx + 1] ?? null }
}

export function computeLoyalty(
  earns: EarnLot[],
  spends: SpendEvent[],
  config: LoyaltyConfig,
  now: Date = new Date(),
): LoyaltySummary {
  // Bolsas ordenadas por antigüedad; se consumen FIFO.
  const lots = [...earns]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((l) => ({ remaining: l.points, expiresAt: l.expiresAt }))

  for (const spend of [...spends].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    let need = spend.points
    for (const lot of lots) {
      if (need <= 0) break
      if (lot.remaining <= 0) continue
      // Una bolsa caducada antes del canje no puede consumirse.
      if (lot.expiresAt.getTime() <= spend.at.getTime()) continue
      const take = Math.min(lot.remaining, need)
      lot.remaining -= take
      need -= take
    }
  }

  let balance = 0
  let nextExpiry: { points: number; at: Date } | null = null
  for (const lot of lots) {
    if (lot.remaining > 0 && lot.expiresAt.getTime() > now.getTime()) {
      balance += lot.remaining
      if (!nextExpiry || lot.expiresAt.getTime() < nextExpiry.at.getTime()) {
        nextExpiry = { points: lot.remaining, at: lot.expiresAt }
      }
    }
  }

  const earned = earns
    .filter((l) => l.expiresAt.getTime() > now.getTime())
    .reduce((sum, l) => sum + l.points, 0)
  const { tier, nextTier } = tierFor(earned, config.tiers)
  const toNextTier = nextTier ? Math.max(0, nextTier.minPoints - earned) : 0
  const span = nextTier ? nextTier.minPoints - tier.minPoints : 0
  const progress = nextTier && span > 0 ? Math.min(1, Math.max(0, (earned - tier.minPoints) / span)) : 1

  return { enabled: config.enabled, balance, earned, tier, nextTier, toNextTier, progress, nextExpiry }
}
