// Hand-drawn monster art. Every enemy gets its OWN bespoke little body drawn in
// code (just like the classic ghost) instead of an emoji slapped on a circle.
// Each drawer is `(ctx, cx, cy, r, def, e, t)` and paints the creature centred
// at (cx, cy) sized to radius r, tinted from `def.color`. The render wrapper
// (render.js → drawEnemy) handles the shared bits: shadow, heal aura, phased
// alpha, frozen wash, crown, status icons and the HP bar.
import { lighten } from './util.js'

const INK = '#3a2e4f'

// Fill the path currently on the context with a soft top-lit gradient + outline.
function paint(ctx, cx, cy, r, color, hi = 26) {
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r)
  g.addColorStop(0, lighten(color, hi + 16))
  g.addColorStop(1, color)
  ctx.fillStyle = g
  ctx.strokeStyle = 'rgba(0,0,0,0.26)'
  ctx.lineWidth = 3
  ctx.fill()
  ctx.stroke()
}

function roundRectPath(ctx, x, y, w, h, rad) {
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

// Two white eyes with dark pupils that glance toward where the monster's headed.
function eyes(ctx, cx, cy, r, e, o = {}) {
  const spread = o.spread ?? 0.4, ey = o.y ?? -0.12, w = o.w ?? 0.2, h = o.h ?? 0.26
  const dx = (e?.facing || 0) * 2
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.ellipse(cx + s * r * spread, cy + r * ey, r * w, r * h, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = o.pupil || INK
    ctx.beginPath(); ctx.arc(cx + s * r * spread + dx, cy + r * ey + 2, r * w * 0.55, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath(); ctx.arc(cx + s * r * spread + dx - r * 0.05, cy + r * ey - r * 0.03, r * w * 0.2, 0, Math.PI * 2); ctx.fill()
  }
}

function cheeks(ctx, cx, cy, r, o = {}) {
  const spread = o.spread ?? 0.62, y = o.y ?? 0.2
  ctx.fillStyle = 'rgba(255,130,170,0.5)'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * spread, cy + r * y, r * 0.15, r * 0.1, 0, 0, Math.PI * 2); ctx.fill() }
}

function smile(ctx, cx, cy, r, o = {}) {
  const y = o.y ?? 0.2, w = o.w ?? 0.26
  ctx.strokeStyle = o.color || INK
  ctx.lineWidth = Math.max(2, r * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy + r * y, r * w, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
}

// ---------------------------------------------------------------------------
// The classic friendly ghost (shape: 'ghost') — domed top, scalloped tail.
// ---------------------------------------------------------------------------
function ghost(ctx, cx, cy, r, def, e) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2)
  const bottom = cy + r * 0.95
  ctx.lineTo(cx + r, bottom)
  const n = 4
  for (let i = 0; i < n; i++) {
    const x1 = cx + r - (2 * r) * ((i + 0.5) / n)
    const x2 = cx + r - (2 * r) * ((i + 1) / n)
    ctx.quadraticCurveTo(x1, bottom + r * 0.3, x2, bottom)
  }
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
  const grd = ctx.createLinearGradient(0, cy - r, 0, bottom)
  grd.addColorStop(0, lighten(def.color, 25))
  grd.addColorStop(1, def.color)
  ctx.fillStyle = grd
  ctx.fill()
  // hand-drawn face in the ghost's face colour
  const dx = e.facing * 2
  const ex = r * 0.42, ey = -r * 0.18, ew = r * 0.27, eh = r * 0.34
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.ellipse(cx + s * ex, cy + ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = def.face
    ctx.beginPath(); ctx.ellipse(cx + s * ex + dx, cy + ey + 2, ew * 0.5, eh * 0.5, 0, 0, Math.PI * 2); ctx.fill()
  }
  cheeks(ctx, cx, cy, r, { spread: 0.6, y: 0.18 })
  smile(ctx, cx, cy, r, { y: 0.18, w: 0.28, color: def.face })
}

// ---------------------------------------------------------------------------
// Critters
// ---------------------------------------------------------------------------
function candy(ctx, cx, cy, r, def, e) {
  // twisted wrapper ends
  ctx.fillStyle = lighten(def.color, 18)
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.8, cy)
    ctx.lineTo(cx + s * r * 1.35, cy - r * 0.55)
    ctx.lineTo(cx + s * r * 1.15, cy)
    ctx.lineTo(cx + s * r * 1.35, cy + r * 0.55)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // candy swirl
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.5, -0.4, 1.7); ctx.stroke()
  eyes(ctx, cx, cy, r, e, { spread: 0.34 }); cheeks(ctx, cx, cy, r, { spread: 0.55 }); smile(ctx, cx, cy, r)
}

function bat(ctx, cx, cy, r, def, e, t) {
  const flap = Math.sin(t * 9 + e.bobPhase) * 0.35
  ctx.fillStyle = def.color; ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.5, cy - r * 0.1)
    ctx.quadraticCurveTo(cx + s * r * 1.7, cy - r * (0.9 + flap), cx + s * r * 1.55, cy + r * 0.5)
    ctx.quadraticCurveTo(cx + s * r * 1.15, cy + r * 0.15, cx + s * r * 0.95, cy + r * 0.55)
    ctx.quadraticCurveTo(cx + s * r * 0.85, cy + r * 0.1, cx + s * r * 0.5, cy + r * 0.3)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  // pointy ears
  ctx.fillStyle = def.color
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.45, cy - r * 0.6)
    ctx.lineTo(cx + s * r * 0.7, cy - r * 1.25)
    ctx.lineTo(cx + s * r * 0.05, cy - r * 0.75)
    ctx.closePath(); ctx.fill()
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  eyes(ctx, cx, cy, r, e, { spread: 0.36, y: -0.1 }); cheeks(ctx, cx, cy, r, { spread: 0.55 })
  smile(ctx, cx, cy, r, { y: 0.16, w: 0.2 })
  // little fangs
  ctx.fillStyle = '#fff'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * r * 0.1, cy + r * 0.26); ctx.lineTo(cx + s * r * 0.22, cy + r * 0.26); ctx.lineTo(cx + s * r * 0.16, cy + r * 0.44); ctx.closePath(); ctx.fill() }
}

function blob(ctx, cx, cy, r, def, e, t) {
  const w = 1 + Math.sin(t * 5 + e.bobPhase) * 0.06
  ctx.beginPath()
  ctx.moveTo(cx - r * w, cy + r * 0.55)
  ctx.quadraticCurveTo(cx - r * 1.05 * w, cy - r * 0.9, cx, cy - r)
  ctx.quadraticCurveTo(cx + r * 1.05 * w, cy - r * 0.9, cx + r * w, cy + r * 0.55)
  ctx.quadraticCurveTo(cx + r * 0.6, cy + r, cx + r * 0.3, cy + r * 0.72)
  ctx.quadraticCurveTo(cx, cy + r * 1.05, cx - r * 0.3, cy + r * 0.72)
  ctx.quadraticCurveTo(cx - r * 0.6, cy + r, cx - r * w, cy + r * 0.55)
  ctx.closePath(); paint(ctx, cx, cy, r, def.color)
  // glossy shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.18, r * 0.26, -0.4, 0, Math.PI * 2); ctx.fill()
  eyes(ctx, cx, cy, r, e, { spread: 0.34, y: -0.05 }); smile(ctx, cx, cy, r, { y: 0.3 })
}

function pumpkin(ctx, cx, cy, r, def, e) {
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.12, r, 0, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // ribs
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = r * 0.06
  for (const f of [0.45, 0.85]) { ctx.beginPath(); ctx.ellipse(cx, cy, r * f, r, 0, 0, Math.PI * 2); ctx.stroke() }
  // stem
  ctx.fillStyle = '#6b8e23'
  ctx.beginPath(); roundRectPath(ctx, cx - r * 0.09, cy - r * 1.2, r * 0.18, r * 0.38, r * 0.06); ctx.fill()
  // cute jack-o face
  ctx.fillStyle = INK
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.42, cy - r * 0.12)
    ctx.lineTo(cx + s * r * 0.16, cy + r * 0.16)
    ctx.lineTo(cx + s * r * 0.58, cy + r * 0.16)
    ctx.closePath(); ctx.fill()
  }
  cheeks(ctx, cx, cy, r, { spread: 0.72, y: 0.32 })
  smile(ctx, cx, cy, r, { y: 0.32, w: 0.42 })
}

function spider(ctx, cx, cy, r, def, e, t) {
  ctx.strokeStyle = lighten(def.color, -10); ctx.lineWidth = Math.max(2, r * 0.12); ctx.lineCap = 'round'
  const wig = Math.sin(t * 8 + e.bobPhase) * 0.15
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const ya = cy - r * 0.2 + i * r * 0.35
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.6, ya)
    ctx.quadraticCurveTo(cx + s * r * 1.3, ya - r * 0.3 + wig * r, cx + s * r * 1.5, ya + r * 0.35)
    ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  eyes(ctx, cx, cy, r, e, { spread: 0.3, y: 0, w: 0.18 })
  // extra tiny top eyes
  ctx.fillStyle = '#fff'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.5, cy - r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill() }
  smile(ctx, cx, cy, r, { y: 0.3, w: 0.2 })
}

function eyeball(ctx, cx, cy, r, def, e) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 3; ctx.fill(); ctx.stroke()
  const dx = (e.facing || 0) * r * 0.18
  ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(cx + dx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + dx, cy, r * 0.26, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx + dx - r * 0.1, cy - r * 0.1, r * 0.09, 0, Math.PI * 2); ctx.fill()
  // pink veins
  ctx.strokeStyle = 'rgba(255,120,150,0.4)'; ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96)
    ctx.lineTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62); ctx.stroke()
  }
}

function alien(ctx, cx, cy, r, def, e) {
  // domed head + flared body
  ctx.beginPath()
  ctx.arc(cx, cy - r * 0.05, r, Math.PI, 0)
  ctx.lineTo(cx + r * 1.05, cy + r * 0.6)
  ctx.lineTo(cx - r * 1.05, cy + r * 0.6)
  ctx.closePath()
  paint(ctx, cx, cy, r, def.color)
  // antennae with bobbles
  ctx.strokeStyle = def.color; ctx.lineWidth = Math.max(2, r * 0.1)
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * r * 0.3, cy - r * 0.8); ctx.lineTo(cx + s * r * 0.5, cy - r * 1.25); ctx.stroke()
    ctx.fillStyle = lighten(def.color, 45); ctx.beginPath(); ctx.arc(cx + s * r * 0.5, cy - r * 1.3, r * 0.13, 0, Math.PI * 2); ctx.fill()
  }
  eyes(ctx, cx, cy, r, e, { spread: 0.42, y: -0.08, w: 0.22, h: 0.24 })
  smile(ctx, cx, cy, r, { y: 0.28, w: 0.3 })
}

function zombie(ctx, cx, cy, r, def, e) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // lopsided derpy eyes
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.15, r * 0.24, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.08, r * 0.16, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = INK
  ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - r * 0.12, r * 0.1, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(cx + r * 0.4, cy - r * 0.06, r * 0.07, 0, Math.PI * 2); ctx.fill()
  // stitched mouth
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(cx - r * 0.28, cy + r * 0.38); ctx.lineTo(cx + r * 0.28, cy + r * 0.38); ctx.stroke()
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.12, cy + r * 0.3); ctx.lineTo(cx + i * r * 0.12, cy + r * 0.46); ctx.stroke() }
  // little tongue
  ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(cx - r * 0.05, cy + r * 0.52, r * 0.1, r * 0.14, 0, 0, Math.PI * 2); ctx.fill()
}

function octopus(ctx, cx, cy, r, def, e, t) {
  // dangling tentacles that splay out below the head, each curling a little
  ctx.fillStyle = def.color
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5
  for (let i = 0; i < 5; i++) {
    const fx = cx + (i - 2) * r * 0.5
    const sway = Math.sin(t * 5 + i + e.bobPhase) * r * 0.25
    ctx.beginPath()
    ctx.moveTo(fx - r * 0.26, cy + r * 0.55)
    ctx.quadraticCurveTo(fx + sway, cy + r * 1.55, fx + sway + r * 0.18, cy + r * 1.45)
    ctx.quadraticCurveTo(fx + sway + r * 0.1, cy + r * 1.5, fx + sway, cy + r * 1.4)
    ctx.quadraticCurveTo(fx + r * 0.05, cy + r * 1.2, fx + r * 0.26, cy + r * 0.55)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  // round head
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.05, 0, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  eyes(ctx, cx, cy, r, e, { spread: 0.36, y: -0.18 }); cheeks(ctx, cx, cy, r, { y: 0.05 })
  smile(ctx, cx, cy, r, { y: 0.08, w: 0.2 })
}

function robot(ctx, cx, cy, r, def, e, t) {
  // antenna with a blinking light
  ctx.strokeStyle = lighten(def.color, -10); ctx.lineWidth = Math.max(2, r * 0.08)
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.9); ctx.lineTo(cx, cy - r * 1.35); ctx.stroke()
  ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff6b6b' : '#ffd34d'
  ctx.beginPath(); ctx.arc(cx, cy - r * 1.42, r * 0.12, 0, Math.PI * 2); ctx.fill()
  // boxy head
  roundRectPath(ctx, cx - r, cy - r * 0.9, r * 2, r * 1.8, r * 0.32); paint(ctx, cx, cy, r, def.color)
  // screen face
  ctx.fillStyle = '#26323f'
  roundRectPath(ctx, cx - r * 0.72, cy - r * 0.55, r * 1.44, r * 1.1, r * 0.2); ctx.fill()
  // glowing eyes + mouth
  ctx.fillStyle = '#8fe3ff'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.3, cy - r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.fill() }
  ctx.strokeStyle = '#8fe3ff'; ctx.lineWidth = Math.max(2, r * 0.07); ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy + r * 0.28); ctx.lineTo(cx + r * 0.3, cy + r * 0.28); ctx.stroke()
  // bolts on the corners
  ctx.fillStyle = lighten(def.color, -20)
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.8, cy - r * 0.7, r * 0.1, 0, Math.PI * 2); ctx.fill() }
}

function snail(ctx, cx, cy, r, def, e) {
  const foot = lighten(def.color, 32)
  // foot
  ctx.fillStyle = foot; ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.55, r * 1.25, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  // head
  ctx.beginPath(); ctx.ellipse(cx + r * 0.95, cy + r * 0.2, r * 0.5, r * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  // eye stalks
  ctx.strokeStyle = foot; ctx.lineWidth = Math.max(2, r * 0.08)
  for (const o of [0, 0.28]) {
    const ax = cx + r * (0.95 + o)
    ctx.beginPath(); ctx.moveTo(ax, cy - r * 0.05); ctx.lineTo(ax + r * 0.08, cy - r * 0.55); ctx.stroke()
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ax + r * 0.08, cy - r * 0.6, r * 0.08, 0, Math.PI * 2); ctx.fill()
  }
  // smiley eye on the head
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + r * 1.05, cy + r * 0.18, r * 0.12, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + r * 1.08, cy + r * 0.2, r * 0.06, 0, Math.PI * 2); ctx.fill()
  // shell with a spiral
  ctx.beginPath(); ctx.arc(cx - r * 0.2, cy - r * 0.1, r, 0, Math.PI * 2); paint(ctx, cx - r * 0.2, cy - r * 0.1, r, def.color)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(2, r * 0.1)
  ctx.beginPath()
  for (let a = 0; a < Math.PI * 4; a += 0.2) {
    const rr = r * 0.85 * (1 - a / (Math.PI * 4))
    const px = cx - r * 0.2 + Math.cos(a) * rr, py = cy - r * 0.1 + Math.sin(a) * rr
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke()
}

function microbe(ctx, cx, cy, r, def, e) {
  // cilia all around
  ctx.strokeStyle = def.color; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9)
    ctx.lineTo(cx + Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 1.18)
    ctx.stroke()
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // pale spots
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  for (const [ox, oy] of [[-0.4, -0.3], [0.45, 0.12], [-0.12, 0.45]]) { ctx.beginPath(); ctx.arc(cx + ox * r, cy + oy * r, r * 0.14, 0, Math.PI * 2); ctx.fill() }
  eyes(ctx, cx, cy, r, e, { spread: 0.3 }); smile(ctx, cx, cy, r, { y: 0.26, w: 0.2 })
}

function caterpillar(ctx, cx, cy, r, def, e, t) {
  const dir = -(e.facing || 1)
  // trailing segments behind the head
  for (let i = 3; i >= 1; i--) {
    const sx = cx + dir * i * r * 0.6
    const sy = cy + Math.sin(t * 6 + i + e.bobPhase) * r * 0.16
    ctx.beginPath(); ctx.arc(sx, sy, r * 0.62, 0, Math.PI * 2); paint(ctx, sx, sy, r * 0.62, def.color)
  }
  // head
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // antennae
  ctx.strokeStyle = def.color; ctx.lineWidth = Math.max(2, r * 0.08)
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx + s * r * 0.2, cy - r * 0.8); ctx.lineTo(cx + s * r * 0.35, cy - r * 1.2); ctx.stroke()
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + s * r * 0.35, cy - r * 1.25, r * 0.08, 0, Math.PI * 2); ctx.fill()
  }
  eyes(ctx, cx, cy, r, e, { spread: 0.34 }); cheeks(ctx, cx, cy, r); smile(ctx, cx, cy, r)
}

function mama(ctx, cx, cy, r, def, e) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // head tuft
  ctx.strokeStyle = lighten(def.color, -22); ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx - r * 0.15, cy - r * 1.2)
  ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx + r * 0.15, cy - r * 1.2)
  ctx.stroke()
  // little wings
  ctx.fillStyle = lighten(def.color, -12)
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.85, cy + r * 0.1, r * 0.22, r * 0.4, s * 0.4, 0, Math.PI * 2); ctx.fill() }
  // beak
  ctx.fillStyle = '#ff9a3d'
  ctx.beginPath(); ctx.moveTo(cx - r * 0.13, cy + r * 0.16); ctx.lineTo(cx + r * 0.13, cy + r * 0.16); ctx.lineTo(cx, cy + r * 0.42); ctx.closePath(); ctx.fill()
  eyes(ctx, cx, cy, r, e, { spread: 0.3, y: -0.18 }); cheeks(ctx, cx, cy, r, { y: 0.12 })
}

function sheller(ctx, cx, cy, r, def, e) {
  // a peeking face under the shell
  ctx.fillStyle = lighten(def.color, 42); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.85, r * 0.55, r * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  eyes(ctx, cx, cy + r * 0.85, r * 0.5, e, { spread: 0.5, y: -0.1, w: 0.22, h: 0.26 })
  // spiral shell
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(2, r * 0.09)
  ctx.beginPath()
  for (let a = 0; a < Math.PI * 3.5; a += 0.2) {
    const rr = r * 0.82 * (1 - a / (Math.PI * 3.5))
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr
    a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.stroke()
}

function dragon(ctx, cx, cy, r, def, e, t) {
  const flap = Math.sin(t * 7 + e.bobPhase) * 0.3
  // wings
  ctx.fillStyle = lighten(def.color, -15)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.5, cy - r * 0.2)
    ctx.quadraticCurveTo(cx + s * r * 1.5, cy - r * (0.9 + flap), cx + s * r * 1.3, cy + r * 0.3)
    ctx.quadraticCurveTo(cx + s * r * 0.9, cy, cx + s * r * 0.5, cy + r * 0.2)
    ctx.closePath(); ctx.fill()
  }
  // body
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // belly
  ctx.fillStyle = 'rgba(255,255,200,0.5)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.3, r * 0.5, r * 0.55, 0, 0, Math.PI * 2); ctx.fill()
  // horns
  ctx.fillStyle = lighten(def.color, -25)
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.3, cy - r * 0.72)
    ctx.lineTo(cx + s * r * 0.5, cy - r * 1.15)
    ctx.lineTo(cx + s * r * 0.05, cy - r * 0.85)
    ctx.closePath(); ctx.fill()
  }
  eyes(ctx, cx, cy, r, e, { spread: 0.34, y: -0.2 })
  // snout nostrils
  ctx.fillStyle = INK
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.15, cy + r * 0.2, r * 0.05, 0, Math.PI * 2); ctx.fill() }
  smile(ctx, cx, cy, r, { y: 0.3, w: 0.25 })
}

function dino(ctx, cx, cy, r, def, e, t) {
  const dir = e.facing || 1
  // tail
  ctx.fillStyle = def.color
  ctx.beginPath()
  ctx.moveTo(cx - dir * r * 0.6, cy)
  ctx.quadraticCurveTo(cx - dir * r * 1.6, cy + r * 0.2, cx - dir * r * 1.5, cy + r * 0.6)
  ctx.quadraticCurveTo(cx - dir * r * 0.8, cy + r * 0.5, cx - dir * r * 0.3, cy + r * 0.4)
  ctx.closePath(); ctx.fill()
  // body
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.05, r, 0, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // belly
  ctx.fillStyle = 'rgba(255,255,200,0.45)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.35, r * 0.55, r * 0.5, 0, 0, Math.PI * 2); ctx.fill()
  // back spikes
  ctx.fillStyle = lighten(def.color, -20)
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * r * 0.4 - r * 0.12, cy - r * 0.82)
    ctx.lineTo(cx + i * r * 0.4, cy - r * 1.2)
    ctx.lineTo(cx + i * r * 0.4 + r * 0.12, cy - r * 0.82)
    ctx.closePath(); ctx.fill()
  }
  // big open jaw toward the door
  ctx.fillStyle = lighten(def.color, 12)
  ctx.beginPath(); ctx.ellipse(cx + dir * r * 0.55, cy + r * 0.28, r * 0.55, r * 0.35, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#7a2a3a'; ctx.beginPath(); ctx.ellipse(cx + dir * r * 0.65, cy + r * 0.32, r * 0.3, r * 0.18, 0, 0, Math.PI * 2); ctx.fill()
  // teeth
  ctx.fillStyle = '#fff'
  for (let i = 0; i < 3; i++) {
    const tx = cx + dir * r * (0.45 + i * 0.2)
    ctx.beginPath(); ctx.moveTo(tx, cy + r * 0.12); ctx.lineTo(tx + dir * r * 0.06, cy + r * 0.12); ctx.lineTo(tx + dir * r * 0.03, cy + r * 0.3); ctx.closePath(); ctx.fill()
  }
  // eye
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + dir * r * 0.25, cy - r * 0.32, r * 0.18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx + dir * r * 0.3, cy - r * 0.32, r * 0.09, 0, Math.PI * 2); ctx.fill()
}

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------
function frosttitan(ctx, cx, cy, r, def, e) {
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.5, r * 0.85, 0, Math.PI * 2); paint(ctx, cx, cy + r * 0.5, r * 0.85, def.color, 40)
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.55, r * 0.62, 0, Math.PI * 2); paint(ctx, cx, cy - r * 0.55, r * 0.62, def.color, 40)
  // coal eyes
  ctx.fillStyle = INK
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.22, cy - r * 0.65, r * 0.08, 0, Math.PI * 2); ctx.fill() }
  // carrot nose
  ctx.fillStyle = '#ff9a3d'
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx + r * 0.45, cy - r * 0.46); ctx.lineTo(cx, cy - r * 0.42); ctx.closePath(); ctx.fill()
  // coal smile
  ctx.fillStyle = INK
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + i * r * 0.13, cy - r * 0.32 + Math.abs(i) * r * 0.03, r * 0.04, 0, Math.PI * 2); ctx.fill() }
  // buttons
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy + r * 0.2 + i * r * 0.32, r * 0.07, 0, Math.PI * 2); ctx.fill() }
}

function goblinking(ctx, cx, cy, r, def, e) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // big ears
  ctx.fillStyle = def.color
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + s * r * 0.85, cy - r * 0.1)
    ctx.lineTo(cx + s * r * 1.35, cy - r * 0.45)
    ctx.lineTo(cx + s * r * 0.85, cy + r * 0.3)
    ctx.closePath(); ctx.fill()
  }
  // heavy brow
  ctx.strokeStyle = lighten(def.color, -32); ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * r * 0.12, cy - r * 0.32); ctx.lineTo(cx + s * r * 0.52, cy - r * 0.14); ctx.stroke() }
  eyes(ctx, cx, cy, r, e, { spread: 0.34, y: -0.05, w: 0.16, pupil: '#ffe14d' })
  // tusks
  ctx.fillStyle = '#fff'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * r * 0.18, cy + r * 0.28); ctx.lineTo(cx + s * r * 0.32, cy + r * 0.28); ctx.lineTo(cx + s * r * 0.25, cy - r * 0.02); ctx.closePath(); ctx.fill() }
  // toothy grin
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.08)
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.22, r * 0.36, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke()
}

function lavadragon(ctx, cx, cy, r, def, e, t) {
  // a fierier dragon — reuse the dragon body, add molten glow puffs
  dragon(ctx, cx, cy, r, def, e, t)
  ctx.fillStyle = 'rgba(255,180,60,0.6)'
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * r * 0.12, cy + r * 0.42, r * 0.1, 0, Math.PI * 2); ctx.fill() }
}

function voidlord(ctx, cx, cy, r, def, e, t) {
  // glass dome
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.05, r * 0.6, Math.PI, 0); ctx.closePath()
  ctx.fillStyle = 'rgba(180,230,255,0.55)'; ctx.fill()
  // little pilot in the dome
  ctx.fillStyle = lighten(def.color, 45); ctx.beginPath(); ctx.arc(cx, cy - r * 0.2, r * 0.24, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = INK
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + s * r * 0.1, cy - r * 0.22, r * 0.05, r * 0.08, 0, 0, Math.PI * 2); ctx.fill() }
  // saucer
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.12, r * 1.2, r * 0.45, 0, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  // running lights
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = Math.sin(t * 5 + i) > 0 ? '#ffe14d' : '#ff8fc6'
    ctx.beginPath(); ctx.arc(cx + i * r * 0.42, cy + r * 0.16, r * 0.08, 0, Math.PI * 2); ctx.fill()
  }
}

const CRITTERS = {
  candy, bat, blob, pumpkin, spider, eyeball, alien, zombie, octopus, robot,
  snail, microbe, caterpillar, mama, sheller, dragon, dino,
  frosttitan, goblinking, lavadragon, voidlord,
}

// The single entry point render.js calls for each monster's body.
export function drawEnemyBody(ctx, e, cx, cy, r, t) {
  const def = e.def
  if (def.shape === 'ghost') return ghost(ctx, cx, cy, r, def, e, t)
  const fn = CRITTERS[e.type]
  if (fn) return fn(ctx, cx, cy, r, def, e, t)
  // safety fallback — a plain round body with a cute face
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, cx, cy, r, def.color)
  eyes(ctx, cx, cy, r, e); cheeks(ctx, cx, cy, r); smile(ctx, cx, cy, r)
}
