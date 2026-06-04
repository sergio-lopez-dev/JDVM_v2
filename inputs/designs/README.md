# inputs/designs

Referencias de diseño de Claude Design (solo lectura, no se copian literalmente).

## Qué dejar aquí para la Fase 1

Para extraer los **tokens exactos** (colores del tema `forest`, tipografías,
radios, espaciados) y reimplementar las pantallas, hacen falta los archivos
fuente que referencia `JDVM App.html`, que **todavía no tenemos**:

- `themes.js` — define el tema `forest` (clave usada: `t = THEMES.find(x => x.key === 'forest')`).
- `design-canvas.jsx`, `ui.jsx`, `home.jsx`, `reservar.jsx`,
  `screens-booking.jsx`, `screens-discovery.jsx`, `screens-account.jsx`,
  `screens-extras.jsx`.

Con eso se sacan los valores reales en vez de aproximarlos desde el PDF.

## Lo que ya tenemos

- `JDVM_App.pdf` / `.pptx` — render del deck (14 pantallas), baja fidelidad.
- `JDVM App.html` — solo el loader (referencia los `.jsx` de arriba).

Las 14 pantallas: Bienvenida, Inicio/Mis citas, Notificaciones, Reserva
(Servicio → Fecha/hora → Confirmar → Confirmada → Lista de espera), Estudio,
Detalle de barbero, Carta, Perfil socio, Detalle de cita, Valorar.
