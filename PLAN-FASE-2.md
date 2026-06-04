# Plan — Fase 2: Auth y capa de datos

> Estado al cerrar hoy: **Fase 0 ✅ · Fase 1 ✅** (4 commits en `main`).
> Leer antes: `CLAUDE.md` (contrato, decisiones, restricciones).

## ⚠️ Restricción que manda sobre todo

**NO tocar la base de datos de producción `jdvm-d82b6`.** Nada de escrituras,
borrados, ni desplegar `firestore.rules`/índices a prod. **Todo el desarrollo de
Fase 2 va contra EMULADORES locales.** Por eso el paso 1 es montar los emuladores
ANTES de escribir una línea que toque datos.

## Objetivo de la fase

Auth (Email/Password + Google) + modelo de datos tipado + reglas de seguridad +
middleware de rutas. Al final: poder registrarse/loguearse, leer/escribir las
colecciones desde composables tipados, todo validado con Zod, **contra emuladores**.
Commit final: `"Fase 2: auth y capa de datos"`.

Recordar: `nvm use` (Node 22) antes de cualquier comando. pnpm 9.

---

## Paso 1 — Emuladores de Firebase (primero, por la restricción de prod)

- [ ] Comprobar prerequisito **Java JDK** (el emulador de Firestore lo necesita):
      `java -version`. Si falta, instalarlo (o usar solo Auth emulator hasta tenerlo).
- [ ] Añadir **`firebase-tools`** como devDep: `pnpm add -D firebase-tools`
      (CLI para emuladores; no confundir con `firebase-admin`).
- [ ] Crear `firebase.json` con bloque `emulators` (auth, firestore, storage, ui)
      y rutas a `firestore.rules` + `firestore.indexes.json`. Mantener el bloque
      `functions` existente del legacy NO aplica aquí (proyecto nuevo); definir
      desde cero solo lo que usamos.
- [ ] Crear `.firebaserc` apuntando a `jdvm-d82b6` SOLO para que el emulador tome
      un projectId coherente (los emuladores **no** se conectan a prod; son locales).
      Alternativa más segura: usar un projectId demo (`demo-jdvm`) para que sea
      imposible tocar prod por accidente. **Decidir al arrancar** (recomendado:
      `demo-jdvm` para los emuladores).
- [ ] `firestore.rules` inicial en modo cerrado (se completa en el paso 6).
- [ ] Scripts en `package.json`:
      `"emulators": "firebase emulators:start --import .emulator-data --export-on-exit"`,
      y un `"dev:emu"` que arranque emuladores + `nuxt dev` con
      `NUXT_PUBLIC_USE_EMULATORS=true` (ya soportado en `nuxt.config.ts` vuefire).
- [ ] Poner `NUXT_PUBLIC_USE_EMULATORS=true` en `.env` local para desarrollo.
- [ ] Verificar que `nuxt-vuefire` conecta a los emuladores (revisar logs:
      debe decir que usa el emulador de Auth/Firestore, no prod).
- [ ] Carpeta `.emulator-data/` (datos sembrados) → añadir a `.gitignore`.

## Paso 2 — Esquemas Zod (`schemas/`) ⟶ fuente de verdad del modelo

Compartibles con Cloud Functions más adelante. **Zod 3** (no 4). Inferir tipos TS
con `z.infer`. Un archivo por entidad + `schemas/common.ts` para primitivas.

- [ ] `common.ts`: `weekdaySchema` (`mon..sun`), `timeRangeSchema` (`{start,end}` HH:mm),
      `dateRangeSchema`, `phoneEsSchema` (regex `^[0-9]{9}$`), enums:
      `roleSchema` (`client|barber|admin`), `appointmentStatusSchema`
      (`booked|completed|cancelled|no_show`), `paymentMethodSchema` (`cash|revolut`).
- [ ] `barber.ts` — id, name, slug, photoUrl, bio, instagram?, color, active,
      servicesOffered: ServiceId[], timetable: { [day]: { morning?, afternoon? } },
      vacations: DateRange[].
- [ ] `service.ts` — id, name, durationMinutes (editable admin), basePrice,
      priceOverrides?: Record<barberId, number>, color, isPrivate, category?.
- [ ] `appointment.ts` — id, clientId, barberId (obligatorio), serviceId,
      startsAt, endsAt, status, priceSnapshot?, tip?, paymentMethod?, isRecurring.
      `cancellable` es DERIVADO (no se guarda): `now <= startsAt - 4h`.
- [ ] `waitlist.ts` — id, clientId, serviceId, preferredBarberId?: string|null,
      timeRange {start,end}, preferredDates: DateRange, createdAt, notified.
- [ ] `client.ts` (doc de `users`) — id(uid), name, email, phone(9), instagram?,
      role, allowPush, createdAt, lastLogin.
- [ ] `review.ts` — id, clientId, barberId, appointmentId?, score(1-5), tags[], text?, createdAt.
- [ ] `settings.ts` — timetable del local (apertura general), daysClosed, reglas
      especiales por rango (lo de `timetable_rules`).
- [ ] (Aplazado: fidelización SOCIO ORO — NO modelar todavía, decisión D.)
- [ ] Decidir **nombres de colección**: nuevos y limpios (`barbers`, `services`,
      `appointments`, `waitlist`, `users`, `reviews`, `settings`). La migración de
      datos del legacy es tema aparte (script futuro), no entra en Fase 2.

## Paso 3 — Lógica pura (`lib/`) ⟶ testeable, sin Firebase

- [ ] `lib/phone.ts` — validación/normalización teléfono ES (9 dígitos).
- [ ] `lib/cancellation.ts` — `isCancellable(startsAt, now, isAdmin)`: `now <= startsAt - 4h`
      o admin. (Decisión B.)
- [ ] `lib/slots.ts` — generación de huecos: intersección
      `horario local ∩ horario barbero − vacaciones − citas existentes`, respetando
      `durationMinutes` del servicio y solapamientos por barbero; filtra pasados si
      es hoy. (Decisión E. Reescribe el algoritmo del legacy, que asumía 30 min fijos
      — ver `appointmentStore.js:586-682` del legacy como referencia, NO copiar.)
- [ ] Con `preferredBarberId = null` (cualquiera): unir disponibilidad de todos los
      barberos activos que ofrezcan el servicio.

## Paso 4 — Auth (Email/Password + Google)

- [ ] Habilitar Email/Password + Google en el emulador de Auth.
- [ ] `composables/useAuth.ts`: `signUp`, `signIn`, `signInWithGoogle`,
      `signOut`, `sendPasswordReset`, `currentUser` (de VueFire `useCurrentUser`).
- [ ] Al registrarse / primer login con Google: crear/actualizar doc en `users`
      (rol por defecto `client`, validar teléfono con Zod en el alta).
- [ ] Flujo "finalizar registro Google" (pedir teléfono si falta) — el diseño lo
      contempla; la UI llega en Fase 3, aquí solo la capa.

## Paso 5 — Composables de colecciones (tipados, sobre VueFire)

Nada de `firebase/firestore` a pelo: usar `useCollection`/`useDocument` de VueFire,
parseando con los schemas Zod. CRUD donde haga falta (admin).

- [ ] `useBarbers` (list activos, por slug, CRUD admin)
- [ ] `useServices` (list públicos = no privados, CRUD admin, precio efectivo por barbero)
- [ ] `useAppointments` (del cliente, del barbero/día, crear, cancelar/reprogramar con regla 4h)
- [ ] `useWaitlist` (alta/baja, comprobar si ya está, list admin)
- [ ] `useClients` (perfil propio; list admin)
- [ ] (auxiliares) `useSettings`, `useReviews`

## Paso 6 — Reglas de seguridad (`firestore.rules`) — SOLO EMULADOR

- [ ] Roles vía custom claims o lookup del doc `users/{uid}.role`.
- [ ] Matriz por colección: - `users/{uid}`: el propio usuario lee/escribe su doc (campos limitados);
      admin lee todos. `role` solo lo cambia admin. - `barbers`, `services`, `settings`: lectura pública; escritura admin. - `appointments`: cliente crea/lee/cancela las suyas; barbero ve las suyas;
      admin todo. Validar regla 4h en cliente (las reglas no calculan bien tiempos
      relativos complejos; la validación dura de 4h puede vivir en Cloud Function/
      cliente, y las reglas garantizan ownership + estados válidos). - `waitlist`: cliente las suyas; admin todo. - `reviews`: cliente crea la suya (de una cita completada); lectura pública.
- [ ] **NO desplegar a prod.** Probar solo contra el emulador.

## Paso 7 — Middleware de rutas (`app/middleware/`)

- [ ] `auth.ts` (global o nombrado): requiere usuario logueado → redirige a login.
- [ ] `guest.ts`: solo no logueados (login/registro).
- [ ] `admin.ts`: requiere `role === 'admin'`.
- [ ] `barber.ts`: requiere `role === 'barber' || 'admin'`.
- [ ] Composable `useRole()` para leer el rol del doc `users`.
- [ ] Encaja con los `routeRules` ya puestos (`/app/**` y `/admin/**` = SPA).

## Paso 8 — Verificación y cierre

- [ ] Sembrar datos de prueba en el emulador (barberos, servicios, settings).
- [ ] Probar a mano contra emulador: registro, login, leer servicios/barberos,
      crear una cita, comprobar slots y la regla de 4h.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` en verde.
- [ ] Commit: `"Fase 2: auth y capa de datos"`.

---

## Cosas a decidir al arrancar (rápidas)

1. ProjectId de emuladores: `demo-jdvm` (recomendado, imposible tocar prod) vs
   `jdvm-d82b6` (mismo id, pero emulador igualmente local).
2. Rol del usuario: ¿custom claims (requiere Admin SDK/функción) o campo `role` en
   el doc `users`? Para empezar simple: campo `role` en `users` (como el `admin`
   booleano del legacy, pero ampliado a `client|barber|admin`).
3. ¿Sembrar barberos/servicios reales de ejemplo o genéricos? (Da igual, es emulador.)

## Pendientes que NO son de esta fase (recordatorio)

- Logo vectorial real (hoy usamos el ráster procesado a blanco/transparente).
- QR/enlace de Revolut para pagos (lo pasará el dueño) — se usa en Fase 3.
- Migración de datos del legacy al nuevo modelo (script futuro; prod intacta).
- Fidelización SOCIO ORO (fase posterior).
- Cloud Functions (proyecto separado): waitlist matching, recordatorios, jobs.
