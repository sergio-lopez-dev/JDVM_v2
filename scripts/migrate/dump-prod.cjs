// Volcado de SOLO LECTURA de Firestore de producción (jdvm-d82b6) a un JSON.
// No escribe NADA en prod. Sirve de backup y de fuente para la migración a v2.
//
// Uso:
//   SA_KEY=/ruta/al/serviceAccountKey.json node scripts/migrate/dump-prod.cjs
//
// Salida: scripts/migrate/prod-dump.json  (ignorado por git)
//
// Recorre todas las colecciones de nivel superior con listCollections(), así no
// hay que enumerarlas a mano. Los Timestamp se serializan con un marcador
// {__type__:'timestamp', seconds, nanoseconds} para poder reconstruirlos luego.

const fs = require('node:fs')
const path = require('node:path')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, Timestamp, GeoPoint } = require('firebase-admin/firestore')

const SA_KEY = process.env.SA_KEY
if (!SA_KEY || !fs.existsSync(SA_KEY)) {
  console.error('✖ Falta la service account. Ejecuta:')
  console.error('  SA_KEY=/ruta/serviceAccountKey.json node scripts/migrate/dump-prod.cjs')
  process.exit(1)
}

const serviceAccount = require(path.resolve(SA_KEY))
if (serviceAccount.project_id !== 'jdvm-d82b6') {
  console.error(`✖ La clave es del proyecto "${serviceAccount.project_id}", no de jdvm-d82b6. Abortando por seguridad.`)
  process.exit(1)
}

// Salvaguarda extra: nos aseguramos de NO estar apuntando a un emulador.
delete process.env.FIRESTORE_EMULATOR_HOST

initializeApp({ credential: cert(serviceAccount), projectId: 'jdvm-d82b6' })
const db = getFirestore()

// Serializa valores Firestore a JSON conservando el tipo de los especiales.
function encode(value) {
  if (value instanceof Timestamp) {
    return { __type__: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds }
  }
  if (value instanceof GeoPoint) {
    return { __type__: 'geopoint', latitude: value.latitude, longitude: value.longitude }
  }
  if (value && typeof value === 'object' && typeof value.path === 'string' && value.firestore) {
    return { __type__: 'ref', path: value.path } // DocumentReference
  }
  if (Array.isArray(value)) return value.map(encode)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = encode(v)
    return out
  }
  return value
}

async function run() {
  const cols = await db.listCollections()
  const dump = { project: 'jdvm-d82b6', exportedAt: new Date().toISOString(), collections: {} }
  let total = 0
  for (const col of cols) {
    const snap = await col.get()
    const docs = {}
    snap.forEach((d) => {
      docs[d.id] = encode(d.data())
    })
    dump.collections[col.id] = docs
    total += snap.size
    console.log(`  · ${col.id}: ${snap.size} docs`)
  }
  const out = path.join(__dirname, 'prod-dump.json')
  fs.writeFileSync(out, JSON.stringify(dump, null, 2))
  console.log(`\n✔ Volcado completado: ${cols.length} colecciones, ${total} documentos.`)
  console.log(`  → ${out}`)
  console.log('  (Es de SOLO LECTURA: no se ha tocado producción.)')
}

run().catch((e) => {
  console.error('Volcado falló:', e)
  process.exit(1)
})
