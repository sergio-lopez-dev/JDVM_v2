// Navegación del panel admin (compartida por sidebar y menú móvil).
export interface AdminNavItem {
  label: string
  icon: string
  to: string
}

export const ADMIN_NAV: AdminNavItem[] = [
  { label: 'Resumen', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Agenda', icon: 'i-lucide-calendar-days', to: '/admin/agenda' },
  { label: 'Citas', icon: 'i-lucide-scissors', to: '/admin/citas' },
  { label: 'Clientes', icon: 'i-lucide-users', to: '/admin/clientes' },
  { label: 'Servicios', icon: 'i-lucide-store', to: '/admin/catalogo' },
  { label: 'Equipo', icon: 'i-lucide-user', to: '/admin/equipo' },
  { label: 'Estudio', icon: 'i-lucide-image', to: '/admin/estudio' },
  { label: 'Facturación', icon: 'i-lucide-wallet', to: '/admin/facturacion' },
  { label: 'Informes', icon: 'i-lucide-chart-column', to: '/admin/reports' },
  { label: 'Fidelización', icon: 'i-lucide-award', to: '/admin/fidelizacion' },
  { label: 'Avisos', icon: 'i-lucide-bell', to: '/admin/notificaciones' },
  { label: 'Ajustes', icon: 'i-lucide-settings', to: '/admin/ajustes' },
]
