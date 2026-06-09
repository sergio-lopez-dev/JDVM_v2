import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import type { GalleryImage } from '~~/schemas'

// Reescala una imagen a un borde máximo antes de subirla. Clave en iOS: las fotos
// de móvil (12MP+) consumen decenas de MB de memoria decodificadas y revientan la
// pestaña en galerías. Guardar ~1600px reduce ~10× esa memoria. Si algo falla
// (formato raro, sin canvas), sube el original sin bloquear.
async function downscaleImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  if (!import.meta.client) return file
  if (!file.type.startsWith('image/') || /svg|gif/.test(file.type)) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
    if (scale >= 1) {
      bmp.close?.()
      return file
    }
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close?.()
      return file
    }
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return blob ?? file
  } catch {
    return file
  }
}

// Galería del estudio: docs en `images` + binarios en Storage (carpeta gallery/).
export function useImages() {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const col = collection(db, COL.images)

  const images = useCollection<GalleryImage>(query(col, orderBy('order', 'asc')))

  // Sube el fichero a Storage y crea el doc con su URL.
  async function upload(file: File, meta: { caption?: string; barberId?: string } = {}) {
    const data = await downscaleImage(file)
    // Si se reescaló a JPEG, normaliza la extensión del nombre guardado.
    const resized = data !== file
    const baseName = file.name.replace(/[^\w.-]+/g, '_')
    const safe = resized ? baseName.replace(/\.[^.]+$/, '') + '.jpg' : baseName
    const path = `${STORAGE_PREFIX}gallery/${safe}`
    const sref = storageRef(storage, path)
    await uploadBytes(sref, data, { contentType: resized ? 'image/jpeg' : file.type })
    const url = await getDownloadURL(sref)
    await addDoc(col, {
      url,
      storagePath: path,
      caption: meta.caption ?? '',
      ...(meta.barberId ? { barberId: meta.barberId } : {}),
      order: images.value.length,
      createdAt: serverTimestamp(),
    })
  }

  // Borra el doc y, si se puede, el binario de Storage.
  async function remove(image: GalleryImage) {
    await deleteDoc(doc(db, COL.images, image.id))
    if (image.storagePath) {
      try {
        await deleteObject(storageRef(storage, image.storagePath))
      } catch {
        // El binario pudo borrarse ya; el doc es lo que importa.
      }
    }
  }

  return { images, upload, remove }
}
