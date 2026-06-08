// La app v2 CONVIVE con la app legacy (v1) en la MISMA base de datos / bucket
// (proyecto jdvm-d82b6, plan Blaze). Para NO afectar a la v1, todas las colecciones
// de la v2 llevan sufijo `_v2` y nunca tocan las de la v1. Esta app SOLO lee/escribe
// en las colecciones `*_v2` (p. ej. las citas viven en `appointments_v2`).
//
// Colecciones de la v1 (NO usar): users, appointments, fixed_appointments,
// fixed_appointments_exceptions, waitingList, services, settings, timetable_rules,
// reviews, images, notifications, alerts.
//
// Auto-importado por Nuxt (app/utils) → disponible en composables, middleware,
// componentes y páginas sin import explícito.
export const COL = {
  users: 'users_v2',
  barbers: 'barbers_v2',
  services: 'services_v2',
  appointments: 'appointments_v2',
  waitlist: 'waitlist_v2',
  reviews: 'reviews_v2',
  images: 'images_v2',
  notifications: 'notifications_v2',
  alerts: 'alerts_v2',
  settings: 'settings_v2',
  fixed_appointments: 'fixed_appointments_v2',
  rewards: 'rewards_v2',
  redemptions: 'redemptions_v2',
  expenses: 'expenses_v2',
  products: 'products_v2',
  productSales: 'product_sales_v2',
  barberInvites: 'barber_invites_v2',
} as const

// Prefijo para las rutas de Firebase Storage (mismo bucket que la v1).
export const STORAGE_PREFIX = 'v2/'
