// Waves, spawning and everything the monsters do: movement, damage, deaths,
// splits, status effects (burn/poison/slow) and the per-area boss tricks.
import { S, isCozy } from './state.js'
import { ENEMIES, TILE, FIELD_W, FIELD_H } from '../content.js'
import { sfx } from '../audio.js'
import { floatText, popEffect, ringEffect, emberAt } from './effects.js'
import { win, lose } from './screens.js'
import { showPrepBanner, hidePrepBanner } from './ui.js'
import { maybeDropSparkle } from './abilities.js'
import { avatarReact } from '../cosmetics.js'


// ===========================================================================
// Waves & spawning
// ===========================================================================
// Cap on-screen monsters so a long iPad sandbox session never bogs down.
const MAX_ENEMIES = 90

function startWave() {
  // Endless rooms generate their wave procedurally; story rooms read the fixed
  // list. waveGen never runs out, so the Start/Next-Wave flow loops forever.
  const wave = S.G.level.waveGen
    ? S.G.level.waveGen(S.G.waveIndex)
    : S.G.level.waves[S.G.waveIndex]
  S.G.spawnQueue = []
  for (const group of wave) {
    for (let i = 0; i < group.count; i++) {
      S.G.spawnQueue.push({ type: group.type, gap: group.spacing })
    }
  }
  S.G.phase = 'spawning'
  S.G.started = true
  S.G.spawnTimer = 0
  S.G.nextGap = 0.3
  hidePrepBanner()
  sfx.wave()
}

function makeEnemy(type, opts = {}) {
  const def = ENEMIES[type]
  const hp = Math.round(def.hp * S.G.level.hpScale)
  const wp = S.G.level.waypoints
  return {
    type, def,
    hp, maxHp: hp,
    x: opts.x ?? wp[0].x,
    y: opts.y ?? wp[0].y,
    seg: opts.seg ?? 1,
    dist: opts.dist ?? 0,
    slowTimer: 0, slowFactor: 1,
    burnTimer: 0, burnDps: 0,
    poisonTimer: 0, poisonDps: 0,
    shield: def.shield || 0,
    bobPhase: Math.random() * Math.PI * 2,
    facing: opts.facing ?? 1,
    // boss state
    boss: def.boss || null,
    summonTimer: def.boss?.summon ? def.boss.summon.interval : 0,
    hexTimer: def.boss?.hex ? def.boss.hex.interval : 0,
    blinkTimer: def.boss?.blink ? def.boss.blink.interval : 0,
    phaseTimer: def.boss?.phaseShield ? def.boss.phaseShield.interval : 0,
    invuln: 0,
    enraged: false,
  }
}

function spawnEnemy(type) {
  S.G.enemies.push(makeEnemy(type))
}

function updateSpawning(dt) {
  if (S.G.phase !== 'spawning') return
  S.G.spawnTimer += dt
  if (S.G.spawnQueue.length && S.G.spawnTimer >= S.G.nextGap) {
    // Memory bound: if the field is already crowded, hold the spawn (don't drop
    // it) so the queue still empties — just paced out — and we stay under cap.
    if (S.G.enemies.length >= MAX_ENEMIES) return
    S.G.spawnTimer = 0
    const next = S.G.spawnQueue.shift()
    spawnEnemy(next.type)
    S.G.nextGap = S.G.spawnQueue.length ? S.G.spawnQueue[0].gap : 0
  }
  if (S.G.spawnQueue.length === 0) S.G.phase = 'cleanup'
}

function checkWaveCleared() {
  if (S.G.phase !== 'cleanup') return
  if (S.G.enemies.length > 0) return
  // Wave bonus!
  const bonus = 25 + S.G.waveIndex * 10
  S.G.coins += bonus
  floatText(FIELD_W / 2, FIELD_H / 2, `Wave clear! +${bonus}`, '#ffd34d', 28)
  sfx.coin()
  S.G.waveIndex++
  if (S.G.endless) {
    // Endless sandbox: never "done", never win() — just queue the next
    // procedural wave and wait for the kid's tap (press-to-advance).
    S.G.phase = 'prep'
    showPrepBanner()
  } else if (S.G.waveIndex >= S.G.waveCount) {
    S.G.phase = 'done'
    win()
  } else {
    S.G.phase = 'prep'
    showPrepBanner()
  }
}

// ===========================================================================
// Enemies
// ===========================================================================
function updateEnemies(dt) {
  const wp = S.G.level.waypoints
  for (const e of S.G.enemies) {
    if (e.dead) continue
    // damage-over-time + healing
    if (e.burnTimer > 0) {
      e.burnTimer -= dt
      damageEnemy(e, e.burnDps * dt, { trueDmg: true, silent: true })
      if (Math.random() < dt * 14) emberAt(e.x, e.y, '#ff8a3d')
    }
    if (!e.dead && e.poisonTimer > 0) {
      e.poisonTimer -= dt
      damageEnemy(e, e.poisonDps * dt, { trueDmg: true, silent: true })
      if (Math.random() < dt * 12) emberAt(e.x, e.y, '#b86bff')
    }
    if (!e.dead && e.def.regen && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.def.regen * dt)
    }
    if (e.dead) continue

    // boss tricks (summon / hex / enrage / blink / phase-shield)
    if (e.boss) updateBoss(e, dt)
    if (e.leaked) continue // a blink may have pushed it off the end

    // Nap (💤): freeze MOVEMENT only — towers keep firing, DoT keeps ticking,
    // which feels powerful and safe. Bosses freeze too (fair).
    if (S.G.freezeTimer > 0) continue

    let eff = 1
    if (e.slowTimer > 0) { e.slowTimer -= dt; eff = e.slowFactor }
    const bossMult = e.enraged ? e.boss.enrage.mult : 1
    const speed = e.def.speed * eff * bossMult * TILE
    let remain = speed * dt
    while (remain > 0 && e.seg < wp.length) {
      const tx = wp[e.seg].x
      const ty = wp[e.seg].y
      const dx = tx - e.x
      const dy = ty - e.y
      const d = Math.hypot(dx, dy)
      if (d <= remain) {
        e.x = tx; e.y = ty
        e.dist += d
        remain -= d
        e.seg++
      } else {
        e.x += (dx / d) * remain
        e.y += (dy / d) * remain
        e.facing = dx >= 0 ? 1 : -1
        e.dist += remain
        remain = 0
      }
    }
    if (e.seg >= wp.length) e.leaked = true
  }
  // Handle leaks
  let leaked = 0
  const leakPts = []
  S.G.enemies = S.G.enemies.filter(e => {
    if (e.leaked) { leaked++; leakPts.push({ x: e.x, y: e.y }); return false }
    return true
  })
  if (leaked > 0) {
    // §6 Cozy vibe reuses the §5 no-fail float-away path — never costs a life.
    if (S.G.endless || isCozy()) {
      // No-fail Backyard: no lives lost, no game-over. The monster just floats
      // away happily with a little giggle cue — pure delight, zero pressure.
      for (const p of leakPts) {
        popEffect(p.x, p.y, '#ffd34d')
        floatText(p.x, p.y - 10, 'bye! 👋', '#ffd34d', 18)
      }
      avatarReact('wave') // mascot waves the friend goodbye
    } else {
      S.G.lives -= leaked
      S.G.shake = Math.min(14, S.G.shake + 8)
      S.G.flash = 0.35
      sfx.hurt()
      avatarReact('hide') // mascot covers its eyes — oh no, one got by!
      if (S.G.lives <= 0) { S.G.lives = 0; lose() }
    }
  }
}

function damageEnemy(e, dmg, opts) {
  if (e.dead) return
  // boss phase shield — totally invincible for a moment
  if (e.invuln > 0) {
    if (Math.random() < 0.25) ringEffect(e.x, e.y, e.def.radius + 4, '#8cff9e')
    return
  }
  // shield bubble eats whole hits (but not DoT ticks)
  if (e.shield > 0 && !(opts && opts.trueDmg)) {
    e.shield--
    ringEffect(e.x, e.y, e.def.radius + 6, '#8cff9e')
    return
  }
  let d = dmg
  if (e.def.armor && !(opts && opts.trueDmg)) d = Math.max(1, d - e.def.armor)
  e.hp -= d
  if (e.hp <= 0) killEnemy(e, opts)
}

function killEnemy(e, opts) {
  if (e.dead) return
  e.dead = true
  const reward = Math.round(e.def.reward * S.G.level.rewardScale)
  S.G.coins += reward
  popEffect(e.x, e.y, e.def.color)
  floatText(e.x, e.y - 10, `+${reward}`, '#ffd34d', 18)
  if (!(opts && opts.silent)) sfx.pop()
  maybeDropSparkle(e.x, e.y) // §2a: a caught monster may leave a ✨ to collect
  // split into little ones
  if (e.def.split) {
    const { type, count } = e.def.split
    for (let i = 0; i < count; i++) {
      const jitter = (i - (count - 1) / 2) * 8
      const child = makeEnemy(type, {
        x: e.x, y: e.y + jitter,
        seg: e.seg, dist: e.dist, facing: e.facing,
      })
      S.G.enemies.push(child)
    }
  }
}

// --- Boss abilities (each boss uses a different trick) ---
function updateBoss(e, dt) {
  const b = e.boss
  // Summon: periodically call little minions that continue down the path.
  if (b.summon) {
    e.summonTimer -= dt
    if (e.summonTimer <= 0) {
      e.summonTimer = b.summon.interval
      for (let i = 0; i < b.summon.count; i++) {
        const jitter = (i - (b.summon.count - 1) / 2) * 10
        S.G.enemies.push(makeEnemy(b.summon.type, { x: e.x, y: e.y + jitter, seg: e.seg, dist: e.dist, facing: e.facing }))
      }
      floatText(e.x, e.y - e.def.radius - 18, 'Minions!', '#c9a0ff', 18)
      ringEffect(e.x, e.y, e.def.radius + 10, '#c9a0ff')
    }
  }
  // Hex: freeze every helper near the boss for a short while.
  if (b.hex) {
    e.hexTimer -= dt
    if (e.hexTimer <= 0) {
      e.hexTimer = b.hex.interval
      const rPx = b.hex.radius * TILE
      let any = false
      for (const t of S.G.towers) {
        const dx = t.cx - e.x, dy = t.cy - e.y
        if (dx * dx + dy * dy <= rPx * rPx) { t.disabledTimer = b.hex.dur; any = true }
      }
      if (any) { floatText(e.x, e.y - e.def.radius - 18, '❄️ Hex!', '#9be8ff', 18); ringEffect(e.x, e.y, rPx, '#9be8ff'); sfx.freeze() }
    }
  }
  // Enrage: speed up once badly hurt (handled in the movement code via mult).
  if (b.enrage && !e.enraged && e.hp < e.maxHp * b.enrage.hpFrac) {
    e.enraged = true
    floatText(e.x, e.y - e.def.radius - 18, '😡 ENRAGED!', '#ff6b5a', 20)
    ringEffect(e.x, e.y, e.def.radius + 14, '#ff6b5a')
    S.G.shake = Math.min(14, S.G.shake + 8)
  }
  // Blink: teleport forward along the path.
  if (b.blink) {
    e.blinkTimer -= dt
    if (e.blinkTimer <= 0) {
      e.blinkTimer = b.blink.interval
      popEffect(e.x, e.y, e.def.color)
      advanceAlongPath(e, b.blink.dist * TILE)
      popEffect(e.x, e.y, e.def.color)
      floatText(e.x, e.y - e.def.radius - 18, '✨ Blink!', '#ffd34d', 18)
    }
  }
  // Phase shield: become invincible for a couple of seconds now and then.
  if (b.phaseShield) {
    if (e.invuln > 0) {
      e.invuln -= dt
    } else {
      e.phaseTimer -= dt
      if (e.phaseTimer <= 0) {
        e.phaseTimer = b.phaseShield.interval
        e.invuln = b.phaseShield.dur
        floatText(e.x, e.y - e.def.radius - 18, '🛡️ Shield!', '#8cff9e', 18)
      }
    }
  }
}

function advanceAlongPath(e, dist) {
  const wp = S.G.level.waypoints
  let remain = dist
  while (remain > 0 && e.seg < wp.length) {
    const dx = wp[e.seg].x - e.x
    const dy = wp[e.seg].y - e.y
    const d = Math.hypot(dx, dy)
    if (d <= remain) { e.x = wp[e.seg].x; e.y = wp[e.seg].y; e.dist += d; remain -= d; e.seg++ }
    else { e.x += (dx / d) * remain; e.y += (dy / d) * remain; e.dist += remain; remain = 0 }
  }
  if (e.seg >= wp.length) e.leaked = true
}

// Tornado (🌪️) whirls a monster BACK toward the entrance — the opposite of
// advanceAlongPath: walk back through the waypoints it already passed.
function retreatAlongPath(e, dist) {
  const wp = S.G.level.waypoints
  let remain = dist
  while (remain > 0 && e.seg > 1) {
    const px = wp[e.seg - 1].x
    const py = wp[e.seg - 1].y
    const dx = px - e.x
    const dy = py - e.y
    const d = Math.hypot(dx, dy)
    if (d <= remain) {
      e.x = px; e.y = py; e.dist = Math.max(0, e.dist - d); remain -= d; e.seg--
    } else {
      e.x += (dx / d) * remain; e.y += (dy / d) * remain
      e.dist = Math.max(0, e.dist - remain); remain = 0
    }
  }
}

// ===========================================================================
// Magic Button (§2) engine helpers — drive the abilities, reusing the path /
// pop / kill semantics rather than reaching into ability internals.
// ===========================================================================
// 🧹 Sweep: shove EVERY monster back along its path by distPx.
function sweepAllBack(distPx) {
  for (const e of S.G.enemies) {
    if (e.dead || e.leaked) continue
    retreatAlongPath(e, distPx)
    ringEffect(e.x, e.y, e.def.radius + 6, '#9be8ff')
  }
}

// 💤 Nap: freeze all monster MOVEMENT for `seconds` (ticked down in main loop).
function freezeAll(seconds) {
  S.G.freezeTimer = Math.max(S.G.freezeTimer, seconds)
  for (const e of S.G.enemies) {
    if (!e.dead) ringEffect(e.x, e.y, e.def.radius + 6, '#cfe9ff')
  }
}

// 🌟 Big Zap: catch every NON-boss monster on screen, awarding coins + pop FX
// just like a normal catch. Bosses are immune (fair).
function clearNonBoss() {
  for (const e of S.G.enemies) {
    if (e.dead || e.boss) continue
    killEnemy(e, { silent: true })
  }
}

// 🌊 Wave (§2b): push back monsters whose position is near the swiped segment
// from→to. `distPx` = pushback amount, `bandPx` = how close counts as "hit".
function pushNearLine(from, to, distPx, bandPx) {
  const ax = from.x, ay = from.y
  const bx = to.x, by = to.y
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let any = false
  for (const e of S.G.enemies) {
    if (e.dead || e.leaked) continue
    // distance from enemy to the segment
    let t = len2 > 0 ? ((e.x - ax) * dx + (e.y - ay) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const px = ax + dx * t, py = ay + dy * t
    const dd = Math.hypot(e.x - px, e.y - py)
    if (dd <= bandPx) {
      retreatAlongPath(e, distPx)
      ringEffect(e.x, e.y, e.def.radius + 8, '#7fd8ff')
      any = true
    }
  }
  // With a single path a swipe might miss everyone; still give a little nudge to
  // the lead pack so the cast never feels dead.
  if (!any) {
    for (const e of S.G.enemies) {
      if (!e.dead && !e.leaked) { retreatAlongPath(e, distPx * 0.6); ringEffect(e.x, e.y, e.def.radius + 8, '#7fd8ff') }
    }
  }
}

function applyBurn(e, dps, dur) {
  e.burnDps = Math.max(e.burnDps, dps)
  e.burnTimer = Math.max(e.burnTimer, dur)
}
function applyPoison(e, dps, dur) {
  e.poisonDps = Math.max(e.poisonDps, dps)
  e.poisonTimer = Math.max(e.poisonTimer, dur)
}
function applySlow(e, factor, dur) {
  if (e.def.slowImmune) return // bosses that shrug off frost
  e.slowFactor = Math.min(e.slowFactor === 1 ? factor : Math.min(e.slowFactor, factor), factor)
  e.slowTimer = Math.max(e.slowTimer, dur)
}

function removeDead() {
  if (S.G.enemies.some(e => e.dead)) {
    S.G.enemies = S.G.enemies.filter(e => !e.dead)
  }
}

export {
  startWave, updateSpawning, updateEnemies, checkWaveCleared, removeDead, damageEnemy, applySlow, applyBurn, applyPoison, retreatAlongPath,
  sweepAllBack, freezeAll, clearNonBoss, pushNearLine,
}
