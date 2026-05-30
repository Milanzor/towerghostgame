import './style.css'
import {
  TILE, COLS, ROWS, FIELD_W, FIELD_H,
  TOWERS, TOWER_ORDER, ENEMIES, LEVELS,
} from './content.js'
import { sfx, setMuted, isMuted } from './audio.js'

// ===========================================================================
// Save / progress
// ===========================================================================
const SAVE_KEY = 'ghostcatchers-v1'

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
      <button class="btn-mini" id="speedBtn" title="Speed">⏩</button>
      <button class="btn-mini" id="muteBtn" title="Sound">🔊</button>
      <button class="btn-mini" id="menuBtn" title="Menu">🏠</button>
    </div>
    <div class="stage" id="stage">
      <canvas id="canvas"></canvas>
      <div class="action-bar hidden" id="actionBar"></div>
    </div>
    <div class="palette" id="palette"></div>
  </div>
`

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const stage = document.getElementById('stage')
const paletteEl = document.getElementById('palette')
const actionBar = document.getElementById('actionBar')
const elCoins = document.getElementById('coins')
const elLives = document.getElementById('lives')
const elWave = document.getElementById('wave')
const elLevelName = document.getElementById('levelName')

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
    prepTimer: 9,
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
  paletteEl.innerHTML = ''
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
    paletteEl.appendChild(b)
  }
  goBtn = document.createElement('button')
  goBtn.className = 'go-btn'
  goBtn.addEventListener('click', onGo)
  paletteEl.appendChild(goBtn)
}

function selectTowerType(key) {
  sfx.click()
  G.selectedTower = null
  hideActionBar()
  G.selectedType = G.selectedType === key ? null : key
  refreshPalette()
}

function refreshPalette() {
  for (const b of paletteEl.querySelectorAll('.tower-btn')) {
    const t = TOWERS[b.dataset.key]
    b.classList.toggle('active', G.selectedType === b.dataset.key)
    b.classList.toggle('cant', G.coins < t.cost)
  }
}

function onGo() {
  if (G.phase === 'prep') startWave()
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
  G.spawnTimer = 0
  G.nextGap = 0.3
  sfx.wave()
}

function spawnEnemy(type) {
  const def = ENEMIES[type]
  const hp = Math.round(def.hp * G.level.hpScale)
  const wp = G.level.waypoints
  G.enemies.push({
    type, def,
    hp, maxHp: hp,
    x: wp[0].x, y: wp[0].y,
    seg: 1,
    dist: 0,
    slowTimer: 0,
    slowFactor: 1,
    bobPhase: Math.random() * Math.PI * 2,
    facing: 1,
  })
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
  const bonus = 25 + G.waveIndex * 8
  G.coins += bonus
  floatText(FIELD_W / 2, FIELD_H / 2, `Wave clear! +${bonus}`, '#ffd34d', 28)
  sfx.coin()
  G.waveIndex++
  if (G.waveIndex >= G.waveCount) {
    G.phase = 'done'
    win()
  } else {
    G.phase = 'prep'
    G.prepTimer = 8
  }
}

// ===========================================================================
// Enemies
// ===========================================================================
function updateEnemies(dt) {
  const wp = G.level.waypoints
  for (const e of G.enemies) {
    let eff = 1
    if (e.slowTimer > 0) { e.slowTimer -= dt; eff = e.slowFactor }
    const speed = e.def.speed * eff * TILE
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

function damageEnemy(e, dmg) {
  if (e.dead) return
  e.hp -= dmg
  if (e.hp <= 0) {
    e.dead = true
    const reward = Math.round(e.def.reward * G.level.rewardScale)
    G.coins += reward
    popEffect(e.x, e.y, e.def.color)
    floatText(e.x, e.y - 10, `+${reward}`, '#ffd34d', 18)
    sfx.pop()
  }
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

function updateTowers(dt) {
  for (const t of G.towers) {
    t.cd -= dt
    t.beamTo = null
    if (t.cd > 0) continue
    const target = findTarget(t)
    if (!target) continue
    t.cd = towerStat(t, 'cooldown')
    const dmg = towerStat(t, 'damage')
    const kind = t.def.kind
    if (kind === 'beam') {
      damageEnemy(target, dmg)
      addBeam(t.cx, t.cy, target.x, target.y, t.def.color, 0.12)
      sfx.shoot()
    } else if (kind === 'suck') {
      damageEnemy(target, dmg)
      target.slowTimer = 0.3
      target.slowFactor = towerStat(t, 'slow')
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
    }
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
  const def = TOWERS[key]
  if (!cellBuildable(c, r)) return
  if (G.coins < def.cost) { sfx.hurt(); return }
  G.coins -= def.cost
  G.towers.push({
    key, def,
    c, r,
    cx: c * TILE + TILE / 2,
    cy: r * TILE + TILE / 2,
    level: 1,
    cd: 0,
    totalSpent: def.cost,
    beamTo: null,
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
  const { c, r } = canvasPos(ev)
  G.hoverCell = { c, r }
})
canvas.addEventListener('pointerleave', () => { if (G) G.hoverCell = null })

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
  e.currentTarget.textContent = isMuted() ? '🔇' : '🔊'
})
document.getElementById('speedBtn').addEventListener('click', (e) => {
  if (!G) return
  G.speed = G.speed === 1 ? 2 : 1
  e.currentTarget.textContent = G.speed === 2 ? '⏩⏩' : '⏩'
})
document.getElementById('menuBtn').addEventListener('click', () => {
  sfx.click()
  showLevelSelect()
})

// ===========================================================================
// Screens
// ===========================================================================
function showStart() {
  screen = 'start'
  hideActionBar()
  ovStart.innerHTML = `
    <div class="card">
      <h1>👻 Ghost Catchers</h1>
      <p>Spooky-cute ghosts are sneaking through the haunted mansion!
      Build your <b>flashlights</b> 🔦, <b>poltergusts</b> 🌀 and <b>boo bombs</b> 💥
      to catch them all. Don't worry — it's friendly, not scary! 💜</p>
      <button class="big-btn green" id="playBtn">▶ Play</button>
      <div class="hint">Tip: tap a helper at the bottom, then tap the floor to place it.</div>
    </div>`
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
  let cells = ''
  LEVELS.forEach((lv, i) => {
    const locked = i > save.unlocked
    const stars = save.stars[i] || 0
    cells += `
      <div class="lvl ${locked ? 'locked' : ''}" data-i="${i}">
        <div class="num">${locked ? '🔒' : i + 1}</div>
        <div class="lname">${locked ? '???' : lv.name}</div>
        <div class="ministars">${locked ? '' : starString(stars)}</div>
      </div>`
  })
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0)
  ovSelect.innerHTML = `
    <div class="card">
      <h1>Pick a Room</h1>
      <p>⭐ Stars collected: <b>${totalStars} / ${LEVELS.length * 3}</b></p>
      <div class="levels">${cells}</div>
      <div class="hint">Beat a room to unlock the next one!</div>
    </div>`
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
  elLevelName.textContent = LEVELS[i].name
  document.getElementById('speedBtn').textContent = '⏩'
  refreshPalette()
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
  sfx.win()
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
      <p>${stars === 3 ? 'Perfect! Not a single ghost got by! 🌟' : 'Great catching! Can you get all 3 stars? 💪'}</p>
      <div>
        ${!isLast ? '<button class="big-btn green" id="nextBtn">▶ Next Room</button>' : '<p>🏆 You finished every room! You are a Ghost Master! 🏆</p>'}
        <button class="big-btn" id="replayBtn">🔁 Play Again</button>
        <button class="big-btn" id="mapBtn">🗺️ Rooms</button>
      </div>
    </div>`
  ovResult.classList.remove('hidden')
  const next = document.getElementById('nextBtn')
  if (next) next.addEventListener('click', () => { sfx.click(); startLevel(i + 1) })
  document.getElementById('replayBtn').addEventListener('click', () => { sfx.click(); startLevel(i) })
  document.getElementById('mapBtn').addEventListener('click', () => { sfx.click(); showLevelSelect() })
}

function lose() {
  G.phase = 'done'
  sfx.lose()
  const i = G.levelIndex
  ovResult.innerHTML = `
    <div class="card">
      <h1>😅 Oh no!</h1>
      <h2>The ghosts got through!</h2>
      <p>That's okay — every ghost catcher needs practice. Try again, you've got this! 💜</p>
      <div>
        <button class="big-btn green" id="retryBtn">🔁 Try Again</button>
        <button class="big-btn" id="mapBtn2">🗺️ Rooms</button>
      </div>
    </div>`
  ovResult.classList.remove('hidden')
  document.getElementById('retryBtn').addEventListener('click', () => { sfx.click(); startLevel(i) })
  document.getElementById('mapBtn2').addEventListener('click', () => { sfx.click(); showLevelSelect() })
}

// ===========================================================================
// HUD sync
// ===========================================================================
function syncHUD() {
  elCoins.textContent = G.coins
  elLives.textContent = G.lives
  const shown = Math.min(G.waveIndex + 1, G.waveCount)
  elWave.textContent = `${shown}/${G.waveCount}`
  if (goBtn) {
    if (G.phase === 'prep') {
      goBtn.disabled = false
      goBtn.textContent = `▶ GO! (${Math.ceil(G.prepTimer)})`
    } else if (G.phase === 'done') {
      goBtn.disabled = true
      goBtn.textContent = '🎉'
    } else {
      goBtn.disabled = true
      goBtn.textContent = '👻 Fighting…'
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

  ctx.restore()
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
  for (let i = 3; i >= 1; i--) {
    ctx.beginPath()
    ctx.fillStyle = `rgba(150,90,255,${0.12 * i})`
    ctx.arc(x, y, 10 + i * 6 + Math.sin(t * 3 + i) * 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawDoor(x, y) {
  ctx.save()
  ctx.translate(x, y)
  // glow
  ctx.fillStyle = 'rgba(255,220,120,0.25)'
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill()
  // door
  ctx.fillStyle = '#5a3a1a'
  roundRect(-20, -30, 40, 60, 8); ctx.fill()
  ctx.fillStyle = '#7a5230'
  roundRect(-15, -24, 30, 48, 6); ctx.fill()
  ctx.fillStyle = '#ffd34d'
  ctx.beginPath(); ctx.arc(8, 4, 3, 0, Math.PI * 2); ctx.fill()
  ctx.font = '20px serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('🏚️', 0, -46)
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
    if (sel) {
      const rangePx = towerStat(t, 'range') * TILE
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(t.cx, t.cy, rangePx, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
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
    ctx.font = '30px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(t.def.emoji, t.cx, t.cy + 1)
    // level pips
    if (t.level >= 2) {
      ctx.font = '14px serif'
      ctx.fillText('⭐', t.cx + 16, t.cy - 16)
    }
    // active suck beam
    if (t.beamTo) {
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
    ctx.font = '14px serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('💥', p.x, p.y)
  }
}

function drawEnemies() {
  for (const e of G.enemies) drawGhost(e)
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
    ctx.fillStyle = '#ffd34d'
    ctx.font = `${r}px serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('👑', cx, cy - r * 0.95)
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

  // hp bar
  if (e.hp < e.maxHp) {
    const w = r * 1.6, h = 6
    const bx = cx - w / 2, by = cy - r - 12
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    roundRect(bx, by, w, h, 3); ctx.fill()
    const frac = clamp(e.hp / e.maxHp, 0, 1)
    ctx.fillStyle = frac > 0.5 ? '#7be38c' : frac > 0.25 ? '#ffd34d' : '#ff6b8b'
    roundRect(bx, by, w * frac, h, 3); ctx.fill()
  }
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
      ctx.font = `800 ${p.size}px 'Baloo 2', sans-serif`
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
  ctx.fillStyle = ok ? 'rgba(120,255,150,0.12)' : 'rgba(255,80,100,0.12)'
  ctx.strokeStyle = ok ? 'rgba(120,255,150,0.7)' : 'rgba(255,80,100,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(cx, cy, def.range * TILE, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  // tile highlight
  ctx.fillStyle = ok ? 'rgba(120,255,150,0.25)' : 'rgba(255,80,100,0.25)'
  roundRect(c * TILE + 4, r * TILE + 4, TILE - 8, TILE - 8, 10); ctx.fill()
  // ghost preview of tower
  ctx.globalAlpha = 0.75
  ctx.font = '30px serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(def.emoji, cx, cy)
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

    if (G.phase !== 'done') {
      const sdt = dt * G.speed
      if (G.phase === 'prep') {
        G.prepTimer -= sdt
        if (G.prepTimer <= 0) startWave()
      }
      updateSpawning(sdt)
      updateEnemies(sdt)
      updateTowers(sdt)
      updateProjectiles(sdt)
      removeDead()
      checkWaveCleared()
    }
    updateParticles(dt * G.speed)

    render()
    syncHUD()
    if (G.selectedTower) positionActionBar(G.selectedTower)
  }

  requestAnimationFrame(frame)
}

// ===========================================================================
// Boot
// ===========================================================================
buildPalette()
showStart()
requestAnimationFrame(frame)
