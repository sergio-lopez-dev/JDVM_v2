// Setup mínimo de la app v2 en el proyecto REAL jdvm-d82b6 (compartido con la v1).
// SOLO escribe en colecciones v2_* → NO afecta a la app legacy v1.
//
//  - users_v2/{uid}.role = 'admin' para los admins conocidos (buscados por email
//    en el Auth, que es el mismo que la v1).
//  - settings_v2/main con una configuración por defecto (horario, marca, etc.) para
//    que el panel y la reserva funcionen desde el primer momento.
//
// NO migra citas ni servicios (eso lo hará el superadmin desde el panel).
// Requiere GOOGLE_APPLICATION_CREDENTIALS = service account de jdvm-d82b6.
// Uso:  node scripts/migrate/setup-prod-v2.cjs

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Variables de emulador activas: abortando (esto escribe en PRODUCCIÓN).')
}
const TARGET = 'jdvm-d82b6'
const ADMIN_EMAILS = [
  'sergio.lj.gr@gmail.com',
  'javiidv7@gmail.com',
  'armandogarrido87@gmail.com',
  'arman-as@hotmail.com',
]

const app = initializeApp({ credential: applicationDefault(), projectId: TARGET })
if (app.options.projectId !== TARGET) throw new Error(`projectId inesperado: ${app.options.projectId}`)
const db = getFirestore()
const auth = getAuth()

const day = { morning: { start: '10:00', end: '14:00' }, afternoon: { start: '16:00', end: '20:30' } }
const week = { mon: day, tue: day, wed: day, thu: day, fri: day, sat: { morning: { start: '10:00', end: '14:00' } } }

async function run() {
  console.log(`Destino: ${TARGET} (PRODUCCIÓN · solo colecciones v2_*)\n`)

  // --- admins → users_v2.role = 'admin' ---
  for (const email of ADMIN_EMAILS) {
    try {
      const u = await auth.getUserByEmail(email)
      await db.collection('users_v2').doc(u.uid).set(
        {
          name: u.displayName || '',
          email,
          role: 'admin',
          allowPush: false,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      console.log(`  admin: ${email} (${u.uid})`)
    } catch (e) {
      console.log(`  · ${email}: ${e.code || e.message}`)
    }
  }

  // --- settings_v2/main (config por defecto, editable en /admin/ajustes) ---
  await db.collection('settings_v2').doc('main').set(
    {
      timetable: week,
      daysClosed: ['sun'],
      slotStepMinutes: 15,
      acceptingAppointments: true,
      acceptingCancellations: true,
      special: [],
      theme: 'forest',
      studio: {
        name: 'JDVM Hair Studio',
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
        heroVideoUrl: '',
        heroVideoPath: '',
      },
      loyalty: { enabled: false, pointsPerEuro: 1, expiryMonths: 12, tiers: [
        { key: 'bronze', name: 'Bronce', minPoints: 0 },
        { key: 'silver', name: 'Plata', minPoints: 200 },
        { key: 'gold', name: 'Oro', minPoints: 500 },
      ] },
      serviceCategories: [
        { id: 'cortes', name: 'Cortes' },
        { id: 'barba', name: 'Barba' },
        { id: 'color', name: 'Color' },
        { id: 'premium', name: 'Premium' },
        { id: 'extras', name: 'Extras' },
      ],
    },
    { merge: true },
  )
  console.log('\n✔ settings_v2/main creado. Setup mínimo completado (v1 intacta).')
  console.log('  Entra con el superadmin → /admin para configurar servicios y dar de alta al barbero.')
}

run().catch((e) => {
  console.error('Setup falló:', e)
  process.exit(1)
})
