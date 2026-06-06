// Migración legacy (prod-dump.json) → modelo v2, escribiendo SOLO en el EMULADOR.
// NUNCA toca producción: fuerza FIRESTORE_EMULATOR_HOST y projectId demo-jdvm.
//
// Requisitos: emuladores arriba (pnpm emulators) y prod-dump.json generado.
// Uso:  node scripts/migrate/migrate-to-emulator.cjs
//
// Decisiones aplicadas:
//  - Javi (javiidv7) = barbero; se le asigna TODO el histórico.
//  - Se descartan notifications, waitingList y timetable_rules pasadas (ruido).
//  - Como en prod NO hay precios/duraciones, se usan los de abajo (EDITABLES).

const fs = require('node:fs')
const path = require('node:path')

// ───────────────────────── CONFIG EDITABLE ─────────────────────────
// Precio (€) y duración (min) por servicio. AJUSTA y re-ejecuta si hace falta.
const SERVICES = {
  GpPnbNAzehwTTeW0u8PK: { name: 'Corte de pelo', price: 13, dur: 30, cat: 'cortes', priv: false },
  qUQvZw4aMIngmI2yR13q: { name: 'Corte + Barba', price: 18, dur: 45, cat: 'barba', priv: false },
  HzI6dfxep8L8zXvfxckG: { name: 'Corte + afeitado de barba', price: 18, dur: 45, cat: 'barba', priv: false },
  rV6j8DTI6zvtC48UjuQY: { name: 'Cliente fijo', price: 18, dur: 45, cat: 'extras', priv: true },
  '7oOvY6tcPdFea0T1jhOX': { name: 'Tinte', price: 25, dur: 60, cat: 'color', priv: true },
  beVBQRPKhcO2nM1i0x3o: { name: 'Mechas', price: 35, dur: 90, cat: 'color', priv: true },
}
const BARBER_UID = 'uo7gSWVRZ8a0mltoExQEo9LEaim1' // jdvm / javiidv7@gmail.com
const BARBER_COLOR = '#C2A24E'
const EMU_PASSWORD = '123456' // contraseña local para poder entrar en el emulador
// ─────────────────────────────────────────────────────────────────

// Guardas anti-producción.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
delete process.env.GOOGLE_APPLICATION_CREDENTIALS // no usar credenciales reales

const { initializeApp } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')

initializeApp({ projectId: 'demo-jdvm' })
const db = getFirestore()
const auth = getAuth()

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'prod-dump.json'), 'utf8'))
const C = dump.collections
const NOW = Date.now()

// timestamp serializado → Date
function decode(v) {
  if (v && typeof v === 'object' && v.__type__ === 'timestamp') return new Date(v.seconds * 1000 + Math.round(v.nanoseconds / 1e6))
  return v
}
// Fecha válida o null (legacy a veces guardó la cadena "Invalid Date").
function toDate(v) {
  const d = decode(v)
  return d instanceof Date && !isNaN(d.getTime()) ? d : null
}
const WD_JS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] // 0=Dom (esquema de settings)
const DAY_NAME = { domingo: 'sun', lunes: 'mon', martes: 'tue', 'miércoles': 'wed', miercoles: 'wed', jueves: 'thu', viernes: 'fri', 'sábado': 'sat', sabado: 'sat' }
function parseTimeSeconds(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t || '').trim())
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60
}
const hm = (h, m) => `${String(Number(h)).padStart(2, '0')}:${String(Number(m || 0)).padStart(2, '0')}`

// Escritura por lotes (máx 500 por batch).
async function batchWrite(colName, entries) {
  let batch = db.batch()
  let n = 0
  let written = 0
  for (const [id, data] of entries) {
    batch.set(db.collection(colName).doc(id), data)
    n++
    written++
    if (n === 450) {
      await batch.commit()
      batch = db.batch()
      n = 0
    }
  }
  if (n > 0) await batch.commit()
  console.log(`  · ${colName}: ${written} docs`)
  return written
}

// settings legacy → weekTimetable v2
function buildTimetable(s) {
  const tt = {}
  const morning = { start: hm(s.morningStartTime, s.morningStartMinutes), end: hm(s.morningEndTime, s.morningEndMinutes) }
  const afternoon = { start: hm(s.afternoonStartTime, s.afternoonStartMinutes), end: hm(s.afternoonEndTime, s.afternoonEndMinutes) }
  for (const d of s.daysOpened || []) {
    const key = WD_JS[d]
    if (key) tt[key] = { morning, afternoon }
  }
  return tt
}

async function run() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Sin FIRESTORE_EMULATOR_HOST: abortando por seguridad.')
  console.log('Destino:', process.env.FIRESTORE_EMULATOR_HOST, '(emulador demo-jdvm)\n')

  const settingsDoc = Object.values(C.settings)[0] || {}
  const timetable = buildTimetable(settingsDoc)

  // ---- services ----
  const serviceEntries = Object.entries(SERVICES).map(([id, s]) => [id, {
    name: s.name, description: '', durationMinutes: s.dur, basePrice: s.price,
    priceOverrides: {}, category: s.cat, isPrivate: s.priv,
  }])
  await batchWrite('services', serviceEntries)

  // ---- users ----
  const userEntries = Object.entries(C.users).map(([id, u]) => {
    const role = id === BARBER_UID ? 'barber' : u.admin ? 'admin' : 'client'
    const last = toDate(u.lastLogin)
    const doc = {
      name: u.name || '', email: u.email || '', phone: u.phone || '', role,
      allowPush: !!u.allowPush, createdAt: last || new Date(NOW), lastLogin: last || new Date(NOW),
    }
    if (u.instagram) doc.instagram = u.instagram
    return [id, doc]
  })
  await batchWrite('users', userEntries)

  // ---- barbers (solo Javi) ----
  const javi = C.users[BARBER_UID]
  await batchWrite('barbers', [[BARBER_UID, {
    name: javi?.name && javi.name !== 'jdvm' ? javi.name : 'Javi', slug: 'javi',
    photoUrl: '', bio: '', color: BARBER_COLOR, active: true,
    servicesOffered: Object.keys(SERVICES), timetable, vacations: [], commissionPercent: 50,
    ...(javi?.instagram ? { instagram: javi.instagram } : {}),
  }]])

  // ---- settings/main ----
  const dayNumToKey = (n) => WD_JS[n]
  const futureRules = Object.values(C.timetable_rules).filter((r) => decode(r.endDay)?.getTime() >= NOW)
  const special = futureRules.map((r, i) => {
    const morning = { start: hm(r.morningStartTime, r.morningStartMinutes), end: hm(r.morningEndTime, r.morningEndMinutes) }
    const afternoon = { start: hm(r.afternoonStartTime, r.afternoonStartMinutes), end: hm(r.afternoonEndTime, r.afternoonEndMinutes) }
    const ruleTt = {}
    for (const k of WD_JS) ruleTt[k] = { morning, afternoon }
    return { id: `legacy-${i}`, label: 'Importado de prod', range: { start: decode(r.startDay), end: decode(r.endDay) }, timetable: ruleTt }
  })
  await batchWrite('settings', [['main', {
    timetable,
    daysClosed: (settingsDoc.daysClosed || []).map(dayNumToKey).filter(Boolean),
    slotStepMinutes: 30,
    acceptingAppointments: true,
    acceptingCancellations: true,
    special,
    theme: 'forest',
    loyalty: { enabled: false, pointsPerEuro: 1, expiryMonths: 12, tiers: [
      { key: 'bronze', name: 'Bronce', minPoints: 0 },
      { key: 'silver', name: 'Plata', minPoints: 200 },
      { key: 'gold', name: 'Oro', minPoints: 500 },
    ] },
  }]])

  // ---- appointments ----
  let skipped = 0
  const apptEntries = []
  for (const [id, a] of Object.entries(C.appointments)) {
    const svc = SERVICES[a.type]
    if (!a.uid || !svc) { skipped++; continue }
    let startsAt = toDate(a.datetime)
    if (!startsAt) {
      const base = toDate(a.date)
      const secs = parseTimeSeconds(a.time)
      if (!base || secs == null) { skipped++; continue }
      startsAt = new Date(base.getTime() + secs * 1000)
    }
    const endsAt = new Date(startsAt.getTime() + svc.dur * 60000)
    const doc = {
      clientId: a.uid, barberId: BARBER_UID, serviceId: a.type,
      startsAt, endsAt, status: startsAt.getTime() < NOW ? 'completed' : 'booked',
      priceSnapshot: svc.price, paymentMethod: 'cash',
      isRecurring: !!a.fixed, createdAt: startsAt,
    }
    if (a.fixedID) doc.fixedId = a.fixedID
    apptEntries.push([id, doc])
  }
  // El legacy reservaba en rejilla de 30 min para UN solo barbero y no tenía
  // duración por servicio. Aplicar las duraciones nuevas (45/60/90) hace que las
  // citas consecutivas se solapen ("se pisan" en la agenda). Recortamos el fin de
  // cada cita para que no invada el inicio de la siguiente del mismo barbero.
  const byBarber = {}
  for (const [, d] of apptEntries) (byBarber[d.barberId] ||= []).push(d)
  let clamped = 0
  for (const list of Object.values(byBarber)) {
    list.sort((a, b) => a.startsAt - b.startsAt)
    for (let i = 0; i < list.length - 1; i++) {
      const next = list[i + 1].startsAt
      if (list[i].endsAt > next && next > list[i].startsAt) {
        list[i].endsAt = next
        clamped++
      }
    }
  }
  console.log(`    (citas recortadas para no solaparse con la siguiente: ${clamped})`)
  await batchWrite('appointments', apptEntries)
  console.log(`    (citas omitidas sin uid/servicio válido: ${skipped})`)

  // ---- fixed_appointments ----
  const fixedEntries = []
  for (const [id, f] of Object.entries(C.fixed_appointments)) {
    const weekday = DAY_NAME[(f.day || '').toString().trim().toLowerCase()]
    const time = (f.hour || '').match(/^\d{1,2}:\d{2}$/) ? f.hour : null
    if (!weekday || !time || !f.uid) continue
    fixedEntries.push([id, {
      clientId: f.uid, barberId: BARBER_UID, serviceId: 'rV6j8DTI6zvtC48UjuQY',
      weekday, time, active: true, createdAt: new Date(NOW),
    }])
  }
  await batchWrite('fixed_appointments', fixedEntries)

  // ---- reviews ----
  const reviewEntries = Object.entries(C.reviews).map(([id, r]) => [id, {
    clientId: r.uid || '', clientName: r.name || '', barberId: BARBER_UID,
    score: Number(r.score) || 5, tags: [], text: r.description || '', createdAt: toDate(r.date) || new Date(NOW),
  }])
  await batchWrite('reviews', reviewEntries)

  // ---- alerts ----
  const alertEntries = Object.entries(C.alerts).map(([id, a]) => {
    const level = /warning/.test(a.color || '') ? 'warning' : /success/.test(a.color || '') ? 'success' : 'info'
    return [id, { title: 'Normas del estudio', body: a.description || '', level, active: !!a.active, push: false, createdAt: new Date(NOW) }]
  })
  await batchWrite('alerts', alertEntries)

  // ---- Auth del emulador: admins + barbero (para poder entrar en local) ----
  console.log('\nAuth (emulador):')
  let created = 0
  for (const [id, u] of Object.entries(C.users)) {
    if (!(id === BARBER_UID || u.admin)) continue // solo staff
    if (!u.email) continue
    try {
      await auth.createUser({ uid: id, email: u.email, password: EMU_PASSWORD, displayName: u.name || u.email })
      created++
    } catch (e) {
      if (e.code !== 'auth/uid-already-exists' && e.code !== 'auth/email-already-exists') console.log('   auth err', u.email, e.code)
    }
  }
  console.log(`  · cuentas staff creadas: ${created} (contraseña ${EMU_PASSWORD})`)

  console.log('\n✔ Migración al emulador completada. Producción NO se ha tocado.')
  console.log('  Entra en local con cualquier admin (p.ej. javiidv7@gmail.com) /', EMU_PASSWORD)
}

run().catch((e) => { console.error('Migración falló:', e); process.exit(1) })
