import { z } from 'zod'
import { roleSchema, phoneEsSchema } from './common'

// Doc de la colección `users` (id = uid de Auth).
export const clientSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  phone: phoneEsSchema,
  instagram: z.string().optional(),
  role: roleSchema.default('client'),
  allowPush: z.boolean().default(false),
  createdAt: z.date().optional(),
  lastLogin: z.date().optional(),
})
export type Client = z.infer<typeof clientSchema>

// — Formularios de auth (VeeValidate + Zod) —

export const signUpSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email inválido'),
  phone: phoneEsSchema,
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})
export type SignInInput = z.infer<typeof signInSchema>

// Completar registro tras Google (cuando falta el teléfono).
export const completeProfileSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: phoneEsSchema,
})
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>

export const profileSchema = z.object({
  name: z.string().min(1),
  phone: phoneEsSchema,
  instagram: z.string().optional(),
  allowPush: z.boolean().default(false),
})
export type ProfileInput = z.infer<typeof profileSchema>
