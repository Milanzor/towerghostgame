// The helper palette, HUD buttons, prep banner and per-frame HUD sync.
import { S } from './state.js'
import { TOWERS, TOWER_ORDER } from '../content.js'
import { sfx, setMuted, isMuted } from '../audio.js'
import { twemojify, setEmojiText } from '../emoji.js'
import { paletteEl, towerStrip, prepBanner, elCoins, elLives, elWave } from './dom.js'
import { hideActionBar } from './towers.js'
import { attachDrag, justDragged } from './input.js'
import { startWave } from './enemies.js'
import { showLevelSelect, leaveSandbox } from './screens.js'


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
  S.G.selectedTower = null
  hideActionBar()
  S.G.selectedType = S.G.selectedType === key ? null : key
  refreshPalette()
}

function refreshPalette() {
  for (const b of paletteEl.querySelectorAll('.tower-btn')) {
    const t = TOWERS[b.dataset.key]
    b.classList.toggle('active', S.G && S.G.selectedType === b.dataset.key)
    b.classList.toggle('cant', S.G && S.G.coins < t.cost)
  }
}

function onGo() {
  if (S.G && S.G.phase === 'prep') startWave()
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
  if (!S.G) return
  const i = (SPEEDS.indexOf(S.G.speed) + 1) % SPEEDS.length
  S.G.speed = SPEEDS[i]
  setEmojiText(e.currentTarget, S.G.speed === 1 ? '⏩' : `${S.G.speed}×`)
})
document.getElementById('menuBtn').addEventListener('click', () => {
  sfx.click()
  showLevelSelect()
})

// ===========================================================================
// Prep banner ("press Start")
// ===========================================================================
function showPrepBanner() {
  const isFirst = !S.G.started
  let msg
  if (S.G.endless) {
    // Backyard: cheery, pressure-free copy + a gentle "All done!" off-ramp.
    msg = isFirst
      ? `🏡 Welcome to the Backyard! Place helpers, then press <b>Start!</b>`
      : `✅ Wave ${S.G.waveIndex} done! Build more, then press <b>Next Wave!</b>`
    msg += ` <button class="prep-done" id="prepDoneBtn">🏡 All done!</button>`
  } else {
    msg = isFirst
      ? (S.G.level.isBoss
          ? `👑 <b>BOSS room!</b> Build your team, then press <b>Start!</b>`
          : `🛡️ Place your helpers, then press <b>Start!</b>`)
      : `✅ Wave ${S.G.waveIndex} cleared! Build more, then press <b>Next Wave!</b>`
  }
  prepBanner.innerHTML = msg
  prepBanner.classList.toggle('boss', !!S.G.level.isBoss && isFirst)
  twemojify(prepBanner)
  prepBanner.classList.remove('hidden')
  const done = document.getElementById('prepDoneBtn')
  if (done) done.addEventListener('click', (e) => { e.stopPropagation(); sfx.click(); leaveSandbox() })
}
function hidePrepBanner() {
  prepBanner.classList.add('hidden')
}

// ===========================================================================
// HUD sync
// ===========================================================================
let lastCoins = null
function syncHUD() {
  elCoins.textContent = S.G.coins
  // When coins change (a monster popped, level income, wave bonus…) re-check
  // which helpers the player can now afford so the strip un-greys instantly.
  if (S.G.coins !== lastCoins) {
    lastCoins = S.G.coins
    refreshPalette()
  }
  if (S.G.endless) {
    // No-fail Backyard: a friendly ∞ instead of a scary "0 lives", and a plain
    // wave number (no "x/y" total — the waves are infinite).
    if (elLives.textContent !== '∞') elLives.textContent = '∞'
    elWave.textContent = `${S.G.waveIndex + 1}`
  } else {
    elLives.textContent = S.G.lives
    const shown = Math.min(S.G.waveIndex + 1, S.G.waveCount)
    elWave.textContent = `${shown}/${S.G.waveCount}`
  }
  if (goBtn) {
    let label
    if (S.G.phase === 'prep') {
      goBtn.disabled = false
      label = S.G.started ? '▶ Next Wave!' : '▶ Start!'
    } else if (S.G.phase === 'done') {
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

export {
  buildPalette, refreshPalette, onGo, showPrepBanner, hidePrepBanner, syncHUD,
}
