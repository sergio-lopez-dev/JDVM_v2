// Sistema de paletas de marca (las "direcciones" del diseño Claude Design).
// Cada tema es un set de tokens autónomo; el admin elige cuál se aplica a TODA
// la app. La paleta forest es la de por defecto (la cableada estáticamente en
// app/assets/css/main.css). El resto se aplican en runtime sobreescribiendo las
// CSS custom properties — ver app/composables/useBrandTheme.ts.
//
// Por qué funciona con solo overridear `--jdvm-*` + las rampas gold/ink: el
// bloque `.dark` de main.css deriva TODOS los tokens semánticos de Nuxt UI
// (`--ui-bg`, `--ui-text`, …) a partir de los `--jdvm-*`. Así que cambiar los
// crudos re-tematiza en cascada toda la UI.

export interface BrandTheme {
  key: string
  name: string
  tagline: string
  /** Fuente serif/display propia del tema (se cargan todas en nuxt.config). */
  serif: string
  /** true = tema claro (color-scheme: light). */
  light?: boolean
  bg0: string
  bg1: string
  bg2: string
  border: string
  borderSoft: string
  fg0: string
  fg1: string
  fg2: string
  accent: string
  accentHover: string
  accentTint: string
  accentSoft: string
  accentLine: string
  accentText: string
  success: string
  warning: string
  danger: string
  serviceA: string
  serviceB: string
  serviceC: string
}

// Valores EXACTOS de inputs/designs/themes.js (las 6 direcciones de marca).
export const BRAND_THEMES: BrandTheme[] = [
  {
    key: 'forest',
    name: 'Verde inglés',
    tagline: 'Racing green · botánico & sobrio',
    serif: "'Libre Caslon Display', Georgia, serif",
    bg0: '#0B0F0C', bg1: '#111711', bg2: '#1A211A',
    border: '#28301F', borderSoft: '#1F271B',
    fg0: '#ECEFE3', fg1: '#9CA791', fg2: '#62705B',
    accent: '#C2A24E', accentHover: '#D4B45F', accentTint: '#DCC07A',
    accentSoft: 'rgba(194,162,78,0.13)', accentLine: 'rgba(194,162,78,0.32)',
    accentText: '#14180C',
    success: '#6FA98A', warning: '#D4A24C', danger: '#C46A4C',
    serviceA: '#C2A24E', serviceB: '#7C8C9E', serviceC: '#A6857B',
  },
  {
    key: 'brass',
    name: 'Latón quemado',
    tagline: 'Aged brass · editorial & sereno',
    serif: "'Instrument Serif', Georgia, serif",
    bg0: '#0E0C0A', bg1: '#15120E', bg2: '#1E1A14',
    border: '#2A2419', borderSoft: '#211C15',
    fg0: '#F2EBDD', fg1: '#A99F8E', fg2: '#6E6557',
    accent: '#B8895A', accentHover: '#CC9D6B', accentTint: '#D2A878',
    accentSoft: 'rgba(184,137,90,0.13)', accentLine: 'rgba(184,137,90,0.32)',
    accentText: '#17120B',
    success: '#8FA15B', warning: '#D4A24C', danger: '#C46A4C',
    serviceA: '#B8895A', serviceB: '#7C8C9E', serviceC: '#A6857B',
  },
  {
    key: 'copper',
    name: 'Cobre oxidado',
    tagline: 'Oxidized copper · cálido & artesano',
    serif: "'Newsreader', Georgia, serif",
    bg0: '#100B08', bg1: '#19120C', bg2: '#241911',
    border: '#33251A', borderSoft: '#281C14',
    fg0: '#F1E6D9', fg1: '#AD9C8A', fg2: '#6F5E4E',
    accent: '#A85A30', accentHover: '#C2703E', accentTint: '#CC8456',
    accentSoft: 'rgba(168,90,48,0.15)', accentLine: 'rgba(168,90,48,0.34)',
    accentText: '#150C06',
    success: '#7F9A57', warning: '#CE9A45', danger: '#C25E36',
    serviceA: '#A85A30', serviceB: '#6E8676', serviceC: '#9A7F5C',
  },
  {
    key: 'burgundy',
    name: 'Borgoña',
    tagline: 'Saturated burgundy · audaz & editorial',
    serif: "'Bodoni Moda', Didot, Georgia, serif",
    bg0: '#0D0A0A', bg1: '#150F10', bg2: '#1F1517',
    border: '#2E1E21', borderSoft: '#241719',
    fg0: '#F1E9E8', fg1: '#AC9D9C', fg2: '#6E5C5D',
    accent: '#8A2326', accentHover: '#A8312F', accentTint: '#C75B53',
    accentSoft: 'rgba(138,35,38,0.18)', accentLine: 'rgba(199,91,83,0.34)',
    accentText: '#F6ECEA',
    success: '#8B9A58', warning: '#CFA24C', danger: '#C25C3E',
    serviceA: '#8A2326', serviceB: '#5F7C84', serviceC: '#9A7350',
  },
  {
    key: 'steel',
    name: 'Acero nocturno',
    tagline: 'Steel blue · moderno & premium',
    serif: "'Cormorant Garamond', Georgia, serif",
    bg0: '#0A0C11', bg1: '#0F131A', bg2: '#181E28',
    border: '#232C3A', borderSoft: '#1B222D',
    fg0: '#E7ECF2', fg1: '#97A1B0', fg2: '#5C6677',
    accent: '#5E8BB0', accentHover: '#74A0C4', accentTint: '#9AC0DE',
    accentSoft: 'rgba(94,139,176,0.15)', accentLine: 'rgba(94,139,176,0.34)',
    accentText: '#0A0E13',
    success: '#6FA98A', warning: '#D4A24C', danger: '#C9624A',
    serviceA: '#5E8BB0', serviceB: '#9A8C6E', serviceC: '#8F7C9E',
  },
  {
    key: 'bone',
    name: 'Hueso',
    tagline: 'Cálido claro · luz de día & nítido',
    serif: "'Spectral', Georgia, serif",
    light: true,
    bg0: '#E9E1D2', bg1: '#F3EDE1', bg2: '#DCD2BF',
    border: '#CBBFA6', borderSoft: '#D8CDB6',
    fg0: '#211B14', fg1: '#6A5F4E', fg2: '#978B76',
    accent: '#9E3B2E', accentHover: '#B24737', accentTint: '#8E3327',
    accentSoft: 'rgba(158,59,46,0.10)', accentLine: 'rgba(158,59,46,0.28)',
    accentText: '#F4ECE4',
    success: '#4F7A4A', warning: '#B0792A', danger: '#B0432E',
    serviceA: '#9E3B2E', serviceB: '#4F6E7A', serviceC: '#8A6A3E',
  },
  {
    key: 'mist',
    name: 'Niebla',
    tagline: 'Frío claro · sereno & minimalista',
    serif: "'Cormorant Garamond', Georgia, serif",
    light: true,
    bg0: '#E9EDF2', bg1: '#F4F6FA', bg2: '#DCE2EA',
    border: '#C5CDD8', borderSoft: '#D6DCE5',
    fg0: '#1B2430', fg1: '#5A6675', fg2: '#8A95A4',
    accent: '#3F6E9E', accentHover: '#4E7EB0', accentTint: '#346090',
    accentSoft: 'rgba(63,110,158,0.10)', accentLine: 'rgba(63,110,158,0.28)',
    accentText: '#F4F8FC',
    success: '#3F7A57', warning: '#B0792A', danger: '#B0432E',
    serviceA: '#3F6E9E', serviceB: '#7A6E4F', serviceC: '#8A5E6A',
  },
  {
    key: 'linen',
    name: 'Lino',
    tagline: 'Cálido claro · natural & sereno',
    serif: "'EB Garamond', Georgia, serif",
    light: true,
    bg0: '#E8EADE', bg1: '#F2F3EB', bg2: '#DBDFCE',
    border: '#C6CBB4', borderSoft: '#D6DAC6',
    fg0: '#1E241A', fg1: '#5C6450', fg2: '#8B937C',
    accent: '#4F7A4A', accentHover: '#5C8A55', accentTint: '#436B3F',
    accentSoft: 'rgba(79,122,74,0.10)', accentLine: 'rgba(79,122,74,0.28)',
    accentText: '#F2F6EE',
    success: '#4F7A4A', warning: '#B0792A', danger: '#B0432E',
    serviceA: '#4F7A4A', serviceB: '#7A6E4F', serviceC: '#8A5E6A',
  },
  // --- Paletas extra (segunda tanda; agrupadas bajo "Más paletas") ----------
  {
    key: 'plum',
    name: 'Ciruela',
    tagline: 'Plum · refinado & misterioso',
    serif: "'Fraunces', Georgia, serif",
    bg0: '#0D0A10', bg1: '#140F19', bg2: '#1E1626',
    border: '#2C2138', borderSoft: '#221829',
    fg0: '#EFE8F2', fg1: '#A59AAF', fg2: '#685D72',
    accent: '#9B5BC4', accentHover: '#AE70D4', accentTint: '#C18CE0',
    accentSoft: 'rgba(155,91,196,0.16)', accentLine: 'rgba(155,91,196,0.34)',
    accentText: '#110A16',
    success: '#6FA98A', warning: '#D4A24C', danger: '#C9624A',
    serviceA: '#9B5BC4', serviceB: '#7C8C9E', serviceC: '#A6857B',
  },
  {
    key: 'emerald',
    name: 'Esmeralda',
    tagline: 'Jade · fresco & vibrante',
    serif: "'EB Garamond', Georgia, serif",
    bg0: '#07100D', bg1: '#0C1714', bg2: '#11211C',
    border: '#1B302A', borderSoft: '#15251F',
    fg0: '#E3F0EA', fg1: '#92A79D', fg2: '#566E64',
    accent: '#3FA889', accentHover: '#4FBF9D', accentTint: '#6FD3B5',
    accentSoft: 'rgba(63,168,137,0.15)', accentLine: 'rgba(63,168,137,0.34)',
    accentText: '#04120D',
    success: '#6FA98A', warning: '#D4A24C', danger: '#C9624A',
    serviceA: '#3FA889', serviceB: '#7C8C9E', serviceC: '#A6857B',
  },
  {
    key: 'noir',
    name: 'Noir dorado',
    tagline: 'Black & gold · lujo & contraste',
    serif: "'Cardo', Georgia, serif",
    bg0: '#08090A', bg1: '#0E0F11', bg2: '#16181B',
    border: '#24272C', borderSoft: '#1B1E22',
    fg0: '#ECEEF0', fg1: '#9DA2A9', fg2: '#5E636B',
    accent: '#D4AF37', accentHover: '#E4C04A', accentTint: '#EDD27A',
    accentSoft: 'rgba(212,175,55,0.14)', accentLine: 'rgba(212,175,55,0.32)',
    accentText: '#0D0D08',
    success: '#6FA98A', warning: '#D4A24C', danger: '#C9624A',
    serviceA: '#D4AF37', serviceB: '#7C8C9E', serviceC: '#8F7C9E',
  },
]

// Las 6 paletas originales se muestran de inicio; estas van bajo "Más paletas".
export const EXTRA_THEME_KEYS = ['plum', 'emerald', 'noir']

export const THEME_KEYS = BRAND_THEMES.map((t) => t.key)
export const DEFAULT_THEME_KEY = 'forest'

export function getTheme(key: string | undefined | null): BrandTheme {
  return BRAND_THEMES.find((t) => t.key === key) ?? BRAND_THEMES[0]!
}

// --- Generación de rampas (50→950) anclada en los tokens de diseño ----------
// El acento da 300/400/500 exactos (accentTint/accentHover/accent); el resto se
// interpola hacia blanco (claros) y negro (oscuros). El neutro ancla 950/900/
// 800/700/500/300 en bg/border/fg e interpola los intermedios. Esto reproduce
// las rampas hand-tuned de forest en sus stops visibles clave.

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

// Mezcla a hacia b en proporción t (0 = a, 1 = b).
function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  return rgbToHex([
    ra[0] + (rb[0] - ra[0]) * t,
    ra[1] + (rb[1] - ra[1]) * t,
    ra[2] + (rb[2] - ra[2]) * t,
  ])
}

const WHITE = '#ffffff'
const BLACK = '#000000'

function accentRamp(t: BrandTheme): Record<string, string> {
  return {
    50: mix(t.accentTint, WHITE, 0.85),
    100: mix(t.accentTint, WHITE, 0.7),
    200: mix(t.accentTint, WHITE, 0.4),
    300: t.accentTint,
    400: t.accentHover,
    500: t.accent,
    600: mix(t.accent, BLACK, 0.18),
    700: mix(t.accent, BLACK, 0.38),
    800: mix(t.accent, BLACK, 0.55),
    900: mix(t.accent, BLACK, 0.7),
    950: mix(t.accent, BLACK, 0.83),
  }
}

function neutralRamp(t: BrandTheme): Record<string, string> {
  return {
    50: mix(t.fg1, WHITE, 0.9),
    100: mix(t.fg1, WHITE, 0.78),
    200: mix(t.fg1, WHITE, 0.5),
    300: t.fg1,
    400: mix(t.fg2, t.fg1, 0.5),
    500: t.fg2,
    600: mix(t.border, t.fg2, 0.5),
    700: t.border,
    800: t.bg2,
    900: t.bg1,
    950: t.bg0,
  }
}

// Mapa completo de CSS custom properties a aplicar en runtime para un tema.
export function themeCssVars(t: BrandTheme): Record<string, string> {
  const vars: Record<string, string> = {
    '--jdvm-bg-0': t.bg0,
    '--jdvm-bg-1': t.bg1,
    '--jdvm-bg-2': t.bg2,
    '--jdvm-border': t.border,
    '--jdvm-border-soft': t.borderSoft,
    '--jdvm-fg-0': t.fg0,
    '--jdvm-fg-1': t.fg1,
    '--jdvm-fg-2': t.fg2,
    '--jdvm-accent': t.accent,
    '--jdvm-accent-hover': t.accentHover,
    '--jdvm-accent-tint': t.accentTint,
    '--jdvm-accent-soft': t.accentSoft,
    '--jdvm-accent-line': t.accentLine,
    '--jdvm-accent-text': t.accentText,
    '--jdvm-success': t.success,
    '--jdvm-warning': t.warning,
    '--jdvm-danger': t.danger,
    '--jdvm-service-a': t.serviceA,
    '--jdvm-service-b': t.serviceB,
    '--jdvm-service-c': t.serviceC,
    '--font-display': t.serif,
  }
  const gold = accentRamp(t)
  for (const [k, v] of Object.entries(gold)) vars[`--color-gold-${k}`] = v
  const ink = neutralRamp(t)
  for (const [k, v] of Object.entries(ink)) vars[`--color-ink-${k}`] = v
  return vars
}
