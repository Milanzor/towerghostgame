// ---------------------------------------------------------------------------
// Magic Buttons — rechargeable active abilities (PLAN §2 + §2a sparkles + §2b
// draw-to-aim). A tray of big tappable spell buttons overlays the play field.
// Each spell is fed by BOTH a gentle cooldown floor AND collectable ✨ sparkles
// (a sparkle grants a charge; the cooldown stops spamming). Casting fires an
// instant, friendly, screen-wide (or aimed) effect.
//
// Everything lives on the per-game state (S.G), so abilities are per-room and
// reset automatically via newGame(). No save/profile involvement.
// ---------------------------------------------------------------------------
import { S } from './state.js'
import { TILE, FIELD_W, FIELD_H } from '../content.js'
import { sfx } from '../audio.js'
import { floatText, ringEffect } from './effects.js'
import { setEmojiText } from '../emoji.js'
import { stage } from './dom.js'
import { sweepAllBack, freezeAll, clearNonBoss, pushNearLine } from './enemies.js'
import { avatarReact } from '../cosmetics.js'

// Each ability has a `cooldown` (seconds, the spam floor) and starts with 1
// charge so a kid can cast right away. `once` spells are limited per level.
export const ABILITIES = [
  { id: 'sweep', name: 'Sweep',      emoji: '🧹', cooldown: 12, maxCharges: 3, kind: 'pushback', amount: 1.0 },
  { id: 'nap',   name: 'Nap',        emoji: '💤', cooldown: 18, maxCharges: 2, kind: 'freeze',   duration: 2 },
  { id: 'candy', name: 'Candy Rain', emoji: '🍬', cooldown: 20, maxCharges: 2, kind: 'coins',    amount: 30 },
  { id: 'wave',  name: 'Wave',       emoji: '🌊', cooldown: 15, maxCharges: 2, kind: 'aim',      amount: 2.2 },
  { id: 'zap',   name: 'Big Zap',    emoji: '🌟', cooldown: 0,  maxCharges: 1, once: true, kind: 'clear' },
]
const ABILITY_BY_ID = Object.fromEntries(ABILITIES.map(a => [a.id, a]))

export const ABILITY_EMOJI = ABILITIES.map(a => a.emoji).concat(['✨'])

// ===========================================================================
// Per-frame ticking (called from the main loop with sdt = dt * speed)
// ===========================================================================
export function updateAbilities(sdt) {
  const G = S.G
  if (!G) return
  // tick down cooldowns
  for (const id in G.abilityCD) {
    if (G.abilityCD[id] > 0) G.abilityCD[id] = Math.max(0, G.abilityCD[id] - sdt)
  }
  // freeze timer (movement is skipped in enemies.js while this is > 0)
  if (G.freezeTimer > 0) G.freezeTimer = Math.max(0, G.freezeTimer - sdt)
}

export function updatePickups(sdt) {
  const G = S.G
  if (!G || !G.pickups.length) return
  let expired = false
  for (const p of G.pickups) {
    p.life -= sdt
    p.bobPhase += sdt * 3
    if (p.life <= 0) expired = true
  }
  if (expired) G.pickups = G.pickups.filter(p => p.life > 0)
}

// ===========================================================================
// Sparkle drops (§2a) — called from killEnemy. Optional treat, never required.
// ===========================================================================
const SPARKLE_CHANCE = 0.15
export function maybeDropSparkle(x, y) {
  const G = S.G
  if (!G) return
  if (G.pickups.length >= 6) return // keep it bounded
  if (Math.random() > SPARKLE_CHANCE) return
  G.pickups.push({
    x, y,
    life: 4, max: 4,
    bobPhase: Math.random() * Math.PI * 2,
    r: 22, // big & easy for tiny fingers
  })
}

// Hit-test the sparkles (canvas field coords). Returns true if one was caught
// and collected. Called from input.js BEFORE place/select logic.
export function collectPickupAt(x, y) {
  const G = S.G
  if (!G || !G.pickups.length) return false
  for (let i = 0; i < G.pickups.length; i++) {
    const p = G.pickups[i]
    const dx = x - p.x, dy = y - p.y
    if (dx * dx + dy * dy <= (p.r + 14) * (p.r + 14)) {
      G.pickups.splice(i, 1)
      grantCharge()
      sfx.sparkle()
      ringEffect(x, y, 26, '#ffe98a')
      floatText(x, y - 14, '✨ +1', '#ffe98a', 18)
      refreshAbilityTray()
      return true
    }
  }
  return false
}

// A collected sparkle fills the most-needed not-full spell: prefer one that's
// out of charges, otherwise the lowest-charge non-full ability.
function grantCharge() {
  const G = S.G
  let best = null
  for (const a of ABILITIES) {
    const cur = G.abilityCharges[a.id] || 0
    if (cur >= a.maxCharges) continue
    if (!best || cur < (G.abilityCharges[best.id] || 0)) best = a
  }
  if (best) G.abilityCharges[best.id] = (G.abilityCharges[best.id] || 0) + 1
}

// ===========================================================================
// Casting
// ===========================================================================
function isReady(a) {
  const G = S.G
  if (a.once && G.zapUsed) return false
  if ((G.abilityCharges[a.id] || 0) <= 0) return false
  if ((G.abilityCD[a.id] || 0) > 0) return false
  return true
}

function cast(a) {
  const G = S.G
  if (!isReady(a)) return
  // Wave is draw-to-aim: arm it instead of firing immediately.
  if (a.kind === 'aim') {
    if (G.aiming === a.id) { G.aiming = null } // tapping again cancels
    else { G.aiming = a.id; sfx.click() }
    refreshAbilityTray()
    return
  }
  spend(a)
  doEffect(a)
}

function spend(a) {
  const G = S.G
  G.abilityCharges[a.id] = Math.max(0, (G.abilityCharges[a.id] || 0) - 1)
  if (a.cooldown > 0) G.abilityCD[a.id] = a.cooldown
  if (a.once) G.zapUsed = true
}

function doEffect(a) {
  const G = S.G
  sfx.cast()
  if (a.kind === 'pushback') {
    sweepAllBack(a.amount * TILE)
    floatText(FIELD_W / 2, FIELD_H / 2, '🧹 Whoosh!', '#9be8ff', 26)
  } else if (a.kind === 'freeze') {
    freezeAll(a.duration)
    sfx.freeze()
    floatText(FIELD_W / 2, FIELD_H / 2, '💤 Nap time!', '#9be8ff', 26)
  } else if (a.kind === 'coins') {
    G.coins += a.amount
    sfx.coin()
    floatText(FIELD_W / 2, FIELD_H / 2, `🍬 +${a.amount}`, '#ffd34d', 28)
  } else if (a.kind === 'clear') {
    clearNonBoss()
    sfx.zap()
    G.flash = 0.4
    avatarReact('clap') // mascot claps for the big catch
    floatText(FIELD_W / 2, FIELD_H / 2, '🌟 ZAP!', '#ffe98a', 30)
  }
  refreshAbilityTray()
}

// Resolve an armed Wave swipe (§2b): from→to are field coords. Pushes monsters
// near the swiped segment back toward the start. Single path today → it just
// confirms direction; shines once branching paths land.
export function resolveAim(from, to) {
  const G = S.G
  const a = ABILITY_BY_ID[G.aiming]
  G.aiming = null
  if (!a) { refreshAbilityTray(); return }
  if (!isReady(a)) { refreshAbilityTray(); return }
  spend(a)
  sfx.cast()
  pushNearLine(from, to, a.amount * TILE, TILE * 1.4)
  floatText((from.x + to.x) / 2, (from.y + to.y) / 2, '🌊 Splash!', '#7fd8ff', 26)
  refreshAbilityTray()
}

export function cancelAim() {
  if (S.G) S.G.aiming = null
  refreshAbilityTray()
}

// ===========================================================================
// Tray DOM (big round buttons overlaying the stage, left edge)
// ===========================================================================
let trayEl = null
const btnEls = {} // id -> { btn, fill, badge }

export function buildAbilityTray() {
  if (trayEl) return
  trayEl = document.createElement('div')
  trayEl.className = 'ability-tray'
  for (const a of ABILITIES) {
    const btn = document.createElement('button')
    btn.className = 'ability-btn'
    btn.dataset.id = a.id
    btn.title = a.name
    const fill = document.createElement('div')
    fill.className = 'ab-cool'
    const emoji = document.createElement('div')
    emoji.className = 'ab-emoji'
    setEmojiText(emoji, a.emoji)
    const badge = document.createElement('div')
    badge.className = 'ab-badge'
    btn.appendChild(fill)
    btn.appendChild(emoji)
    btn.appendChild(badge)
    btn.addEventListener('click', () => cast(a))
    trayEl.appendChild(btn)
    btnEls[a.id] = { btn, fill, badge }
  }
  stage.appendChild(trayEl)
}

// Show/refresh the tray each frame; only visible while actually playing.
export function refreshAbilityTray() {
  if (!trayEl) buildAbilityTray()
  const playing = S.screen === 'playing' && S.G
  trayEl.classList.toggle('hidden', !playing)
  if (!playing) return
  const G = S.G
  for (const a of ABILITIES) {
    const { btn, fill, badge } = btnEls[a.id]
    const charges = G.abilityCharges[a.id] || 0
    const cd = G.abilityCD[a.id] || 0
    const ready = isReady(a)
    const usedUp = a.once && G.zapUsed
    btn.classList.toggle('ready', ready)
    btn.classList.toggle('cant', !ready)
    btn.classList.toggle('armed', G.aiming === a.id)
    btn.disabled = !ready && !(G.aiming === a.id)
    // cooldown sweep (top-down wipe)
    const frac = (a.cooldown > 0 && cd > 0) ? cd / a.cooldown : 0
    fill.style.height = `${Math.round(frac * 100)}%`
    // charge badge (or ✓ once used for the once-per-level zap)
    if (usedUp) { badge.textContent = '✓'; badge.classList.add('done') }
    else { badge.textContent = charges; badge.classList.toggle('done', false) }
    badge.classList.toggle('zero', !usedUp && charges <= 0)
  }
}

// Called when leaving a room / entering a new one — clear any armed aim.
export function resetAbilities() {
  if (S.G) S.G.aiming = null
  refreshAbilityTray()
}
