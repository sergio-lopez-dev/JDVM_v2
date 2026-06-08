// La app v2 CONVIVE con la app legacy (v1) en la MISMA base de datos / bucket
// (proyecto jdvm-d82b6, plan Blaze). Para NO afectar a la v1, todas las colecciones
// y rutas de Storage de la v2 van con prefijo propio y nunca tocan las de la v1.
//
// Colecciones de la v1 (NO usar): users, appointments, fixed_appointments,
// fixed_appointments_exceptions, waitingList, services, settings, timetable_rules,
// reviews, images, notifications, alerts.
//
// Auto-importado por Nuxt (app/utils) → disponible en composables, middleware,
// componentes y páginas sin import explícito.
export const COL = {
  users: 'v2_users',
  barbers: 'v2_barbers',
  services: 'v2_services',
  appointments: 'v2_appointments',
  waitlist: 'v2_waitlist',
  reviews: 'v2_reviews',
  images: 'v2_images',
  notifications: 'v2_notifications',
  alerts: 'v2_alerts',
  settings: 'v2_settings',
  fixed_appointments: 'v2_fixed_appointments',
  rewards: 'v2_rewards',
  redemptions: 'v2_redemptions',
} as const

// Prefijo para las rutas de Firebase Storage (mismo bucket que la v1).
export const STORAGE_PREFIX = 'v2/'
