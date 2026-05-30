// Player input: keyboard shortcuts, drag-and-drop placement, canvas taps and
// the iPad touch-gesture guards.
import { S } from './state.js'
import { TOWERS, TILE, FIELD_W, FIELD_H } from '../content.js'
import { sfx } from '../audio.js'
import { setEmojiText } from '../emoji.js'
import { canvas } from './dom.js'
import { placeTower, towerAt, selectPlacedTower, hideActionBar } from './towers.js'
import { refreshPalette, onGo } from './ui.js'
import { collectPickupAt, resolveAim, cancelAim } from './abilities.js'


// Keyboard shortcuts while playing.
document.addEventListener('keydown', (e) => {
  if (S.screen !== 'playing' || !S.G) return
  // Space / Enter → Start or Next Wave (button is only live during prep).
  if (e.code === 'Space' || e.key === 'Enter') {
    if (S.G.phase !== 'prep') return
    e.preventDefault()
    onGo()
  // F → cycle fast-forward speed (same as the ⏩ button).
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault()
    document.getElementById('speedBtn').click()
  // P → pause / resume (freezes the action but keeps the field on screen).
  } else if (e.key === 'p' || e.key === 'P') {
    if (S.G.phase === 'done') return
    e.preventDefault()
    S.G.paused = !S.G.paused
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
    if (S.screen !== 'playing') return
    justDragged = false // fresh press — let the trailing click through
    if (S.G.coins < TOWERS[key].cost) return // can't afford → tap only (no drag)
    // Don't grab yet — wait for the first move to tell drag from scroll.
    pendKey = key
    pendX = ev.clientX
    pendY = ev.clientY
    pendActive = true
  })
}

function startDrag(key, clientX, clientY) {
  dragKey = key
  S.G.selectedTower = null
  hideActionBar()
  S.G.selectedType = key
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
    S.G.hoverCell = cellFromClient(ev.clientX, ev.clientY) // null when off-canvas
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
      S.G.selectedType = dragKey
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
  S.G.hoverCell = null
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

function canvasPos(ev) {
  const rect = canvas.getBoundingClientRect()
  const x = (ev.clientX - rect.left) / rect.width * FIELD_W
  const y = (ev.clientY - rect.top) / rect.height * FIELD_H
  return { x, y, c: Math.floor(x / TILE), r: Math.floor(y / TILE) }
}

// While a 🌊 Wave is armed, the next swipe on the field is captured as the aim
// gesture (NOT a tower placement). Gated entirely behind S.G.aiming so it never
// fights the drag-to-place gesture.
let aimActive = false

canvas.addEventListener('pointerdown', (ev) => {
  if (S.screen !== 'playing') return
  if (dragKey) return // a palette drag is in progress
  const pos = canvasPos(ev)

  // §2b: an armed Wave captures this swipe.
  if (S.G.aiming) {
    aimActive = true
    S.G.aimSwipe = { from: { x: pos.x, y: pos.y }, to: { x: pos.x, y: pos.y } }
    return
  }

  // §2a: tapping a floating sparkle collects it (before place/select logic).
  if (collectPickupAt(pos.x, pos.y)) return

  const { c, r } = pos
  if (S.G.selectedType) {
    placeTower(c, r)
    return
  }
  const t = towerAt(c, r)
  if (t) {
    selectPlacedTower(t)
  } else {
    S.G.selectedTower = null
    hideActionBar()
  }
})

// Track + resolve the aim swipe (works for mouse and touch via Pointer events).
window.addEventListener('pointermove', (ev) => {
  if (!aimActive || !S.G || !S.G.aimSwipe) return
  S.G.aimSwipe.to = canvasPos(ev)
})
window.addEventListener('pointerup', (ev) => {
  if (!aimActive) return
  aimActive = false
  const sw = S.G && S.G.aimSwipe
  S.G.aimSwipe = null
  if (!sw) { cancelAim(); return }
  const to = canvasPos(ev)
  const moved = Math.hypot(to.x - sw.from.x, to.y - sw.from.y)
  // a real swipe → wash that line; a tap (no movement) → cancel the aim
  if (moved > TILE * 0.5) resolveAim(sw.from, to)
  else cancelAim()
})
window.addEventListener('pointercancel', () => {
  if (!aimActive) return
  aimActive = false
  if (S.G) S.G.aimSwipe = null
  cancelAim()
})

canvas.addEventListener('pointermove', (ev) => {
  if (S.screen !== 'playing') return
  if (dragKey) return // handled by the global drag listener
  const { c, r } = canvasPos(ev)
  S.G.hoverCell = { c, r }
})
canvas.addEventListener('pointerleave', () => { if (S.G && !dragKey) S.G.hoverCell = null })

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

export {
  attachDrag, justDragged,
}
