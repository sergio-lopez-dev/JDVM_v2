/**
 * Cloud Functions — JDVM v2 (1ª gen, región europe-west1)
 *
 * Se usa 1ª gen (como las funciones de la v1 ya desplegadas) para NO requerir los
 * bindings de IAM de Eventarc/Run que pide la 2ª gen (que necesitan rol Owner).
 *
 * 1) inviteBarber  (callable)  — email de invitación de barbero (Resend).
 * 2) onAppointmentCreated      — push + aviso in-app al barbero y al admin (cita nueva).
 * 3) onAppointmentUpdated      — al pasar a 'cancelled': push a barbero + admin.
 * 4) onAlertCreated            — noticia destacada con push:true → difusión push a clientes.
 * 5) broadcastToClients (call) — aviso push + buzón a TODOS los clientes (sin banner).
 * 6) sendReminders (cron 5m)   — recordatorio al cliente 24 h y 1 h antes.
 *
 * Tokens FCM en users_v2/{uid}/fcmTokens/{token}. Avisos in-app en notifications_v2.
 * Secreto: RESEND_API_KEY (Secret Manager). Var: FROM_EMAIL (functions/.env).
 */
const functions = require('firebase-functions/v1')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { DateTime } = require('luxon')
const { Resend } = require('resend')

initializeApp()
const db = getFirestore()

const REGION = 'europe-west1'
const TZ = 'Europe/Madrid'
const REMINDER_MINUTES = [1440, 60] // 24 h y 1 h antes
// El cron corre cada 5 min. Ventana SOLO hacia atrás respecto al hito "X antes": el
// recordatorio se manda cuando faltan ≤ X (justo en el hito o un pelín después, ya más
// cerca de la cita), NUNCA cuando aún falta MÁS de X. Así el recordatorio de 24 h jamás
// sale con más de 24 h de antelación. 6 min cubren el intervalo del cron (5 min) sin
// dejar huecos ni mandarlo antes de tiempo.
const REMINDER_WINDOW_MS = 6 * 60 * 1000

const C = {
  users: 'users_v2',
  barbers: 'barbers_v2',
  services: 'services_v2',
  appointments: 'appointments_v2',
  notifications: 'notifications_v2',
  alerts: 'alerts_v2',
  invites: 'barber_invites_v2',
  settings: 'settings_v2',
}

const normalizeEmail = (e) => String(e || '').trim().toLowerCase()

// ───────────────────────── helpers ─────────────────────────

async function studioName() {
  const snap = await db.doc(`${C.settings}/main`).get()
  return snap.exists ? snap.data()?.studio?.name || 'JDVM Hair Studio' : 'JDVM Hair Studio'
}

async function getUserName(uid) {
  if (!uid) return ''
  const s = await db.doc(`${C.users}/${uid}`).get()
  return s.exists ? s.data()?.name || '' : ''
}

async function getServiceName(serviceId) {
  if (!serviceId) return 'servicio'
  const s = await db.doc(`${C.services}/${serviceId}`).get()
  return s.exists ? s.data()?.name || 'servicio' : 'servicio'
}

async function getBarberName(barberId) {
  if (!barberId) return ''
  const s = await db.doc(`${C.barbers}/${barberId}`).get()
  return s.exists ? s.data()?.name || '' : ''
}

async function getAdminUids() {
  const snap = await db.collection(C.users).where('role', '==', 'admin').get()
  return snap.docs.map((d) => d.id)
}

async function getClientUids() {
  const snap = await db.collection(C.users).where('role', '==', 'client').get()
  return snap.docs.map((d) => d.id)
}

// Tokens FCM de un usuario (solo si permite push).
async function getUserTokens(uid) {
  if (!uid) return []
  const userSnap = await db.doc(`${C.users}/${uid}`).get()
  if (!userSnap.exists || userSnap.data()?.allowPush !== true) return []
  const tokSnap = await db.collection(`${C.users}/${uid}/fcmTokens`).get()
  return tokSnap.docs.map((d) => d.id)
}

// Envía push a una lista de tokens y limpia los inválidos.
// IMPORTANTE (anti-duplicados): mensaje DATA-ONLY (sin clave `notification`). En web,
// un payload con `notification` lo auto-muestra el navegador Y ADEMÁS dispara
// onBackgroundMessage del SW → 2 notificaciones del sistema por cada push. Mandando
// solo `data`, únicamente el service worker lo pinta (una sola vez). El SW y el
// handler de primer plano leen título/cuerpo de `data`.
async function pushToTokens(tokens, uid, { title, body, data }) {
  if (!tokens.length) return
  const payloadData = Object.fromEntries(
    Object.entries({ ...(data || {}), title, body }).map(([k, v]) => [k, String(v ?? '')]),
  )
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: payloadData,
    webpush: { fcmOptions: { link: (data && data.link) || '/' } },
  })
  const dead = []
  res.responses.forEach((r, i) => {
    const code = r.error?.code || ''
    if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(code)) {
      dead.push(tokens[i])
    }
  })
  await Promise.all(dead.map((t) => db.doc(`${C.users}/${uid}/fcmTokens/${t}`).delete().catch(() => {})))
}

// Solo push (sin crear aviso in-app). Para cancelaciones, donde la app ya crea el
// aviso in-app (a admin y barbero) — aquí solo añadimos la entrega por push.
async function pushUser(uid, payload) {
  const tokens = await getUserTokens(uid)
  await pushToTokens(tokens, uid, payload)
}
async function pushAdmins(payload) {
  const admins = await getAdminUids()
  await Promise.all(admins.map((uid) => pushUser(uid, payload)))
}

// Crea aviso in-app (notifications_v2).
function createNotification(data) {
  return db.collection(C.notifications).add({ read: false, ...data, createdAt: FieldValue.serverTimestamp() })
}

// Avisa a un usuario concreto: in-app + push.
async function notifyUser(uid, { type, title, body, appointmentId, audience = 'user', link }) {
  await createNotification({ type, title, body, audience, targetUid: uid, ...(appointmentId ? { appointmentId } : {}) })
  await pushUser(uid, { title, body, data: { appointmentId, link } })
}

// Avisa a TODOS los admin: notificación de rol 'admin' (feed del panel) + push a cada uno.
async function notifyAdmins({ type, title, body, appointmentId, link }) {
  await createNotification({ type, title, body, audience: 'admin', ...(appointmentId ? { appointmentId } : {}) })
  const admins = await getAdminUids()
  await Promise.all(admins.map((uid) => pushUser(uid, { title, body, data: { appointmentId, link } })))
}

function fmtWhen(startsAt) {
  if (!startsAt?.toMillis) return ''
  return DateTime.fromMillis(startsAt.toMillis()).setZone(TZ).setLocale('es').toFormat("cccc d 'a las' HH:mm")
}

// ───────────────────── 1) inviteBarber (Resend) ─────────────────────

exports.inviteBarber = functions
  .region(REGION)
  .runWith({ secrets: ['RESEND_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Inicia sesión.')
    const caller = await db.doc(`${C.users}/${context.auth.uid}`).get()
    if (!caller.exists || caller.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Solo el admin puede invitar.')
    }

    const email = normalizeEmail(data?.email)
    const origin = String(data?.origin || '').replace(/\/$/, '')
    if (!email || !origin) throw new functions.https.HttpsError('invalid-argument', 'Faltan email u origin.')

    const inviteSnap = await db.doc(`${C.invites}/${email}`).get()
    if (!inviteSnap.exists) throw new functions.https.HttpsError('not-found', 'No hay invitación para ese email.')
    const name = inviteSnap.data()?.barber?.name || ''
    const studio = await studioName()
    const link = `${origin}/invitacion?email=${encodeURIComponent(email)}`
    const from = process.env.FROM_EMAIL || 'JDVM Hair Studio <onboarding@resend.dev>'

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: `Únete al equipo de ${studio}`,
      html: inviteEmailHtml({ name, studio, link }),
    })
    if (error) throw new functions.https.HttpsError('internal', `No se pudo enviar el email: ${error.message || error}`)
    return { ok: true }
  })

function inviteEmailHtml({ name, studio, link }) {
  const greet = name ? `Hola, ${name}` : 'Hola'
  return `<!doctype html><html lang="es"><body style="margin:0;background:#0B0F0C;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#E7E4DA">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0F0C;padding:32px 0">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:linear-gradient(160deg,#16241B,#0B0F0C);border:1px solid #2A352D;border-radius:18px;overflow:hidden">
        <tr><td style="padding:36px 36px 8px">
          <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C2A24E;font-weight:600">Invitación de equipo</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.1;color:#fff;font-weight:700">${greet}</h1>
        </td></tr>
        <tr><td style="padding:14px 36px 0;font-size:15px;line-height:1.6;color:#C9C5B8">
          Te damos acceso como barbero de <strong style="color:#fff">${studio}</strong>. Crea tu acceso para entrar en tu app: gestiona tu agenda, tus citas y tus ingresos desde el móvil.
        </td></tr>
        <tr><td align="center" style="padding:28px 36px 8px">
          <a href="${link}" style="display:inline-block;background:#C2A24E;color:#0B0F0C;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">Crear mi acceso</a>
        </td></tr>
        <tr><td style="padding:8px 36px 0;font-size:13px;line-height:1.6;color:#8B8F84">
          Podrás entrar con <strong style="color:#C9C5B8">Google</strong> o con <strong style="color:#C9C5B8">contraseña</strong> usando este mismo email. Si el botón no funciona, copia este enlace:
          <br><a href="${link}" style="color:#C2A24E;word-break:break-all">${link}</a>
        </td></tr>
        <tr><td style="padding:28px 36px 32px;border-top:1px solid #2A352D;font-size:12px;color:#6E726A">
          Si no esperabas este correo, puedes ignorarlo.<br>— El equipo de ${studio}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

// ───────────────── 2) cita nueva → barbero + admin ─────────────────

exports.onAppointmentCreated = functions
  .region(REGION)
  .firestore.document(`${C.appointments}/{id}`)
  .onCreate(async (snap, context) => {
    const appt = snap.data()
    if (!appt) return
    if (appt.status && !['booked', 'completed'].includes(appt.status)) return

    const [clientName, serviceName, barberName] = await Promise.all([
      getUserName(appt.clientId),
      getServiceName(appt.serviceId),
      getBarberName(appt.barberId),
    ])
    const when = fmtWhen(appt.startsAt)
    const appointmentId = context.params.id
    // El barbero ya sabe que es para él → no repetimos su nombre. El admin necesita
    // distinguir a QUÉ barbero se le ha reservado → su cuerpo incluye "con <barbero>".
    const body = `${clientName || 'Un cliente'} · ${serviceName} · ${when}.`
    const adminBody = barberName
      ? `${clientName || 'Un cliente'} · ${serviceName} con ${barberName} · ${when}.`
      : body

    // La cita SOLO la notifica al barbero en cuestión (su targetUid), no a los demás.
    if (appt.barberId) {
      await notifyUser(appt.barberId, { type: 'cita_nueva', title: '💈 Nueva cita', body, appointmentId, audience: 'barber', link: '/staff/agenda' })
    }
    await notifyAdmins({ type: 'cita_nueva', title: '💈 Nueva cita', body: adminBody, appointmentId, link: '/admin/agenda' })
  })

// ───────────── 3) cita cancelada → push a barbero + admin ─────────────

exports.onAppointmentUpdated = functions
  .region(REGION)
  .firestore.document(`${C.appointments}/{id}`)
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()
    if (!before || !after) return
    if (!(before.status !== 'cancelled' && after.status === 'cancelled')) return

    const [clientName, serviceName] = await Promise.all([
      getUserName(after.clientId),
      getServiceName(after.serviceId),
    ])
    const when = fmtWhen(after.startsAt)
    const appointmentId = context.params.id
    const title = 'Cita cancelada'
    const body = `${clientName || 'Un cliente'} canceló ${serviceName} · ${when}.`

    // SOLO PUSH: el aviso in-app (a admin y barbero) ya lo crea la app al cancelar.
    if (after.barberId) {
      await pushUser(after.barberId, { title, body, data: { appointmentId, link: '/staff/agenda' } })
    }
    await pushAdmins({ title, body, data: { appointmentId, link: '/admin/agenda' } })
  })

// ─────────── 4) noticia destacada con push → difusión a clientes ───────────
// Una "noticia destacada" (alerts_v2) es un banner persistente en la app del cliente.
// Si además se marca `push: true`, hacemos difusión a TODOS los clientes (solo push;
// el banner ya es el registro persistente, también visible en /avisos).
exports.onAlertCreated = functions
  .region(REGION)
  .firestore.document(`${C.alerts}/{id}`)
  .onCreate(async (snap) => {
    const alert = snap.data()
    if (!alert || alert.push !== true || alert.active === false) return
    const title = alert.title || 'Novedad'
    const body = alert.body || ''
    const uids = await getClientUids()
    await Promise.all(uids.map((uid) => pushUser(uid, { title, body, data: { link: '/avisos' } })))
  })

// ───────────── 5) aviso en difusión (callable, admin) ─────────────
// Notificación push + buzón a TODOS los clientes, SIN crear banner. Distinto de la
// noticia destacada (que sí se fija en la portada). Se llama desde /admin/notificaciones.
exports.broadcastToClients = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Inicia sesión.')
    const caller = await db.doc(`${C.users}/${context.auth.uid}`).get()
    if (!caller.exists || caller.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Solo el admin puede enviar avisos.')
    }
    const title = String(data?.title || '').trim()
    const body = String(data?.body || '').trim()
    if (!title) throw new functions.https.HttpsError('invalid-argument', 'Falta el título.')

    const uids = await getClientUids()
    await Promise.all(
      uids.map((uid) =>
        notifyUser(uid, { type: 'aviso', title, body, audience: 'client', link: '/avisos' }),
      ),
    )
    return { count: uids.length }
  })

// ───────────── 6) recordatorios programados (24 h y 1 h) ─────────────

exports.sendReminders = functions
  .region(REGION)
  .pubsub.schedule('every 5 minutes')
  .timeZone(TZ)
  .onRun(async () => {
    const nowMs = Date.now()
    for (const minutesBefore of REMINDER_MINUTES) {
      const target = nowMs + minutesBefore * 60 * 1000
      // Ventana [target - 6min, target]: solo citas a las que ya les faltan ≤ X (nunca
      // más), para no enviar el recordatorio antes del momento exacto "X antes".
      const startTs = Timestamp.fromMillis(target - REMINDER_WINDOW_MS)
      const endTs = Timestamp.fromMillis(target)

      const snap = await db
        .collection(C.appointments)
        .where('startsAt', '>=', startTs)
        .where('startsAt', '<=', endTs)
        .get()

      for (const docSnap of snap.docs) {
        const appt = docSnap.data()
        if (appt.status !== 'booked') continue
        const sent = Array.isArray(appt.remindersSent) ? appt.remindersSent : []
        if (sent.includes(minutesBefore)) continue
        if (!appt.clientId) continue

        const when = DateTime.fromMillis(appt.startsAt.toMillis()).setZone(TZ).toFormat('HH:mm')
        const title = '💈 Recordatorio de cita'
        const body =
          minutesBefore === 1440
            ? `Mañana a las ${when} tienes tu cita.`
            : `En 1 hora (a las ${when}) tienes tu cita.`

        try {
          await notifyUser(appt.clientId, { type: 'recordatorio', title, body, appointmentId: docSnap.id, audience: 'client', link: `/citas/${docSnap.id}` })
          await docSnap.ref.update({
            remindersSent: Array.from(new Set([...sent, minutesBefore])),
            lastReminderAt: FieldValue.serverTimestamp(),
          })
        } catch (e) {
          console.error('Error recordatorio', docSnap.id, e)
        }
      }
    }
    return null
  })
