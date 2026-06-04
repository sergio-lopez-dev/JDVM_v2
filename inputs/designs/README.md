# inputs/designs

Referencias de diseño de Claude Design (solo lectura, no se copian literalmente).
Reimplementar como componentes Vue 3 idiomáticos sobre Nuxt UI con nuestros tokens.

## Dirección elegida: `forest` (Verde inglés)

`JDVM App.html` renderiza el tema `forest`. Tokens exactos (de `themes.js`):

| Token | Valor | Uso |
|---|---|---|
| `bg0` | `#0B0F0C` | Fondo base (casi-negro verdoso) |
| `bg1` | `#111711` | Superficie elevada (cards) |
| `bg2` | `#1A211A` | Superficie 2 (chips, badges) |
| `border` | `#28301F` | Borde normal |
| `borderSoft` | `#1F271B` | Borde suave (divisores internos) |
| `fg0` | `#ECEFE3` | Texto principal (crema) |
| `fg1` | `#9CA791` | Texto secundario |
| `fg2` | `#62705B` | Texto terciario / labels |
| `accent` | `#C2A24E` | Dorado/mostaza (CTA, selección) |
| `accentHover` | `#D4B45F` | Hover del acento |
| `accentTint` | `#DCC07A` | Acento claro (texto sobre oscuro) |
| `accentSoft` | `rgba(194,162,78,0.13)` | Fondo tintado del acento |
| `accentLine` | `rgba(194,162,78,0.32)` | Borde tintado del acento |
| `accentText` | `#14180C` | Texto sobre el acento (oscuro) |
| `success` | `#6FA98A` | Verde "hecha/pagado" |
| `warning` | `#D4A24C` | |
| `danger` | `#C46A4C` | Cancelar / destructivo |
| `serviceA/B/C` | `#C2A24E` / `#7C8C9E` / `#A6857B` | Colores de categoría de servicio |

Tipografías: **Libre Caslon Display** (serif/display, peso 400), **Hanken Grotesk**
(sans, 400-700), **JetBrains Mono** (mono, labels/horas). Ya cargadas en `nuxt.config.ts`.

Radios observados: cards 12-18, botones 13, chips/pills 20, inputs/botón-icono 10-11.
Grano sutil (`feTurbulence`) sobre el fondo oscuro para que no quede plano.

## Archivos

- `themes.js` ✅ — los 6 temas; usar `forest`.
- `ui.jsx` ✅ — átomos: `Icon` (geometría Lucide), `Star`, `Avatar`, `Photo`
  (placeholder a rayas para foto real), `StatusBar`, `Grain`, `Phone` (shell 390px),
  `TabBar` (Inicio/Reservar/Estudio/Perfil), `LogoMark`, `AppBar`.
- `design-canvas.jsx` — infraestructura del lienzo Figma-ish (no es diseño de la app).
- Pantallas (referencia para Fases 3-4, se persisten al llegar o a petición):
  - `home.jsx` — Inicio / Mis citas (hero próxima cita, CTA reservar, teaser estudio, historial).
  - `reservar.jsx` — Reserva paso 2 (toggle barbero concreto + chips, semana, slots con nº libres, hint lista de espera, `Stepper`).
  - `screens-booking.jsx` — Servicio (paso 1, `ServiceRow`), Confirmar (paso 3, métodos de pago + desglose), Confirmada (confeti + ticket + código).
  - `screens-discovery.jsx` — Estudio (galería masonry filtrable), Detalle de barbero (hero, stats, trabajos, reseñas).
  - `screens-account.jsx` — Perfil (tarjeta socio/puntos), Detalle de cita (mapa, pago, reprogramar/cancelar), Notificaciones (agrupadas), Valorar (estrellas, tags, propina).
  - `screens-extras.jsx` — Welcome/Login, Lista de espera (posición + preferencias), Carta de servicios.
  - `specimen.jsx` — specimen de tokens y tipografía por dirección.

## Notas de copy/datos vistas en los diseños (ground truth de producto)

- Servicios y precios: Corte de pelo (30 min, 13€), Corte + barba (45 min, 18€, "favorito"),
  Corte + diseño (50 min, 22€), Arreglo de barba (20 min, 9€), Afeitado clásico (30 min, 14€),
  Ritual completo (1h10, 29€), Padre e hijo (1h, 24€).
- Barberos de ejemplo: Dani Ruiz (DR), Marco (MS), Jon (JT) + "Cualquiera disponible".
- Local: JDVM Maracena, C/ Ancha 12.
- Política en diseño: "Cancela gratis hasta 4 h antes" (⚠ decisión B pendiente: 24h vs 4h).
- Pagos en diseño: Apple Pay, tarjeta ·· 4921, "Pagar en local" (⚠ decisión C).
- Fidelización: "Socio · Oro", 340 puntos, "+20 puntos", "Invita y gana" (⚠ decisión D).

## Pendiente de assets

- `assets/logo-mark-white.png` y `assets/logo-mark-ink.png` (logo JDVM) que usa `LogoMark`.
  No los tenemos aún; se pueden recuperar del proyecto antiguo o exportar del diseño.

## Lo que NO tenemos en alta fidelidad

`JDVM App.html` es solo el loader; el PDF/PPTX son render de baja fidelidad. La fuente
fiel de cada pantalla son los `.jsx` de arriba.
