import { z } from 'zod'

// — Fidelización "Socio" (puntos, niveles, recompensas) —
// Configurable desde admin; deshabilitada por defecto. Los puntos se DERIVAN de
// las citas completadas (no se almacenan), por lo que un cliente no puede
// inflarlos: solo staff/admin marca una cita como `completed` (ver reglas).
// La caducidad y el cómputo FIFO viven en `lib/loyalty.ts`.

// Nivel de socio (Bronce / Plata / Oro…). `minPoints` = puntos activos (ganados
// dentro de la ventana de caducidad) necesarios para alcanzarlo.
export const loyaltyTierSchema = z.object({
  key: z.string(),
  name: z.string().min(1),
  minPoints: z.number().int().nonnegative(),
})
export type LoyaltyTier = z.infer<typeof loyaltyTierSchema>

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { key: 'bronze', name: 'Bronce', minPoints: 0 },
  { key: 'silver', name: 'Plata', minPoints: 200 },
  { key: 'gold', name: 'Oro', minPoints: 500 },
]

// Config de fidelización dentro de settings/main (`settings.loyalty`).
export const loyaltyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  // Puntos ganados por cada € gastado en una cita completada.
  pointsPerEuro: z.number().nonnegative().default(1),
  // Meses tras los que caduca cada bolsa de puntos ganada.
  expiryMonths: z.number().int().positive().default(12),
  tiers: z.array(loyaltyTierSchema).default(DEFAULT_TIERS),
})
export type LoyaltyConfig = z.infer<typeof loyaltyConfigSchema>

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  enabled: false,
  pointsPerEuro: 1,
  expiryMonths: 12,
  tiers: DEFAULT_TIERS,
}

// Recompensa canjeable del catálogo (la define el admin: corte gratis, camiseta,
// cerveza…). Colección `rewards`.
export const rewardSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  pointsCost: z.number().int().positive(),
  icon: z.string().default('i-lucide-gift'),
  active: z.boolean().default(true),
  createdAt: z.date().optional(),
})
export type Reward = z.infer<typeof rewardSchema>

export const rewardInputSchema = rewardSchema.omit({ id: true })
export type RewardInput = z.infer<typeof rewardInputSchema>

// Canje de una recompensa por un cliente. Colección `redemptions`. El cliente lo
// crea en estado `pending`; staff/admin lo entrega (`fulfilled`) o lo anula
// (`cancelled`). Un canje cancelado no descuenta puntos.
export const REDEMPTION_STATUSES = ['pending', 'fulfilled', 'cancelled'] as const
export const redemptionStatusSchema = z.enum(REDEMPTION_STATUSES)
export type RedemptionStatus = z.infer<typeof redemptionStatusSchema>

export const redemptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().default(''),
  rewardId: z.string(),
  rewardName: z.string(),
  pointsCost: z.number().int().nonnegative(),
  status: redemptionStatusSchema.default('pending'),
  createdAt: z.date().optional(),
  resolvedAt: z.date().optional(),
})
export type Redemption = z.infer<typeof redemptionSchema>

export const redemptionInputSchema = redemptionSchema.omit({ id: true })
export type RedemptionInput = z.infer<typeof redemptionInputSchema>
