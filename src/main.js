import './style.css'
import {
  TILE, COLS, ROWS, FIELD_W, FIELD_H,
  TOWERS, TOWER_ORDER, ENEMIES, LEVELS, AREAS,
} from './content.js'
import { sfx, music, setMuted, isMuted } from './audio.js'
import { initUpdateCheck } from './update-check.js'
import { preloadEmoji, drawEmoji, twemojify, setEmojiText } from './emoji.js'

// Preload every emoji we draw/show so they render identically on all devices
// (some tablets don't draw colour emoji on a canvas, or even in the DOM).
preloadEmoji([
  ...Object.values(TOWERS).map(t => t.emoji),
  ...Object.values(ENEMIES).map(e => e.emoji),
  '⭐', '👑', '❄️', '💥', '🏚️', '🛡️', '🔥', '🫧', '🪙', '💜', '🌊',
  '🔊', '🔇', '⏩', '🏠', '✨', '👻', '🎉', '🗑️', '⬆️', '🐷',
  // themed room props + goal doors (see LEVELS decor/door in content.js)
  '🚪', '🏰', '🌀', '🕸️', '🖼️', '🪦', '🕯️', '🦇', '🧊', '💎', '🦴', '⛄',
  '⛓️', '🗝️', '🪨', '🌑', '🪐', '☄️', '🌟', '🛸',
])

// ===========================================================================
// Save / progress
// ===========================================================================
const SAVE_KEY = 'ghostcatchers-v3'

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY))
    if (s && typeof s === 'object') {
      return { unlocked: s.unlocked || 0, stars: s.stars || {} }
    }
  } catch { /* ignore */ }
  return { unlocked: 0, stars: {} }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* ignore */ }
}
let save = loadSave()

// ===========================================================================
// DOM scaffold
// ===========================================================================
const app = document.getElementById('app')
app.innerHTML = `
  <div class="game">
    <div class="hud">
      <span class="chip level-name" id="levelName">Ghost Catchers</span>
      <span class="chip coins">🪙 <span id="coins">0</span></span>
      <span class="chip lives">💜 <span id="lives">0</span></span>
      <span class="chip wave">🌊 <span id="wave">0/0</span></span>
      <button class="btn-mini update-btn" id="updateBtn" title="New version! Tap to update" hidden>✨</button>
      <button class="btn-mini" id="speedBtn" title="Speed">⏩</button>
      <button class="btn-mini" id="muteBtn" title="Sound">🔊</button>
      <button class="btn-mini" id="menuBtn" title="Menu">🏠</button>
    </div>
    <div class="stage" id="stage">
      <canvas id="canvas"></canvas>
      <div class="prep-banner hidden" id="prepBanner"></div>
      <div class="action-bar hidden" id="actionBar"></div>
    </div>
    <div class="palette" id="palette">
      <button class="strip-arrow" id="stripLeft" title="Scroll left">◀</button>
      <div class="tower-strip" id="towerStrip"></div>
      <button class="strip-arrow" id="stripRight" title="Scroll right">▶</button>
      <button class="go-btn" id="goBtn"></button>
    </div>
  </div>
`

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const stage = document.getElementById('stage')
const paletteEl = document.getElementById('palette')
const towerStrip = document.getElementById('towerStrip')
const actionBar = document.getElementById('actionBar')
const prepBanner = document.getElementById('prepBanner')
const elCoins = document.getElementById('coins')
const elLives = document.getElementById('lives')
const elWave = document.getElementById('wave')
const elLevelName = document.getElementById('levelName')

// Swap the static HUD/button emoji to images so they show everywhere.
twemojify(document.querySelector('.hud'))

// Canvas resolution (with device-pixel-ratio for crispness)
function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = FIELD_W * dpr
  canvas.height = FIELD_H * dpr
  canvas.style.aspectRatio = `${FIELD_W} / ${FIELD_H}`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
sizeCanvas()
window.addEventListener('resize', sizeCanvas)

// Canvas needs an explicit colour-emoji font stack — the generic `serif`
// family doesn't resolve emoji on iOS/Safari (and some others), which made
// placed helpers/monsters show only their coloured platform, no icon.
// Fallback font for the rare text label that still uses fillText (floating
// combat text). Tower/monster icons are drawn as Twemoji images, see emoji.js.
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","Twemoji Mozilla",sans-serif'

// ===========================================================================
// Overlays
// ===========================================================================
function makeOverlay(id) {
  const o = document.createElement('div')
  o.className = 'overlay hidden'
  o.id = id
  app.appendChild(o)
  return o
}
const ovStart = makeOverlay('ovStart')
const ovSelect = makeOverlay('ovSelect')
const ovResult = makeOverlay('ovResult')

function hideAllOverlays() {
  ovStart.classList.add('hidden')
  ovSelect.classList.add('hidden')
  ovResult.classList.add('hidden')
}

// ===========================================================================
// Game state
// ===========================================================================
let screen = 'start' // 'start' | 'select' | 'playing'
let G = null

function newGame(levelIndex) {
  const level = LEVELS[levelIndex]
  return {
    level,
    levelIndex,
    coins: level.startCoins,
    lives: level.lives,
    livesMax: level.lives,
    waveIndex: 0,
    waveCount: level.waves.length,
    phase: 'prep', // 'prep' | 'spawning' | 'cleanup' | 'done'
    started: false, // has the player pressed Start at least once?
    spawnQueue: [],
    spawnTimer: 0,
    nextGap: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    occupied: new Set(),
    selectedType: null,
    selectedTower: null,
    hoverCell: null,
    speed: 1,
    paused: false,
    time: 0,
    shake: 0,
    flash: 0,
  }
}

// ===========================================================================
// Palette (tower picker + GO button)
// ===========================================================================
let goBtn = null
function buildPalette() {
  towerStrip.innerHTML = ''
  for (const key of TOWER_ORDER) {
    const t = TOWERS[key]
    const b = document.createElement('button')
    b.className = 'tower-btn'
    b.dataset.key = key
    b.innerHTML = `
      <div class="emoji">${t.emoji}</div>
      <div class="tname">${t.name}</div>
      <div class="tprice">🪙 ${t.cost}</div>
      <span class="tblurb">${t.blurb}</span>`
    b.addEventListener('click', () => selectTowerType(key))
    attachDrag(b, key)
    towerStrip.appendChild(b)
  }
  twemojify(towerStrip)
  goBtn = document.getElementById('goBtn')
  goBtn.addEventListener('click', onGo)

  // Scroll arrows (so swiping a helper never fights with the strip scroll).
  const scrollStep = () => Math.max(160, towerStrip.clientWidth * 0.7)
  document.getElementById('stripLeft').addEventListener('click', () => {
    sfx.click(); towerStrip.scrollBy({ left: -scrollStep(), behavior: 'smooth' })
  })
  document.getElementById('stripRight').addEventListener('click', () => {
    sfx.click(); towerStrip.scrollBy({ left: scrollStep(), behavior: 'smooth' })
  })
  // Mouse wheel over the strip scrolls it sideways.
  towerStrip.addEventListener('wheel', (e) => {
    if (e.deltaY === 0) return
    e.preventDefault()
    towerStrip.scrollBy({ left: e.deltaY })
  }, { passive: false })
}

function selectTowerType(key) {
  if (justDragged) return // a drag just finished; ignore the trailing click
  sfx.click()
  G.selectedTower = null
  hideActionBar()
  G.selectedType = G.selectedType === key ? null : key
  refreshPalette()
}

function refreshPalette() {
  for (const b of paletteEl.querySelectorAll('.tower-btn')) {
    const t = TOWERS[b.dataset.key]
    b.classList.toggle('active', G && G.selectedType === b.dataset.key)
    b.classList.toggle('cant', G && G.coins < t.cost)
  }
}

function onGo() {
  if (G && G.phase === 'prep') startWave()
}

// Keyboard shortcuts while playing.
document.addEventListener('keydown', (e) => {
  if (screen !== 'playing' || !G) return
  // Space / Enter → Start or Next Wave (button is only live during prep).
  if (e.code === 'Space' || e.key === 'Enter') {
    if (G.phase !== 'prep') return
    e.preventDefault()
    onGo()
  // F → cycle fast-forward speed (same as the ⏩ button).
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault()
    document.getElementById('speedBtn').click()
  // P → pause / resume (freezes the action but keeps the field on screen).
  } else if (e.key === 'p' || e.key === 'P') {
    if (G.phase === 'done') return
    e.preventDefault()
    G.paused = !G.paused
    sfx.click()
  }
})

// ===========================================================================
// Drag & drop placement (palette → field)
// ===========================================================================
let dragKey = null
let dragGhostEl = null
let justDragged = false
// "pending" gesture: a press on a helper that hasn't yet decided whether it's a
// sideways scroll-swipe or a deliberate drag up onto the field.
let pendKey = null
let pendX = 0
let pendY = 0
let pendActive = false

function attachDrag(btn, key) {
  btn.addEventListener('pointerdown', (ev) => {
    if (screen !== 'playing') return
    justDragged = false // fresh press — let the trailing click through
    if (G.coins < TOWERS[key].cost) return // can't afford → tap only (no drag)
    // Don't grab yet — wait for the first move to tell drag from scroll.
    pendKey = key
    pendX = ev.clientX
    pendY = ev.clientY
    pendActive = true
  })
}

function startDrag(key, clientX, clientY) {
  dragKey = key
  G.selectedTower = null
  hideActionBar()
  G.selectedType = key
  refreshPalette()
  const def = TOWERS[key]
  dragGhostEl = document.createElement('div')
  dragGhostEl.className = 'drag-ghost'
  setEmojiText(dragGhostEl, def.emoji)
  document.body.appendChild(dragGhostEl)
  moveDragGhost(clientX, clientY)
}

function moveDragGhost(x, y) {
  if (dragGhostEl) {
    dragGhostEl.style.left = `${x}px`
    dragGhostEl.style.top = `${y}px`
  }
}

window.addEventListener('pointermove', (ev) => {
  if (dragKey) {
    moveDragGhost(ev.clientX, ev.clientY)
    G.hoverCell = cellFromClient(ev.clientX, ev.clientY) // null when off-canvas
    return
  }
  if (!pendActive) return
  const dx = ev.clientX - pendX
  const dy = ev.clientY - pendY
  if (dy < -10 && Math.abs(dy) > Math.abs(dx)) {
    // pulled up toward the field → pick the helper up
    const k = pendKey
    pendActive = false; pendKey = null
    startDrag(k, ev.clientX, ev.clientY)
  } else if (Math.abs(dx) > 12) {
    // sideways swipe → let the strip scroll natively, no drag
    pendActive = false; pendKey = null
  }
})

window.addEventListener('pointerup', (ev) => {
  if (dragKey) {
    const cell = cellFromClient(ev.clientX, ev.clientY)
    if (cell) {
      G.selectedType = dragKey
      placeTower(cell.c, cell.r)
      justDragged = true // suppress the click-toggle that follows
    }
    endDrag()
  }
  pendActive = false; pendKey = null
})

window.addEventListener('pointercancel', () => {
  if (dragKey) endDrag()
  pendActive = false; pendKey = null
})

function endDrag() {
  dragKey = null
  G.hoverCell = null
  if (dragGhostEl) { dragGhostEl.remove(); dragGhostEl = null }
}

// Convert a client (screen) coordinate to a grid cell, or null if outside canvas.
function cellFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect()
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null
  }
  const x = (clientX - rect.left) / rect.width * FIELD_W
  const y = (clientY - rect.top) / rect.height * FIELD_H
  return { x, y, c: Math.floor(x / TILE), r: Math.floor(y / TILE) }
}

// ===========================================================================
// Waves & spawning
// ===========================================================================
function startWave() {
  const wave = G.level.waves[G.waveIndex]
  G.spawnQueue = []
  for (const group of wave) {
    for (let i = 0; i < group.count; i++) {
      G.spawnQueue.push({ type: group.type, gap: group.spacing })
    }
  }
  G.phase = 'spawning'
  G.started = true
  G.spawnTimer = 0
  G.nextGap = 0.3
  hidePrepBanner()
  sfx.wave()
}

function makeEnemy(type, opts = {}) {
  const def = ENEMIES[type]
  const hp = Math.round(def.hp * G.level.hpScale)
  const wp = G.level.waypoints
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
  G.enemies.push(makeEnemy(type))
}

function updateSpawning(dt) {
  if (G.phase !== 'spawning') return
  G.spawnTimer += dt
  if (G.spawnQueue.length && G.spawnTimer >= G.nextGap) {
    G.spawnTimer = 0
    const next = G.spawnQueue.shift()
    spawnEnemy(next.type)
    G.nextGap = G.spawnQueue.length ? G.spawnQueue[0].gap : 0
  }
  if (G.spawnQueue.length === 0) G.phase = 'cleanup'
}

function checkWaveCleared() {
  if (G.phase !== 'cleanup') return
  if (G.enemies.length > 0) return
  // Wave bonus!
  const bonus = 25 + G.waveIndex * 10
  G.coins += bonus
  floatText(FIELD_W / 2, FIELD_H / 2, `Wave clear! +${bonus}`, '#ffd34d', 28)
  sfx.coin()
  G.waveIndex++
  if (G.waveIndex >= G.waveCount) {
    G.phase = 'done'
    win()
  } else {
    G.phase = 'prep'
    showPrepBanner()
  }
}

// ===========================================================================
// Enemies
// ===========================================================================
function updateEnemies(dt) {
  const wp = G.level.waypoints
  for (const e of G.enemies) {
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
  G.enemies = G.enemies.filter(e => {
    if (e.leaked) { leaked++; return false }
    return true
  })
  if (leaked > 0) {
    G.lives -= leaked
    G.shake = Math.min(14, G.shake + 8)
    G.flash = 0.35
    sfx.hurt()
    if (G.lives <= 0) { G.lives = 0; lose() }
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
  const reward = Math.round(e.def.reward * G.level.rewardScale)
  G.coins += reward
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
        seg: e.seg, dist: e.dist, facing: e.facing,
      })
      G.enemies.push(child)
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
        G.enemies.push(makeEnemy(b.summon.type, { x: e.x, y: e.y + jitter, seg: e.seg, dist: e.dist, facing: e.facing }))
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
      for (const t of G.towers) {
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
    G.shake = Math.min(14, G.shake + 8)
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
  const wp = G.level.waypoints
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
  if (G.enemies.some(e => e.dead)) {
    G.enemies = G.enemies.filter(e => !e.dead)
  }
}

// ===========================================================================
// Towers
// ===========================================================================
function towerStat(t, stat) {
  if (t.level >= 2 && t.def.upgrade && t.def.upgrade[stat] !== undefined) {
    return t.def.upgrade[stat]
  }
  return t.def[stat]
}

function findTarget(t) {
  const rangePx = towerStat(t, 'range') * TILE
  const r2 = rangePx * rangePx
  let best = null
  let bestDist = -1
  for (const e of G.enemies) {
    if (e.dead) continue
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
  for (const e of G.enemies) {
    if (e.dead) continue
    const dx = e.x - t.cx
    const dy = e.y - t.cy
    if (dx * dx + dy * dy <= r2) inRange.push(e)
  }
  inRange.sort((a, b) => b.dist - a.dist)
  return inRange.slice(0, n)
}

function enemiesInRange(cx, cy, rangePx) {
  const r2 = rangePx * rangePx
  const out = []
  for (const e of G.enemies) {
    if (e.dead) continue
    const dx = e.x - cx
    const dy = e.y - cy
    if (dx * dx + dy * dy <= r2) out.push(e)
  }
  return out
}

function updateTowers(dt) {
  for (const t of G.towers) {
    t.cd -= dt
    t.beamTo = null
    // hexed by a boss — frozen solid, can't fire
    if (t.disabledTimer > 0) { t.disabledTimer -= dt; continue }
    if (t.cd > 0) continue
    const kind = t.def.kind

    if (kind === 'bank') {
      const income = towerStat(t, 'income')
      G.coins += income
      floatText(t.cx, t.cy - 14, `+${income}`, '#ffd34d', 16)
      t.cd = towerStat(t, 'cooldown')
      sfx.coin()
      continue
    }

    if (kind === 'frost' || kind === 'pulse') {
      const rangePx = towerStat(t, 'range') * TILE
      const hits = enemiesInRange(t.cx, t.cy, rangePx)
      if (hits.length === 0) continue
      t.cd = towerStat(t, 'cooldown')
      const dmg = towerStat(t, 'damage')
      for (const e of hits) {
        damageEnemy(e, dmg)
        if (kind === 'frost') applySlow(e, towerStat(t, 'slow'), towerStat(t, 'slowDur'))
      }
      ringEffect(t.cx, t.cy, rangePx, t.def.color)
      if (kind === 'frost') { sfx.freeze(); t.frostPulse = 0.3 }
      else { sfx.shoot(); t.frostPulse = 0.3 }
      continue
    }

    const target = findTarget(t)
    if (!target) continue
    t.cd = towerStat(t, 'cooldown')
    const dmg = towerStat(t, 'damage')

    if (kind === 'beam') {
      damageEnemy(target, dmg)
      addBeam(t.cx, t.cy, target.x, target.y, t.def.color, 0.12)
      sfx.shoot()
    } else if (kind === 'suck') {
      damageEnemy(target, dmg)
      applySlow(target, towerStat(t, 'slow'), 0.35)
      t.beamTo = target
    } else if (kind === 'splash') {
      G.projectiles.push({
        x: t.cx, y: t.cy,
        tx: target.x, ty: target.y,
        speed: 9 * TILE,
        dmg,
        radius: towerStat(t, 'splashRadius') * TILE,
        color: t.def.color,
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
    for (const e of G.enemies) {
      if (e.dead || hit.has(e)) continue
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
  for (const p of G.projectiles) {
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
  if (G.projectiles.some(p => p.done)) {
    G.projectiles = G.projectiles.filter(p => !p.done)
  }
}

function explode(p) {
  ringEffect(p.x, p.y, p.radius, p.color)
  G.shake = Math.min(10, G.shake + 4)
  const r2 = p.radius * p.radius
  for (const e of G.enemies) {
    if (e.dead) continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    if (dx * dx + dy * dy <= r2) damageEnemy(e, p.dmg)
  }
}

// ===========================================================================
// Particles & effects
// ===========================================================================
function popEffect(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    G.particles.push({
      kind: 'puff', x, y,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20,
      life: 0.5, max: 0.5, r: 6 + Math.random() * 4, color,
    })
  }
}
function emberAt(x, y, color) {
  G.particles.push({
    kind: 'puff', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16,
    vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30,
    life: 0.45, max: 0.45, r: 3 + Math.random() * 3, color,
  })
}
function ringEffect(x, y, radius, color) {
  G.particles.push({ kind: 'ring', x, y, r: 6, max: radius, life: 0.35, t: 0.35, color })
}
function floatText(x, y, text, color, size) {
  G.particles.push({ kind: 'text', x, y, text, color, size: size || 18, life: 1.1, max: 1.1 })
}
function addBeam(x1, y1, x2, y2, color, life) {
  G.particles.push({ kind: 'beam', x1, y1, x2, y2, color, life, max: life })
}

function updateParticles(dt) {
  for (const p of G.particles) {
    p.life -= dt
    if (p.kind === 'puff') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt
    } else if (p.kind === 'text') {
      p.y -= 28 * dt
    }
  }
  if (G.particles.some(p => p.life <= 0)) {
    G.particles = G.particles.filter(p => p.life > 0)
  }
}

// ===========================================================================
// Placement / selection input
// ===========================================================================
function cellBuildable(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false
  if (G.level.pathTiles.has(`${c},${r}`)) return false
  if (G.occupied.has(`${c},${r}`)) return false
  return true
}

function towerAt(c, r) {
  return G.towers.find(t => t.c === c && t.r === r) || null
}

function placeTower(c, r) {
  const key = G.selectedType
  if (!key) return
  const def = TOWERS[key]
  if (!cellBuildable(c, r)) { sfx.hurt(); return }
  if (G.coins < def.cost) { sfx.hurt(); return }
  G.coins -= def.cost
  G.towers.push({
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
  G.occupied.add(`${c},${r}`)
  sfx.place()
  refreshPalette()
}

function selectPlacedTower(t) {
  G.selectedTower = t
  G.selectedType = null
  refreshPalette()
  showActionBar(t)
}

function canvasPos(ev) {
  const rect = canvas.getBoundingClientRect()
  const x = (ev.clientX - rect.left) / rect.width * FIELD_W
  const y = (ev.clientY - rect.top) / rect.height * FIELD_H
  return { x, y, c: Math.floor(x / TILE), r: Math.floor(y / TILE) }
}

canvas.addEventListener('pointerdown', (ev) => {
  if (screen !== 'playing') return
  if (dragKey) return // a palette drag is in progress
  const { c, r } = canvasPos(ev)
  if (G.selectedType) {
    placeTower(c, r)
    return
  }
  const t = towerAt(c, r)
  if (t) {
    selectPlacedTower(t)
  } else {
    G.selectedTower = null
    hideActionBar()
  }
})

canvas.addEventListener('pointermove', (ev) => {
  if (screen !== 'playing') return
  if (dragKey) return // handled by the global drag listener
  const { c, r } = canvasPos(ev)
  G.hoverCell = { c, r }
})
canvas.addEventListener('pointerleave', () => { if (G && !dragKey) G.hoverCell = null })

// ---- Action bar (upgrade / sell) ----
function showActionBar(t) {
  const upgradable = t.level < 2 && t.def.upgrade
  const upCost = upgradable ? t.def.upgrade.cost : 0
  const refund = Math.round(t.totalSpent * 0.6)
  actionBar.innerHTML = `
    ${upgradable
      ? `<button class="up" ${G.coins < upCost ? 'disabled' : ''} data-act="up">⬆️ Upgrade 🪙${upCost}</button>`
      : `<button class="up" disabled>⭐ Max</button>`}
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
  if (t.level >= 2 || !t.def.upgrade) return
  const cost = t.def.upgrade.cost
  if (G.coins < cost) { sfx.hurt(); return }
  G.coins -= cost
  t.level = 2
  t.totalSpent += cost
  sfx.upgrade()
  floatText(t.cx, t.cy - 18, 'LEVEL UP!', '#7be38c', 18)
  showActionBar(t)
  refreshPalette()
}
function sellTower(t) {
  const refund = Math.round(t.totalSpent * 0.6)
  G.coins += refund
  G.occupied.delete(`${t.c},${t.r}`)
  G.towers = G.towers.filter(x => x !== t)
  G.selectedTower = null
  hideActionBar()
  sfx.coin()
  floatText(t.cx, t.cy, `+${refund}`, '#ffd34d', 18)
  refreshPalette()
}

// ===========================================================================
// HUD buttons
// ===========================================================================
document.getElementById('muteBtn').addEventListener('click', (e) => {
  setMuted(!isMuted())
  setEmojiText(e.currentTarget, isMuted() ? '🔇' : '🔊')
})
const SPEEDS = [1, 2, 3]
document.getElementById('speedBtn').addEventListener('click', (e) => {
  if (!G) return
  const i = (SPEEDS.indexOf(G.speed) + 1) % SPEEDS.length
  G.speed = SPEEDS[i]
  setEmojiText(e.currentTarget, G.speed === 1 ? '⏩' : `${G.speed}×`)
})
document.getElementById('menuBtn').addEventListener('click', () => {
  sfx.click()
  showLevelSelect()
})

// ===========================================================================
// Prep banner ("press Start")
// ===========================================================================
function showPrepBanner() {
  const isFirst = !G.started
  prepBanner.innerHTML = isFirst
    ? (G.level.isBoss
        ? `👑 <b>BOSS room!</b> Build your team, then press <b>Start!</b>`
        : `🛡️ Place your helpers, then press <b>Start!</b>`)
    : `✅ Wave ${G.waveIndex} cleared! Build more, then press <b>Next Wave!</b>`
  prepBanner.classList.toggle('boss', !!G.level.isBoss && isFirst)
  twemojify(prepBanner)
  prepBanner.classList.remove('hidden')
}
function hidePrepBanner() {
  prepBanner.classList.add('hidden')
}

// ===========================================================================
// Screens
// ===========================================================================
function showStart() {
  screen = 'start'
  hideActionBar()
  music.stop()
  ovStart.innerHTML = `
    <div class="card">
      <h1>👻 Ghost Catchers</h1>
      <p>Spooky-cute monsters are sneaking through the haunted mansion!
      Build <b>flashlights</b> 🔦, <b>frostpuffs</b> ❄️, <b>star wands</b> 🌟 and lots more
      to catch them all. It's friendly, not scary! 💜</p>
      <button class="big-btn green" id="playBtn">▶ Play</button>
      <div class="hint">Tip: <b>drag</b> a helper from the bottom onto the floor — or tap one, then tap the floor.</div>
    </div>`
  twemojify(ovStart)
  hideAllOverlays()
  ovStart.classList.remove('hidden')
  document.getElementById('playBtn').addEventListener('click', () => {
    sfx.win() // also unlocks audio on first gesture
    showLevelSelect()
  })
}

function starString(n) {
  let s = ''
  for (let i = 0; i < 3; i++) s += i < n ? '⭐' : '☆'
  return s
}

function showLevelSelect() {
  screen = 'select'
  hideActionBar()
  music.stop()
  let sections = ''
  AREAS.forEach((area) => {
    const areaLocked = area.levelIndices[0] > save.unlocked
    let tiles = ''
    area.levelIndices.forEach((i, li) => {
      const lv = LEVELS[i]
      const locked = i > save.unlocked
      const stars = save.stars[i] || 0
      const num = locked ? '🔒' : (lv.isBoss ? '👑' : li + 1)
      tiles += `
        <div class="lvl ${locked ? 'locked' : ''} ${lv.isBoss ? 'boss' : ''}" data-i="${i}">
          <div class="num">${num}</div>
          <div class="lname">${locked ? '???' : lv.name}</div>
          <div class="ministars">${locked ? '' : starString(stars)}</div>
        </div>`
    })
    sections += `
      <div class="area ${areaLocked ? 'area-locked' : ''}">
        <div class="area-head">${area.emoji} ${area.name}${areaLocked ? ' 🔒' : ''}</div>
        <div class="levels">${tiles}</div>
      </div>`
  })
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0)
  ovSelect.innerHTML = `
    <div class="card wide">
      <h1>Pick a Room</h1>
      <p>⭐ Stars collected: <b>${totalStars} / ${LEVELS.length * 3}</b></p>
      ${sections}
      <div class="hint">Beat a room to unlock the next! Each world ends with a 👑 BOSS.</div>
    </div>`
  twemojify(ovSelect)
  hideAllOverlays()
  ovSelect.classList.remove('hidden')
  for (const el of ovSelect.querySelectorAll('.lvl')) {
    const i = +el.dataset.i
    if (i > save.unlocked) continue
    el.addEventListener('click', () => { sfx.click(); startLevel(i) })
  }
}

function startLevel(i) {
  G = newGame(i)
  screen = 'playing'
  hideAllOverlays()
  hideActionBar()
  setEmojiText(elLevelName, `${LEVELS[i].areaEmoji} ${LEVELS[i].name}`)
  setEmojiText(document.getElementById('speedBtn'), '⏩')
  showPrepBanner()
  refreshPalette()
  music.play(i) // each room has its own tune
}

function computeStars() {
  const lost = G.livesMax - G.lives
  if (lost <= 1) return 3
  if (lost <= Math.ceil(G.livesMax * 0.4)) return 2
  return 1
}

function win() {
  const stars = computeStars()
  const i = G.levelIndex
  if (stars > (save.stars[i] || 0)) save.stars[i] = stars
  if (i + 1 > save.unlocked && i + 1 < LEVELS.length) save.unlocked = i + 1
  if (i + 1 >= LEVELS.length) save.unlocked = Math.max(save.unlocked, LEVELS.length - 1)
  writeSave()
  music.stop()
  sfx.win()
  hidePrepBanner()
  const isLast = i + 1 >= LEVELS.length
  ovResult.innerHTML = `
    <div class="card">
      <h1>🎉 You Win! 🎉</h1>
      <div class="stars">
        <span class="${stars >= 1 ? 'star-on' : 'star-off'}">⭐</span>
        <span class="${stars >= 2 ? 'star-on' : 'star-off'}">⭐</span>
        <span class="${stars >= 3 ? 'star-on' : 'star-off'}">⭐</span>
      </div>
      <h2>${G.level.name} cleared!</h2>
      <p>${stars === 3 ? 'Perfect! Not a single monster got by! 🌟' : 'Great catching! Can you get all 3 stars? 💪'}</p>
      <div>
        ${!isLast ? '<button class="big-btn green" id="nextBtn">▶ Next Room</button>' : '<p>🏆 You finished every room! You are a Ghost Master! 🏆</p>'}
        <button class="big-btn" id="replayBtn">🔁 Play Again</button>
        <button class="big-btn" id="mapBtn">🗺️ Rooms</button>
      </div>
    </div>`
  twemojify(ovResult)
  ovResult.classList.remove('hidden')
  const next = document.getElementById('nextBtn')
  if (next) next.addEventListener('click', () => { sfx.click(); startLevel(i + 1) })
  document.getElementById('replayBtn').addEventListener('click', () => { sfx.click(); startLevel(i) })
  document.getElementById('mapBtn').addEventListener('click', () => { sfx.click(); showLevelSelect() })
}

function lose() {
  G.phase = 'done'
  music.stop()
  sfx.lose()
  hidePrepBanner()
  const i = G.levelIndex
  ovResult.innerHTML = `
    <div class="card">
      <h1>😅 Oh no!</h1>
      <h2>The monsters got through!</h2>
      <p>That's okay — every ghost catcher needs practice. Try again, you've got this! 💜</p>
      <div>
        <button class="big-btn green" id="retryBtn">🔁 Try Again</button>
        <button class="big-btn" id="mapBtn2">🗺️ Rooms</button>
      </div>
    </div>`
  twemojify(ovResult)
  ovResult.classList.remove('hidden')
  document.getElementById('retryBtn').addEventListener('click', () => { sfx.click(); startLevel(i) })
  document.getElementById('mapBtn2').addEventListener('click', () => { sfx.click(); showLevelSelect() })
}

// ===========================================================================
// HUD sync
// ===========================================================================
let lastCoins = null
function syncHUD() {
  elCoins.textContent = G.coins
  // When coins change (a monster popped, level income, wave bonus…) re-check
  // which helpers the player can now afford so the strip un-greys instantly.
  if (G.coins !== lastCoins) {
    lastCoins = G.coins
    refreshPalette()
  }
  elLives.textContent = G.lives
  const shown = Math.min(G.waveIndex + 1, G.waveCount)
  elWave.textContent = `${shown}/${G.waveCount}`
  if (goBtn) {
    let label
    if (G.phase === 'prep') {
      goBtn.disabled = false
      label = G.started ? '▶ Next Wave!' : '▶ Start!'
    } else if (G.phase === 'done') {
      goBtn.disabled = true
      label = '🎉'
    } else {
      goBtn.disabled = true
      label = '👻 Fighting…'
    }
    // only rebuild (and re-twemojify) when the label actually changes
    if (goBtn._label !== label) {
      goBtn._label = label
      setEmojiText(goBtn, label)
    }
  }
}

// ===========================================================================
// Rendering
// ===========================================================================
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function render() {
  const lv = G.level
  ctx.save()
  // screen shake
  if (G.shake > 0.2) {
    const s = G.shake
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

  // hurt flash
  if (G.flash > 0) {
    ctx.fillStyle = `rgba(255,40,80,${G.flash * 0.5})`
    ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)
  }

  // vignette
  const vg = ctx.createRadialGradient(FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.3, FIELD_W / 2, FIELD_H / 2, FIELD_H * 0.85)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vg
  ctx.fillRect(-20, -20, FIELD_W + 40, FIELD_H + 40)

  // paused overlay
  if (G.paused) {
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

// Tiny seeded RNG so a room's scattered props are placed once and stay put
// (instead of flickering to new spots every frame).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Sprinkle each room with a handful of faint, area-themed props (cobwebs in the
// mansion, ice crystals in the caverns, lava rocks in the volcano…). Purely
// decorative — placed on non-path tiles and drawn behind everything, so they
// never block building. Computed once per level and cached on the level.
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
      if (!G.level.pathTiles.has(`${c},${r}`) && !G.occupied.has(`${c},${r}`)) {
        ctx.beginPath()
        ctx.arc(c * TILE + TILE / 2, r * TILE + TILE / 2, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function drawPath() {
  const wp = G.level.waypoints
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // outer carpet
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = TILE * 0.82
  strokeWaypoints(wp)
  ctx.strokeStyle = G.level.floor
  ctx.lineWidth = TILE * 0.66
  strokeWaypoints(wp)
  // dashed center line
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 4
  ctx.setLineDash([14, 16])
  strokeWaypoints(wp)
  ctx.setLineDash([])

  // entrance portal (first visible)
  const start = clampPoint(wp[0])
  drawPortal(start.x, start.y)
  // mansion door at exit
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
  const t = G.time
  ctx.fillStyle = G.level.accent || '#9a6bff'
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
  const t = G.time
  // pulsing goal glow in the area accent colour
  ctx.globalAlpha = 0.22 + Math.sin(t * 2) * 0.05
  ctx.fillStyle = G.level.accent || '#ffd34d'
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  drawEmoji(ctx, G.level.door || '🚪', 0, 0, 40)
  ctx.restore()
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
  for (const t of G.towers) {
    const sel = G.selectedTower === t
    if (sel && towerStat(t, 'range') > 0) {
      const rangePx = towerStat(t, 'range') * TILE
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(t.cx, t.cy, rangePx, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
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
    // emoji
    drawEmoji(ctx, t.def.emoji, t.cx, t.cy + 1, 32)
    // level pips
    if (t.level >= 2) {
      drawEmoji(ctx, '⭐', t.cx + 16, t.cy - 16, 15)
    }
    // hexed / frozen by a boss
    if (t.disabledTimer > 0) {
      ctx.fillStyle = 'rgba(150,220,255,0.5)'
      ctx.beginPath(); ctx.arc(t.cx, t.cy, 24, 0, Math.PI * 2); ctx.fill()
      drawEmoji(ctx, '❄️', t.cx, t.cy, 20)
    }
    // active suck beam
    if (t.beamTo && !t.beamTo.dead) {
      drawSuckBeam(t, t.beamTo)
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
    const off = Math.sin(G.time * 20 + i) * 6 * (1 - f)
    ctx.lineTo(x + off, y - off)
  }
  ctx.stroke()
  ctx.restore()
}

function drawProjectiles() {
  for (const p of G.projectiles) {
    ctx.fillStyle = p.color
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    drawEmoji(ctx, '💥', p.x, p.y, 16)
  }
}

function drawEnemies() {
  for (const e of G.enemies) {
    if (e.def.shape === 'ghost') drawGhost(e)
    else drawCritter(e)
  }
}

function drawGhost(e) {
  const def = e.def
  const r = def.radius
  const bob = Math.sin(G.time * 3 + e.bobPhase) * 4
  const cx = e.x
  const cy = e.y + bob

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.9, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill()

  ctx.save()
  ctx.globalAlpha = 0.94
  // body
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2) // top dome
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
  ctx.restore()

  // crown for king
  if (def.crown) {
    drawEmoji(ctx, '👑', cx, cy - r * 0.95, r)
  }

  // eyes (look toward movement)
  const eyeDX = e.facing * 2
  const ex = r * 0.42, ey = -r * 0.18, ew = r * 0.27, eh = r * 0.34
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.ellipse(cx + s * ex, cy + ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = def.face
    ctx.beginPath(); ctx.ellipse(cx + s * ex + eyeDX, cy + ey + 2, ew * 0.5, eh * 0.5, 0, 0, Math.PI * 2); ctx.fill()
  }
  // rosy cheeks
  ctx.fillStyle = 'rgba(255,130,170,0.55)'
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(cx + s * r * 0.6, cy + r * 0.18, r * 0.16, r * 0.1, 0, 0, Math.PI * 2); ctx.fill()
  }
  // smile
  ctx.strokeStyle = def.face
  ctx.lineWidth = Math.max(2, r * 0.08)
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.18, r * 0.28, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()

  drawStatus(e, cx, cy, r)
  drawHpBar(e, cx, cy, r)
}

function drawCritter(e) {
  const def = e.def
  const r = def.radius
  const bob = Math.sin(G.time * 4 + e.bobPhase) * 3
  const squish = 1 + Math.sin(G.time * 6 + e.bobPhase) * 0.06
  const cx = e.x
  const cy = e.y + bob

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 0.95, r * 0.8, r * 0.28, 0, 0, Math.PI * 2); ctx.fill()

  // soft glow body
  const grd = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.2, cx, cy, r)
  grd.addColorStop(0, lighten(def.color, 40))
  grd.addColorStop(1, def.color)
  ctx.fillStyle = grd
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r / squish, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()

  // frozen tint
  if (e.slowTimer > 0 && e.slowFactor <= 0.5) {
    ctx.fillStyle = 'rgba(150,220,255,0.35)'
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r / squish, 0, 0, Math.PI * 2); ctx.fill()
  }

  // emoji face
  drawEmoji(ctx, def.emoji, cx, cy + 1, Math.round(r * 1.6))

  drawStatus(e, cx, cy, r)
  drawHpBar(e, cx, cy, r)
}

function drawStatus(e, cx, cy, r) {
  // boss: enraged red aura
  if (e.enraged) {
    ctx.strokeStyle = `rgba(255,90,70,${0.4 + Math.sin(G.time * 12) * 0.2})`
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke()
  }
  // boss: phase-shield bubble
  if (e.invuln > 0) {
    ctx.fillStyle = `rgba(140,255,158,${0.18 + Math.sin(G.time * 16) * 0.08})`
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

function drawParticles() {
  for (const p of G.particles) {
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

function drawPlacementPreview() {
  if (!G.selectedType || !G.hoverCell) return
  const { c, r } = G.hoverCell
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return
  const def = TOWERS[G.selectedType]
  const ok = cellBuildable(c, r) && G.coins >= def.cost
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

function lighten(hex, amt) {
  const h = hex.replace('#', '')
  const num = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16)
  let r = (num >> 16) + amt
  let g = ((num >> 8) & 0xff) + amt
  let b = (num & 0xff) + amt
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255)
  return `rgb(${r},${g},${b})`
}

// ===========================================================================
// Main loop
// ===========================================================================
let last = performance.now()
function frame(now) {
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05

  if (screen === 'playing' && G) {
    G.time += dt
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30)
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 1.5)

    if (G.phase !== 'done' && !G.paused) {
      const sdt = dt * G.speed
      // NOTE: prep waits for the player to press Start — no auto-countdown.
      updateSpawning(sdt)
      updateEnemies(sdt)
      updateTowers(sdt)
      updateProjectiles(sdt)
      removeDead()
      checkWaveCleared()
    }
    if (!G.paused) updateParticles(dt * G.speed)

    render()
    syncHUD()
    if (G.selectedTower) positionActionBar(G.selectedTower)
  }

  requestAnimationFrame(frame)
}

// ===========================================================================
// iPad / touch polish — stop double-tap and pinch from zooming the page.
// (iOS Safari ignores user-scalable=no, so we block the gestures ourselves.)
// ===========================================================================
let lastTouchEnd = 0
document.addEventListener('touchend', (e) => {
  const now = Date.now()
  if (now - lastTouchEnd <= 350) e.preventDefault() // double-tap zoom
  lastTouchEnd = now
}, { passive: false })
// Pinch-zoom gestures (Safari-specific events)
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault())
}
// Block multi-finger touchmoves (pinch) without killing single-finger drags.
document.addEventListener('touchmove', (e) => {
  if (e.touches && e.touches.length > 1) e.preventDefault()
}, { passive: false })
document.addEventListener('dblclick', (e) => e.preventDefault())

// ===========================================================================
// Boot
// ===========================================================================
buildPalette()
showStart()
initUpdateCheck()
requestAnimationFrame(frame)
