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
| Calendario admin | **Schedule-X** (`@schedule-x/vue`)                      | Agenda. v4 usa **Temporal** → `temporal-polyfill` como dep directa + helper `lib/schedulex.ts`.                                          |
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

- Tema **forest** confirmado; tokens exactos cableados (ver §9). Es la paleta
  **por defecto**; ahora es **configurable** (ver abajo).
- App **dark-only** (sin toggle de tema): forzamos `colorMode` dark. (La paleta
  `bone` es clara; se maneja vía `color-scheme: light` sin tocar la clase `.dark`,
  cuyos mapeos semánticos son agnósticos a la dirección bg/fg.)
- **Paleta configurable por el admin** (las 6 direcciones de `themes.js`: forest,
  brass, copper, burgundy, steel, bone). Fuente de verdad: `lib/themes.ts`
  (`BRAND_THEMES` + `themeCssVars`, que genera rampas gold/ink ancladas en los
  tokens de diseño). Se elige en **`/admin/ajustes`** (campo `settings/main.theme`,
  enum en `schemas/settings.ts`) y se aplica a **TODA la app** en runtime vía
  `app/composables/useBrandTheme.ts` (`useBrandThemeSync` en `app.vue` sobreescribe
  los `--jdvm-*` + rampas `--color-gold/ink-*` + `--font-display` en `<html>`; el
  bloque `.dark` de `main.css` deriva en cascada los tokens de Nuxt UI). Cookie
  `jdvm-theme` (1 año) para aplicar sin flash antes de que llegue Firestore. Cada
  dirección trae su propia serif (todas cargadas en `nuxt.config`).
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
- **C) Pagos: SIN pasarela online.** Pago **en el local** (efectivo o tarjeta/datáfono)
  o vía **QR a Revolut** (link/QR estático que el dueño pasará; no integración, no Stripe).
  No se cobra dentro de la app. `PAYMENT_METHODS = cash | card | revolut`. Al **completar**
  una cita, el barbero/admin marca cómo se cobró (**por defecto efectivo**; conmutable a
  tarjeta con `PaymentToggle` en `/staff/cita/[id]` y los drawers de agenda/citas). Para
  facturación lo que cuenta es efectivo vs no-efectivo (`isCashPayment`): `useFinance.collectedByMethod`
  (servicios `byPaymentMethod` de `useAdminStats` + productos) alimenta el arqueo de caja en
  **`/admin/facturacion`** (tarjeta "Cobros por método").
- **D) Fidelización "Socio": IMPLEMENTADA y configurable** (antes aplazada). Niveles
  Bronce/Plata/Oro, recompensas canjeables (corte gratis, camiseta, cerveza…),
  caducidad de puntos y activar/desactivar — todo desde admin. Ver §13. (Referidos
  siguen fuera de alcance.)
- **E) Duración de servicio = configurable por el admin.** Cada servicio tiene
  `durationMinutes` editable desde el catálogo admin; el generador de slots respeta
  esa duración (y los solapamientos por barbero). Las citas recurrentes/fijas
  también las programa el admin. **Override por barbero:** además del precio, la
  **duración** admite override por barbero (`service.durationOverrides`, mismo patrón
  que `priceOverrides`). Helper `effectiveDuration(service, barberId)` en
  `schemas/service.ts`; lo usan slots, reserva, citas fijas y los enriquecidos. Se
  edita en `/admin/catalogo` (bloque "Duración por barbero").

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
- **Fase 4 — Admin** ✅: panel bajo `/admin/**` (SPA, middleware `admin`). Layout
  `admin` (sidebar desktop + menú overlay móvil, nav en `useAdminNav`). Pantallas:
  **Hoy** (`/admin`, KPIs + citas del día), **Agenda** (`/admin/agenda`, Schedule-X),
  **Clientes** (`/admin/clientes`, listado+ficha+historial), **Equipo** (`/admin/equipo`,
  CRUD barberos + horario/vacaciones), **Catálogo** (`/admin/catalogo`, CRUD servicios
  - duración + overrides), **Estudio** (`/admin/estudio`, galería Storage + reseñas),
    **Reports** (`/admin/reports`, @unovis/vue), **Notificaciones** (`/admin/notificaciones`).
    Acceso desde Perfil si `role==='admin'`. Verificado: lint + typecheck + build.
  * **Nuevas colecciones:** `images` (galería; doc + binario en Storage `gallery/`) y
    `alerts` (avisos/banner). Schemas `schemas/image.ts`, `schemas/alert.ts`. Reglas
    `images`/`alerts` en `firestore.rules` (lectura pública, escritura admin).
  * **Composables nuevos/ampliados:** `useAppointments` +`onDay`/`inRange`/`forClient`/
    `setStatus`/`update`; `useAdminAppointments` (enriquecido cliente+barbero+servicio),
    `useAdminStats` (agregados Reports), `useImages`, `useAlerts`, `useAdminNav`.
    Componentes: `AdminHeader`, `AdminBookingModal`, `WeekTimetableEditor`.
  * **Schedule-X v4** usa **Temporal**: añadido `temporal-polyfill` (dep directa,
    requisito de la versión 4) y helper `lib/schedulex.ts` (JS Date ↔ ZonedDateTime,
    zona `Europe/Madrid`). Eventos sincronizados vía `calendarApp.events.set()`.
  * Pendiente menor: vincular `barbers/{uid}` al uid de Auth al crear barbero (hoy
    id automático); citas recurrentes (UI + generación) aplazadas.
  * **Extra (pedido):** hero video en la home cliente (`public/video/hero.mp4`, vertical)
    con velo oscuro forest + grano y saludo superpuesto.
  * **Rediseño escritorio (PC)** según mockups Claude Design: layout `admin` con
    sidebar (sección "Gestión", estado del local en vivo, ficha de usuario) y topbar
    (`AdminHeader` con búsqueda + campana). Átomos `AdminCard`/`AdminPill`/`AdminKpi`.
    **Resumen** (`/admin`) = dashboard (KPIs con delta, timeline "próximas citas",
    barras ingresos/semana, equipo hoy). Nueva **Citas** (`/admin/citas`): tabla con
    filtros + búsqueda + paginación + acciones. **Servicios** (`/admin/catalogo`):
    catálogo + panel de edición lateral (incl. barberos que ofrecen cada servicio).
    **Equipo** (`/admin/equipo`): tarjetas con stats (valoración/reseñas/servicios) +
    chips de horario semanal. Nav reordenada (`useAdminNav`). Landing web pública (`/`)
    rehecha como sitio de marketing responsive (nav, hero con vídeo, carta, estudio,
    equipo, testimonios, visítanos, CTA, footer); acceso Google+vídeo movido a `/login`.
- **Rol BARBERO (app móvil propia)** ✅: rutas bajo **`/staff/**`** (SPA, middleware
`barber`; prefijo distinto de `/barbero/[slug]`público para evitar colisión). Layout`barber`(centrado móvil +`BarberTabBar`: Hoy/Agenda/Clientes/Ingresos/Perfil).
Pantallas: **Hoy** (`/staff`, stats + "en curso" + mi día), **Agenda** (`/staff/agenda`,
timeline propio), **Detalle** (`/staff/cita/[id]`, datos+historial+marcar hecha),
**Clientes** (`/staff/clientes`, derivados de sus citas), **Ingresos** (`/staff/ingresos`,
"tu parte" semana/mes + desglose), **Perfil** (`/staff/perfil`, disponibilidad editable,
  servicios solo lectura). Acceso reducido: solo lo suyo, sin carta/equipo/negocio.
  - Composable `useBarber` (una consulta amplia `forBarberInRange` enriquecida → hoy/
    semana/clientes/ingresos). Login redirige por rol (`useAuth.destinationFor`): barbero
    → `/staff`, resto → `/app`.
  - **Reglas ampliadas:** `users` legibles por `isStaff` (el barbero ve nombre/teléfono de
    sus clientes); el barbero puede actualizar SOLO `timetable`/`vacations` de su propio
    doc `barbers/{uid}` (precios/servicios/color siguen siendo admin).
- **Peticiones de la barbería (lote)** ✅:
  - **Foto de barberos:** subida a Storage (`barbers/`) desde admin Equipo; se muestra
    vía componente `UiAvatar` (foto o iniciales) en Equipo, perfil de barbero y
    detalle público `/barbero/[slug]`.
  - **% comisión por barbero:** `barber.commissionPercent` (lo fija el admin en Equipo);
    el barbero ve en `/staff/ingresos` solo su parte (servicios·% + propinas), no la caja.
  - **Notificaciones in-app** (como legacy, sin FCM; PWA = acceso directo): colección
    `notifications` + `useNotifications`. Aviso automático al **cancelar** (a admin y
    barbero); buzón del cliente en `/avisos`; campaña **"anima a reservar"** (clientes con
    1–3 citas/mes) desde admin Avisos. Reglas: crea cualquier autenticado, lee su `targetUid`
    o admin/staff su rol.
  - **Vacaciones bloquean reserva:** `reservar.vue` aplica `isOnVacation` (día deshabilitado
    - sin huecos) para el barbero concreto.
  - **Granularidad configurable + ajustes:** nueva pantalla **`/admin/ajustes`** (paso de
    franjas `slotStepMinutes`, días cerrados, aceptar reservas/cancelaciones, horario del
    local con `WeekTimetableEditor`).
  - **Noticias destacadas:** los `alerts` activos se muestran al cliente (banner en `/app`
    - sección en `/avisos`).
  - **Citas fijas (semanales):** schema `fixed` + colección `fixed_appointments` +
    `useFixedAppointments`. El admin las crea (modal en Agenda); se **materializan** como
    `appointments` reales (`isRecurring`+`fixedId`) 12 semanas → bloquean reserva y aparecen
    en agenda/barbero automáticamente. Borrar serie elimina sus citas futuras.
  - **Reglas ampliadas:** `notifications`, `fixed_appointments` (lectura staff, escritura
    admin). (Índices compuestos para prod pendientes: notifications where+orderBy,
    fixed_appointments fixedId+startsAt.)
- **Responsive web (PC) cliente y barbero** ✅: el layout `barber` adopta en `lg+` un
  shell tipo app: barra lateral fija (`BarberSideNav`) + columna centrada, ocultando el
  tab bar inferior (`lg:hidden`). En móvil sigue igual.
- **Cliente PC — rediseño top-nav** ✅ (según mockups `client-web.jsx` /
  `client-web-booking.jsx`): el shell del cliente en `lg+` pasa de barra lateral a
  **barra superior** (`AppTopNav`: logo + Inicio/Reservar/El estudio/Mi cuenta + campana
  → `/avisos` + ficha con menú desplegable que incluye Carta/Lista de espera/Cerrar
  sesión). Los layouts `app` e `inner` usan `AppTopNav` en `lg+` y `AppTabBar` en móvil
  (`AppSideNav` queda en desuso). Pantallas con vista de escritorio dedicada (móvil
  intacto, `lg:hidden` / `hidden lg:flex`):
  - **Inicio** (`/app`): saludo, hero "próxima cita" horizontal, 3 acciones rápidas,
    historial en tabla + lateral (socio + galería). Sin vídeo en PC (sí en móvil).
  - **El estudio** (`/estudio`): galería 4-col + botón Instagram (responsive sobre el
    mismo árbol).
  - **Mi cuenta** (`/perfil`): 2 columnas — ficha+socio / ajustes de cuenta + acciones.
  - **Reservar** (`/reservar`, layout nuevo **`booking`** a ancho completo): vista
    unificada servicio+barbero+**calendario mensual**+slots+resumen → Confirmar (2 col,
    pago en local/Revolut) → Confirmada (con enlace "Añadir a Google Calendar"). En móvil
    sigue el flujo por pasos. La máquina de estados (`step`) se comparte; solo cambia el
    render por breakpoint.
- **Conexión total a datos (sin hardcode)** ✅: se eliminaron los últimos placeholders.
  - **Landing pública** (`/`) ahora 100% data-driven: carta (`useServices`+`useServiceCategories`),
    equipo (`useBarbers` + valoración real), galería (`useImages`), testimonios y media de
    estrellas (`useReviews`), horario + estado "abierto/cerrado ahora" (`useSettings`),
    contacto/marca (`settings.studio`). Sin datos inventados.
  - **`/estudio`**: galería real desde `useImages` (sin "likes" placeholder ni filtros muertos),
    botón Instagram a `settings.studio.instagram`.
  - **`/barbero/[slug]`**: chips = servicios que ofrece, stats = valoración/reseñas/servicios
    reales (no "212 cortes/mes"/"98% puntualidad", inaccesibles por reglas), trabajos = imágenes
    con `barberId`.
  - **Nuevo bloque `settings.studio`** (`schemas/settings.ts`) editable en `/admin/ajustes`
    ("Información del estudio"). Helpers `formatDayHours`/`openStatus` en `lib/slots.ts`.
    `UiPhoto` ahora acepta `src` (imagen real con fallback al placeholder a rayas).
- **White-label (app genérica)** ✅: toda la marca es configurable desde admin; no quedan
  textos "JDVM"/"Maracena" incrustados.
  - **`settings.studio`** ampliado: `name, city, phone, email, whatsapp, address, instagram,
facebook, tiktok, mapsUrl, foundedYear, logoUrl/logoPath, logoMarkUrl/logoMarkPath`.
  - **Composable `useStudio()`** = fuente única de verdad (reactiva, con defaults) + helpers
    `igUrl/fbUrl/tiktokUrl/waUrl`, `codePrefix` (prefijo de código de reserva derivado del
    nombre) y `uploadLogo/removeLogo` (a Storage `branding/`). **Todas** las pantallas leen de
    aquí en vez de literales.
  - **`AppLogo`** usa los logos subidos (`logoUrl`/`logoMarkUrl`) con fallback al logo legacy;
    variante `wordmark` = nombre configurable. Admin sube 2 logos (completo + emblema) en
    `/admin/ajustes` → "Logo".
  - **Títulos de pestaña**: `app.vue` define `titleTemplate` que añade el nombre del estudio;
    cada página pone solo su nombre (se barrió el sufijo `· JDVM`).
  - Reglas de Storage ya permiten `branding/` (escritura autenticada). Seed siembra el `studio`
    completo. Verificado: typecheck + lint + rutas SSR 200.
- **Fase 5 — PWA, notificaciones, pulido:** service worker, push FCM,
  recordatorios, offline, animaciones, lighthouse, deploy a Vercel.

Cloud Functions (waitlist matching, recordatorios, jobs) = proyecto separado,
se trata aparte.

---

## 13. Programa de fidelización "Socio"

Configurable 100% desde admin; **deshabilitado por defecto** (si está off, desaparece
de la app del cliente).

**Modelo (clave):** los puntos NO se almacenan como movimientos: se **derivan** de las
citas `completed` del cliente (`pointsForPrice = floor(precio × pointsPerEuro)`). Así no
hay que enganchar el devengo en cada punto de "completar cita", funciona retroactivamente
con el histórico y **el cliente no puede inflarlos**. Lo único que se persiste son las
recompensas (catálogo) y los canjes.

- **Caducidad:** cada visita genera una "bolsa" de puntos que caduca a los `expiryMonths`.
  El saldo gastable se consume **FIFO** (bolsas más antiguas no caducadas primero). Cómputo
  lazy en lectura → sin cron ni Cloud Function. Lógica pura en [`lib/loyalty.ts`](lib/loyalty.ts)
  (`computeLoyalty`, `buildEarnLots`, `tierFor`).
- **Niveles:** Bronce/Plata/Oro por defecto (editables: nombre + `minPoints`). El nivel usa
  los **puntos brutos activos** (ganados en la ventana), no el saldo → canjear no baja de nivel.
- **Recompensas** (`rewards`, schema [`schemas/loyalty.ts`](schemas/loyalty.ts)): catálogo
  CRUD admin (nombre, descripción, coste en pts, icono, visible). **Canjes** (`redemptions`):
  el cliente los pide en `pending`; staff/admin los entrega (`fulfilled`) o anula (`cancelled`).
- **Config** en `settings.loyalty` (`enabled`, `pointsPerEuro`, `expiryMonths`, `tiers[]`).
- **Composable** [`useLoyalty`](app/composables/useLoyalty.ts): `mySummary` (nivel/saldo/
  próxima caducidad del usuario), `activeRewards`, `redeem`, `forClient(uid)` (ficha admin),
  `adminRedemptions()` (cola de canjes), CRUD de recompensas.
- **UI:** admin [`/admin/fidelizacion`](app/pages/admin/fidelizacion.vue) (config + niveles +
  recompensas + canjes pendientes) y nav "Fidelización"; cliente [`/socio`](app/pages/socio.vue)
  (nivel, saldo, progreso, caducidad, catálogo, mis canjes). Las tarjetas "Socio" de
  `/app` y `/perfil` muestran datos reales y se ocultan si está off. Ficha de cliente en admin
  muestra nivel + saldo.
- **Reglas/seguridad** ([`firestore.rules`](firestore.rules)): `rewards` lectura pública /
  escritura admin; `redemptions` el cliente crea el suyo en `pending` con el **coste exacto**
  de la recompensa (verificado con `get()`), staff resuelve. Además se **endurecieron** las
  citas: el cliente solo puede reprogramar (sigue `booked`) o cancelar, sin tocar
  precio/servicio/barbero ni marcarse `completed`, y no puede **crear** citas ya `completed`
  (evita forjar puntos). Verificado contra el emulador (reprogramar/cancelar/canjear OK;
  auto-completar/abaratar canje DENEGADO). Índices compuestos para prod pendientes
  (`redemptions` userId, etc.).

---

## 14. Categorías de la carta (dinámicas) + fix agenda

- **Categorías configurables:** antes `service.category` era un enum fijo; ahora es un
  **id libre** y las categorías se gestionan desde admin. Viven en
  `settings.serviceCategories` (`[{id,name}]`, con [`DEFAULT_SERVICE_CATEGORIES`](schemas/service.ts)
  de fallback). Composable [`useServiceCategories`](app/composables/useServiceCategories.ts)
  (categories/label/add/rename/remove/reorder). UI de gestión (crear/renombrar/borrar) en
  [`/admin/catalogo`](app/pages/admin/catalogo.vue): al borrar una categoría, sus servicios
  pasan a “Sin categoría” (se reasignan a `''`). El selector del servicio y el agrupado de
  [`/carta`](app/pages/carta.vue) usan estas categorías + un grupo “Otros” para huérfanos.
- **Fix agenda (Schedule-X v4):** el módulo `@schedule-x/calendar` usa `Temporal` como
  **global**; `temporal-polyfill` no lo instala al importar el named export, así que la
  página petaba con `500 · Temporal is not defined` (cliente y SSR). Solución: `import
'temporal-polyfill/global'` como **primer import** de [`agenda.vue`](app/pages/admin/agenda.vue),
  antes de `@schedule-x`. Verificado en navegador headless (login admin → render del
  calendario con eventos reales migrados).

## 15. Lote de mejoras/bugs (mejoras barbería)

> **Rutas raíz (cambio):** el **login es la página principal** (URL base `/`) — `login.vue` añade
> `alias: ['/']`; `/login` sigue funcionando (lo usan middleware y flujos de auth). La **landing
> pública** se movió de `/` a **`/about-us`** (`app/pages/about-us.vue`, antes `index.vue`). El login
> incluye un enlace "Conoce el estudio" → `/about-us`. (App SPA `ssr:false`; el logo de la landing
> usa anclas `#`, ningún enlace apunta a `/`.)

- **Fix fecha "hoy/mañana" (home cliente):** `daysUntil` en [`app/index.vue`](app/pages/app/index.vue)
  comparaba ms en UTC mientras `fmtDate` formatea en hora local → de madrugada una parte
  decía "hoy" y otra "mañana". Ahora se compara por **medianoche local** de ambas fechas.
- **Orden de barberos configurable:** nuevo campo `barber.sortOrder` (schema). `useBarbers`
  ordena TODAS las listas por `sortOrder` asc (desempate por nombre) → afecta al selector de
  reserva del cliente y al admin. Se edita en [`/admin/equipo`](app/pages/admin/equipo.vue):
  campo "Orden en reserva" + flechas ↑/↓ en cada tarjeta (reescriben sortOrder = índice).
- **Mapa real:** nuevo componente [`UiMap`](app/components/UiMap.vue) = iframe de Google Maps
  embebido (`?q=<dirección>&output=embed`, sin API key, filtrado a oscuro). Sustituye los
  placeholders `UiPhoto` "mapa" en la landing (`/`, sección Visítanos) y en el detalle de cita
  (`/citas/[id]`). Se alimenta de `studio.address` (fallback `name, city`) + `studio.mapsUrl`
  como enlace "Cómo llegar".
- **Notificaciones push dobles (fix):** las Functions enviaban push con payload `notification`
  → en web el navegador lo auto-mostraba Y además disparaba `onBackgroundMessage` del SW = 2
  avisos. Ahora `pushToTokens` ([functions/index.js](functions/index.js)) manda **data-only**
  (título/cuerpo en `data`); el SW [firebase-messaging-sw.js](public/firebase-messaging-sw.js)
  y el handler de primer plano ([useMessaging](app/composables/useMessaging.ts)) leen de `data`,
  y el SW usa `tag = appointmentId` para colapsar duplicados. **Requiere redeploy de Functions.**
- **Agenda · vista equipo (columnas por barbero):** Schedule-X v4 no tiene vista de recursos;
  nuevo componente [`AdminDayBoard`](app/components/AdminDayBoard.vue) = eje horario + una
  columna por barbero con sus citas del día. Toggle "Calendario / Equipo" + navegación de día
  en [`/admin/agenda`](app/pages/admin/agenda.vue) (escritorio). Click en cita → mismo drawer.
- **Ya existían (verificados, sin cambios):** "última fecha de acceso" (`users.lastLogin`,
  columna en [`/admin/clientes`](app/pages/admin/clientes.vue)) y "mantener sesión iniciada"
  (checkbox `remember` en [`/login`](app/pages/login.vue) → `setPersistence` en `useAuth`).

### 15.1 No-show, veto y eliminación de clientes

- **No-show no contabiliza:** ya era así — TODA la contabilidad (`useAdminStats` con
  `DONE={'completed'}`, `useFinance` que la reusa, y `/staff/ingresos`) cuenta **solo**
  citas `completed`. Marcar `no_show` la excluye de ingresos/comisiones automáticamente.
  Nuevo: el **barbero** ya puede marcar "No vino" desde [`/staff/cita/[id]`](app/pages/staff/cita/[id].vue)
  (antes solo "Marcar hecha"); el admin ya podía desde la agenda.
- **Veto de cliente (`users.banned`):** lo marca **staff** (barbero o admin). Un cliente
  vetado no puede coger nuevas citas: guard en [`reservar.vue`](app/pages/reservar.vue)
  (`confirm()` bloquea + banner). Se conmuta desde [`/staff/cita/[id]`](app/pages/staff/cita/[id].vue)
  ("Vetar cliente"/"Quitar veto") y desde la ficha de [`/admin/clientes`](app/pages/admin/clientes.vue).
  Helpers nuevos en [`useClients`](app/composables/useClients.ts): `setBanned`, `clientById`.
  (Enforcement a nivel de app, coherente con las reglas permisivas heredadas de v1.)
- **Eliminar cliente (admin):** botón en la ficha de [`/admin/clientes`](app/pages/admin/clientes.vue)
  (doble confirmación) → `removeClient` borra el doc `users/{uid}`. La cuenta de Auth NO se
  borra desde el cliente (requiere Admin SDK); si el usuario vuelve a entrar se recrea la ficha
  (sin veto) → para impedir el acceso de verdad se usa el **veto**, no el borrado. Solo para
  rol `client` (no se ofrece sobre barberos/admin).
- **Ofrecer veto tras "no vino":** al marcar `no_show` (en [`/staff/cita/[id]`](app/pages/staff/cita/[id].vue),
  drawer de [`/admin/agenda`](app/pages/admin/agenda.vue) y de [`/admin/citas`](app/pages/admin/citas.vue))
  aparece un prompt "¿Vetar cliente?" — **no es automático** (solo si no paga la cita perdida).
  El drawer no se cierra; el botón "No vino" usa `noShowSel`/`markNoShow` que reflejan el nuevo
  estado en `selected` (spread) y el `watch` del prompt se resetea por `id`, no por objeto.

### 15.2 Agenda admin · columnas por barbero + horas libres (móvil y PC)

- **[`AdminDayBoard`](app/components/AdminDayBoard.vue)** ampliado: además de las columnas por
  barbero, pinta los **huecos libres** por columna (zonas verdes punteadas), un badge **€** en las
  citas `completed` (pagadas) e indicador de **"ahora"** (línea roja, solo si el día es hoy).
  Recibe `freeByBarber` (mapa barberId→[{start,end}]) calculado en la agenda con `freeWindows`.
- **Móvil:** la agenda ([`/admin/agenda`](app/pages/admin/agenda.vue)) ahora ofrece un toggle
  **Columnas / Lista** (`mobileView`, por defecto **Columnas**). "Columnas" = `AdminDayBoard` del día
  seleccionado (scroll horizontal si hay muchos barberos); "Lista" = el timeline anterior.
- **Escritorio:** el board de la vista **Equipo** usa `boardBarbers` (respeta el filtro de barbero)
  y muestra también las horas libres. Mismo componente que móvil.
- **Navegación de semanas (móvil):** la agenda móvil ya no se limita a la semana actual — hay una
  cabecera con ‹ / › (`shiftWeek`) y el rango "d MMM – d MMM" clicable que vuelve a hoy (`goToday`).
  Mueve `rangeStart`/`rangeEnd` (consulta a Firestore) y `selectedDay`. El Schedule-X oculto en
  `lg:` no pisa el rango (su `onRangeUpdate` solo dispara al navegar la propia vista).
- **Revertir estado:** "No vino" y "Hecha" se pueden deshacer (`revertToBooked`: status → `booked`)
  desde [`/staff/cita/[id]`](app/pages/staff/cita/[id].vue) y los drawers de
  [`/admin/agenda`](app/pages/admin/agenda.vue) y [`/admin/citas`](app/pages/admin/citas.vue).

### 15.3 Presencia / último acceso (admin ve quién está activo)

- **`users.lastLogin` = presencia real:** además de en el login, [`usePresence`](app/composables/usePresence.ts)
  (montado en [`app.vue`](app/app.vue)) lo actualiza con heartbeat mientras se usa la app
  (throttle 5 min, solo con pestaña visible). Así "último acceso" refleja actividad real.
- **[`/admin/clientes`](app/pages/admin/clientes.vue):** punto verde "en línea" (actividad < 10 min)
  en el avatar; el último acceso se ve **también en móvil** como tiempo relativo (`timeAgo` en
  [`lib/format`](lib/format.ts)); contador "N en línea" en la cabecera; orden **A–Z / Recientes**
  (`sortBy`). Pensado para detectar quién está entrando y avisarle de huecos / animar a reservar
  (campañas en [`/admin/notificaciones`](app/pages/admin/notificaciones.vue)).

### 15.4 Agenda: hoy, WhatsApp, citas fijas cada N semanas y bloqueo de huecos

- **Día actual señalado:** las tiras de días de [`/admin/agenda`](app/pages/admin/agenda.vue) y
  [`/staff/agenda`](app/pages/staff/agenda.vue) resaltan **hoy** (borde dorado + punto), distinto
  del día seleccionado; la vista Equipo (escritorio) muestra un chip "Hoy". El board sigue pintando
  la línea roja de "ahora".
- **Contactar por WhatsApp:** helpers `waLink`/`telLink`/`intlPhone` en [`lib/phone.ts`](lib/phone.ts)
  (España → prefijo 34). Botón de WhatsApp en [`ClientInfoButton`](app/components/ClientInfoButton.vue)
  (chip de las agendas), en el drawer de [`/admin/agenda`](app/pages/admin/agenda.vue) y en el detalle
  [`/staff/cita/[id]`](app/pages/staff/cita/[id].vue) (junto a "Llamar").
- **Citas fijas cada N semanas:** `fixed.intervalWeeks` (1–4) + `fixed.anchorDate` (schema). El
  generador de ocurrencias salta `intervalWeeks` semanas (horizonte ~12 sem). El bloqueo de reserva
  desde la plantilla (`fixedBusy` en `reservar.vue` y `AdminBookingModal`) usa `fixedOccursOn`
  ([`lib/datetime.ts`](lib/datetime.ts)) para NO bloquear las semanas que no tocan. Selector
  "Periodicidad" en [`AdminFixedModal`](app/components/AdminFixedModal.vue).
- **Citas fijas a no-clientes y citas extra fuera de horario:** ya existían (toggles "Sin registrar"
  y "Fuera de horario" en los modales). Sin cambios; verificados.
- **Crash al crear citas fijas (blindado, decisión del dueño):** `useFixedAppointments.create` es
  ahora **idempotente** (rechaza una serie activa idéntica → no duplica; `update` la salta con
  `allowDuplicate`) y el render de Schedule-X va envuelto (`safeSetEvents`) para que un dato raro no
  tumbe la agenda. `dayBoundaries` ampliado a 07–23.
- **Bloqueo de huecos (staff/admin):** una "cita" con `appointment.type: 'block'` (sin cliente ni
  servicio, `note` opcional). Ocupa el hueco automáticamente (es `status: 'booked'` → ya cuenta como
  `busy` en slots/reserva) pero **no factura** (la contabilidad solo suma `completed`).
  [`BlockModal`](app/components/BlockModal.vue) lo crea (barbero fijado en staff, seleccionable en
  admin). Se pinta en gris ("No disponible") en agendas y board; se excluye de los paneles "Hoy"
  (admin/staff) y de los contadores. Enriquecido en [`useAdminAppointments`](app/composables/useAdminAppointments.ts).
- **Comisión del dueño (sin cambio de código):** si el dueño hace cortes, debe ponerse **0%** de
  comisión en Equipo; así su facturación entra íntegra como beneficio del local (la comisión se resta
  como coste en [`useFinance`](app/composables/useFinance.ts), por diseño).
