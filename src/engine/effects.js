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
function ringEffect(x, y, radius, color) {
  S.G.particles.push({ kind: 'ring', x, y, r: 6, max: radius, life: 0.35, t: 0.35, color })
}
function floatText(x, y, text, color, size) {
  S.G.particles.push({ kind: 'text', x, y, text, color, size: size || 18, life: 1.1, max: 1.1 })
}
function addBeam(x1, y1, x2, y2, color, life) {
  S.G.particles.push({ kind: 'beam', x1, y1, x2, y2, color, life, max: life })
}

function updateParticles(dt) {
  for (const p of S.G.particles) {
    p.life -= dt
    if (p.kind === 'puff') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt
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
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    } else if (p.kind === 'ring') {
      const rad = p.max * (1 - a) + 6
      ctx.globalAlpha = a
      ctx.strokeStyle = p.color
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
    } else if (p.kind === 'beam') {
      ctx.globalAlpha = a
      ctx.strokeStyle = p.color
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.shadowColor = p.color
      ctx.shadowBlur = 12
      ctx.beginPath(); ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x2, p.y2); ctx.stroke()
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
  popEffect, emberAt, ringEffect, floatText, addBeam, updateParticles, drawParticles,
}
