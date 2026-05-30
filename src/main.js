// Baloo 2 — a rounded, bouncy, kid-friendly display face. Latin-only subsets
// keep the deploy lean (no Devanagari/Vietnamese the game never shows).
import '@fontsource/baloo-2/latin-400.css'
import '@fontsource/baloo-2/latin-500.css'
import '@fontsource/baloo-2/latin-600.css'
import '@fontsource/baloo-2/latin-700.css'
import '@fontsource/baloo-2/latin-800.css'
import './style.css'
import './engine/dom.js' // builds the DOM scaffold first (side effects)
import { TOWERS, ENEMIES } from './content.js'
import { preloadEmoji } from './emoji.js'
import { initUpdateCheck } from './update-check.js'
import { S } from './engine/state.js'
import { updateParticles } from './engine/effects.js'
import { updateSpawning, updateEnemies, removeDead, checkWaveCleared } from './engine/enemies.js'
import { updateTowers, updateProjectiles, positionActionBar } from './engine/towers.js'
import { render } from './engine/render.js'
import { buildPalette, syncHUD } from './engine/ui.js'
import { tickPlayTimer, wireSettingsButton } from './engine/grownup.js'
import { showStart, tickTidyUp } from './engine/screens.js'
import './engine/input.js' // registers pointer/keyboard/touch listeners

// Preload every emoji we draw/show so they render identically on all devices
// (some tablets don't draw colour emoji on a canvas, or even in the DOM).
preloadEmoji([
  ...Object.values(TOWERS).map(t => t.emoji),
  ...Object.values(ENEMIES).map(e => e.emoji),
  '⭐', '👑', '❄️', '💥', '🏚️', '🛡️', '🔥', '🫧', '🪙', '💜', '🌊',
  '🔊', '🔇', '⏩', '🏠', '✨', '👻', '🎉', '🗑️', '⬆️', '🐷',
  '👦', '👧', '➕', // kid profile avatars + add-player card
  '💚', '🐤', '🐚', // §3 heal-aura "mama" mend cue + Mama Chick + Bubble Shell (🫧 shielder + 💨 burrow already above)
  '👋', // friendly "bye!" cue when a monster floats away / tidy-up
  // §1 avatars/shop: hats + the shop bag
  '🛍️', '🎩', '🧢', '🎀', '🎃', '🧙',
  // §6 grown-up corner: gear gate, vibe faces, the wind-down clock + sleepy face
  '⚙️', '😌', '😄', '⏰', '🗑️', '😴',
  // §8 world-map journey: the "you are here" flag + diorama poke puffs
  '🚩', '💨', '🌙',

  // themed room props + goal doors (see LEVELS decor/door in content.js)
  '🚪', '🏰', '🌀', '🕸️', '🖼️', '🪦', '🕯️', '🦇', '🧊', '💎', '🦴', '⛄',
  '⛓️', '🗝️', '🪨', '🌑', '🪐', '☄️', '🌟', '🛸',

  // §5 Backyard sandbox — the home button/door + bright garden decor
  '🏡', '🌻', '🌷', '🌼', '🦋', '🐝', '🌳',
])

// ===========================================================================
// Main loop
// ===========================================================================
let last = performance.now()
function frame(now) {
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05

  // §6 soft play-timer: counts real PLAY seconds (self-guards on screen/pause)
  // and drives the gentle wind-down. Runs every frame so the ramp keeps moving.
  tickPlayTimer(dt)

  if (S.screen === 'playing' && S.G) {
    const G = S.G
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
      tickTidyUp(sdt)       // §9 — drive the closure ritual when phase==='tidyup'
    }
    if (!G.paused) updateParticles(dt * G.speed)

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
wireSettingsButton() // the permanent in-game ⚙️ in the HUD top bar
showStart()
initUpdateCheck()
requestAnimationFrame(frame)
