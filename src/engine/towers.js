// Helpers (towers): leveling/stat growth, targeting, every 'kind' of attack,
// projectiles, placement and the select/upgrade/sell action bar.
import { S } from './state.js'
import { TOWERS, TILE, COLS, ROWS, FIELD_W, FIELD_H } from '../content.js'
import { sfx } from '../audio.js'
import { twemojify } from '../emoji.js'
import { actionBar } from './dom.js'
import { lighten } from './util.js'
import { floatText, addBeam, ringEffect, burst, pullParticle, bubbleAt, swirlAt } from './effects.js'
import { damageEnemy, applySlow, applyBurn, applyPoison, retreatAlongPath, isTargetable } from './enemies.js'
import { refreshPalette } from './ui.js'


// ===========================================================================
// Towers
// ===========================================================================
// Leveling: every helper can be upgraded all the way to MAX_LEVEL. Rather than
// authoring a stat block per level, we grow the base stat by a per-stat factor
// for each level above 1, so adding new helpers needs no upgrade tables. Some
// stats get *smaller* as they grow (cooldown → shoots faster; slow → stronger).
//
// On top of the smooth stat growth, helpers unlock a brand-new POWER at two
// milestones — level 3 and level 5 (see `levelTier`). What the power is depends
// on the helper's `kind`: beams sprout extra forked bolts, snipers shatter into
// shrapnel, flames + goo spread to the crowd, vacuums grab more monsters, booms
// gain clustered after-blasts, and so on. It's handled inline in `updateTowers`.
const MAX_LEVEL = 5
const LEVEL_GROWTH = {
  damage: 1.35, cooldown: 0.9, range: 1.05,
  burnDps: 1.35, burnDur: 1.1, poisonDps: 1.35, poisonDur: 1.1,
  splashRadius: 1.1, income: 1.5, slow: 0.88, slowDur: 1.12,
  chainRange: 1.06, bounty: 1.4, pull: 1.12, boostDmg: 1.12, boostRate: 0.95,
}

function towerStat(t, stat) {
  const base = t.def[stat]
  if (base === undefined) return undefined
  const steps = (t.level || 1) - 1
  if (steps <= 0) return base
  // count-style stats gain a whole +1 every two levels
  if (stat === 'chainCount' || stat === 'shots') return base + Math.floor(steps / 2)
  const g = LEVEL_GROWTH[stat]
  return g === undefined ? base : base * Math.pow(g, steps)
}

// What the next level-up costs — scales with the helper's base price and level.
function upgradeCost(t) {
  return Math.round(t.def.cost * (0.9 + 0.55 * (t.level - 1)))
}

function findTarget(t) {
  const rangePx = towerStat(t, 'range') * TILE
  const r2 = rangePx * rangePx
  let best = null
  let bestDist = -1
  for (const e of S.G.enemies) {
    if (!isTargetable(e, t.def.kind)) continue
    const dx = e.x - t.cx
    const dy = e.y - t.cy
    if (dx * dx + dy * dy <= r2 && e.dist > bestDist) {
      best = e
      bestDist = e.dist
    }
  }
  return best
}

function findTargets(t, n) {
  const rangePx = towerStat(t, 'range') * TILE
  const r2 = rangePx * rangePx
  const inRange = []
  for (const e of S.G.enemies) {
    if (!isTargetable(e, t.def.kind)) continue
    const dx = e.x - t.cx
    const dy = e.y - t.cy
    if (dx * dx + dy * dy <= r2) inRange.push(e)
  }
  inRange.sort((a, b) => b.dist - a.dist)
  return inRange.slice(0, n)
}

// Snipers (🦉) pick the toughest monster in range — the one with the most HP
// left — so they hammer big bruisers and bosses instead of wasting shots.
function findStrongest(t) {
  const rangePx = towerStat(t, 'range') * TILE
  const r2 = rangePx * rangePx
  let best = null
  let bestHp = -1
  for (const e of S.G.enemies) {
    if (!isTargetable(e, t.def.kind)) continue
    const dx = e.x - t.cx
    const dy = e.y - t.cy
    if (dx * dx + dy * dy <= r2 && e.hp > bestHp) {
      best = e
      bestHp = e.hp
    }
  }
  return best
}

// Milestone tier: 0 at levels 1–2, 1 at levels 3–4, 2 at level 5. Drives the
// "new power" each helper unlocks as it grows.
function levelTier(t) {
  return Math.floor(((t.level || 1) - 1) / 2)
}

// The nearest-to-goal monsters in range, minus one we've already zapped — used
// by the forked-bolt / extra-grab milestone powers.
function extraTargets(t, n, exclude) {
  return findTargets(t, n + 1).filter(e => e !== exclude).slice(0, n)
}

// Give a helper a satisfying "kick" when it fires: a quick scale-pop + a muzzle
// flash aimed at its target (drawn in render.js from firePulse / aim).
function fireFx(t, target) {
  t.firePulse = 0.16
  t.aim = target ? { x: target.x, y: target.y } : null
}

function enemiesInRange(cx, cy, rangePx, kind) {
  const r2 = rangePx * rangePx
  const out = []
  for (const e of S.G.enemies) {
    if (!isTargetable(e, kind)) continue
    const dx = e.x - cx
    const dy = e.y - cy
    if (dx * dx + dy * dy <= r2) out.push(e)
  }
  return out
}

function updateTowers(dt) {
  // Cheer Captains (📣 boost) buff every nearby helper. Recompute the buffs
  // each frame so placing/selling a booster (or hexing one) takes effect at once.
  for (const t of S.G.towers) { t.dmgBuff = 1; t.rateBuff = 1 }
  for (const b of S.G.towers) {
    if (b.def.kind !== 'boost' || b.disabledTimer > 0) continue
    const rangePx = towerStat(b, 'range') * TILE
    const r2 = rangePx * rangePx
    for (const t of S.G.towers) {
      if (t === b || t.def.kind === 'boost') continue
      const dx = t.cx - b.cx, dy = t.cy - b.cy
      if (dx * dx + dy * dy <= r2) {
        t.dmgBuff = Math.max(t.dmgBuff, towerStat(b, 'boostDmg'))
        t.rateBuff = Math.min(t.rateBuff, towerStat(b, 'boostRate'))
      }
    }
  }

  for (const t of S.G.towers) {
    t.cd -= dt
    t.beamTo = null
    t.beamTargets = null
    // hexed by a boss — frozen solid, can't fire
    if (t.disabledTimer > 0) { t.disabledTimer -= dt; continue }
    const kind = t.def.kind
    if (kind === 'boost') continue // support only — never fires
    if (t.cd > 0) continue
    const rate = t.rateBuff || 1

    if (kind === 'bank') {
      const income = towerStat(t, 'income')
      S.G.coins += income
      floatText(t.cx, t.cy - 14, `+${income}`, '#ffd34d', 16)
      // a little fountain of coins-sparks puffing up out of the piggy/cupcake
      burst(t.cx, t.cy - 8, '#ffd34d', { n: 7, speed: 80, life: 0.5, gravity: -50, glow: true })
      t.firePulse = 0.16
      t.cd = towerStat(t, 'cooldown') * rate
      sfx.coin()
      continue
    }

    if (kind === 'frost' || kind === 'pulse') {
      const rangePx = towerStat(t, 'range') * TILE
      const hits = enemiesInRange(t.cx, t.cy, rangePx, kind)
      if (hits.length === 0) continue
      t.cd = towerStat(t, 'cooldown') * rate
      const tier = levelTier(t)
      const dmg = towerStat(t, 'damage') * (t.dmgBuff || 1)
      for (const e of hits) {
        damageEnemy(e, dmg)
        if (kind === 'frost') applySlow(e, towerStat(t, 'slow'), towerStat(t, 'slowDur'))
        // Lvl power: the boom-thump grows a knockback that shoves the crowd back.
        else if (tier > 0) retreatAlongPath(e, 0.22 * tier * TILE * (e.def.slowImmune ? 0.25 : 1))
      }
      if (kind === 'frost') {
        ringEffect(t.cx, t.cy, rangePx, t.def.color, { width: 6 })
        burst(t.cx, t.cy, '#e3f5ff', { n: 14, speed: 120, life: 0.5, gravity: 25, glow: true })
        for (const e of hits) burst(e.x, e.y, '#bfefff', { n: 3, speed: 45, life: 0.4, gravity: 12 })
        sfx.freeze(); t.frostPulse = 0.3
      } else {
        // a heavy double shockwave + screen punch
        ringEffect(t.cx, t.cy, rangePx, t.def.color, { fill: true, width: 8 })
        ringEffect(t.cx, t.cy, rangePx * 0.6, lighten(t.def.color, 20), { width: 4, life: 0.3 })
        burst(t.cx, t.cy, lighten(t.def.color, 20), { n: 10, speed: 130, life: 0.4 })
        S.G.shake = Math.min(10, S.G.shake + 3)
        sfx.shoot(); t.frostPulse = 0.3
      }
      continue
    }

    const target = kind === 'snipe' ? findStrongest(t) : findTarget(t)
    if (!target) continue
    t.cd = towerStat(t, 'cooldown') * rate
    const dmg = towerStat(t, 'damage') * (t.dmgBuff || 1)
    const tier = levelTier(t)

    if (kind === 'beam') {
      fireFx(t, target)
      damageEnemy(target, dmg)
      // a glowing spark pellet that zips to the monster (no laser line)
      spawnBolt(t, target.x, target.y, 'spark', t.def.color)
      // Lvl power: the zap forks to extra monsters (one more per tier).
      if (tier > 0) {
        for (const e of extraTargets(t, tier, target)) {
          damageEnemy(e, dmg * 0.6)
          spawnBolt(t, e.x, e.y, 'spark', lighten(t.def.color, 15))
        }
      }
      sfx.shoot()
    } else if (kind === 'snipe') {
      fireFx(t, target)
      damageEnemy(target, dmg)
      // a thin, fast sniper tracer + a crosshair flash + a hard impact crack
      addBeam(t.cx, t.cy, target.x, target.y, t.def.color, 0.14, { width: 3 })
      ringEffect(target.x, target.y, target.def.radius + 10, '#fff', { width: 2, life: 0.22 })
      burst(target.x, target.y, '#fff', { n: 10, speed: 150, life: 0.3, glow: true })
      S.G.shake = Math.min(10, S.G.shake + 3)
      // Lvl power: the shot shatters into shrapnel that nicks nearby monsters.
      if (tier > 0) {
        const rad = (0.6 + 0.4 * tier) * TILE
        for (const e of enemiesInRange(target.x, target.y, rad, kind)) {
          if (e !== target) damageEnemy(e, dmg * 0.35)
        }
        ringEffect(target.x, target.y, rad, t.def.color, { width: 3 })
      }
      sfx.shoot()
    } else if (kind === 'suck') {
      // Lvl power: the vacuum grabs more monsters at once (one more per tier).
      const targets = findTargets(t, 1 + tier)
      for (const e of targets) {
        damageEnemy(e, dmg)
        applySlow(e, towerStat(t, 'slow'), 0.35)
        pullParticle(e.x, e.y, t.cx, t.cy, lighten(t.def.color, 30))
      }
      t.beamTargets = targets.filter(e => !e.dead)
    } else if (kind === 'splash') {
      fireFx(t, target)
      spawnSplashProjectile(t, target, dmg, tier)
      sfx.shoot()
    } else if (kind === 'burn') {
      fireFx(t, target)
      damageEnemy(target, dmg)
      applyBurn(target, towerStat(t, 'burnDps'), towerStat(t, 'burnDur'))
      // a lobbed fireball that bursts into embers where it lands
      spawnBolt(t, target.x, target.y, 'fire', '#ff8a3d')
      // Lvl power: the flames lick out and ignite nearby monsters too.
      if (tier > 0) {
        const rad = (0.7 + 0.3 * tier) * TILE
        for (const e of enemiesInRange(target.x, target.y, rad, kind)) {
          if (e === target) continue
          applyBurn(e, towerStat(t, 'burnDps') * 0.6, towerStat(t, 'burnDur'))
          burst(e.x, e.y, '#ff8a3d', { n: 3, speed: 50, life: 0.3, gravity: -25, glow: true })
        }
      }
      sfx.shoot()
    } else if (kind === 'poison') {
      fireFx(t, target)
      damageEnemy(target, dmg)
      applyPoison(target, towerStat(t, 'poisonDps'), towerStat(t, 'poisonDur'))
      applySlow(target, towerStat(t, 'slow'), 0.5)
      // a wobbly goo glob that splatters bubbles on impact
      spawnBolt(t, target.x, target.y, 'goo', lighten(t.def.color, 8))
      // Lvl power: the goo splashes onto nearby monsters too.
      if (tier > 0) {
        const rad = (0.7 + 0.3 * tier) * TILE
        for (const e of enemiesInRange(target.x, target.y, rad, kind)) {
          if (e === target) continue
          applyPoison(e, towerStat(t, 'poisonDps') * 0.6, towerStat(t, 'poisonDur'))
          for (let i = 0; i < 3; i++) bubbleAt(e.x, e.y, lighten(t.def.color, 25))
        }
        ringEffect(target.x, target.y, rad, t.def.color, { width: 3 })
      }
      sfx.shoot()
    } else if (kind === 'chain') {
      fireFx(t, target)
      chainZap(t, dmg, target)
      sfx.shoot()
    } else if (kind === 'multishot') {
      fireFx(t, target)
      const targets = findTargets(t, towerStat(t, 'shots'))
      const cols = ['#ff6b8b', '#ffd34d', '#7be38c', '#5bc8ff', '#c065ff']
      targets.forEach((e, i) => {
        const col = cols[i % cols.length]
        damageEnemy(e, dmg)
        // curvy rainbow ribbons — each waved a little differently
        addBeam(t.cx, t.cy, e.x, e.y, col, 0.16, { style: 'wavy', amp: 9, phase: i * 1.3, width: 5 })
        burst(e.x, e.y, col, { n: 4, speed: 80, life: 0.25, glow: true })
      })
      sfx.shoot()
    } else if (kind === 'bounty') {
      fireFx(t, target)
      damageEnemy(target, dmg)
      // a tumbling gold coin lobbed at the monster
      spawnBolt(t, target.x, target.y, 'coin', '#ffe14d')
      payBounty(t, target)
      // Lvl power: extra coins net more monsters (and more treasure).
      if (tier > 0) {
        for (const e of extraTargets(t, tier, target)) {
          damageEnemy(e, dmg * 0.6)
          spawnBolt(t, e.x, e.y, 'coin', '#ffe14d')
          payBounty(t, e)
        }
      }
      sfx.shoot()
    } else if (kind === 'pull') {
      fireFx(t, target)
      // Lvl power: the tornado whirls more monsters back at once.
      const targets = tier > 0 ? findTargets(t, 1 + tier) : [target]
      for (const e of targets) {
        damageEnemy(e, dmg)
        // big bosses are too heavy to whirl far
        retreatAlongPath(e, towerStat(t, 'pull') * TILE * (e.def.slowImmune ? 0.25 : 1))
        applySlow(e, 0.6, 0.4)
        addBeam(t.cx, t.cy, e.x, e.y, t.def.color, 0.12, { style: 'bolt', jag: 6, width: 4 })
        ringEffect(e.x, e.y, e.def.radius + 8, t.def.color, { width: 3 })
        swirlAt(e.x, e.y, lighten(t.def.color, 20))
      }
      sfx.shoot()
    }
  }
}

// A clean catch from a bounty helper pays a little extra treasure.
function payBounty(t, e) {
  if (!e.dead) return
  const bonus = Math.round(towerStat(t, 'bounty'))
  S.G.coins += bonus
  floatText(e.x, e.y - 26, `+${bonus}`, '#ffe14d', 16)
}

// Lob a boom that arcs toward the target and explodes on landing. `cluster` is
// the splash helper's milestone power: extra mini-blasts ringing the impact.
function spawnSplashProjectile(t, target, dmg, cluster) {
  const dist = Math.hypot(target.x - t.cx, target.y - t.cy)
  const speed = 9 * TILE
  S.G.projectiles.push({
    sx: t.cx, sy: t.cy, x: t.cx, y: t.cy,
    tx: target.x, ty: target.y,
    prog: 0, dur: Math.max(0.18, dist / speed),
    arc: Math.min(70, dist * 0.28),
    spin: 0, trail: 0,
    dmg, radius: towerStat(t, 'splashRadius') * TILE,
    color: t.def.color, kind: 'splash', cluster,
  })
}

// A purely-cosmetic flying shot (damage is already applied at fire time). Each
// `style` flies and lands differently so no two helper kinds look alike:
//   spark – a fast straight pellet of light   (beam helpers)
//   fire  – a lobbed fireball                  (burn helpers)
//   goo   – a lobbed wobbly glob               (poison helpers)
//   coin  – a tumbling gold coin               (bounty helpers)
function spawnBolt(t, tx, ty, style, color) {
  const dist = Math.hypot(tx - t.cx, ty - t.cy)
  const speedTiles = style === 'spark' ? 20 : style === 'fire' ? 15 : style === 'coin' ? 14 : 13
  const arc = (style === 'goo' || style === 'coin') ? Math.min(38, dist * 0.18) : 0
  S.G.projectiles.push({
    sx: t.cx, sy: t.cy, x: t.cx, y: t.cy,
    tx, ty,
    prog: 0, dur: Math.max(0.07, dist / (speedTiles * TILE)),
    arc, spin: 0, trail: 0,
    visual: true, style, color, kind: t.def.kind, dmg: 0, radius: 0,
  })
}

function chainZap(t, dmg, first) {
  const hit = new Set()
  const count = towerStat(t, 'chainCount')
  const range = towerStat(t, 'chainRange') * TILE
  const fall = towerStat(t, 'chainFalloff')
  let cur = first
  let from = { x: t.cx, y: t.cy }
  let d = dmg
  for (let i = 0; i < count && cur; i++) {
    // jagged lightning hop with a little electric spark where it strikes
    addBeam(from.x, from.y, cur.x, cur.y, t.def.color, 0.14, { style: 'bolt', jag: 9, width: 4 })
    burst(cur.x, cur.y, t.def.color, { n: 4, speed: 90, life: 0.2, glow: true })
    damageEnemy(cur, d)
    hit.add(cur)
    from = { x: cur.x, y: cur.y }
    // next nearest unhit enemy within chain range
    let best = null
    let bd = range * range
    for (const e of S.G.enemies) {
      if (hit.has(e) || !isTargetable(e, 'chain')) continue
      const dx = e.x - cur.x
      const dy = e.y - cur.y
      const dd = dx * dx + dy * dy
      if (dd <= bd) { bd = dd; best = e }
    }
    cur = best
    d *= fall
  }
}

function updateProjectiles(dt) {
  for (const p of S.G.projectiles) {
    p.prog += dt / p.dur
    p.spin += dt * 12
    if (p.prog >= 1) {
      p.x = p.tx; p.y = p.ty
      explode(p)
      p.done = true
    } else {
      p.x = p.sx + (p.tx - p.sx) * p.prog
      p.y = p.sy + (p.ty - p.sy) * p.prog - Math.sin(p.prog * Math.PI) * p.arc
      // a trail wisp puffing off the shot as it flies — tinted to its style
      p.trail += dt
      if (p.trail > 0.03) {
        p.trail = 0
        const tc = p.style === 'fire' ? 'rgba(255,140,60,0.75)'
          : p.style === 'coin' ? 'rgba(255,225,120,0.85)'
          : p.style === 'goo' || p.style === 'spark' ? p.color
          : 'rgba(225,225,225,0.8)'
        S.G.particles.push({
          kind: 'puff', x: p.x, y: p.y,
          vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
          life: 0.3, max: 0.3, r: p.style === 'spark' ? 3 : 4, color: tc,
          grav: p.style === 'fire' ? -30 : 0, glow: !!p.style,
        })
      }
    }
  }
  if (S.G.projectiles.some(p => p.done)) {
    S.G.projectiles = S.G.projectiles.filter(p => !p.done)
  }
}

// The impact burst when a cosmetic shot lands — particles themed to the shot so
// a fireball scatters embers, a goo glob pops bubbles, a coin showers sparkles,
// and a light pellet flashes a little starburst.
function splatBolt(p) {
  if (p.style === 'fire') {
    burst(p.x, p.y, '#ff8a3d', { n: 8, speed: 90, life: 0.4, gravity: -25, glow: true })
    burst(p.x, p.y, '#ffd34d', { n: 4, speed: 60, life: 0.3, gravity: -15 })
    ringEffect(p.x, p.y, TILE * 0.45, '#ff8a3d', { width: 3, life: 0.25 })
  } else if (p.style === 'goo') {
    for (let i = 0; i < 7; i++) bubbleAt(p.x, p.y, p.color)
    burst(p.x, p.y, p.color, { n: 6, speed: 70, life: 0.3, glow: true })
    ringEffect(p.x, p.y, TILE * 0.4, p.color, { width: 3, life: 0.25 })
  } else if (p.style === 'coin') {
    burst(p.x, p.y, '#ffe14d', { n: 9, speed: 110, life: 0.4, gravity: 60, glow: true })
    ringEffect(p.x, p.y, TILE * 0.35, '#ffe14d', { width: 3, life: 0.22 })
  } else {
    // spark pellet (beam helpers) — a bright little starburst flash
    burst(p.x, p.y, '#fff', { n: 6, speed: 120, life: 0.22, glow: true })
    burst(p.x, p.y, p.color, { n: 6, speed: 80, life: 0.3, glow: true })
    ringEffect(p.x, p.y, TILE * 0.3, p.color, { width: 2, life: 0.2 })
  }
}

function splashHurt(x, y, radius, dmg, kind) {
  const r2 = radius * radius
  for (const e of S.G.enemies) {
    if (!isTargetable(e, kind)) continue
    const dx = e.x - x
    const dy = e.y - y
    if (dx * dx + dy * dy <= r2) damageEnemy(e, dmg)
  }
}

function explode(p) {
  // cosmetic shots just spray a little impact splatter where they land
  if (p.visual) { splatBolt(p); return }
  // a filled flash ring + a fat debris spray + a bright core puff = a real BOOM
  ringEffect(p.x, p.y, p.radius, p.color, { fill: true, width: 6 })
  burst(p.x, p.y, p.color, { n: 12, speed: 130, life: 0.4, r: 6 })
  burst(p.x, p.y, '#fff', { n: 6, speed: 90, life: 0.25, glow: true })
  S.G.shake = Math.min(12, S.G.shake + 5)
  splashHurt(p.x, p.y, p.radius, p.dmg, p.kind)
  // Lvl power: clustered after-blasts ring the main impact.
  for (let i = 0; i < (p.cluster || 0); i++) {
    const a = (i / p.cluster) * Math.PI * 2 + 0.4
    const cx = p.x + Math.cos(a) * p.radius * 0.8
    const cy = p.y + Math.sin(a) * p.radius * 0.8
    ringEffect(cx, cy, p.radius * 0.55, p.color, { fill: true, width: 4 })
    burst(cx, cy, p.color, { n: 6, speed: 90, life: 0.3 })
    splashHurt(cx, cy, p.radius * 0.55, p.dmg * 0.4, p.kind)
  }
}

// ===========================================================================
// Placement / selection input
// ===========================================================================
function cellBuildable(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false
  if (S.G.level.pathTiles.has(`${c},${r}`)) return false
  if (S.G.occupied.has(`${c},${r}`)) return false
  return true
}

function towerAt(c, r) {
  return S.G.towers.find(t => t.c === c && t.r === r) || null
}

function placeTower(c, r) {
  const key = S.G.selectedType
  if (!key) return
  const def = TOWERS[key]
  if (!cellBuildable(c, r)) { sfx.hurt(); return }
  if (S.G.coins < def.cost) { sfx.hurt(); return }
  S.G.coins -= def.cost
  S.G.towers.push({
    key, def,
    c, r,
    cx: c * TILE + TILE / 2,
    cy: r * TILE + TILE / 2,
    level: 1,
    cd: def.kind === 'bank' ? def.cooldown : 0,
    totalSpent: def.cost,
    beamTo: null,
    beamTargets: null,
    frostPulse: 0,
    firePulse: 0,
    aim: null,
    disabledTimer: 0,
  })
  S.G.occupied.add(`${c},${r}`)
  sfx.place()
  // Drop the selection after placing so a tap on the field doesn't keep dropping
  // more helpers — the kid picks a helper again for the next one.
  S.G.selectedType = null
  refreshPalette()
}

function selectPlacedTower(t) {
  S.G.selectedTower = t
  S.G.selectedType = null
  refreshPalette()
  showActionBar(t)
}

// ---- Action bar (upgrade / sell) ----
function showActionBar(t) {
  const upgradable = t.level < MAX_LEVEL
  const upCost = upgradable ? upgradeCost(t) : 0
  const refund = Math.round(t.totalSpent * 0.6)
  actionBar.innerHTML = `
    ${upgradable
      ? `<button class="up" ${S.G.coins < upCost ? 'disabled' : ''} data-act="up">⬆️ Lvl ${t.level + 1} 🪙${upCost}</button>`
      : `<button class="up" disabled>⭐ Max Lvl ${MAX_LEVEL}</button>`}
    <button class="sell" data-act="sell">🗑️ Sell 🪙${refund}</button>
  `
  twemojify(actionBar)
  actionBar.classList.remove('hidden')
  for (const b of actionBar.querySelectorAll('button')) {
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      if (b.dataset.act === 'up') upgradeTower(t)
      else if (b.dataset.act === 'sell') sellTower(t)
    })
  }
  positionActionBar(t)
}
function hideActionBar() {
  actionBar.classList.add('hidden')
}
function positionActionBar(t) {
  actionBar.style.left = `${(t.cx / FIELD_W) * 100}%`
  actionBar.style.top = `${(t.cy / FIELD_H) * 100}%`
}
function upgradeTower(t) {
  if (t.level >= MAX_LEVEL) return
  const cost = upgradeCost(t)
  if (S.G.coins < cost) { sfx.hurt(); return }
  S.G.coins -= cost
  t.level++
  t.totalSpent += cost
  sfx.upgrade()
  floatText(t.cx, t.cy - 18, `LEVEL ${t.level}!`, '#7be38c', 18)
  // levels 3 + 5 unlock a brand-new power (see levelTier) — make a fuss about it
  if (t.level === 3 || t.level === 5) {
    floatText(t.cx, t.cy - 42, '✨ NEW POWER!', '#ffd34d', 16)
    burst(t.cx, t.cy, '#ffd34d', { n: 12, speed: 110, life: 0.6, gravity: -30, glow: true })
  }
  showActionBar(t)
  refreshPalette()
}
function sellTower(t) {
  const refund = Math.round(t.totalSpent * 0.6)
  S.G.coins += refund
  S.G.occupied.delete(`${t.c},${t.r}`)
  S.G.towers = S.G.towers.filter(x => x !== t)
  S.G.selectedTower = null
  hideActionBar()
  sfx.coin()
  floatText(t.cx, t.cy, `+${refund}`, '#ffd34d', 18)
  refreshPalette()
}

export {
  MAX_LEVEL, towerStat, cellBuildable, placeTower, towerAt, selectPlacedTower, hideActionBar, positionActionBar, updateTowers, updateProjectiles,
}
