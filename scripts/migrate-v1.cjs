/**
 * Migración v1 (legacy) → v2 · MISMO proyecto Firebase (jdvm-d82b6).
 * Colecciones v1 (sin sufijo) → v2 (`*_v2`). Lee las v1 y escribe las _v2.
 *
 * SOLO MIGRA HACIA v2 — NUNCA TOCA EL LEGACY: las colecciones v1 (users, appointments,
 * fixed_appointments, fixed_appointments_exceptions, services, settings) se LEEN con
 * `.get()` y jamás se escriben ni se borran. No hay ninguna operación delete/update.
 * Además, el escritor tiene un guard que ABORTA si se intentara escribir en una
 * colección que no termine en `_v2`.
 *
 * DECISIONES (acordadas):
 *  - Todas las citas y fijas → barbero "Javi" (se resuelve en barbers_v2 por nombre/slug).
 *  - Servicios mapeados a los dos de v2: "Corte" y "Corte+Barba" (ambos 30 min).
 *    Heurística por nombre v1; overrides manuales en MANUAL_SERVICE_MAP.
 *  - Citas pasadas → status 'completed'; futuras → 'booked'.
 *  - Citas fijas → Javi + servicio "Corte".
 *  - Granularidad v2 = 30 min y duración de los dos servicios = 30 (paso --commit con config).
 *    OJO: bajar granularidad/duración NO afecta a citas ya guardadas (conservan startsAt/endsAt);
 *    solo cambia la generación de huecos para reservas NUEVAS.
 *
 * USO:
 *   # Dry-run (SOLO LECTURA, no escribe nada) — imprime informe y mapeos:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa-prod.json node scripts/migrate-v1.cjs
 *
 *   # Dry-run contra EMULADOR (para probar con una muestra cargada en el emulador):
 *   node scripts/migrate-v1.cjs --emulator
 *
 *   # Migración REAL (idempotente; por defecto NO sobreescribe docs ya migrados):
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa-prod.json node scripts/migrate-v1.cjs --commit
 *
 *   Flags:
 *     --commit         escribe de verdad (sin él = dry-run)
 *     --emulator       usa los emuladores (projectId demo-jdvm)
 *     --overwrite      sobreescribe citas v2 ya existentes con el mismo id (por defecto se saltan)
 *     --skip-config    NO toca settings/servicios (granularidad/duración)
 *     --skip-users     NO migra users → users_v2 (no recomendado: los nombres saldrían en blanco)
 *
 * Credenciales prod: una service account con permisos de Firestore en jdvm-d82b6
 * (GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON). El seed.cjs solo vale para emulador.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

// ───────────────────────── flags ─────────────────────────
const args = new Set(process.argv.slice(2))
const COMMIT = args.has('--commit')
const EMULATOR = args.has('--emulator')
const OVERWRITE = args.has('--overwrite')
const SKIP_CONFIG = args.has('--skip-config')
const SKIP_USERS = args.has('--skip-users')
// Borra de appointments_v2 las citas de PRUEBA (las que NO produce la migración: ni
// ids de citas v1 ni el patrón de fijas materializadas). Se ejecuta antes de migrar.
const CLEAN_TEST = args.has('--clean-test')
// Solo inspecciona (no migra) las citas v1 con fecha/hora no parseable, marcando las
// de este mes en adelante (las antiguas no nos interesan).
const INSPECT_BAD = args.has('--inspect-bad')

// Overrides manuales de servicio v1→v2 (si la heurística no acierta con alguno):
//   '<idServicioV1>': '<idServicioV2>'
const MANUAL_SERVICE_MAP = {}

// Barbero destino: se resuelve en barbers_v2 por el campo `name` EXACTO.
const JAVI_NAME = 'Javi'

// Duración fija de las citas migradas (v1 siempre 30 min).
const LEGACY_DURATION_MIN = 30
const WEEKS_AHEAD = 12 // materialización de fijas (igual que useFixedAppointments)

// ───────────────────────── conexión ─────────────────────────
if (EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  initializeApp({ projectId: 'demo-jdvm' })
} else {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('✖ Falta GOOGLE_APPLICATION_CREDENTIALS (service account de prod jdvm-d82b6).')
    process.exit(1)
  }
  initializeApp({ credential: applicationDefault(), projectId: 'jdvm-d82b6' })
}
const db = getFirestore()

const NOW = new Date()
const log = (...a) => console.log(...a)
const section = (t) => log(`\n${'━'.repeat(60)}\n${t}\n${'━'.repeat(60)}`)

// ───────────────────────── helpers ─────────────────────────
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

function toJsDate(v) {
  if (!v) return null
  if (typeof v.toDate === 'function') return v.toDate()
  if (v instanceof Date) return v
  if (typeof v === 'number') return new Date(v)
  return new Date(v)
}

// Partes de fecha (Y-M-D) de un instante en zona Europe/Madrid.
const MADRID = 'Europe/Madrid'
function madridParts(date) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: MADRID,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]))
  return { y: +p.year, mo: +p.month, d: +p.day }
}
// Offset (min) de Madrid en un instante dado: (hora local Madrid − UTC).
function madridOffsetMin(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]))
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour % 24), +p.minute, +p.second)
  return Math.round((asUTC - date.getTime()) / 60000)
}
// Instante UTC correcto para una hora "de pared" en Madrid (Y,M,D,h,m). DST-safe salvo
// el hueco exacto del cambio de hora (irrelevante para horario de barbería).
function madridWallToInstant(y, mo, d, h, mi) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi))
  const off = madridOffsetMin(guess)
  return new Date(guess.getTime() - off * 60000)
}
// Combina el DÍA (Timestamp v1, interpretado en Madrid) + hora "HH:MM" → Date real.
// Devuelve null si el día o la hora son inválidos (cita corrupta → se salta).
function combineDayAndTime(dayDate, timeStr) {
  if (!dayDate || isNaN(dayDate.getTime())) return null
  const parts = String(timeStr || '').split(':')
  const h = Number(parts[0])
  const mi = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null
  const { y, mo, d } = madridParts(dayDate)
  const out = madridWallToInstant(y, mo, d, h, mi)
  return isNaN(out.getTime()) ? null : out
}

// v1 dayNumber (1=Dom,2=Lun,...,7=Sáb) → weekday v2 ('mon'..'sun').
const DAYNUM_TO_WEEKDAY = { 1: 'sun', 2: 'mon', 3: 'tue', 4: 'wed', 5: 'thu', 6: 'fri', 7: 'sat' }
// nombre español → weekday (respaldo si falta dayNumber).
const DAYNAME_TO_WEEKDAY = {
  domingo: 'sun', lunes: 'mon', martes: 'tue', miercoles: 'wed',
  jueves: 'thu', viernes: 'fri', sabado: 'sat',
}
const WEEKDAY_TO_JS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

// GUARD de seguridad: este script SOLO migra/limpia HACIA v2 y NUNCA toca el legacy.
// Cualquier escritura o borrado cuya colección no termine en `_v2` aborta (las v1 se
// leen pero jamás se modifican/borran).
function assertV2(ref) {
  const colId = ref.parent && ref.parent.id
  if (!colId || !colId.endsWith('_v2')) {
    throw new Error(
      `BLOQUEADO: operación fuera de v2 en la colección "${colId}". ` +
        'Este script solo escribe/borra en colecciones *_v2 y preserva el legacy.',
    )
  }
}

// Escritor por lotes (máx 450 ops/batch). En dry-run solo cuenta.
function makeWriter() {
  let batch = COMMIT ? db.batch() : null
  let n = 0
  let total = 0
  let deleted = 0
  async function flush() {
    if (COMMIT && n > 0) {
      await batch.commit()
      batch = db.batch()
      n = 0
    }
  }
  return {
    async set(ref, data, opts) {
      assertV2(ref)
      total++
      if (COMMIT) {
        batch.set(ref, data, opts || {})
        if (++n >= 450) await flush()
      }
    },
    async del(ref) {
      assertV2(ref)
      deleted++
      if (COMMIT) {
        batch.delete(ref)
        if (++n >= 450) await flush()
      }
    },
    deletedCount: () => deleted,
    async done() {
      await flush()
      return total
    },
  }
}

// ───────────────────────── carga de referencias v2 ─────────────────────────
async function loadV2Refs() {
  const [barbersSnap, servicesSnap] = await Promise.all([
    db.collection('barbers_v2').get(),
    db.collection('services_v2').get(),
  ])
  const barbers = barbersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const services = servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  // Resolver Javi por el campo `name` EXACTO (= JAVI_NAME).
  const javiCandidates = barbers.filter((b) => b.name === JAVI_NAME)
  if (javiCandidates.length === 0) {
    throw new Error(
      `No encuentro un barbero con name === "${JAVI_NAME}" en barbers_v2. ` +
        'Barberos v2 actuales: ' +
        barbers.map((b) => `${JSON.stringify(b.name)} (${b.id})`).join(', '),
    )
  }
  if (javiCandidates.length > 1) {
    throw new Error(
      `Hay varios barberos con name === "${JAVI_NAME}": ` +
        javiCandidates.map((b) => `${b.name} (${b.id})`).join(', ') +
        '. Desambigua antes de migrar.',
    )
  }
  const javi = javiCandidates[0]

  // Resolver servicios "Corte" y "Corte+Barba".
  const hasBarba = (s) => norm(s.name).includes('barba') || norm(s.id).includes('barba')
  const hasCorte = (s) => norm(s.name).includes('corte') || norm(s.id).includes('corte')
  const corteBarba =
    services.find((s) => hasCorte(s) && hasBarba(s)) || services.find((s) => norm(s.id) === 'corte-barba')
  const corte =
    services.find((s) => norm(s.id) === 'corte') ||
    services.find((s) => hasCorte(s) && !hasBarba(s)) ||
    services.find((s) => norm(s.name) === 'corte')
  if (!corte || !corteBarba) {
    throw new Error(
      'No encuentro los servicios "Corte" y/o "Corte+Barba" en services_v2. ' +
        'Servicios v2 actuales: ' +
        services.map((s) => `${s.name} (${s.id})`).join(', '),
    )
  }
  return { barbers, services, javi, corte, corteBarba }
}

// Mapa v1 serviceId → v2 serviceId (por nombre, con overrides manuales).
async function buildServiceMap(corteId, corteBarbaId) {
  const snap = await db.collection('services').get()
  const map = {}
  const table = []
  const review = []
  for (const d of snap.docs) {
    const name = d.data().name || ''
    let target
    let reason
    if (MANUAL_SERVICE_MAP[d.id]) {
      target = MANUAL_SERVICE_MAP[d.id]
      reason = 'override manual'
    } else {
      const n = norm(name)
      const barba = n.includes('barba')
      const corte = n.includes('corte')
      if (corte && barba) { target = corteBarbaId; reason = 'corte+barba' }
      else if (corte) { target = corteId; reason = 'corte' }
      else if (barba) { target = corteBarbaId; reason = 'solo "barba" → corte+barba (REVISAR)' }
      else { target = corteId; reason = 'sin corte/barba → corte (REVISAR)' }
      if (reason.includes('REVISAR')) review.push({ id: d.id, name, target, reason })
    }
    map[d.id] = target
    table.push({ id: d.id, name, target, reason })
  }
  return { map, table, review }
}

const effectivePrice = (svc, barberId) =>
  (svc.priceOverrides && svc.priceOverrides[barberId]) ?? svc.basePrice ?? 0

// ───────────────────────── migración: users ─────────────────────────
async function migrateUsers(writer) {
  const [v1Snap, v2Snap] = await Promise.all([
    db.collection('users').get(),
    db.collection('users_v2').select().get(),
  ])
  const existing = new Set(v2Snap.docs.map((d) => d.id))
  let created = 0
  let backfilled = 0
  for (const d of v1Snap.docs) {
    const u = d.data()
    if (existing.has(d.id)) {
      // No tocar rol/banned de usuarios ya en v2 (evita degradar a Javi/admin). Solo
      // rellenar teléfono/instagram si faltan.
      const patch = {}
      if (u.phone) patch.phone = String(u.phone)
      if (u.instagram) patch.instagram = u.instagram
      if (Object.keys(patch).length) {
        await writer.set(db.collection('users_v2').doc(d.id), patch, { merge: true })
        backfilled++
      }
      continue
    }
    await writer.set(db.collection('users_v2').doc(d.id), {
      name: u.name || '',
      email: u.email || '',
      phone: u.phone ? String(u.phone) : '',
      instagram: u.instagram || '',
      role: u.admin === true ? 'admin' : 'client',
      allowPush: u.allowPush === true,
      lastLogin: u.lastLogin || null,
      createdAt: u.createdAt || FieldValue.serverTimestamp(),
    })
    created++
  }
  return { v1: v1Snap.size, created, backfilled, alreadyInV2: existing.size }
}

// ───────────────────────── limpieza de citas de prueba ─────────────────────────
// Borra de appointments_v2 SOLO lo que la migración NO va a (re)crear: docs cuyo id no
// es un id de cita v1 ni el patrón de una fija materializada (`{fixedId}__YYYY-MM-DD`).
// Así nunca borra datos migrados, solo las citas de prueba creadas a mano en v2.
const FIXED_ID_RE = /__\d{4}-\d{2}-\d{2}$/
async function cleanTestAppointments(writer) {
  const [v1Snap, v2Snap] = await Promise.all([
    db.collection('appointments').select().get(),
    db.collection('appointments_v2').select().get(),
  ])
  const v1Ids = new Set(v1Snap.docs.map((d) => d.id))
  const samples = []
  let toDelete = 0
  for (const d of v2Snap.docs) {
    if (v1Ids.has(d.id) || FIXED_ID_RE.test(d.id)) continue // proviene de la migración → conservar
    toDelete++
    if (samples.length < 20) samples.push(d.id)
    await writer.del(db.collection('appointments_v2').doc(d.id))
  }
  return { v2Existing: v2Snap.size, toDelete, samples }
}

// ───────────────────────── migración: appointments ─────────────────────────
async function migrateAppointments(writer, { javi, serviceMap, services, corteId }) {
  const [v1Snap, v2Snap, v2UsersSnap] = await Promise.all([
    db.collection('appointments').get(),
    db.collection('appointments_v2').select().get(),
    db.collection('users_v2').select().get(),
  ])
  const existing = new Set(v2Snap.docs.map((d) => d.id))
  const v2Users = new Set(v2UsersSnap.docs.map((d) => d.id))
  const svcById = Object.fromEntries(services.map((s) => [s.id, s]))

  const stats = {
    v1: v1Snap.size,
    v2Existing: existing.size,
    migrated: 0,
    skippedExisting: 0,
    completed: 0,
    booked: 0,
    noClient: 0,
    clientNotInV2: 0,
    serviceUnmapped: 0,
    badDate: 0,
  }
  for (const d of v1Snap.docs) {
    const a = d.data()
    if (!a.uid) { stats.noClient++; continue }
    if (!OVERWRITE && existing.has(d.id)) { stats.skippedExisting++; continue }

    const day = toJsDate(a.date)
    const startsAt = combineDayAndTime(day, a.time)
    if (!startsAt) { stats.badDate++; continue } // cita con fecha/hora corrupta → se salta
    if (!v2Users.has(a.uid)) stats.clientNotInV2++ // se migra igual; nombre saldrá del user migrado
    const endsAt = new Date(startsAt.getTime() + LEGACY_DURATION_MIN * 60000)

    let serviceId = serviceMap[a.type]
    if (!serviceId) { serviceId = corteId; stats.serviceUnmapped++ }
    const svc = svcById[serviceId]
    const price = svc ? effectivePrice(svc, javi.id) : 0

    const isPast = startsAt.getTime() < NOW.getTime()
    const status = isPast ? 'completed' : 'booked'
    if (isPast) stats.completed++
    else stats.booked++

    await writer.set(db.collection('appointments_v2').doc(d.id), {
      clientId: a.uid,
      barberId: javi.id,
      serviceId,
      startsAt,
      endsAt,
      status,
      priceSnapshot: price,
      isRecurring: false,
      createdAt: FieldValue.serverTimestamp(),
    })
    stats.migrated++
  }
  return stats
}

// ───────────────────────── migración: fijas + materialización ─────────────────────────
async function migrateFixed(writer, { javi, corteId, services }) {
  const [v1Snap, excSnap, v2ApptSnap] = await Promise.all([
    db.collection('fixed_appointments').get(),
    db.collection('fixed_appointments_exceptions').get(),
    db.collection('appointments_v2').select().get(),
  ])
  const existingAppt = new Set(v2ApptSnap.docs.map((d) => d.id))
  const svc = services.find((s) => s.id === corteId)
  const price = svc ? effectivePrice(svc, javi.id) : 0

  // Excepciones por fixedId → set de claves YYYY-MM-DD (en Madrid) a omitir.
  const excByFixed = {}
  for (const e of excSnap.docs) {
    const x = e.data()
    const day = toJsDate(x.date)
    if (!x.fixedAppointmentId || !day || isNaN(day.getTime())) continue
    const { y, mo, d } = madridParts(day)
    ;(excByFixed[x.fixedAppointmentId] ||= new Set()).add(`${y}-${mo}-${d}`)
  }

  const stats = { v1: v1Snap.size, templates: 0, noClient: 0, badTime: 0, materialized: 0, skippedExc: 0 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const d of v1Snap.docs) {
    const f = d.data()
    if (!f.uid) { stats.noClient++; continue } // v1 permite uid null → no se puede migrar limpio
    const weekday =
      DAYNUM_TO_WEEKDAY[f.dayNumber] || DAYNAME_TO_WEEKDAY[norm(f.day)] || null
    if (!weekday) continue

    // Plantilla v2 (preserva el id v1).
    await writer.set(db.collection('fixed_appointments_v2').doc(d.id), {
      clientId: f.uid,
      barberId: javi.id,
      serviceId: corteId,
      weekday,
      time: f.hour,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    })
    stats.templates++

    // Materializar 12 semanas hacia delante (id determinista → idempotente).
    const [h, mi] = String(f.hour || '').split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(mi)) { stats.badTime++; continue } // hora corrupta
    const target = WEEKDAY_TO_JS[weekday]
    const first = new Date(today)
    first.setDate(first.getDate() + ((target - first.getDay() + 7) % 7))
    for (let i = 0; i < WEEKS_AHEAD; i++) {
      const dd = new Date(first)
      dd.setDate(dd.getDate() + i * 7)
      const { y, mo, d: dnum } = madridParts(dd)
      const start = madridWallToInstant(y, mo, dnum, h || 0, mi || 0)
      const key = `${y}-${mo}-${dnum}`
      if (excByFixed[d.id]?.has(key)) { stats.skippedExc++; continue }
      const apptId = `${d.id}__${y}-${String(mo).padStart(2, '0')}-${String(dnum).padStart(2, '0')}`
      if (!OVERWRITE && existingAppt.has(apptId)) continue
      await writer.set(db.collection('appointments_v2').doc(apptId), {
        clientId: f.uid,
        barberId: javi.id,
        serviceId: corteId,
        startsAt: start,
        endsAt: new Date(start.getTime() + LEGACY_DURATION_MIN * 60000),
        status: 'booked',
        priceSnapshot: price,
        isRecurring: true,
        fixedId: d.id,
        createdAt: FieldValue.serverTimestamp(),
      })
      stats.materialized++
    }
  }
  return stats
}

// ───────────────────────── config v2 (granularidad/duración) ─────────────────────────
async function applyConfig(writer, { corte, corteBarba }) {
  // Granularidad a 30 min (como v1).
  await writer.set(db.collection('settings_v2').doc('main'), { slotStepMinutes: 30 }, { merge: true })
  // Duración 30 min para los dos servicios.
  await writer.set(db.collection('services_v2').doc(corte.id), { durationMinutes: 30 }, { merge: true })
  await writer.set(db.collection('services_v2').doc(corteBarba.id), { durationMinutes: 30 }, { merge: true })

  // Diff informativo de horarios v1 vs v2 (NO se auto-convierte: shapes distintos).
  const [v1Set, v2Set] = await Promise.all([
    db.collection('settings').get(),
    db.collection('settings_v2').doc('main').get(),
  ])
  return {
    v1Settings: v1Set.docs.map((d) => ({ id: d.id, data: d.data() })),
    v2Timetable: v2Set.exists ? v2Set.data().timetable : null,
  }
}

// ───────────────────────── inspección de fechas corruptas ─────────────────────────
async function inspectBad() {
  const snap = await db.collection('appointments').get()
  const mp = madridParts(NOW)
  const startMonth = madridWallToInstant(mp.y, mp.mo, 1, 0, 0) // 1 de este mes (Madrid)

  const bad = []
  const dateTypeCount = {}
  const rawSamples = []
  for (const d of snap.docs) {
    const a = d.data()
    const day = toJsDate(a.date)
    if (combineDayAndTime(day, a.time)) continue // parsea bien → no es problemática
    const dayValid = day && !isNaN(day.getTime())
    const dateType = a.date && typeof a.date.toDate === 'function' ? 'Timestamp' : a.date === undefined ? 'undefined' : a.date === null ? 'null' : typeof a.date
    dateTypeCount[dateType] = (dateTypeCount[dateType] || 0) + 1
    if (rawSamples.length < 6) rawSamples.push({ id: d.id, data: a })
    bad.push({
      id: d.id,
      rawTime: JSON.stringify(a.time),
      dateType,
      dayISO: dayValid ? day.toISOString() : null,
      recent: dayValid && day.getTime() >= startMonth.getTime(),
      client: a.clientName || '',
      type: a.type || '',
    })
  }
  const withDay = bad.filter((b) => b.dayISO)
  const noDay = bad.filter((b) => !b.dayISO)
  const recent = bad.filter((b) => b.recent)

  section('INSPECCIÓN de citas con fecha/hora no parseable')
  log(`  Total problemáticas: ${bad.length}`)
  log(`  · con DÍA válido pero HORA mala (recuperables): ${withDay.length}`)
  log(`  · sin día válido (date corrupto, no recuperable): ${noDay.length}`)
  log(`  · de ESTE MES en adelante (${mp.y}-${String(mp.mo).padStart(2, '0')}-01+): ${recent.length}`)
  log(`  · tipo del campo "date": ${JSON.stringify(dateTypeCount)}`)
  log('\n  Muestra de docs problemáticos (campos crudos):')
  for (const s of rawSamples) log(`   - ${s.id}: ${JSON.stringify(s.data)}`)
  log('\n  Muestra de valores de "time" mal formados (con día válido):')
  const sampleTimes = [...new Set(withDay.map((b) => b.rawTime))].slice(0, 20)
  log('  ' + sampleTimes.join('  '))
  log('\n  RECIENTES/FUTURAS (este mes en adelante) — detalle:')
  if (!recent.length) log('  (ninguna)')
  for (const b of recent.sort((a, c) => (a.dayISO || '').localeCompare(c.dayISO || ''))) {
    log(`   - ${b.id}  día=${b.dayISO}  time=${b.rawTime}  cliente="${b.client}"  type=${b.type}`)
  }
  process.exit(0)
}

// ───────────────────────── main ─────────────────────────
;(async () => {
  if (INSPECT_BAD) return inspectBad()
  section(`MIGRACIÓN v1 → v2  ·  ${COMMIT ? 'COMMIT (ESCRIBE)' : 'DRY-RUN (solo lectura)'}  ·  ${EMULATOR ? 'EMULADOR' : 'PROD jdvm-d82b6'}`)
  if (COMMIT && !EMULATOR) log('⚠️  Vas a ESCRIBIR en producción. Asegúrate de haber hecho antes un dry-run.')

  const refs = await loadV2Refs()
  log(`\nBarbero destino (Javi): ${refs.javi.name} (${refs.javi.id})`)
  log(`Servicio "Corte":       ${refs.corte.name} (${refs.corte.id})`)
  log(`Servicio "Corte+Barba": ${refs.corteBarba.name} (${refs.corteBarba.id})`)

  const svc = await buildServiceMap(refs.corte.id, refs.corteBarba.id)
  section('MAPEO DE SERVICIOS v1 → v2')
  for (const r of svc.table) log(`  ${r.name.padEnd(28)} (${r.id})  →  ${r.target}   [${r.reason}]`)
  if (svc.review.length) {
    log('\n  ⚠️  REVISAR (heurística dudosa, añade overrides en MANUAL_SERVICE_MAP si hace falta):')
    for (const r of svc.review) log(`     - ${r.name} (${r.id}) → ${r.target}`)
  }

  const writer = makeWriter()

  if (CLEAN_TEST) {
    const clean = await cleanTestAppointments(writer)
    section('LIMPIEZA de citas de prueba en appointments_v2')
    log(`  En appointments_v2: ${clean.v2Existing} · a borrar (no provienen de la migración): ${clean.toDelete}`)
    if (clean.samples.length) log(`  ids: ${clean.samples.join(', ')}${clean.toDelete > clean.samples.length ? ' …' : ''}`)
  } else {
    log('\n(ℹ️  Limpieza de citas de prueba desactivada. Añade --clean-test para borrarlas.)')
  }

  let usersStats = null
  if (!SKIP_USERS) {
    usersStats = await migrateUsers(writer)
    section('USERS → users_v2')
    log(usersStats)
  }

  const apptStats = await migrateAppointments(writer, {
    javi: refs.javi,
    serviceMap: svc.map,
    services: refs.services,
    corteId: refs.corte.id,
  })
  section('APPOINTMENTS → appointments_v2')
  log(apptStats)

  const fixedStats = await migrateFixed(writer, {
    javi: refs.javi,
    corteId: refs.corte.id,
    services: refs.services,
  })
  section('FIXED_APPOINTMENTS → fixed_appointments_v2 (+ materialización 12 semanas)')
  log(fixedStats)

  if (!SKIP_CONFIG) {
    const cfg = await applyConfig(writer, refs)
    section('CONFIG v2 (granularidad 30 + duración servicios 30)')
    log('  slotStepMinutes → 30 ; durationMinutes(Corte, Corte+Barba) → 30')
    log('\n  Horarios v1 (settings) — revisa que v2 coincida (no se auto-convierte):')
    log(JSON.stringify(cfg.v1Settings, null, 2))
    log('\n  Horario v2 actual (settings_v2/main.timetable):')
    log(JSON.stringify(cfg.v2Timetable, null, 2))
  }

  const totalOps = await writer.done()
  section('RESUMEN')
  log(`  Escrituras ${COMMIT ? 'aplicadas' : 'que se aplicarían'}: ${totalOps}`)
  log(`  Borrados (citas de prueba) ${COMMIT ? 'aplicados' : 'que se aplicarían'}: ${writer.deletedCount()}`)
  log(COMMIT ? '  ✅ Migración aplicada.' : '  ℹ️  DRY-RUN: no se ha escrito ni borrado nada. Añade --commit para ejecutar.')
  process.exit(0)
})().catch((e) => {
  console.error('\n✖ ERROR:', e.message)
  process.exit(1)
})
