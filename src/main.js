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
import { showStart } from './engine/screens.js'
import './engine/input.js' // registers pointer/keyboard/touch listeners

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
// Main loop
// ===========================================================================
let last = performance.now()
function frame(now) {
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.05) dt = 0.05

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
showStart()
initUpdateCheck()
requestAnimationFrame(frame)
