// Particle effects: pops, embers, rings, floating combat text and zap beams.
import { S } from './state.js'
import { ctx, EMOJI_FONT } from './dom.js'
import { clamp } from './util.js'


// ===========================================================================
// Particles & effects
// ===========================================================================
function popEffect(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    S.G.particles.push({
      kind: 'puff', x, y,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20,
      life: 0.5, max: 0.5, r: 6 + Math.random() * 4, color,
    })
  }
}
function emberAt(x, y, color) {
  S.G.particles.push({
    kind: 'puff', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16,
    vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30,
    life: 0.45, max: 0.45, r: 3 + Math.random() * 3, color,
  })
}

// A configurable spray of little puffs — the workhorse for every helper's
// impact flair. opts: n, speed, life, gravity, r, glow, dir+spread (a fan
// instead of a full ring).
function burst(x, y, color, opts = {}) {
  const n = opts.n ?? 8
  const speed = opts.speed ?? 60
  const life = opts.life ?? 0.5
  const grav = opts.gravity ?? 140
  const r = opts.r ?? 5
  for (let i = 0; i < n; i++) {
    const a = opts.spread !== undefined
      ? (opts.dir ?? 0) + (n === 1 ? 0 : (i / (n - 1) - 0.5) * opts.spread)
      : (i / n) * Math.PI * 2 + Math.random() * 0.4
    const sp = speed * (0.55 + Math.random() * 0.7)
    S.G.particles.push({
      kind: 'puff', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life, max: life, r: r * (0.7 + Math.random() * 0.6), color,
      grav, glow: opts.glow || false,
    })
  }
}

// A speck that flies FROM the monster TOWARD a helper — the "sucking" look.
function pullParticle(fromX, fromY, toX, toY, color) {
  const a = Math.atan2(toY - fromY, toX - fromX)
  const sp = 90 + Math.random() * 70
  const side = (Math.random() - 0.5) * 22
  S.G.particles.push({
    kind: 'puff',
    x: fromX + Math.cos(a + Math.PI / 2) * side,
    y: fromY + Math.sin(a + Math.PI / 2) * side,
    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
    life: 0.3, max: 0.3, r: 3 + Math.random() * 2, color, grav: 0, glow: true,
  })
}

// A little goo bubble that drifts upward (poison helpers).
function bubbleAt(x, y, color) {
  S.G.particles.push({
    kind: 'puff', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 25,
    life: 0.55, max: 0.55, r: 3 + Math.random() * 3, color, grav: -45, glow: true,
  })
}

// A swirling ring of sparks (tornado / pull helpers) — tangential velocity so
// they whirl around the spot instead of flying straight out.
function swirlAt(x, y, color) {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const rad = 14
    S.G.particles.push({
      kind: 'puff', x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad,
      vx: Math.cos(a + Math.PI / 2) * 80, vy: Math.sin(a + Math.PI / 2) * 80,
      life: 0.35, max: 0.35, r: 3, color, grav: 0, glow: true,
    })
  }
}

function ringEffect(x, y, radius, color, opts = {}) {
  const life = opts.life ?? 0.35
  S.G.particles.push({
    kind: 'ring', x, y, r: 6, max: radius, life, t: life, color,
    width: opts.width ?? 5, fill: opts.fill || false,
  })
}
function floatText(x, y, text, color, size) {
  S.G.particles.push({ kind: 'text', x, y, text, color, size: size || 18, life: 1.1, max: 1.1 })
}
// A zap beam. opts: width, style ('laser' straight glow | 'bolt' jagged
// lightning), core (bright white inner line, on by default), jag/segs for bolts.
function addBeam(x1, y1, x2, y2, color, life, opts = {}) {
  const p = {
    kind: 'beam', x1, y1, x2, y2, color, life, max: life,
    style: opts.style || 'laser', width: opts.width ?? 6, core: opts.core !== false,
  }
  if (p.style === 'bolt') {
    // precompute a jagged path once so the bolt holds its shape (no per-frame jitter)
    const segs = opts.segs ?? 5
    const amp = opts.jag ?? 10
    const nx = -(y2 - y1), ny = x2 - x1
    const len = Math.hypot(nx, ny) || 1
    const pts = [{ x: x1, y: y1 }]
    for (let i = 1; i < segs; i++) {
      const f = i / segs
      const off = (Math.random() - 0.5) * 2 * amp
      pts.push({ x: x1 + (x2 - x1) * f + (nx / len) * off, y: y1 + (y2 - y1) * f + (ny / len) * off })
    }
    pts.push({ x: x2, y: y2 })
    p.points = pts
  }
  S.G.particles.push(p)
}

function updateParticles(dt) {
  for (const p of S.G.particles) {
    p.life -= dt
    if (p.kind === 'puff') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav ?? 140) * dt
    } else if (p.kind === 'text') {
      p.y -= 28 * dt
    }
  }
  if (S.G.particles.some(p => p.life <= 0)) {
    S.G.particles = S.G.particles.filter(p => p.life > 0)
  }
}

function drawParticles() {
  for (const p of S.G.particles) {
    const a = clamp(p.life / p.max, 0, 1)
    if (p.kind === 'puff') {
      ctx.globalAlpha = a
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 8 }
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    } else if (p.kind === 'ring') {
      const rad = p.max * (1 - a) + 6
      ctx.globalAlpha = a
      if (p.fill) {
        ctx.globalAlpha = a * 0.18
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = a
      }
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.width
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    } else if (p.kind === 'beam') {
      ctx.globalAlpha = a
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = p.color
      ctx.shadowBlur = 12
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.width
      ctx.beginPath()
      if (p.points) {
        ctx.moveTo(p.points[0].x, p.points[0].y)
        for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y)
      } else {
        ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2)
      }
      ctx.stroke()
      // bright white core down the middle for extra zap
      if (p.core) {
        ctx.shadowBlur = 0
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = Math.max(1.5, p.width * 0.35)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    } else if (p.kind === 'text') {
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.lineWidth = 4
      ctx.font = `800 ${p.size}px 'Baloo 2', ${EMOJI_FONT}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.strokeText(p.text, p.x, p.y)
      ctx.fillText(p.text, p.x, p.y)
      ctx.globalAlpha = 1
    }
  }
}

export {
  popEffect, emberAt, burst, pullParticle, bubbleAt, swirlAt,
  ringEffect, floatText, addBeam, updateParticles, drawParticles,
}
