import { z } from 'zod'

// Imagen de la galería del estudio (colección `images`).
// El binario vive en Firebase Storage; este doc guarda la URL + metadatos.
export const imageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  // Ruta en Storage (para poder borrar el binario al borrar el doc).
  storagePath: z.string(),
  caption: z.string().default(''),
  // Barbero al que se atribuye el trabajo (opcional).
  barberId: z.string().optional(),
  // Orden manual en la galería (menor = antes).
  order: z.number().int().default(0),
  createdAt: z.date().optional(),
})
export type GalleryImage = z.infer<typeof imageSchema>

export const imageInputSchema = imageSchema.omit({ id: true })
export type GalleryImageInput = z.infer<typeof imageInputSchema>
