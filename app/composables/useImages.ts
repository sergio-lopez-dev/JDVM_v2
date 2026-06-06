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

// Galería del estudio: docs en `images` + binarios en Storage (carpeta gallery/).
export function useImages() {
  const db = useFirestore()
  const storage = useFirebaseStorage()
  const col = collection(db, 'images')

  const images = useCollection<GalleryImage>(query(col, orderBy('order', 'asc')))

  // Sube el fichero a Storage y crea el doc con su URL.
  async function upload(file: File, meta: { caption?: string; barberId?: string } = {}) {
    const safe = file.name.replace(/[^\w.-]+/g, '_')
    const path = `gallery/${safe}`
    const sref = storageRef(storage, path)
    await uploadBytes(sref, file)
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
    await deleteDoc(doc(db, 'images', image.id))
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
