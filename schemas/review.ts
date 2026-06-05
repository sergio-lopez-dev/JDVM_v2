import { z } from 'zod'

export const reviewSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string().optional(),
  barberId: z.string(),
  appointmentId: z.string().optional(),
  score: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
  text: z.string().optional(),
  createdAt: z.date().optional(),
})
export type Review = z.infer<typeof reviewSchema>

export const reviewInputSchema = reviewSchema.omit({ id: true })
export type ReviewInput = z.infer<typeof reviewInputSchema>
