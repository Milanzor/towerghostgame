// All canvas drawing: field, path, towers, enemies, previews and overlays.
import { S } from './state.js'
import { ctx } from './dom.js'
import { TILE, COLS, ROWS, FIELD_W, FIELD_H, TOWERS } from '../content.js'
import { drawEmoji } from '../emoji.js'
import { clamp, lighten, mulberry32 } from './util.js'
import { towerStat, cellBuildable } from './towers.js'
import { drawParticles } from './effects.js'
import { drawEnemyBody } from './critters.js'


function render() {
  const lv = S.G.level
  ctx.save()
  // screen shake
  if (S.G.shake > 0.2) {
    const s = S.G.shake
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s)
  }

  // background
  ctx.fillStyle = lv.bg
  ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)

  drawDecor(lv)
  drawBuildableDots()
  drawPath()
  drawTowers()
  drawProjectiles()
  drawEnemies()
  drawParticles()
  drawPlacementPreview()
  if (S.G.phase === 'tidyup') drawTidyUp()

  // hurt flash
  if (S.G.flash > 0) {
    ctx.fillStyle = `rgba(255,40,80,${S.G.flash * 0.5})`
    ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)
  }

  // vignette
  const vg = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.3, FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.85)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vg
  ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)

  // paused overlay
  if (S.G.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)
    drawEmoji(ctx, '⏸️', FIELD_W / 2, FIELD_H / 2 - 26, 56)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 30px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Paused', FIELD_W / 2, FIELD_H / 2 + 28)
  }

  ctx.restore()
}

function levelDecor(lv) {
  if (lv._decor) return lv._decor
  const props = []
  const list = lv.decor || []
  if (list.length) {
    const rand = mulberry32(lv.areaIndex * 101 + lv.waypoints.length * 17 + lv.name.length * 7)
    const used = new Set()
    let tries = 0
    while (props.length < 16 && tries < 200) {
      tries++
      const c = Math.floor(rand() * COLS)
      const r = Math.floor(rand() * ROWS)
      const key = `${c},${r}`
      if (lv.pathTiles.has(key) || used.has(key)) continue
      used.add(key)
      props.push({
        emoji: list[Math.floor(rand() * list.length)],
        x: c * TILE + TILE / 2 + (rand() - 0.5) * 18,
        y: r * TILE + TILE / 2 + (rand() - 0.5) * 18,
        size: 22 + Math.floor(rand() * 16),
        alpha: 0.16 + rand() * 0.16,
      })
    }
  }
  lv._decor = props
  return props
}

function drawDecor(lv) {
  for (const p of levelDecor(lv)) {
    ctx.globalAlpha = p.alpha
    drawEmoji(ctx, p.emoji, p.x, p.y, p.size)
  }
  ctx.globalAlpha = 1
}

function drawBuildableDots() {
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!S.G.level.pathTiles.has(`${c},${r}`) && !S.G.occupied.has(`${c},${r}`)) {
        ctx.beginPath()
        ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function drawPath() {
  // §4 — every lane variant shares its start + end, so we stroke each lane's
  // carpet/centerline but draw the portal + door just once at the shared ends.
  const lanes = S.G.level.paths
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // outer carpet (all lanes)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = TILE * 0.82
  for (const v of lanes) strokeWaypoints(v.waypoints)
  ctx.strokeStyle = S.G.level.floor
  ctx.lineWidth = TILE * 0.66
  for (const v of lanes) strokeWaypoints(v.waypoints)
  // dashed center line (all lanes)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 4
  ctx.setLineDash([14, 16])
  for (const v of lanes) strokeWaypoints(v.waypoints)
  ctx.setLineDash([])

  const wp = S.G.level.waypoints
  // entrance portal (shared start)
  const start = clampPoint(wp[0])
  drawPortal(start.x, start.y)
  // mansion door at exit (shared end)
  const end = clampPoint(wp[wp.length - 1])
  drawDoor(end.x, end.y)
}

function strokeWaypoints(wp) {
  ctx.beginPath()
  ctx.moveTo(wp[0].x, wp[0].y)
  for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i].x, wp[i].y)
  ctx.stroke()
}

function clampPoint(p) {
  return { x: clamp(p.x, 6, FIELD_W - 6), y: clamp(p.y, 6, FIELD_H - 6) }
}

function drawPortal(x, y) {
  const t = S.G.time
  ctx.fillStyle = S.G.level.accent || '#9a6bff'
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.12 * i
    ctx.beginPath()
    ctx.arc(x, y, 10 + i * 6 + Math.sin(t * 3 + i) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

// The "goal" the monsters race toward — themed per area (a creaky door in the
// mansion, a frozen gate in the caverns, a swirling portal in the void…).
function drawDoor(x, y) {
  ctx.save()
  ctx.translate(x, y)
  const t = S.G.time
  // §9 — during the tidy-up ritual the house "tucks in": the goal glow fades out
  // toward the end and a sleepy 💤 floats up. Otherwise the usual pulsing glow.
  const tidy = S.G.phase === 'tidyup' ? S.G.tidy : null
  const dim = (tidy && tidy.ran) ? clamp(1 - (tidy.t - 1.0) / 1.5, 0, 1) : 1
  ctx.globalAlpha = (0.22 + Math.sin(t * 2) * 0.05) * dim
  ctx.fillStyle = S.G.level.accent || '#ffd34d'
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  drawEmoji(ctx, S.G.level.door || '🚪', 0, 0, 40)
  if (tidy && tidy.ran && tidy.t > 1.4) {
    ctx.globalAlpha = clamp((tidy.t - 1.4) / 0.6, 0, 1)
    drawEmoji(ctx, '💤', 22, -30 - Math.sin(t * 3) * 3, 20)
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

// §9 — the closure ritual's piggy bank + the coin swoosh. The piggy bobs in the
// lower-left corner; while the (display-only) coin counter drains, little 🪙s
// arc from the field centre into the piggy. A friendly "all tidy!" cue floats up
// once everything is put away.
function drawTidyUp() {
  const td = S.G.tidy
  if (!td) return
  const px = 56, py = FIELD_H - 54 // piggy home (lower-left, clear of the path)
  const t = S.G.time
  if (!td.ran) {
    // Waiting for the kid's first tap — a gentle "tap me!" nudge near the door.
    return
  }
  // the piggy, gently bobbing + a soft glow
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = '#ffd9ec'
  ctx.beginPath(); ctx.arc(px, py, 30 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  drawEmoji(ctx, '🐷', px, py + Math.sin(t * 3) * 2, 46)

  // flying coins during the drain window (mirrors the swoosh timing in screens)
  const drainStart = 0.5, drainDur = 1.3
  const f = clamp((td.t - drainStart) / drainDur, 0, 1)
  if (td.coins0 > 0 && f > 0 && f < 1) {
    const fromX = FIELD_W / 2, fromY = FIELD_H / 2
    const n = 5
    for (let i = 0; i < n; i++) {
      // each coin staggered along the window so they stream into the piggy
      let cf = f * 1.4 - i * 0.12
      cf = clamp(cf, 0, 1)
      if (cf <= 0 || cf >= 1) continue
      const ease = cf * cf * (3 - 2 * cf)
      const cx = fromX + (px - fromX) * ease
      const cy = fromY + (py - fromY) * ease - Math.sin(ease * Math.PI) * 40 // arc up
      ctx.globalAlpha = clamp(1 - ease, 0.2, 1)
      drawEmoji(ctx, '🪙', cx, cy, 24)
      ctx.globalAlpha = 1
    }
  }
  // count badge above the piggy as it ticks down
  if (td.coins0 > 0) {
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 4
    ctx.font = `800 18px 'Baloo 2', system-ui, sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const label = `🪙 ${td.coins}`
    ctx.strokeText(label, px, py - 36)
    ctx.fillText(label, px, py - 36)
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawTowers() {
  const tidy = S.G.phase === 'tidyup' ? S.G.tidy : null
  for (const t of S.G.towers) {
    // §9 — during the tidy-up ritual, helpers hop off one by one: a brief
    // anticipatory hop just before their exit time, then a pop-and-vanish.
    if (tidy && tidy.ran) {
      if (t.popped) continue // already hopped off — popEffect did the burst
      const until = (t.exitAt || 0) - tidy.t
      if (until < 0.35) {
        // wind-up hop: lift + lean in the exit direction
        const p = clamp(1 - until / 0.35, 0, 1)
        ctx.save()
        ctx.translate((t.exitDir || 1) * p * 10, -Math.sin(p * Math.PI) * 16)
        drawTowerBody(t)
        ctx.restore()
        continue
      }
    }
    drawTowerBody(t)
  }
}

function drawTowerBody(t) {
  {
    const sel = S.G.selectedTower === t
    if (sel && towerStat(t, 'range') > 0) {
      const rangePx = towerStat(t, 'range') * TILE
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(t.cx, t.cy, rangePx, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    // Cheer Captain shows its buff area softly so kids can see who it helps
    if (t.def.kind === 'boost') {
      const rp = towerStat(t, 'range') * TILE
      ctx.globalAlpha = 0.1 + Math.sin(S.G.time * 3) * 0.03
      ctx.fillStyle = t.def.color
      ctx.beginPath(); ctx.arc(t.cx, t.cy, rp, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }
    // frost/pulse aura flash
    if (t.frostPulse > 0) {
      t.frostPulse -= 0.016
      const rp = towerStat(t, 'range') * TILE
      ctx.globalAlpha = clamp(t.frostPulse, 0, 1) * 0.5
      ctx.fillStyle = t.def.color
      ctx.beginPath(); ctx.arc(t.cx, t.cy, rp, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = 1
    }
    // firing kick: a quick scale-pop on the helper + a muzzle flash toward its aim
    let fp = 0
    if (t.firePulse > 0) { t.firePulse -= 0.016; fp = clamp(t.firePulse / 0.16, 0, 1) }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); ctx.ellipse(t.cx, t.cy + 16, 22, 9, 0, 0, Math.PI * 2); ctx.fill()
    // platform
    const grd = ctx.createLinearGradient(0, t.cy - 20, 0, t.cy + 18)
    grd.addColorStop(0, lighten(t.def.color, 30))
    grd.addColorStop(1, t.def.color)
    ctx.fillStyle = grd
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(t.cx, t.cy, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    // buffed-by-a-Cheer-Captain glow ring
    if (t.dmgBuff > 1) {
      ctx.strokeStyle = `rgba(255,211,77,${0.45 + Math.sin(S.G.time * 8) * 0.2})`
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(t.cx, t.cy, 27, 0, Math.PI * 2); ctx.stroke()
    }
    // muzzle flash — a bright bloom at the helper's rim, pointed at its target
    if (fp > 0 && t.aim) {
      const ang = Math.atan2(t.aim.y - t.cy, t.aim.x - t.cx)
      const mx = t.cx + Math.cos(ang) * 18, my = t.cy + Math.sin(ang) * 18
      ctx.globalAlpha = fp * 0.85
      ctx.fillStyle = lighten(t.def.color, 55)
      ctx.shadowColor = t.def.color; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.arc(mx, my, 4 + fp * 6, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }
    // emoji (pops a touch bigger the instant it fires)
    drawEmoji(ctx, t.def.emoji, t.cx, t.cy + 1, 32 + fp * 6)
    // level badge (shows the helper's level once upgraded)
    if (t.level >= 2) {
      ctx.fillStyle = '#ffd34d'
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(t.cx + 17, t.cy - 15, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#5a3a00'
      ctx.font = '800 13px "Baloo 2", system-ui, sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(t.level, t.cx + 17, t.cy - 14)
    }
    // hexed / frozen by a boss
    if (t.disabledTimer > 0) {
      ctx.fillStyle = 'rgba(150,220,255,0.5)'
      ctx.beginPath(); ctx.arc(t.cx, t.cy, 24, 0, Math.PI * 2); ctx.fill()
      drawEmoji(ctx, '❄️', t.cx, t.cy, 20)
    }
    // active suck beam(s) — leveled vacuums grab several monsters at once
    if (t.beamTargets) {
      for (const e of t.beamTargets) {
        if (e && !e.dead) drawSuckBeam(t, e)
      }
    }
  }
}

function drawSuckBeam(t, e) {
  ctx.save()
  ctx.strokeStyle = 'rgba(120,210,255,0.7)'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(t.cx, t.cy)
  // wavy beam
  const segs = 6
  for (let i = 1; i <= segs; i++) {
    const f = i / segs
    const x = t.cx + (e.x - t.cx) * f
    const y = t.cy + (e.y - t.cy) * f
    const off = Math.sin(S.G.time * 20 + i) * 6 * (1 - f)
    ctx.lineTo(x + off, y - off)
  }
  ctx.stroke()
  ctx.restore()
}

function drawProjectiles() {
  for (const p of S.G.projectiles) {
    const st = p.style
    if (st === 'coin') {
      // a tumbling gold coin — flips by squashing its width as it spins
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.scale(Math.max(0.2, Math.abs(Math.cos((p.spin || 0) * 1.5))), 1)
      ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 10
      ctx.fillStyle = '#ffe14d'; ctx.strokeStyle = '#c79a2e'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
      continue
    }
    if (st === 'fire' || st === 'goo' || st === 'spark') {
      // a glowing orb with a hot white core; goo wobbles as it travels
      const rad = st === 'spark' ? 6 : 7
      const wob = st === 'goo' ? 1 + Math.sin((p.spin || 0) * 3) * 0.18 : 1
      ctx.save()
      ctx.shadowColor = p.color; ctx.shadowBlur = 12
      const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad)
      g.addColorStop(0, '#fff')
      g.addColorStop(0.5, lighten(p.color, 30))
      g.addColorStop(1, p.color)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rad * wob, rad / wob, 0, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
      continue
    }
    // splash boom-ball — a glowing, tumbling shell with the 💥 upright on top
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.spin || 0)
    ctx.shadowColor = p.color; ctx.shadowBlur = 10
    ctx.fillStyle = p.color
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.shadowBlur = 0
    ctx.restore()
    drawEmoji(ctx, '💥', p.x, p.y, 16)
  }
}

function drawEnemies() {
  for (const e of S.G.enemies) drawEnemy(e)
}

// Shared scaffolding around each monster's own hand-drawn body (see critters.js):
// heal aura, burrow mound, phased translucency, drop shadow, frozen wash, crown,
// status icons and the HP bar.
function drawEnemy(e) {
  const def = e.def
  const r = def.radius
  const bob = Math.sin(S.G.time * 3 + e.bobPhase) * 4
  const cx = e.x
  const cy = e.y + bob

  // §3 heal-aura glow ring (drawn under everything else)
  drawHealAura(e, cx, cy, r)
  // §3 burrowed → mostly hidden underground; just a dust mound + status icons
  if (e.burrowed) { drawBurrowMound(e); drawStatus(e, cx, cy, r); return }
  // §3 phased → translucent and dodging one tower kind
  const bodyA = e.phased ? 0.35 : 1

  // shadow
  ctx.fillStyle = `rgba(0,0,0,${0.25 * bodyA})`
  ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.92, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill()

  // the creature's bespoke body
  ctx.save()
  ctx.globalAlpha = bodyA
  drawEnemyBody(ctx, e, cx, cy, r, S.G.time)
  ctx.restore()

  // frozen wash (icy aura over the body when slowed hard)
  if (e.slowTimer > 0 && e.slowFactor <= 0.5) {
    ctx.globalAlpha = bodyA * 0.38
    ctx.fillStyle = 'rgba(150,220,255,1)'
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  // crown for kings / bosses
  if (def.crown) {
    ctx.globalAlpha = bodyA
    drawEmoji(ctx, '👑', cx, cy - r * 1.02, r)
    ctx.globalAlpha = 1
  }

  drawStatus(e, cx, cy, r)
  drawHpBar(e, cx, cy, r)
}

// §3 — a soft pulsing glow ring in the monster's colour around a "mama" heal-aura.
function drawHealAura(e, cx, cy, r) {
  if (!e.def.healAura) return
  const rPx = e.def.healAura.radius * TILE
  const pulse = 0.5 + Math.sin(S.G.time * 3 + e.bobPhase) * 0.5
  ctx.save()
  ctx.globalAlpha = 0.08 + pulse * 0.06
  ctx.fillStyle = e.def.color
  ctx.beginPath(); ctx.arc(cx, cy, rPx, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.3 + pulse * 0.25
  ctx.strokeStyle = lighten(e.def.color, 40)
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.arc(cx, cy, rPx, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

// §3 — when a burrower is underground, draw a little dusty mound where it dipped.
function drawBurrowMound(e) {
  const r = e.def.radius
  const t = S.G.time
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.9, r * 0.7, r * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(202,165,107,0.55)'
  ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.5, r * 0.55, r * 0.3, 0, Math.PI, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.5 + Math.sin(t * 8 + e.bobPhase) * 0.2
  drawEmoji(ctx, '💨', e.x + Math.sin(t * 4) * 3, e.y + r * 0.2, 16)
  ctx.restore()
}

function drawStatus(e, cx, cy, r) {
  // boss: enraged red aura
  if (e.enraged) {
    ctx.strokeStyle = `rgba(255,90,70,${0.4 + Math.sin(S.G.time * 12) * 0.2})`
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke()
  }
  // boss: phase-shield bubble
  if (e.invuln > 0) {
    ctx.fillStyle = `rgba(140,255,158,${0.18 + Math.sin(S.G.time * 16) * 0.08})`
    ctx.strokeStyle = 'rgba(140,255,158,0.8)'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  let bx = cx - r * 0.7
  const by = cy - r - 16
  if (e.shield > 0) { drawEmoji(ctx, '🛡️', bx, by, 14); bx += 14 }
  if (e.burnTimer > 0) { drawEmoji(ctx, '🔥', bx, by, 14); bx += 14 }
  if (e.poisonTimer > 0) { drawEmoji(ctx, '🫧', bx, by, 14); bx += 14 }
}

function drawHpBar(e, cx, cy, r) {
  if (e.hp >= e.maxHp) return
  const w = r * 1.6, h = 6
  const bx = cx - w / 2, by = cy - r - 12
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  roundRect(bx, by, w, h, 3); ctx.fill()
  const frac = clamp(e.hp / e.maxHp, 0, 1)
  ctx.fillStyle = frac > 0.5 ? '#7be38c' : frac > 0.25 ? '#ffd34d' : '#ff6b8b'
  roundRect(bx, by, w * frac, h, 3); ctx.fill()
}

function drawPlacementPreview() {
  if (!S.G.selectedType || !S.G.hoverCell) return
  const { c, r } = S.G.hoverCell
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return
  const def = TOWERS[S.G.selectedType]
  const ok = cellBuildable(c, r) && S.G.coins >= def.cost
  const cx = c * TILE + TILE / 2
  const cy = r * TILE + TILE / 2
  // range
  if (def.range > 0) {
    ctx.fillStyle = ok ? 'rgba(120,255,150,0.12)' : 'rgba(255,80,100,0.12)'
    ctx.strokeStyle = ok ? 'rgba(120,255,150,0.7)' : 'rgba(255,80,100,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, cy, def.range * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // tile highlight
  ctx.fillStyle = ok ? 'rgba(120,255,150,0.25)' : 'rgba(255,80,100,0.25)'
  roundRect(c * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8, 10); ctx.fill()
  // ghost preview of tower
  ctx.globalAlpha = 0.75
  drawEmoji(ctx, def.emoji, cx, cy, 32)
  ctx.globalAlpha = 1
}

export {
  render,
}
