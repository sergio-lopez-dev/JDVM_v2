// JDVM shared atoms — icons (Lucide geometry), avatar, photo placeholder, phone shell.
const I = {
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  clock: 'M12 6v6l4 2',
  pin: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z',
  chevR: 'm9 18 6-6-6-6', chevL: 'm15 18-6-6 6-6', chevD: 'm6 9 6 6 6-6', chevU: 'm18 15-6-6-6 6',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  plus: 'M5 12h14M12 5v14', x: 'M18 6 6 18M6 6l12 12', check: 'M20 6 9 17l-5-5',
  bell: 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
  phone: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384',
  insta: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37ZM17.5 6.5h.01M5 2h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z',
  home: 'M3 9.5 12 3l9 6.5M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  arrowR: 'M5 12h14M13 6l6 6-6 6', sparkle: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z',
  scissorsLine: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12',
  creditCard: 'M22 10H2M5 5h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z',
  gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  checkCircle: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  mail: 'M22 6 12 13 2 6M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  tag: 'M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7.5 7.5h.01',
  mapTrifold: 'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3ZM9 3v15M15 6v15',
  navigation: 'M3 11l19-9-9 19-2-8-8-2Z',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
}
function Icon({ d, size = 18, stroke, sw = 1.6, fill = 'none', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke || 'currentColor'}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      {I[d].split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  )
}
function Star({ size = 16, fill, stroke, sw = 1.4 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke={stroke || 'currentColor'} strokeWidth={sw} strokeLinejoin="round">
      <path d="M12 2.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9l6.1-.9z" />
    </svg>
  )
}
function Avatar({ initials, size = 38, t, color, img }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: img ? 'transparent' : t.bg2, color: t.fg1,
      border: `1px solid ${color || t.border}`, overflow: 'hidden',
      fontFamily: t.sans, fontWeight: 600, fontSize: size * 0.36, letterSpacing: 0.2,
    }}>{initials}</div>
  )
}
// Striped placeholder for real photography to be dropped in.
function Photo({ t, label, ar = '1 / 1', radius = 12, h }) {
  const stripe = `repeating-linear-gradient(135deg, ${t.bg2} 0px, ${t.bg2} 9px, ${t.bg1} 9px, ${t.bg1} 18px)`
  return (
    <div style={{
      aspectRatio: h ? undefined : ar, height: h, width: '100%', borderRadius: radius,
      background: stripe, border: `1px solid ${t.borderSoft}`, position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start',
    }}>
      <span style={{
        fontFamily: t.mono, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
        color: t.fg2, background: t.bg0, padding: '3px 6px', margin: 7, borderRadius: 4,
        border: `1px solid ${t.borderSoft}`,
      }}>{label}</span>
    </div>
  )
}
function StatusBar({ t }) {
  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 22px 0 26px', color: t.fg0, fontFamily: t.sans, flexShrink: 0,
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.3 }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill={t.fg0}><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={t.fg0} strokeWidth="1.4"><path d="M1 4.2a10 10 0 0 1 14 0M3.4 6.6a6.5 6.5 0 0 1 9.2 0M8 9.4h.01" strokeLinecap="round"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={t.fg1} opacity="0.5"/><rect x="2" y="2" width="17" height="8" rx="1.5" fill={t.fg0}/><rect x="23" y="3.5" width="1.6" height="5" rx="0.8" fill={t.fg1} opacity="0.5"/></svg>
      </div>
    </div>
  )
}
// Soft grain so the dark base isn't flat.
function Grain({ opacity = 0.5, blend = 'overlay' }) {
  const uri = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"
  return <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${uri}")`, backgroundSize: '160px 160px', opacity, mixBlendMode: blend, pointerEvents: 'none', zIndex: 0 }} />
}
// Phone shell: fixed 390 wide, content fills. Children render over the grain.
function Phone({ t, children, height }) {
  return (
    <div style={{ width: 390, height, background: t.bg0, position: 'relative', overflow: 'hidden', fontFamily: t.sans, color: t.fg0, display: 'flex', flexDirection: 'column' }}>
      <Grain opacity={t.light ? 0.14 : 0.45} blend={t.light ? 'multiply' : 'overlay'} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <StatusBar t={t} />
        {children}
      </div>
    </div>
  )
}
function TabBar({ t, active }) {
  const items = [['home', 'Inicio'], ['scissors', 'Reservar'], ['grid', 'Estudio'], ['user', 'Perfil']]
  return (
    <div style={{ display: 'flex', borderTop: `1px solid ${t.border}`, background: t.bg0, paddingBottom: 18, flexShrink: 0 }}>
      {items.map(([ic, lab]) => {
        const on = lab === active
        return (
          <div key={lab} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingTop: 11 }}>
            <Icon d={ic} size={21} stroke={on ? t.accentTint : t.fg2} sw={on ? 1.9 : 1.6} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500, color: on ? t.fg0 : t.fg2, letterSpacing: 0.1 }}>{lab}</span>
          </div>
        )
      })}
    </div>
  )
}
// Tiny logo mark from the extracted asset.
function LogoMark({ h = 22, opacity = 1, t }) {
  const src = t && t.light ? 'assets/logo-mark-ink.png' : 'assets/logo-mark-white.png'
  return <img src={src} alt="JDVM" style={{ height: h, width: 'auto', opacity, display: 'block' }} />
}
// Shared app bar for inner screens.
function AppBar({ t, title, back = true, right, sub }) {
  const dw = t.key === 'burgundy' ? 600 : 400
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 18px 12px' }}>
      {back ? <div style={{ width: 38, height: 38, borderRadius: 11, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg1 }}><Icon d="chevL" size={19} stroke={t.fg0} /></div> : <div style={{ width: 38 }} />}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: t.serif, fontSize: 19, fontWeight: dw, color: t.fg0, lineHeight: 1.1 }}>{title}</div>
        {sub && <div style={{ fontFamily: t.mono, fontSize: 9.5, letterSpacing: 0.6, textTransform: 'uppercase', color: t.fg2, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ width: 38, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  )
}
Object.assign(window, { Icon, Star, Avatar, Photo, StatusBar, Grain, Phone, TabBar, LogoMark, AppBar })
