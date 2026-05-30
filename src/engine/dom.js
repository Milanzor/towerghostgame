// ---------------------------------------------------------------------------
// DOM scaffold + element handles. Importing this module builds the game's HTML
// once and exports the canvas, drawing context, HUD elements and overlays the
// rest of the engine talks to. Keep this imported before any module that reads
// these handles at evaluation time.
// ---------------------------------------------------------------------------
import { FIELD_W, FIELD_H } from '../content.js'
import { twemojify } from '../emoji.js'

export const app = document.getElementById('app')
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

export const canvas = document.getElementById('canvas')
export const ctx = canvas.getContext('2d')
export const stage = document.getElementById('stage')
export const paletteEl = document.getElementById('palette')
export const towerStrip = document.getElementById('towerStrip')
export const actionBar = document.getElementById('actionBar')
export const prepBanner = document.getElementById('prepBanner')
export const elCoins = document.getElementById('coins')
export const elLives = document.getElementById('lives')
export const elWave = document.getElementById('wave')
export const elLevelName = document.getElementById('levelName')

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
export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","Twemoji Mozilla",sans-serif'

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
export const ovStart = makeOverlay('ovStart')
export const ovProfiles = makeOverlay('ovProfiles')
export const ovSelect = makeOverlay('ovSelect')
export const ovResult = makeOverlay('ovResult')
export const ovShop = makeOverlay('ovShop')
export const ovGrownup = makeOverlay('ovGrownup') // §6 grown-ups-only panel
export const ovRest = makeOverlay('ovRest')       // §6 gentle wind-down screen

export function hideAllOverlays() {
  ovStart.classList.add('hidden')
  ovProfiles.classList.add('hidden')
  ovSelect.classList.add('hidden')
  ovResult.classList.add('hidden')
  ovShop.classList.add('hidden')
  ovGrownup.classList.add('hidden')
  ovRest.classList.add('hidden')
}
