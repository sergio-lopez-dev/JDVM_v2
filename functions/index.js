/**
 * Cloud Functions — JDVM v2 (2ª gen, región europe-west1)
 *
 * 1) inviteBarber  (callable) — envía el email de invitación de barbero (Resend).
 * 2) onAppointmentCreated     — push + aviso in-app al barbero y al admin (cita nueva).
 * 3) onAppointmentUpdated     — al pasar a 'cancelled': avisa a cliente + barbero + admin.
 * 4) sendReminders (cron 5m)  — recordatorio al cliente 24 h y 1 h antes.
 *
 * Tokens FCM en subcolección users_v2/{uid}/fcmTokens/{token}. Avisos in-app en
 * notifications_v2 (mismo shape que la app). Secretos: RESEND_API_KEY. Params: FROM_EMAIL.
 */
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { setGlobalOptions } = require('firebase-functions/v2')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { defineSecret, defineString } = require('firebase-functions/params')
const { DateTime } = require('luxon')
const { Resend } = require('resend')

initializeApp()
const db = getFirestore()

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })

const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const FROM_EMAIL = defineString('FROM_EMAIL', { default: 'JDVM Hair Studio <onboarding@resend.dev>' })

const TZ = 'Europe/Madrid'
const REMINDER_MINUTES = [1440, 60] // 24 h y 1 h antes
const TOLERANCE_MS = 3 * 60 * 1000 // el cron corre cada 5 min → ventana ±3 min

const C = {
  users: 'users_v2',
  barbers: 'barbers_v2',
  services: 'services_v2',
  appointments: 'appointments_v2',
  notifications: 'notifications_v2',
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

async function getAdminUids() {
  const snap = await db.collection(C.users).where('role', '==', 'admin').get()
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
async function pushToTokens(tokens, uid, { title, body, data }) {
  if (!tokens.length) return
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
    webpush: { fcmOptions: { link: (data && data.link) || '/' } },
  })
  // Borra tokens caducados/invalidados.
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
  const tokens = await getUserTokens(uid)
  await pushToTokens(tokens, uid, { title, body, data: { appointmentId, link } })
}

// Avisa a TODOS los admin: una notificación de rol 'admin' (feed del panel) + push a cada uno.
async function notifyAdmins({ type, title, body, appointmentId, link }) {
  await createNotification({ type, title, body, audience: 'admin', ...(appointmentId ? { appointmentId } : {}) })
  const admins = await getAdminUids()
  await Promise.all(
    admins.map(async (uid) => {
      const tokens = await getUserTokens(uid)
      await pushToTokens(tokens, uid, { title, body, data: { appointmentId, link } })
    }),
  )
}

function fmtWhen(startsAt) {
  if (!startsAt?.toMillis) return ''
  return DateTime.fromMillis(startsAt.toMillis()).setZone(TZ).setLocale('es').toFormat("cccc d 'a las' HH:mm")
}

// ───────────────────── 1) inviteBarber (Resend) ─────────────────────

exports.inviteBarber = onCall({ secrets: [RESEND_API_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.')
  const caller = await db.doc(`${C.users}/${req.auth.uid}`).get()
  if (!caller.exists || caller.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo el admin puede invitar.')
  }

  const email = normalizeEmail(req.data?.email)
  const origin = String(req.data?.origin || '').replace(/\/$/, '')
  if (!email || !origin) throw new HttpsError('invalid-argument', 'Faltan email u origin.')

  const inviteSnap = await db.doc(`${C.invites}/${email}`).get()
  if (!inviteSnap.exists) throw new HttpsError('not-found', 'No hay invitación para ese email.')
  const name = inviteSnap.data()?.barber?.name || ''
  const studio = await studioName()
  const link = `${origin}/invitacion?email=${encodeURIComponent(email)}`

  const resend = new Resend(RESEND_API_KEY.value())
  const { error } = await resend.emails.send({
    from: FROM_EMAIL.value(),
    to: email,
    subject: `Únete al equipo de ${studio}`,
    html: inviteEmailHtml({ name, studio, link }),
  })
  if (error) throw new HttpsError('internal', `No se pudo enviar el email: ${error.message || error}`)
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
        <tr><td style="padding:28px 36px 32px;border-top:1px solid #2A352D;margin-top:20px;font-size:12px;color:#6E726A">
          Si no esperabas este correo, puedes ignorarlo.<br>— El equipo de ${studio}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

// ───────────────── 2) cita nueva → barbero + admin ─────────────────

exports.onAppointmentCreated = onDocumentCreated(`${C.appointments}/{id}`, async (event) => {
  const appt = event.data?.data()
  if (!appt) return
  if (appt.status && !['booked', 'completed'].includes(appt.status)) return

  const [clientName, serviceName] = await Promise.all([
    getUserName(appt.clientId),
    getServiceName(appt.serviceId),
  ])
  const when = fmtWhen(appt.startsAt)
  const appointmentId = event.params.id
  const body = `${clientName || 'Un cliente'} · ${serviceName} · ${when}.`

  // Al barbero asignado.
  if (appt.barberId) {
    await notifyUser(appt.barberId, {
      type: 'cita_nueva',
      title: '💈 Nueva cita',
      body,
      appointmentId,
      audience: 'barber',
      link: '/staff/agenda',
    })
  }
  // Al panel admin.
  await notifyAdmins({ type: 'cita_nueva', title: '💈 Nueva cita', body, appointmentId, link: '/admin/agenda' })
})

// ───────────── 3) cita cancelada → cliente + barbero + admin ─────────────

exports.onAppointmentUpdated = onDocumentUpdated(`${C.appointments}/{id}`, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()
  if (!before || !after) return
  const cancelled = before.status !== 'cancelled' && after.status === 'cancelled'
  if (!cancelled) return

  const [clientName, serviceName] = await Promise.all([
    getUserName(after.clientId),
    getServiceName(after.serviceId),
  ])
  const when = fmtWhen(after.startsAt)
  const appointmentId = event.params.id
  const title = 'Cita cancelada'
  const body = `${clientName || 'Un cliente'} canceló ${serviceName} · ${when}.`

  // SOLO PUSH: el aviso in-app (a admin y barbero) ya lo crea la app al cancelar.
  // Aquí únicamente añadimos la entrega por notificación push.
  if (after.barberId) {
    await pushUser(after.barberId, { title, body, data: { appointmentId, link: '/staff/agenda' } })
  }
  await pushAdmins({ title, body, data: { appointmentId, link: '/admin/agenda' } })
})

// ───────────── 4) recordatorios programados (24 h y 1 h) ─────────────

exports.sendReminders = onSchedule({ schedule: 'every 5 minutes', timeZone: TZ }, async () => {
  const nowMs = Date.now()
  for (const minutesBefore of REMINDER_MINUTES) {
    const target = nowMs + minutesBefore * 60 * 1000
    const startTs = Timestamp.fromMillis(target - TOLERANCE_MS)
    const endTs = Timestamp.fromMillis(target + TOLERANCE_MS)

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
        await notifyUser(appt.clientId, {
          type: 'recordatorio',
          title,
          body,
          appointmentId: docSnap.id,
          audience: 'client',
          link: `/citas/${docSnap.id}`,
        })
        await docSnap.ref.update({
          remindersSent: Array.from(new Set([...sent, minutesBefore])),
          lastReminderAt: FieldValue.serverTimestamp(),
        })
      } catch (e) {
        console.error('Error recordatorio', docSnap.id, e)
      }
    }
  }
})
