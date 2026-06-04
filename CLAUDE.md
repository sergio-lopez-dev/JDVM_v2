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
```

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

---

## 9. Tokens de diseño (PROVISIONALES)

En `app/assets/css/main.css` (`@theme`) y `app/app.config.ts`. Aproximados del
deck: fondo cálido casi-negro (`--color-ink-950: #0c0f0c`), acento dorado
(`gold`), fuentes Libre Caslon Display (display) / Hanken Grotesk (sans) /
JetBrains Mono (mono). **Se finalizan en la Fase 1** con los `themes.js` reales.
`app.config` usa `primary: 'gold'` y `neutral: 'stone'` (placeholder).

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

**Decisiones de producto PENDIENTES (cerrar antes de Fase 3):**

- **B) Cancelación: 24h vs 4h.** Brief y app vieja = 24h. El diseño dice "Cancela
  gratis hasta 4h antes". Decidir cuál es la canónica.
- **C) Pagos online.** El diseño muestra Apple Pay / tarjeta / "pagar en local",
  pero no hay pasarela en el stack. ¿Pago online real (metería Stripe, fuera de
  stack) o solo UI + pago en local?
- **D) Fidelización "SOCIO ORO".** Puntos, tiers, "invita y gana" aparecen en el
  diseño pero no en el modelo del brief. ¿Dentro o fuera del modelo v2?
- **E) Duración variable de servicio.** El modelo nuevo tiene `durationMinutes`;
  el algoritmo de slots de la app vieja asumía 30 min fijos → hay que reescribirlo
  respetando duración y solapamientos por barbero.

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
- Cancelación: `now ≤ (fechaCita − 24h)`; admin siempre puede. (Ver decisión B.)
- Slots: timetable − citas existentes − citas fijas (salvo excepción) − pasados
  si es hoy. (Duración era fija 30 min; ahora variable, ver decisión E.)
- Citas fijas (recurrentes): semanales, colección aparte + colección de excepciones.
- Servicios privados: no salen en lista pública ni reserva.
- Roles: la app vieja solo tiene booleano `admin`. La v2 contempla
  `client | barber | admin`.

Colecciones Firestore actuales (app vieja): `users`, `appointments`,
`fixed_appointments`, `fixed_appointments_exceptions`, `waitingList`, `services`,
`settings`, `timetable_rules`, `reviews`, `images`, `notifications`, `alerts`.

---

## 12. Plan de fases

- **Fase 0 — Arranque** ✅ (este commit): scaffold, stack, config, tooling, estructura.
- **Fase 1 — Sistema de diseño:** tokens reales desde `themes.js`, primitivos
  envueltos sobre Nuxt UI, layout, página `/_styleguide` (oculta en prod).
- **Fase 2 — Auth y modelo:** Auth Email/Google, esquemas Zod, composables de
  colecciones (`useBarbers`, `useServices`, `useAppointments`, `useWaitlist`,
  `useClients`), `firestore.rules`, middleware de rutas, emuladores.
- **Fase 3 — Cliente:** Login → Registro → Recuperación → Google → Home/Mis citas
  → Reservar → Estudio → Perfil. Una pantalla por commit.
- **Fase 4 — Admin:** Hoy → Agenda → Clientes → Equipo → Catálogo → Estudio admin
  → Reports → Notificaciones.
- **Fase 5 — PWA, notificaciones, pulido:** service worker, push FCM,
  recordatorios, offline, animaciones, lighthouse, deploy a Vercel.

Cloud Functions (waitlist matching, recordatorios, jobs) = proyecto separado,
se trata aparte.
