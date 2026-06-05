# Plan — Fase 4: Panel de administración

> Estado: Fases 0-1-2 ✅ y Fase 3 (cliente) ✅. Leer `CLAUDE.md` antes.
> Todo contra **emuladores** (no tocar prod `jdvm-d82b6`). `nvm use` + pnpm 9.

## Objetivo

Panel admin (y barbero) para gestionar el día a día. Rutas bajo `/admin/**`
(ya marcadas como SPA en `routeRules`), protegidas por el middleware `admin`
(barbero donde aplique con `barber`). Reusar el sistema de diseño forest, los
composables de la Fase 2 y los componentes de shell.

Commit final sugerido: `"Fase 4: panel de administración"` (o uno por pantalla).

## Shell admin

- [ ] Layout `admin` con navegación propia (sidebar en desktop / tab-bar o menú en
      móvil). Reutilizar tokens; la versión desktop aquí SÍ importa (uso interno).
- [ ] Middleware `admin` ya existe; aplicar `definePageMeta({ layout: 'admin', middleware: 'admin' })`.
- [ ] Acceso al panel desde el Perfil del cliente si `role === 'admin'`.

## Pantallas (orden sugerido, una por commit)

1. **Hoy** (`/admin`): resumen del día — próximas citas, huecos, ingresos
   estimados, accesos rápidos. Datos: `useAppointments.forBarberOnDay` (ampliar a
   "todas las del día") + servicios/barberos.
2. **Agenda** (`/admin/agenda`): calendario con **Schedule-X** (`@schedule-x/vue`).
   Eventos = citas (color por barbero). Crear/editar/cancelar; vista día/semana.
   Cablear el tema oscuro de Schedule-X a los tokens forest.
3. **Clientes** (`/admin/clientes`): listado (`useClients.clients`, solo admin por
   reglas) + buscador + ficha (historial de citas del cliente). Crear cita a un cliente.
4. **Equipo** (`/admin/equipo`): CRUD de barberos (`useBarbers`): alta/edición,
   horario semanal (mañana/tarde por día), vacaciones, servicios que ofrece,
   color, activo. Vincular cuenta de barbero (rol).
5. **Catálogo** (`/admin/catalogo`): CRUD de servicios (`useServices`):
   nombre, **duración (editable)**, precio base, overrides por barbero, categoría,
   privado. (Decisión E: la duración la fija el admin y el generador de slots la respeta.)
6. **Estudio admin** (`/admin/estudio`): gestión de galería (subir/borrar imágenes,
   Firebase Storage) + reseñas (moderar). Modelar colección `images` si hace falta.
7. **Reports** (`/admin/reports`): gráficos con **@unovis/vue** — citas por
   día/semana, ingresos, ranking de servicios, ocupación por barbero.
8. **Notificaciones** (`/admin/notificaciones`): alertas/banner (colección `alerts`),
   y disparo manual de avisos (se integra con FCM en Fase 5).

## Modelo / reglas a tocar

- [ ] `firestore.rules`: las colecciones ya permiten escritura admin; revisar
      `images`/`alerts` si se añaden. Probar SOLO en emulador.
- [ ] Posible nueva colección `images` (galería) y `alerts` (avisos/banner) → schemas Zod.
- [ ] Citas fijas/recurrentes (las **programa el admin**, decisión E): colección
      `fixed_appointments` + excepciones, o `isRecurring` + generación. Diseñar en esta fase.
- [ ] Ampliar `useAppointments` con consultas de día/rango para todos los barberos.

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
