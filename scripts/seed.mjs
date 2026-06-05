// Siembra datos de prueba en los EMULADORES (nunca prod).
// Requiere los emuladores corriendo: `pnpm emulators` y luego `pnpm seed`.
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Apuntar el Admin SDK a los emuladores locales.
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'

const PROJECT_ID = 'demo-jdvm'
initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()
const auth = getAuth()

const PASSWORD = '123456'

async function ensureUser(email, displayName) {
  try {
    const u = await auth.createUser({ email, password: PASSWORD, displayName })
    return u.uid
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      return (await auth.getUserByEmail(email)).uid
    }
    throw e
  }
}

// — Horarios —
const fullDay = {
  morning: { start: '10:00', end: '14:00' },
  afternoon: { start: '16:00', end: '20:00' },
}
const localDay = {
  morning: { start: '10:00', end: '14:00' },
  afternoon: { start: '16:00', end: '22:00' },
}
const week = (day) => ({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day.morning ? { morning: day.morning } : day })

// — Servicios (de la carta del diseño) —
const services = [
  { id: 'corte', name: 'Corte de pelo', description: 'Lavado, corte y peinado', durationMinutes: 30, basePrice: 13, category: 'cortes', color: '#C2A24E' },
  { id: 'corte-barba', name: 'Corte + barba', description: 'Corte completo + perfilado y toalla', durationMinutes: 45, basePrice: 18, category: 'cortes', color: '#C2A24E' },
  { id: 'corte-diseno', name: 'Corte + diseño', description: 'Líneas y degradado a navaja', durationMinutes: 50, basePrice: 22, category: 'cortes', color: '#A6857B' },
  { id: 'arreglo-barba', name: 'Arreglo de barba', description: 'Perfilado, toalla caliente y aceite', durationMinutes: 20, basePrice: 9, category: 'barba', color: '#7C8C9E' },
  { id: 'afeitado', name: 'Afeitado clásico', description: 'Navaja y toalla caliente', durationMinutes: 30, basePrice: 14, category: 'barba', color: '#7C8C9E' },
  { id: 'ritual', name: 'Ritual completo', description: 'Corte, barba, mascarilla y cejas', durationMinutes: 70, basePrice: 29, category: 'premium', color: '#A6857B' },
  { id: 'padre-hijo', name: 'Padre e hijo', description: 'Dos cortes, una experiencia', durationMinutes: 60, basePrice: 24, category: 'premium', color: '#A6857B' },
]

const allServiceIds = services.map((s) => s.id)

// — Barberos (con cuenta de auth; el doc usa el uid como id) —
const barbers = [
  { key: 'dani', name: 'Dani Ruiz', slug: 'dani-ruiz', color: '#C2A24E', email: 'dani@jdvm.test', bio: 'Especialista en degradados y trabajo a navaja.' },
  { key: 'marco', name: 'Marco S.', slug: 'marco-s', color: '#7C8C9E', email: 'marco@jdvm.test', bio: 'Clásico y preciso.' },
  { key: 'jon', name: 'Jon T.', slug: 'jon-t', color: '#A6857B', email: 'jon@jdvm.test', bio: 'Texturizados y estilo moderno.' },
]

async function run() {
  // Servicios
  for (const s of services) {
    const { id, ...data } = s
    await db.collection('services').doc(id).set({ ...data, isPrivate: false }, { merge: true })
  }

  // Barberos + sus cuentas + doc users
  for (const b of barbers) {
    const uid = await ensureUser(b.email, b.name)
    await db.collection('users').doc(uid).set(
      { name: b.name, email: b.email, phone: '', role: 'barber', allowPush: false, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    await db.collection('barbers').doc(uid).set(
      {
        name: b.name,
        slug: b.slug,
        photoUrl: '',
        bio: b.bio,
        color: b.color,
        active: true,
        servicesOffered: allServiceIds,
        timetable: week(fullDay),
        vacations: [],
      },
      { merge: true },
    )
  }

  // Configuración del local
  await db.collection('settings').doc('main').set(
    {
      timetable: week(localDay),
      daysClosed: ['sun'],
      slotStepMinutes: 15,
      acceptingAppointments: true,
      acceptingCancellations: true,
      special: [],
    },
    { merge: true },
  )

  // Admin + cliente de prueba
  const adminUid = await ensureUser('admin@jdvm.test', 'Admin JDVM')
  await db.collection('users').doc(adminUid).set(
    { name: 'Admin JDVM', email: 'admin@jdvm.test', phone: '600000000', role: 'admin', allowPush: false, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  const clientUid = await ensureUser('alex@jdvm.test', 'Álex Morán')
  await db.collection('users').doc(clientUid).set(
    { name: 'Álex Morán', email: 'alex@jdvm.test', phone: '600123456', role: 'client', allowPush: false, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  console.log('✔ Seed completado en el emulador (' + PROJECT_ID + ').')
  console.log('  Admin:   admin@jdvm.test /', PASSWORD)
  console.log('  Cliente: alex@jdvm.test  /', PASSWORD)
  console.log('  Barberos: dani@/marco@/jon@jdvm.test /', PASSWORD)
}

run().catch((e) => {
  console.error('Seed falló:', e)
  process.exit(1)
})
