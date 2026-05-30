// Helpers (towers): leveling/stat growth, targeting, every 'kind' of attack,
// projectiles, placement and the select/upgrade/sell action bar.
import { S } from './state.js'
import { TOWERS, TILE, COLS, ROWS, FIELD_W, FIELD_H } from '../content.js'
import { sfx } from '../audio.js'
import { twemojify } from '../emoji.js'
import { actionBar } from './dom.js'
import { floatText, addBeam, ringEffect } from './effects.js'
import { damageEnemy, applySlow, applyBurn, applyPoison, retreatAlongPath, isTargetable } from './enemies.js'
import { refreshPalette } from './ui.js'


// ===========================================================================
// Towers
// ===========================================================================
// Leveling: every helper can be upgraded all the way to MAX_LEVEL. Rather than
// authoring a stat block per level, we grow the base stat by a per-stat factor
// for each level above 1, so adding new helpers needs no upgrade tables. Some
// stats get *smaller* as they grow (cooldown → shoots faster; slow → stronger).
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
      t.cd = towerStat(t, 'cooldown') * rate
      sfx.coin()
      continue
    }

    if (kind === 'frost' || kind === 'pulse') {
      const rangePx = towerStat(t, 'range') * TILE
      const hits = enemiesInRange(t.cx, t.cy, rangePx, kind)
      if (hits.length === 0) continue
      t.cd = towerStat(t, 'cooldown') * rate
      const dmg = towerStat(t, 'damage') * (t.dmgBuff || 1)
      for (const e of hits) {
        damageEnemy(e, dmg)
        if (kind === 'frost') applySlow(e, towerStat(t, 'slow'), towerStat(t, 'slowDur'))
      }
      ringEffect(t.cx, t.cy, rangePx, t.def.color)
      if (kind === 'frost') { sfx.freeze(); t.frostPulse = 0.3 }
      else { sfx.shoot(); t.frostPulse = 0.3 }
      continue
    }

    const target = kind === 'snipe' ? findStrongest(t) : findTarget(t)
    if (!target) continue
    t.cd = towerStat(t, 'cooldown') * rate
    const dmg = towerStat(t, 'damage') * (t.dmgBuff || 1)

    if (kind === 'beam' || kind === 'snipe') {
      damageEnemy(target, dmg)
      addBeam(t.cx, t.cy, target.x, target.y, t.def.color, 0.12)
      sfx.shoot()
    } else if (kind === 'suck') {
      damageEnemy(target, dmg)
      applySlow(target, towerStat(t, 'slow'), 0.35)
      t.beamTo = target
    } else if (kind === 'splash') {
      S.G.projectiles.push({
        x: t.cx, y: t.cy,
        tx: target.x, ty: target.y,
        speed: 9 * TILE,
        dmg,
        radius: towerStat(t, 'splashRadius') * TILE,
        color: t.def.color,
        kind: 'splash',
      })
      sfx.shoot()
    } else if (kind === 'burn') {
      damageEnemy(target, dmg)
      applyBurn(target, towerStat(t, 'burnDps'), towerStat(t, 'burnDur'))
      addBeam(t.cx, t.cy, target.x, target.y, '#ff8a3d', 0.12)
      sfx.shoot()
    } else if (kind === 'poison') {
      damageEnemy(target, dmg)
      applyPoison(target, towerStat(t, 'poisonDps'), towerStat(t, 'poisonDur'))
      applySlow(target, towerStat(t, 'slow'), 0.5)
      addBeam(t.cx, t.cy, target.x, target.y, '#c065ff', 0.12)
      sfx.shoot()
    } else if (kind === 'chain') {
      chainZap(t, dmg, target)
      sfx.shoot()
    } else if (kind === 'multishot') {
      const targets = findTargets(t, towerStat(t, 'shots'))
      const cols = ['#ff6b8b', '#ffd34d', '#7be38c', '#5bc8ff', '#c065ff']
      targets.forEach((e, i) => {
        damageEnemy(e, dmg)
        addBeam(t.cx, t.cy, e.x, e.y, cols[i % cols.length], 0.12)
      })
      sfx.shoot()
    } else if (kind === 'bounty') {
      damageEnemy(target, dmg)
      addBeam(t.cx, t.cy, target.x, target.y, t.def.color, 0.12)
      // a clean catch pays a little extra treasure
      if (target.dead) {
        const bonus = Math.round(towerStat(t, 'bounty'))
        S.G.coins += bonus
        floatText(target.x, target.y - 26, `+${bonus}`, '#ffe14d', 16)
      }
      sfx.shoot()
    } else if (kind === 'pull') {
      damageEnemy(target, dmg)
      // big bosses are too heavy to whirl far
      retreatAlongPath(target, towerStat(t, 'pull') * TILE * (target.def.slowImmune ? 0.25 : 1))
      applySlow(target, 0.6, 0.4)
      addBeam(t.cx, t.cy, target.x, target.y, t.def.color, 0.12)
      ringEffect(target.x, target.y, target.def.radius + 8, t.def.color)
      sfx.shoot()
    }
  }
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
    addBeam(from.x, from.y, cur.x, cur.y, t.def.color, 0.14)
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
    const dx = p.tx - p.x
    const dy = p.ty - p.y
    const d = Math.hypot(dx, dy)
    const step = p.speed * dt
    if (d <= step) {
      p.x = p.tx; p.y = p.ty
      explode(p)
      p.done = true
    } else {
      p.x += (dx / d) * step
      p.y += (dy / d) * step
    }
  }
  if (S.G.projectiles.some(p => p.done)) {
    S.G.projectiles = S.G.projectiles.filter(p => !p.done)
  }
}

function explode(p) {
  ringEffect(p.x, p.y, p.radius, p.color)
  S.G.shake = Math.min(10, S.G.shake + 4)
  const r2 = p.radius * p.radius
  for (const e of S.G.enemies) {
    if (!isTargetable(e, p.kind)) continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    if (dx * dx + dy * dy <= r2) damageEnemy(e, p.dmg)
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
    frostPulse: 0,
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
