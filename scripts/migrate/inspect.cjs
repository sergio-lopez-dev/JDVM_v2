// Analiza prod-dump.json (local, sin tocar prod) para diseñar la migración.
const fs = require('node:fs')
const path = require('node:path')
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'prod-dump.json'), 'utf8'))
const C = dump.collections

const sample = (obj) => { const k = Object.keys(obj)[0]; return { id: k, data: obj[k] } }
const keysOf = (obj) => {
  const set = new Set()
  for (const id of Object.keys(obj)) for (const k of Object.keys(obj[id] || {})) set.add(k)
  return [...set].sort()
}
const distinct = (col, field) => {
  const m = {}
  for (const id of Object.keys(col)) { const v = col[id]?.[field]; const key = JSON.stringify(v); m[key] = (m[key] || 0) + 1 }
  return m
}
const show = (label, v) => console.log(label, JSON.stringify(v, null, 2))

console.log('================ USERS ================')
console.log('keys:', keysOf(C.users))
console.log('admin distribution:', distinct(C.users, 'admin'))
console.log('category distribution:', distinct(C.users, 'category'))
show('sample user:', sample(C.users))

console.log('\n================ SERVICES (las 6) ================')
for (const id of Object.keys(C.services)) console.log(id, '→', JSON.stringify(C.services[id]))

console.log('\n================ SETTINGS ================')
for (const id of Object.keys(C.settings)) show(id, C.settings[id])

console.log('\n================ TIMETABLE_RULES ================')
console.log('keys:', keysOf(C.timetable_rules))
show('sample:', sample(C.timetable_rules))

console.log('\n================ APPOINTMENTS ================')
console.log('keys:', keysOf(C.appointments))
console.log('type distribution:', distinct(C.appointments, 'type'))
console.log('fixed distribution:', distinct(C.appointments, 'fixed'))
console.log('status distribution:', distinct(C.appointments, 'status'))
{
  const ids = Object.keys(C.appointments).slice(0, 3)
  ids.forEach((id) => show('sample appt:', { id, data: C.appointments[id] }))
}

console.log('\n================ FIXED_APPOINTMENTS ================')
console.log('keys:', keysOf(C.fixed_appointments))
show('sample:', sample(C.fixed_appointments))
console.log('-- exceptions keys:', keysOf(C.fixed_appointments_exceptions))
show('exception sample:', sample(C.fixed_appointments_exceptions))

console.log('\n================ REVIEWS ================')
console.log('keys:', keysOf(C.reviews))
show('sample:', sample(C.reviews))

console.log('\n================ IMAGES ================')
console.log('keys:', keysOf(C.images))
show('sample:', sample(C.images))

console.log('\n================ ALERTS ================')
show('sample:', sample(C.alerts))

console.log('\n================ NOTIFICATIONS ================')
console.log('keys:', keysOf(C.notifications))
console.log('type distribution:', distinct(C.notifications, 'type'))
show('sample:', sample(C.notifications))

console.log('\n================ WAITINGLIST ================')
console.log('keys:', keysOf(C.waitingList))
show('sample:', sample(C.waitingList))
