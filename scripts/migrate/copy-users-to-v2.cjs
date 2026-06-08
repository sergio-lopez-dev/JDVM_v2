// Copia los usuarios de la v1 (colección `users`) a `users_v2`, mapeando al esquema
// v2 y conservando el UID. LEE la v1 (solo lectura, no la modifica) y ESCRIBE solo
// en `users_v2` → NO afecta a la app legacy v1.
//
// role: admin (legacy `admin === true`) → 'admin'; el resto → 'client'.
// (Los barberos se dan de alta luego desde el panel.)
//
// Requiere GOOGLE_APPLICATION_CREDENTIALS = service account de jdvm-d82b6.
// Uso:  node scripts/migrate/copy-users-to-v2.cjs

const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

if (process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Emulador activo: abortando (esto escribe en PRODUCCIÓN).')
}
const TARGET = 'jdvm-d82b6'
const app = initializeApp({ credential: applicationDefault(), projectId: TARGET })
if (app.options.projectId !== TARGET) throw new Error(`projectId inesperado: ${app.options.projectId}`)
const db = getFirestore()

async function run() {
  console.log(`Destino: ${TARGET} · users (v1, lectura) → users_v2 (escritura)\n`)
  const snap = await db.collection('users').get()
  console.log(`Usuarios en la v1: ${snap.size}`)

  let batch = db.batch()
  let n = 0
  let written = 0
  let admins = 0
  for (const d of snap.docs) {
    const u = d.data() || {}
    const role = u.admin === true ? 'admin' : 'client'
    if (role === 'admin') admins++
    const doc = {
      name: u.name || '',
      email: u.email || '',
      phone: u.phone != null ? String(u.phone) : '',
      role,
      allowPush: !!u.allowPush,
      createdAt: u.createdAt || u.lastLogin || FieldValue.serverTimestamp(),
      lastLogin: u.lastLogin || FieldValue.serverTimestamp(),
    }
    if (u.instagram) doc.instagram = String(u.instagram)
    batch.set(db.collection('users_v2').doc(d.id), doc, { merge: true })
    n++
    written++
    if (n === 450) {
      await batch.commit()
      batch = db.batch()
      n = 0
    }
  }
  if (n > 0) await batch.commit()

  console.log(`✔ Copiados a users_v2: ${written} (admins: ${admins}, clientes: ${written - admins}).`)
  console.log('  La v1 (users) NO se ha modificado.')
}

run().catch((e) => {
  console.error('Copia falló:', e)
  process.exit(1)
})
