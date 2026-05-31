// Waves, spawning and everything the monsters do: movement, damage, deaths,
// splits, status effects (burn/poison/slow) and the per-area boss tricks.
import { S, isCozy } from './state.js'
import { ENEMIES, TILE, FIELD_W, FIELD_H } from '../content.js'
import { sfx } from '../audio.js'
import { floatText, popEffect, ringEffect, emberAt } from './effects.js'
import { beginTidyUp, lose } from './screens.js'
import { showPrepBanner, hidePrepBanner } from './ui.js'


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
  // §4 — each enemy walks ONE lane variant. Default to lane 0 (the only lane in
  // single-path rooms). Split children / boss summons pass the parent's pathId.
  const pathId = opts.pathId ?? 0
  const wp = S.G.level.paths[pathId].waypoints
  return {
    type, def,
    pathId,
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
    // §3 new powers — per-instance timers/flags (each only matters if its def has it)
    speedburstT: 0,                 // ticks up; cycles idle↔burst every `period`
    healT: 0,                       // accumulates toward a 1s heal tick
    phaseT: def.phase ? def.phase.period : 0, // time until next phase toggle
    phased: false,                  // currently translucent + ignoring one kind
    burrowT: def.burrow ? 2.0 : 0,  // time until next burrow toggle
    burrowed: false,                // currently underground + untargetable
    shielderT: def.shielder ? 0.4 : 0, // grants a bubble to the friend behind soon after spawn
  }
}

function spawnEnemy(type) {
  // §4 — alternate lanes across spawns for an even split (single-lane rooms
  // always resolve to lane 0). spawnCount lives on G and persists across waves.
  const lanes = S.G.level.paths.length
  const pathId = lanes > 1 ? (S.G.spawnCount++ % lanes) : 0
  S.G.enemies.push(makeEnemy(type, { pathId }))
}

// §3 — can a tower of `towerKind` see/hit this monster right now?
// Burrowed monsters are hidden from everyone; phased ones dodge ONE tower kind.
function isTargetable(e, towerKind) {
  if (e.dead || e.leaked) return false
  if (e.burrowed) return false
  if (e.phased && e.def.phase && e.def.phase.kind === towerKind) return false
  return true
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
    // §9 — a real level win routes through the calm tidy-up ritual, which then
    // reveals the result/stars. beginTidyUp() sets phase = 'tidyup' itself.
    beginTidyUp()
  } else {
    S.G.phase = 'prep'
    showPrepBanner()
  }
}

// ===========================================================================
// Enemies
// ===========================================================================
function updateEnemies(dt) {
  for (const e of S.G.enemies) {
    if (e.dead) continue
    // §4 — each enemy follows its own lane's waypoints.
    const wp = S.G.level.paths[e.pathId].waypoints
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
    // §3 friendly powers (speedburst / heal-aura / phase / burrow / shielder)
    updatePowers(e, dt)
    if (e.leaked) continue // a blink may have pushed it off the end

    let eff = 1
    if (e.slowTimer > 0) { e.slowTimer -= dt; eff = e.slowFactor }
    const bossMult = e.enraged ? e.boss.enrage.mult : 1
    const speed = e.def.speed * eff * bossMult * powerSpeedMult(e) * TILE
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
    } else {
      S.G.lives -= leaked
      S.G.shake = Math.min(14, S.G.shake + 8)
      S.G.flash = 0.35
      sfx.hurt()
      if (S.G.lives <= 0) { S.G.lives = 0; lose() }
    }
  }
}

function damageEnemy(e, dmg, opts) {
  if (e.dead) return
  // §3 burrowed monsters are safely underground — hits fizzle (covers stray
  // AoE that didn't pre-filter). DoT already on them keeps ticking elsewhere.
  if (e.burrowed) return
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
  S.G.caughtThisRun.add(e.type) // sticker album — banked into the album only on a win
  const reward = Math.round(e.def.reward * S.G.level.rewardScale)
  S.G.coins += reward
  popEffect(e.x, e.y, e.def.color)
  floatText(e.x, e.y - 10, `+${reward}`, '#ffd34d', 18)
  if (!(opts && opts.silent)) sfx.pop()
  // split into little ones
  if (e.def.split) {
    const { type, count } = e.def.split
    for (let i = 0; i < count; i++) {
      const jitter = (i - (count - 1) / 2) * 8
      const child = makeEnemy(type, {
        x: e.x, y: e.y + jitter,
        seg: e.seg, dist: e.dist, facing: e.facing, pathId: e.pathId,
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
        S.G.enemies.push(makeEnemy(b.summon.type, { x: e.x, y: e.y + jitter, seg: e.seg, dist: e.dist, facing: e.facing, pathId: e.pathId }))
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

// §3 — friendly enemy powers. Each only does anything if the def opts in, so
// plain monsters behave exactly as before. Bosses can stack these too (fair).
function updatePowers(e, dt) {
  const def = e.def
  // speedburst handled in powerSpeedMult; just keep the clock ticking here so
  // the cycle advances even while frozen-in-place isn't an issue (it's read live)
  if (def.speedburst) e.speedburstT += dt

  // heal-aura: a "mama" that mends nearby friends once a second (never herself,
  // never past their maxHp). A soft glow ring is drawn in render.js.
  if (def.healAura) {
    e.healT += dt
    if (e.healT >= 1) {
      e.healT -= 1
      const rPx = def.healAura.radius * TILE
      const r2 = rPx * rPx
      for (const o of S.G.enemies) {
        if (o === e || o.dead || o.leaked) continue
        if (o.hp >= o.maxHp) continue
        const dx = o.x - e.x, dy = o.y - e.y
        if (dx * dx + dy * dy <= r2) {
          o.hp = Math.min(o.maxHp, o.hp + def.healAura.hps)
          if (Math.random() < 0.5) floatText(o.x, o.y - o.def.radius - 8, '💚', '#7be38c', 14)
        }
      }
    }
  }

  // phase: flips translucent on a timer and dodges ONE tower kind while phased.
  if (def.phase) {
    e.phaseT -= dt
    if (e.phaseT <= 0) {
      e.phased = !e.phased
      e.phaseT = def.phase.period
      ringEffect(e.x, e.y, def.radius + 6, '#cfe9ff')
    }
  }

  // burrow: periodically dips underground → untargetable, with a dust puff cue.
  if (def.burrow) {
    e.burrowT -= dt
    if (e.burrowT <= 0) {
      e.burrowed = !e.burrowed
      // stay under briefly, surface for longer so it's always catchable soon
      e.burrowT = e.burrowed ? 1.2 : 2.4
      popEffect(e.x, e.y, '#caa56b')
      floatText(e.x, e.y - def.radius - 8, '💨', '#e8d3a0', 16)
    }
  }

  // shielder: hands a one-hit bubble to the nearest friend BEHIND it (lower
  // dist), reusing the existing shield-bubble mechanic. Recharges on a timer.
  if (def.shielder) {
    e.shielderT -= dt
    if (e.shielderT <= 0) {
      e.shielderT = 3.0
      let behind = null, bestDist = -1
      for (const o of S.G.enemies) {
        if (o === e || o.dead || o.leaked) continue
        if (o.dist < e.dist && o.dist > bestDist) { behind = o; bestDist = o.dist }
      }
      if (behind) {
        behind.shield = Math.max(behind.shield, 1)
        ringEffect(behind.x, behind.y, behind.def.radius + 6, '#8cff9e')
        floatText(e.x, e.y - def.radius - 8, '🫧', '#8cff9e', 16)
      }
    }
  }
}

// speedburst folds into the movement speed: a gentle slow↔fast pulse.
function powerSpeedMult(e) {
  const sb = e.def.speedburst
  if (!sb) return 1
  // one full idle+burst loop is two `period`s; first half idle, second half burst
  const cycle = (e.speedburstT % (sb.period * 2))
  return cycle < sb.period ? sb.idle : sb.burst
}

function advanceAlongPath(e, dist) {
  const wp = S.G.level.paths[e.pathId].waypoints
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
  const wp = S.G.level.paths[e.pathId].waypoints
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
  startWave, updateSpawning, updateEnemies, checkWaveCleared, removeDead, damageEnemy, applySlow, applyBurn, applyPoison, retreatAlongPath, isTargetable,
}
