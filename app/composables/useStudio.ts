import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import type { StudioInfo } from '~~/schemas'

// Marca/contacto del estudio (white-label). Fuente única de verdad leída de
// settings/main.studio, con valores por defecto. Lo usa toda la app en lugar de
// los antiguos textos hardcodeados ("JDVM", "Maracena"…).
const DEFAULTS: StudioInfo = {
  name: 'JDVM Barbería',
  city: 'Maracena, Granada',
  phone: '',
  email: '',
  whatsapp: '',
  address: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  mapsUrl: '',
  foundedYear: 2018,
  logoUrl: '',
  logoPath: '',
  logoMarkUrl: '',
  logoMarkPath: '',
}

function toUrl(handle: string, base: string) {
  if (!handle) return ''
  if (handle.startsWith('http')) return handle
  return base + handle.replace(/^@/, '')
}

export function useStudio() {
  const { settings, save } = useSettings()
  const storage = useFirebaseStorage()

  const studio = computed<StudioInfo>(() => ({ ...DEFAULTS, ...(settings.value?.studio ?? {}) }))

  const name = computed(() => studio.value.name || DEFAULTS.name)
  // Prefijo para códigos de reserva (p. ej. "JDVM-1A2B"), derivado del nombre.
  const codePrefix = computed(() => {
    const letters = name.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    return (letters.slice(0, 4) || 'CITA')
  })
  const igUrl = computed(() => toUrl(studio.value.instagram, 'https://instagram.com/'))
  const fbUrl = computed(() => toUrl(studio.value.facebook, 'https://facebook.com/'))
  const tiktokUrl = computed(() => toUrl(studio.value.tiktok, 'https://tiktok.com/@'))
  const waUrl = computed(() => {
    const w = studio.value.whatsapp
    if (!w) return ''
    if (w.startsWith('http')) return w
    return `https://wa.me/${w.replace(/[^\d]/g, '')}`
  })

  // Sube un logo (lockup o mark) a Storage y persiste su URL+path en settings.
  async function uploadLogo(file: File, kind: 'logo' | 'logoMark') {
    const ext = file.name.split('.').pop() || 'png'
    const path = `branding/${kind}.${ext}`
    const sref = storageRef(storage, path)
    await uploadBytes(sref, file)
    const url = await getDownloadURL(sref)
    await save({ studio: { ...studio.value, [`${kind}Url`]: url, [`${kind}Path`]: path } })
  }

  async function removeLogo(kind: 'logo' | 'logoMark') {
    const path = studio.value[`${kind}Path` as const]
    if (path) {
      try {
        await deleteObject(storageRef(storage, path))
      } catch {
        // el binario pudo borrarse ya; lo que importa es limpiar el doc
      }
    }
    await save({ studio: { ...studio.value, [`${kind}Url`]: '', [`${kind}Path`]: '' } })
  }

  return { studio, name, codePrefix, igUrl, fbUrl, tiktokUrl, waUrl, uploadLogo, removeLogo }
}
