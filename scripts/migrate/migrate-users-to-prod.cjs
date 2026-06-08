// Migra SOLO los usuarios (perfiles Firestore + cuentas Auth) del dump legacy al
// proyecto REAL jdvm-v2. NO migra citas, servicios ni nada más.
//
// - Auth: importa todas las cuentas preservando el UID y el email (SIN contraseña:
//   los clientes entran con Google o con "recuperar acceso"). A los admins se les
//   pone una contraseña temporal para poder entrar ya (cámbiala después).
// - Firestore: users/{uid} con el esquema v2 (role admin|client; no barberos: el
//   barbero se da de alta luego desde el panel con el superadmin).
//
// Requiere: GOOGLE_APPLICATION_CREDENTIALS apuntando al service account de jdvm-v2.
// Uso:  node scripts/migrate/migrate-users-to-prod.cjs

const path = require('node:path')
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')

// Guarda anti-emulador / anti-proyecto-equivocado.
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Hay variables de emulador activas: abortando (esto escribe en PRODUCCIÓN).')
}
const TARGET = 'jdvm-v2'
const TEMP_ADMIN_PASSWORD = 'JDVMv2-temporal-2026' // cámbiala tras el primer login

const app = initializeApp({ credential: applicationDefault(), projectId: TARGET })
if (app.options.projectId !== TARGET) {
  throw new Error(`projectId inesperado: ${app.options.projectId} (esperaba ${TARGET})`)
}
const db = getFirestore()
const auth = getAuth()

const dump = require(path.join(__dirname, 'prod-dump.json'))
const USERS = dump.collections.users

function decode(v) {
  if (v && typeof v === 'object' && v.__type__ === 'timestamp')
    return new Date(v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6))
  return v
}
function toDate(v) {
  const d = decode(v)
  return d instanceof Date && !isNaN(d.getTime()) ? d : null
}
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

async function run() {
  console.log(`Destino: ${TARGET} (PRODUCCIÓN real)\n`)
  const ids = Object.keys(USERS).filter((id) => USERS[id] && USERS[id].email)
  console.log(`Usuarios con email: ${ids.length}`)

  // ---- Auth: importación masiva (sin contraseña) ----
  // Requiere Authentication habilitado en la consola. Si no lo está, se avisa y se
  // continúa con Firestore; vuelve a ejecutar el script al habilitarlo.
  const adminIds = ids.filter((id) => USERS[id].admin === true)
  let authDone = false
  try {
    const records = ids.map((id) => ({
      uid: id,
      email: String(USERS[id].email).trim(),
      emailVerified: true,
      ...(USERS[id].name ? { displayName: String(USERS[id].name) } : {}),
    }))
    let okAuth = 0
    let failAuth = 0
    for (const part of chunk(records, 1000)) {
      const res = await auth.importUsers(part)
      okAuth += res.successCount
      failAuth += res.failureCount
      res.errors.slice(0, 5).forEach((e) => console.log('   auth err idx', e.index, e.error.message))
    }
    console.log(`Auth importados: ${okAuth} (fallos: ${failAuth})`)
    for (const id of adminIds) {
      try {
        await auth.updateUser(id, { password: TEMP_ADMIN_PASSWORD })
      } catch (e) {
        console.log('   no se pudo fijar pass admin', USERS[id].email, e.message)
      }
    }
    console.log(`Admins con contraseña temporal: ${adminIds.length} → ${adminIds.map((id) => USERS[id].email).join(', ')}`)
    authDone = true
  } catch (e) {
    if (e.code === 'auth/configuration-not-found') {
      console.log('\n⚠️  Authentication NO está habilitado en jdvm-v2.')
      console.log('   Habilítalo en la consola (Authentication → Get started; activa Email/Password y Google)')
      console.log('   y vuelve a ejecutar este script para importar las cuentas Auth.\n')
    } else {
      throw e
    }
  }

  // ---- Firestore: users/{uid} (esquema v2) ----
  let okDocs = 0
  for (const part of chunk(ids, 450)) {
    const batch = db.batch()
    for (const id of part) {
      const u = USERS[id]
      const last = toDate(u.lastLogin)
      const doc = {
        name: u.name || '',
        email: String(u.email).trim(),
        phone: u.phone != null ? String(u.phone) : '',
        role: u.admin === true ? 'admin' : 'client',
        allowPush: false,
        createdAt: last || FieldValue.serverTimestamp(),
        lastLogin: last || FieldValue.serverTimestamp(),
      }
      if (u.instagram) doc.instagram = String(u.instagram)
      batch.set(db.collection('users').doc(id), doc, { merge: true })
    }
    await batch.commit()
    okDocs += part.length
  }
  console.log(`Docs users escritos: ${okDocs}`)

  if (authDone) {
    console.log('\n✔ Migración de usuarios completada (perfiles + Auth, sin citas ni servicios).')
    console.log(`  Superadmin: cualquiera de los admins · contraseña temporal: ${TEMP_ADMIN_PASSWORD}`)
    console.log('  Los clientes entran con Google o "recuperar acceso" (sin contraseña migrada).')
  } else {
    console.log('\n✔ Perfiles Firestore migrados. Falta la parte de Auth (ver aviso de arriba).')
  }
}

run().catch((e) => {
  console.error('Migración falló:', e)
  process.exit(1)
})
