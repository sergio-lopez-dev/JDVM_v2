# CLAUDE.md — JDVM Hair Studio · App v2

Contrato del proyecto. Léelo al empezar cada sesión. Documenta stack, decisiones
tomadas, comandos, estructura y convenciones. Si cambias algo estructural,
actualízalo aquí.

---

## 1. Qué es esto

Rediseño desde cero (v2) de la app de **JDVM Hair Studio**, una barbería en
Granada. El dominio se mantiene respecto a la app antigua, pero el modelo, las
pantallas y el stack cambian. El cambio de modelo más importante: **multi-barbero**
(la app vieja asumía un único barbero implícito; la nueva soporta varios a la vez).

- **Proyecto antiguo (solo lectura, NO tocar):** `/home/sergio/JDVM/JDVM`
  (Vue 3 + Vite + Pinia + Firebase + Bootstrap + Qalendar). Se usa para entender
  lógica de negocio, recuperar copys y ver el schema de Firestore actual.
- **Diseños:** `inputs/designs/` (referencias de Claude Design, no copiar literal).
  Tema "forest" / verde inglés. Por ahora solo tenemos el PDF de baja fidelidad;
  faltan los `.jsx` + `themes.js` reales para extraer tokens exactos (ver Fase 1).

---

## 2. Requisitos de entorno (IMPORTANTE)

- **Node ≥ 22.12** obligatorio. Hay un `.nvmrc` con `22` → ejecuta **`nvm use`**
  antes de cualquier comando. El Node global del sistema (22.4.0) NO sirve:
  Nuxt 4 + oxc-parser necesitan `require()` de ESM, activo por defecto desde
  Node 22.12. `engines.node` en package.json lo refleja para Vercel/CI.
- **Gestor de paquetes: pnpm 9** (`pnpm@9.15.9`). No usar npm/yarn.
  - Nota: pnpm "latest" pide Node ≥22.13; usamos la línea 9.x a propósito.
  - `.npmrc`: `auto-install-peers=true`, `strict-peer-dependencies=false`.

---

## 3. Stack (decidido, no negociar)

| Área             | Librería                                                | Notas                                                                                                                                    |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | **Nuxt 4** (4.4.x)                                      | Última estable. srcDir = `app/`.                                                                                                         |
| Lenguaje         | **TypeScript estricto**                                 | `typescript.strict: true`. Nada de `any` sin justificar.                                                                                 |
| UI base          | **Nuxt UI v4** (Reka UI)                                | Trae **Tailwind v4** integrado. No instalar `@nuxtjs/tailwindcss`.                                                                       |
| Estilos          | **Tailwind v4**                                         | CSS-first: tokens en `app/assets/css/main.css` (`@theme`), no en `tailwind.config.js`.                                                   |
| Firebase         | **VueFire + nuxt-vuefire**                              | Firestore, Auth, Storage, Messaging. NO usar `firebase/firestore` directo: todo por composables/VueFire.                                 |
| Admin SDK        | **firebase-admin**                                      | Requerido por nuxt-vuefire con SSR+Auth (importa `firebase-admin/auth`). Sin service account solo avisa; auth de cliente funciona igual. |
| Estado           | **Pinia**                                               | Solo cuando un composable no llegue.                                                                                                     |
| Formularios      | **VeeValidate + Zod**                                   | Esquemas Zod en `schemas/`, compartidos con Cloud Functions. **Zod 3** (vee-validate aún no soporta Zod 4).                              |
| Animación        | **motion-v** (complejas) + **@vueuse/motion** (simples) | Solo se registra el módulo `motion-v/nuxt` (ver §8).                                                                                     |
| Calendario admin | **Schedule-X** (`@schedule-x/vue`)                      | Agenda.                                                                                                                                  |
| Date picker      | **v-calendar** (`v-calendar@3`, Vue 3)                  | Flujo de reserva. La v3 vive en el tag `next` de npm.                                                                                    |
| Confeti          | **canvas-confetti**                                     | Momento "cita confirmada".                                                                                                               |
| Gráficos         | **@unovis/vue** (+ `@unovis/ts`)                        | Pantalla Reports. (El paquete `unovis-vue` del brief no existe; es `@unovis/vue`.)                                                       |
| Iconos           | **@lucide/vue**                                         | Sucesor de `lucide-vue-next` (deprecado).                                                                                                |
| Fechas           | **date-fns**                                            |                                                                                                                                          |
| PWA              | **@vite-pwa/nuxt**                                      |                                                                                                                                          |
| Lint/format      | **@nuxt/eslint** + **ESLint 10** + **Prettier 3**       |                                                                                                                                          |
| Hooks git        | **Husky 9** + **lint-staged**                           | pre-commit: lint-staged + `nuxt typecheck`.                                                                                              |

**Prohibido:** Bootstrap, Font Awesome, Vuetify, Quasar, Element Plus, Express,
Socket.io, Qalendar, axios (usar `$fetch`), moment, lodash completo. Si falta un
componente que Nuxt UI no cubre, copiar un primitivo de shadcn-vue antes que meter
una librería entera. No instalar deps fuera de esta lista sin proponerlo antes.

---

## 4. Comandos

Siempre precede con `nvm use` (Node 22).

```bash
pnpm dev          # dev server (http://localhost:3000)
pnpm build        # build de producción (cliente + servidor + nitro)
pnpm generate     # SSG
pnpm preview      # preview del build
pnpm lint         # eslint .
pnpm lint:fix     # eslint . --fix
pnpm format       # prettier --write .
pnpm typecheck    # nuxt typecheck (vue-tsc)
pnpm emulators    # emuladores Firebase (auth/firestore/storage/ui) · proyecto demo-jdvm
pnpm seed         # siembra datos de prueba en el emulador (requiere emuladores arriba)
pnpm dev:emu      # emuladores + nuxt dev en un solo comando
```

**Dev con datos:** terminal A `pnpm emulators` (UI en http://localhost:4000),
terminal B `nvm use && pnpm dev`. Con `NUXT_PUBLIC_USE_EMULATORS=true` (ya en
`.env`) la app usa el projectId `demo-jdvm` contra los emuladores. La primera vez
`pnpm seed` crea el catálogo y los usuarios de prueba.

---

## 5. Estructura

Nuxt 4 → el código de la app vive en `app/`.

```
app/
  app.vue              # raíz: <NuxtLayout><NuxtPage/></NuxtLayout>
  app.config.ts        # tokens de Nuxt UI (primary/neutral)
  assets/css/main.css  # @import tailwind + nuxt ui + @theme (tokens de marca)
  assets/img/
  components/          # PascalCase, prefijo de dominio (AppointmentCard, BarberAvatar; UiButton para primitivos)
  composables/         # useX, toda lógica reutilizable (nada de prop drilling)
  layouts/             # default.vue (fondo oscuro cálido)
  middleware/          # rutas: pública / autenticada / admin / barbero
  pages/               # rutas
schemas/               # esquemas Zod de las entidades (compartibles con Functions)
lib/                   # utilidades puras
types/                 # tipos globales (o junto al composable que los usa)
public/                # estáticos
inputs/designs/        # referencias de diseño (no se copian literal)
nuxt.config.ts         # módulos, routeRules, vuefire, pwa, head/fuentes
```

---

## 6. Convenciones

- **Composition API + `<script setup lang="ts">`** en todos los componentes.
- **Composables** para lógica reutilizable. Nada de prop drilling.
- **Server routes / nitro** solo si hace falta lógica de servidor que no cubra
  Firestore directo o una Cloud Function.
- **Estilos:** Tailwind primero. CSS scoped solo si Tailwind no llega. Nada de `!important`.
- **Comentarios:** explica el _por qué_, no el _qué_. No comentar lo obvio.
- **Tests:** por ahora ninguno (se valorará Vitest en una fase posterior).
- Fases pequeñas y verificables: al final de cada una, commit claro + resumen.

---

## 7. Auto-imports de Nuxt (activos)

Nuxt auto-importa sin `import` explícito:

- **Vue:** `ref`, `computed`, `reactive`, `watch`, `onMounted`, etc.
- **Nuxt:** `useRoute`, `useRouter`, `useState`, `useFetch`, `useAsyncData`,
  `$fetch`, `navigateTo`, `useHead`, `useRuntimeConfig`, `defineNuxtConfig`,
  `defineAppConfig`, `definePageMeta`, etc.
- **Componentes** de `app/components/` (por nombre de archivo).
- **Composables** de `app/composables/`.
- **Nuxt UI:** componentes `U*` (`UButton`, `UInput`, `UModal`…).
- **Pinia:** `defineStore`, `storeToRefs`, `useX` stores en `stores/` (si se crean).
- **VeeValidate:** `useForm`, `useField`, etc.
- **VueFire:** `useFirestore`, `useCollection`, `useDocument`, `useCurrentUser`,
  `useFirebaseAuth`, etc.
- **motion-v:** componentes `<Motion>` y composables (`useSpring`, …).

Iconos: vía `@lucide/vue` (componentes) o el sistema de iconos de Nuxt UI
(`i-lucide-*` con la colección iconify de lucide).

---

## 8. Firebase

- **Proyecto prod reutilizado:** `jdvm-d82b6`. Config web (pública) en `.env`
  (ver `.env.example`, ya con los valores reales — son públicos por diseño).
- **Auth habilitada:** Email/Contraseña + Google (decisión de producto;
  el diseño mostraba Apple/teléfono pero se descartaron).
- **Emuladores en dev:** flag `NUXT_PUBLIC_USE_EMULATORS`. Se cablearán en la
  Fase 2 junto con `firebase.json` + `firestore.rules`.
- **Acceso a datos:** siempre vía VueFire / composables propios. Nunca
  `firebase/firestore` a pelo.

> ⚠️ **NO alterar la base de datos de producción (`jdvm-d82b6`) todavía.** No
> escribir datos en prod, no borrar, no desplegar `firestore.rules`/índices a prod.
> En Fase 2 se cablean los **emuladores ANTES** de cualquier trabajo con datos, y
> todo el desarrollo va contra emuladores hasta que se diga lo contrario.

**Capa de datos (Fase 2):**

- **Emuladores** (`firebase.json`): auth 9099, firestore 8080, storage 9199, UI 4000.
  Proyecto **`demo-jdvm`** (`.firebaserc`) → con `NUXT_PUBLIC_USE_EMULATORS=true` la
  app fuerza ese projectId, así es **imposible tocar prod por accidente**.
- **Reglas** en `firestore.rules` (+ `storage.rules`, `firestore.indexes.json`).
  Probadas SOLO contra emulador. **NO desplegar a prod.**
- **Rol** en `users/{uid}.role` (`client|barber|admin`). Composable `useCurrentClient`.
- Composables de datos en `app/composables/` (`useAuth`, `useBarbers`, `useServices`,
  `useAppointments`, `useWaitlist`, `useClients`, `useSettings`, `useReviews`).
  Matiz: estos composables SÍ usan el SDK `firebase/firestore` (son la capa de
  encapsulación); los **componentes** nunca lo usan a pelo.
- Esquemas Zod en `schemas/` y lógica pura en `lib/` (slots, cancelación 4h,
  teléfono); se importan con el alias de rootDir `~~/schemas` y `~~/lib`.
- Usuarios sembrados (`pnpm seed`): `admin@jdvm.test`, `alex@jdvm.test`,
  `dani@/marco@/jon@jdvm.test` — contraseña `123456` (solo emulador).

---

## 9. Sistema de diseño (Fase 1 — tema `forest`)

Valores EXACTOS de `inputs/designs/themes.js` (dirección forest). Definidos en
`app/assets/css/main.css`:

- **`@theme`**: rampa `gold` (acento, 500 = `#C2A24E`) y rampa `ink` (neutro
  cálido verdoso; 950 = `#0B0F0C` bg0, 900 = bg1, 800 = bg2, 700 = border,
  500 ≈ fg2, 300 ≈ fg1) + fuentes (`--font-display/sans/mono`).
- **`:root`**: tokens crudos `--jdvm-*` (bg/fg/accent/semánticos/service) para
  fidelidad 1:1, y `--ui-radius: 0.625rem`.
- **`.dark`**: remapeo de los tokens semánticos de Nuxt UI (`--ui-bg`, `--ui-text`,
  `--ui-border`, …) a la paleta forest → todos los `U*` heredan la marca.
- **App dark-only**: `colorMode: { preference: 'dark', fallback: 'dark' }`.
- `app.config.ts`: `ui.colors.primary = 'gold'`, `neutral = 'ink'`.
- Iconos: colección **`@iconify-json/lucide`** local (offline) → usar `i-lucide-*`
  en props `icon` de Nuxt UI, o `<UIcon name="i-lucide-…">`.

**Primitivos:** se usan los `U*` de Nuxt UI tematizados (no se reconstruyen).
Componentes propios en `app/components/`: `AppLogo` (logo real, variantes
`lockup`/`mark`/`wordmark`), `UiStarRating` (display/interactiva), `UiEmptyState`,
`UiGrain` (grano de fondo). Página **`/_styleguide`** (solo dev, 404 en prod)
muestra tipografía, paleta y todos los componentes.

**Logo:** recuperado del legacy (era ráster sobre negro). Procesado con ImageMagick
a blanco-sobre-transparente: `public/logo-jdvm.png` (emblema + "•JDVM•") y
`public/logo-jdvm-mark.png` (solo emblema). Set de iconos PWA/favicon en
`public/icons/` + `public/favicon.ico`. (Sigue siendo ráster; si algún día hay
vector, sustituir.)

---

## 10. Registro de decisiones y temas abiertos

**Decisiones tomadas en Fase 0:**

- Nuxt **4** (no 3): el brief decía "Nuxt 3 (última estable)"; hoy la última
  estable es la 4.
- Auth: Email + Google.
- Firebase: reusar prod `jdvm-d82b6` + emuladores en dev.
- pnpm 9 + Husky + lint-staged.
- Node 22 LTS vía nvm (.nvmrc), global intacto.
- Solo se registra el módulo `motion-v/nuxt`; `@vueuse/motion` queda instalado
  pero sin auto-cablear (registrar ambos colisiona en auto-imports). Si se quiere
  la directiva `v-motion`, añadirla como plugin en Fase 1.
- `oxc-parser` se fija como dep directa (resolución bajo pnpm).
- `firebase-admin` añadido por requisito de nuxt-vuefire (SSR + Auth).

**Decisiones tomadas en Fase 1:**

- Tema **forest** confirmado; tokens exactos cableados (ver §9).
- App **dark-only** (sin toggle de tema): forzamos `colorMode` dark.
- Primitivos = `U*` de Nuxt UI tematizados vía tokens semánticos; solo se crean
  componentes propios donde Nuxt UI no llega (StarRating, EmptyState, Grain, Logo).
- `@iconify-json/lucide` añadido (data de iconos local, offline para la PWA).
- `lint-staged` fijado a la línea **13.x** (la 17 exige git ≥ 2.32; el sistema
  tiene git 2.25.1).
- Logo: wordmark tipográfico placeholder hasta tener el vectorial real.

**Decisiones tomadas en Fase 2:**

- Emuladores con projectId **`demo-jdvm`** (aislado de prod). Dev contra emuladores.
- **Rol en el doc `users/{uid}.role`** (no custom claims, por simplicidad inicial).
- Nombres de colección nuevos y limpios: `users`, `barbers`, `services`,
  `appointments`, `waitlist`, `reviews`, `settings/main`. Migración del legacy = aparte.
- Barbero ↔ cuenta: el **id del doc `barbers/{uid}` = uid de Auth** del barbero, para
  que `appointment.barberId == request.auth.uid` cuadre con las reglas.
- Esquemas en `schemas/` (Zod 3) + lógica pura en `lib/`, vía alias `~~/`.

**Decisiones de producto CERRADAS:**

- **B) Cancelación = 4 h antes** (no 24h). El cliente puede cancelar/reprogramar
  hasta 4 h antes del inicio de la cita; admin siempre puede. (El copy del diseño
  "hasta 4 h antes" es el canónico.)
- **C) Pagos: SIN pasarela online.** Pago **en el local** o vía **QR a Revolut**
  (link/QR estático que el dueño pasará; no integración, no Stripe). `paymentMethod`
  refleja esto (p. ej. `cash | revolut`); no se cobra dentro de la app.
- **D) Fidelización "SOCIO ORO": aplazada.** Es un subsistema completo (puntos,
  tiers, referidos, canje). NO entra en el modelo de Fase 2; se diseña en una fase
  posterior. La tarjeta de socio del diseño quedará visual/placeholder por ahora.
- **E) Duración de servicio = configurable por el admin.** Cada servicio tiene
  `durationMinutes` editable desde el catálogo admin; el generador de slots respeta
  esa duración (y los solapamientos por barbero). Las citas recurrentes/fijas
  también las programa el admin.

---

## 11. Modelo de dominio (resumen)

**Entidades nuevas/cambiadas (refinar al implementar en Fase 2):**

- **Barber** (nueva): name, slug, photoUrl, bio, instagram?, color, active,
  servicesOffered[], timetable por día (mañana/tarde), vacations[].
- **Service:** + `priceOverrides` por barbero, `durationMinutes`, `isPrivate`.
- **Appointment:** + `barberId` (obligatorio), `priceSnapshot`, `status`
  (`booked|completed|cancelled|no_show`), `tip?`, `paymentMethod?`, `cancellable`,
  `isRecurring`.
- **WaitlistEntry:** + `preferredBarberId?` (null = cualquiera), `serviceId`,
  rango horario + fechas.
- **Horario efectivo de reserva** = intersección de horario del local
  (`settings/timetable`) ∩ horario del barbero ∩ vacaciones del barbero.

**Reglas de negocio de la app vieja (reimplementar, no copiar):**

- Teléfono ES: exactamente 9 dígitos numéricos.
- Cancelación/reprogramación: `now ≤ (fechaCita − 4h)`; admin siempre puede. (Decisión B.)
- Slots: timetable − citas existentes − citas fijas (salvo excepción) − pasados
  si es hoy. Ahora con **duración variable por servicio** (decisión E) → respetar
  duración y solapamientos por barbero.
- Citas fijas (recurrentes): las **programa el admin**; semanales, colección aparte
  - colección de excepciones.
- Servicios privados: no salen en lista pública ni reserva.
- Roles: la app vieja solo tiene booleano `admin`. La v2 contempla
  `client | barber | admin`.

Colecciones Firestore actuales (app vieja): `users`, `appointments`,
`fixed_appointments`, `fixed_appointments_exceptions`, `waitingList`, `services`,
`settings`, `timetable_rules`, `reviews`, `images`, `notifications`, `alerts`.

---

## 12. Plan de fases

- **Fase 0 — Arranque** ✅: scaffold, stack, config, tooling, estructura.
- **Fase 1 — Sistema de diseño** ✅: tokens forest exactos, dark-only, primitivos
  `U*` tematizados + componentes propios, layout, página `/_styleguide`.
- **Fase 2 — Auth y modelo** ✅: emuladores (demo-jdvm), esquemas Zod, lógica pura
  (slots/cancelación/teléfono), Auth Email/Google + roles, composables de colecciones,
  `firestore.rules`, middleware de rutas, seed. Verificado contra emuladores.
- **Fase 3 — Cliente** ✅ (pulido pendiente): Auth (`/login`, `/registro`,
  `/recuperar`, `/completar-perfil`) + Home (`/app`), Reservar (`/reservar`, flujo
  servicio→fecha→confirmar→confirmada con slots reales y confeti), Lista de espera
  (`/lista-espera`), Estudio (`/estudio`), Detalle barbero (`/barbero/[slug]`),
  Carta (`/carta`), Perfil (`/perfil`), Detalle cita (`/citas/[id]`), Valorar
  (`/valorar/[id]`), Avisos (`/avisos`). Shell: layouts `app` (con `AppTabBar`) e
  `inner` (con `AppBar`); componentes `UiPhoto`, helpers `lib/format`,
  `useMyAppointments`. Tab-bar: Inicio/Reservar/Estudio/Perfil.
  - **Formularios:** se usa `UForm` de Nuxt UI validando con los esquemas **Zod**
    (standard-schema; zod ≥3.24). VeeValidate queda instalado por si hace falta.
  - Diseño adaptado: el mockup mostraba Apple/teléfono; usamos Email + Google
    manteniendo el lenguaje visual (hero serif, dorado, grano). Layout `auth`.
- **Fase 4 — Admin:** Hoy → Agenda → Clientes → Equipo → Catálogo → Estudio admin
  → Reports → Notificaciones.
- **Fase 5 — PWA, notificaciones, pulido:** service worker, push FCM,
  recordatorios, offline, animaciones, lighthouse, deploy a Vercel.

Cloud Functions (waitlist matching, recordatorios, jobs) = proyecto separado,
se trata aparte.
