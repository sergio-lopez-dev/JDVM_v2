// Siembra datos de prueba en los EMULADORES (nunca prod).
// CommonJS (.cjs) a propósito: así funciona tanto con `node` como cuando
// firebase emulators:exec lo carga vía require().
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'

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

const fullDay = {
  morning: { start: '10:00', end: '14:00' },
  afternoon: { start: '16:00', end: '20:00' },
}
const localDay = {
  morning: { start: '10:00', end: '14:00' },
  afternoon: { start: '16:00', end: '22:00' },
}
const week = (day) => ({
  mon: day,
  tue: day,
  wed: day,
  thu: day,
  fri: day,
  sat: day.morning ? { morning: day.morning } : day,
})

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

const barbers = [
  { name: 'Dani Ruiz', slug: 'dani-ruiz', color: '#C2A24E', email: 'dani@jdvm.test', bio: 'Especialista en degradados y trabajo a navaja.' },
  { name: 'Marco S.', slug: 'marco-s', color: '#7C8C9E', email: 'marco@jdvm.test', bio: 'Clásico y preciso.' },
  { name: 'Jon T.', slug: 'jon-t', color: '#A6857B', email: 'jon@jdvm.test', bio: 'Texturizados y estilo moderno.' },
]

async function run() {
  for (const s of services) {
    const { id, ...data } = s
    await db.collection('v2_services').doc(id).set({ ...data, isPrivate: false }, { merge: true })
  }

  const barberUids = {}
  for (const b of barbers) {
    const uid = await ensureUser(b.email, b.name)
    barberUids[b.slug] = uid
    await db.collection('v2_users').doc(uid).set(
      { name: b.name, email: b.email, phone: '', role: 'barber', allowPush: false, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    await db.collection('v2_barbers').doc(uid).set(
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

  await db.collection('v2_settings').doc('main').set(
    {
      timetable: week(localDay),
      daysClosed: ['sun'],
      slotStepMinutes: 15,
      acceptingAppointments: true,
      acceptingCancellations: true,
      special: [],
      studio: {
        name: 'JDVM Hair Studio',
        city: 'Maracena, Granada',
        phone: '958 00 00 00',
        email: 'hola@jdvm.test',
        whatsapp: '+34 600 00 00 00',
        address: 'C/ Ancha 12, 18200 Maracena, Granada',
        instagram: '@jdvm',
        facebook: '',
        tiktok: '',
        mapsUrl: 'https://maps.google.com/?q=Maracena+Granada',
        foundedYear: 2018,
        logoUrl: '',
        logoPath: '',
        logoMarkUrl: '',
        logoMarkPath: '',
      },
      loyalty: {
        enabled: true,
        pointsPerEuro: 1,
        expiryMonths: 12,
        tiers: [
          { key: 'bronze', name: 'Bronce', minPoints: 0 },
          { key: 'silver', name: 'Plata', minPoints: 200 },
          { key: 'gold', name: 'Oro', minPoints: 500 },
        ],
      },
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

  // Catálogo de recompensas de ejemplo (programa Socio).
  const rewards = [
    ['reward-cerveza', { name: 'Cerveza de la casa', description: 'Una cerveza fría mientras te cortamos.', pointsCost: 50, icon: 'i-lucide-beer', active: true }],
    ['reward-barba', { name: 'Arreglo de barba', description: 'Perfilado de barba de regalo.', pointsCost: 150, icon: 'i-lucide-sparkles', active: true }],
    ['reward-corte', { name: 'Corte gratis', description: 'Un servicio de corte de pelo, gratis.', pointsCost: 300, icon: 'i-lucide-scissors', active: true }],
    ['reward-camiseta', { name: 'Camiseta JDVM', description: 'Camiseta de algodón de la marca.', pointsCost: 600, icon: 'i-lucide-shirt', active: true }],
  ]
  for (const [id, data] of rewards) {
    await db.collection('v2_rewards').doc(id).set({ ...data, createdAt: FieldValue.serverTimestamp() }, { merge: true })
  }

  const adminUid = await ensureUser('admin@jdvm.test', 'Admin JDVM')
  await db.collection('v2_users').doc(adminUid).set(
    { name: 'Admin JDVM', email: 'admin@jdvm.test', phone: '600000000', role: 'admin', allowPush: false, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  const clientUid = await ensureUser('alex@jdvm.test', 'Álex Morán')
  await db.collection('v2_users').doc(clientUid).set(
    { name: 'Álex Morán', email: 'alex@jdvm.test', phone: '600123456', role: 'client', allowPush: false, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  // Citas de ejemplo para el cliente (una próxima, una pasada) + reseña.
  const dani = barberUids['dani-ruiz']
  const now = new Date()
  const at = (daysAhead, h, m) => {
    const d = new Date(now)
    d.setDate(d.getDate() + daysAhead)
    d.setHours(h, m, 0, 0)
    return d
  }
  const up = at(2, 17, 30)
  const past = at(-14, 18, 0)
  await db.collection('v2_appointments').doc('seed-up').set(
    { clientId: clientUid, barberId: dani, serviceId: 'corte-barba', startsAt: up, endsAt: new Date(up.getTime() + 45 * 60000), status: 'booked', priceSnapshot: 18, isRecurring: false, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  await db.collection('v2_appointments').doc('seed-past').set(
    { clientId: clientUid, barberId: dani, serviceId: 'corte-barba', startsAt: past, endsAt: new Date(past.getTime() + 45 * 60000), status: 'completed', priceSnapshot: 18, paymentMethod: 'cash', isRecurring: false, createdAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  // Historial extra del cliente (para ver puntos/nivel del programa Socio).
  for (let i = 1; i <= 11; i++) {
    const d = at(-(i * 21), 18, 0)
    await db.collection('v2_appointments').doc('seed-hist-' + i).set(
      { clientId: clientUid, barberId: dani, serviceId: 'corte-barba', startsAt: d, endsAt: new Date(d.getTime() + 45 * 60000), status: 'completed', priceSnapshot: 18, paymentMethod: 'cash', isRecurring: false, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  }
  const marco = barberUids['marco-s']
  const jon = barberUids['jon-t']
  const seedReviews = [
    ['seed-rev1', { clientName: 'Carlos M.', barberId: dani, score: 5, tags: ['Puntual', 'Profesional'], text: 'El mejor fade que me han hecho. Atento al detalle y buena charla.' }],
    ['seed-rev2', { clientName: 'Iván P.', barberId: marco, score: 5, tags: ['Profesional', 'Buen ambiente'], text: 'Reservo desde la app en 30 segundos y nunca espero. Muy profesionales.' }],
    ['seed-rev3', { clientName: 'Rubén G.', barberId: jon, score: 4, tags: ['Buen precio', 'Limpio'], text: 'Llevo a mi hijo y a mí cada mes. Trato de diez y salimos como nuevos.' }],
  ]
  for (const [id, data] of seedReviews) {
    await db.collection('v2_reviews').doc(id).set(
      { clientId: clientUid, ...data, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
  }

  console.log('✔ Seed completado en el emulador (' + PROJECT_ID + ').')
  console.log('  Admin:   admin@jdvm.test / ' + PASSWORD)
  console.log('  Cliente: alex@jdvm.test  / ' + PASSWORD)
}

run().catch((e) => {
  console.error('Seed falló:', e)
  process.exit(1)
})
