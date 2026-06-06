# Plan — Fase 4: Panel de administración

> Estado: Fases 0-1-2 ✅, Fase 3 (cliente) ✅ y **Fase 4 (admin) ✅**. Leer `CLAUDE.md` antes.
> Todo contra **emuladores** (no tocar prod `jdvm-d82b6`). `nvm use` + pnpm 9.
> Verificado: `pnpm lint`, `pnpm typecheck` y `pnpm build` en verde.

## Objetivo

Panel admin (y barbero) para gestionar el día a día. Rutas bajo `/admin/**`
(ya marcadas como SPA en `routeRules`), protegidas por el middleware `admin`
(barbero donde aplique con `barber`). Reusar el sistema de diseño forest, los
composables de la Fase 2 y los componentes de shell.

Commit final sugerido: `"Fase 4: panel de administración"` (o uno por pantalla).

## Shell admin

- [x] Layout `admin` con navegación propia (sidebar en desktop / menú overlay en
      móvil). Tokens forest reutilizados; desktop a ancho completo (uso interno).
- [x] Middleware `admin` aplicado en cada página vía `definePageMeta({ layout: 'admin', middleware: 'admin' })`.
- [x] Acceso al panel desde el Perfil del cliente si `role === 'admin'`.

## Pantallas (orden sugerido, una por commit)

1. [x] **Hoy** (`/admin`): resumen del día — KPIs (citas, ingresos est., clientes,
       canceladas), citas del día con estado, próxima, reparto por barbero, accesos
       rápidos, navegación por día. `useAppointments.onDay` + `useAdminAppointments`.
2. [x] **Agenda** (`/admin/agenda`): **Schedule-X** v4 (`@schedule-x/vue`), vistas
       semana/día. Eventos = citas (color por barbero), filtro por barbero, drawer de
       detalle con completar/no-show/cancelar/eliminar, alta vía `AdminBookingModal`.
       Tema oscuro cableado a tokens forest. Rango ↔ Firestore vía `onRangeUpdate`.
3. [x] **Clientes** (`/admin/clientes`): listado (`useClients.clients`) + buscador +
       filtro por rol + ficha lateral (datos, stats, historial). Crear cita al cliente.
4. [x] **Equipo** (`/admin/equipo`): CRUD de barberos (`useBarbers`): alta/edición,
       horario semanal (`WeekTimetableEditor`), vacaciones, servicios, color, activo.
5. [x] **Catálogo** (`/admin/catalogo`): CRUD de servicios (`useServices`):
       nombre, **duración editable** (decisión E), precio base, overrides por barbero,
       categoría, color, privado.
6. [x] **Estudio admin** (`/admin/estudio`): galería (subir/borrar, Firebase Storage
   - colección `images`) y reseñas (moderar/borrar). Pestañas Galería/Reseñas.
7. [x] **Reports** (`/admin/reports`): **@unovis/vue** — barras citas/día, donut de
       servicios top, ocupación e ingresos por barbero, KPIs. Rango 7/30/90 días.
8. [x] **Notificaciones** (`/admin/notificaciones`): avisos (colección `alerts`),
       composer con nivel (info/buenas/aviso) + flag push (FCM en Fase 5), activar/borrar.

> Pendiente menor (no bloqueante): **vincular cuenta de barbero (uid Auth)** al crear
> un barbero desde el panel — hoy `useBarbers.create` usa id automático; para que
> `appointment.barberId == request.auth.uid` cuadre, el doc `barbers/{uid}` debe usar
> el uid del barbero (como hace el seed). Editar barberos existentes funciona pleno.

## Extra (fuera de plan, pedido por el usuario)

- [x] **Hero video** en la pantalla inicial del cliente (`/app`): `public/video/hero.mp4`
      (vídeo vertical 1080×1920) con velo oscuro forest por encima + grano, saludo encima.

## Modelo / reglas a tocar

- [x] `firestore.rules`: añadidas reglas `images` y `alerts` (lectura pública,
      escritura admin). Probadas SOLO en emulador. NO desplegar a prod.
- [x] Nuevas colecciones `images` (galería) y `alerts` (avisos/banner) → schemas Zod
      (`schemas/image.ts`, `schemas/alert.ts`).
- [x] Ampliado `useAppointments` con `onDay`, `inRange`, `forClient`, `setStatus`,
      `update`. Nuevos composables: `useAdminAppointments`, `useAdminStats`,
      `useImages`, `useAlerts`, `useAdminNav`.
- [ ] Citas fijas/recurrentes (las **programa el admin**, decisión E): aplazado a un
      sub-paso posterior (el modelo ya tiene `isRecurring`; falta UI + generación).

## Stack específico de esta fase

- **Schedule-X** (`@schedule-x/vue`, `@schedule-x/calendar`, `@schedule-x/theme-default`) — agenda.
- **@unovis/vue** (+ `@unovis/ts`) — gráficos de Reports.
- (ya instalados en Fase 0.)

## Pendientes que NO son de esta fase

- Pulido responsive desktop de las pantallas de **cliente** (hoy son móvil centrado).
- PWA / push FCM / recordatorios → Fase 5.
- Fidelización SOCIO ORO (aplazada).
- Migración de datos del legacy → script aparte.
- Pasarela de pago: NO (pago en local / QR Revolut).
