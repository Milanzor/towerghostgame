// Start screen, room picker, and the win/lose result screens.
import { S, writeSave, newGame, currentProfile, setActiveProfile, addProfile, listProfiles } from './state.js'
import { LEVELS, AREAS } from '../content.js'
import { sfx, music } from '../audio.js'
import { twemojify, setEmojiText } from '../emoji.js'
import { ovStart, ovProfiles, ovSelect, ovResult, hideAllOverlays, elLevelName } from './dom.js'
import { hideActionBar } from './towers.js'
import { refreshPalette, showPrepBanner, hidePrepBanner } from './ui.js'


// ===========================================================================
// Screens
// ===========================================================================
function showStart() {
  S.screen = 'start'
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
    showProfiles()
  })
}

function starString(n) {
  let s = ''
  for (let i = 0; i < 3; i++) s += i < n ? '⭐' : '☆'
  return s
}

function avatarEmoji(p) { return p.avatar === 'boy' ? '👦' : '👧' }
function totalStarsFor(p) { return Object.values(p.stars || {}).reduce((a, b) => a + b, 0) }

// "Who's playing?" picker — sits between Play and the level select.
function showProfiles() {
  S.screen = 'profiles'
  hideActionBar()
  music.stop()
  const profiles = listProfiles()
  let cards = profiles.map((p) => `
    <button class="profile-card" data-id="${p.id}">
      <div class="pc-avatar">${avatarEmoji(p)}</div>
      <div class="pc-name">${p.name}</div>
      <div class="pc-stars">⭐ ${totalStarsFor(p)}</div>
    </button>`).join('')
  if (profiles.length < 3) {
    cards += `
      <button class="profile-card add-card" id="addProfileCard">
        <div class="pc-avatar">➕</div>
        <div class="pc-name">Add player</div>
      </button>`
  }
  ovProfiles.innerHTML = `
    <div class="card wide">
      <h1>Who's playing?</h1>
      <div class="profile-grid">${cards}</div>
      <div class="hint">Tap your face to play! Each player has their own rooms and stars. 💜</div>
    </div>`
  twemojify(ovProfiles)
  hideAllOverlays()
  ovProfiles.classList.remove('hidden')
  for (const el of ovProfiles.querySelectorAll('.profile-card[data-id]')) {
    el.addEventListener('click', () => {
      sfx.click()
      setActiveProfile(el.dataset.id)
      showLevelSelect()
    })
  }
  const addBtn = document.getElementById('addProfileCard')
  if (addBtn) addBtn.addEventListener('click', () => { sfx.click(); createProfileFlow() })
}

// No-typing-friendly: a couple of cheery default names, tap to pick boy/girl.
const DEFAULT_NAMES = ['Lily', 'Max', 'Zoe', 'Leo', 'Ruby', 'Finn']
function createProfileFlow() {
  const used = listProfiles().map(p => p.name)
  const name = DEFAULT_NAMES.find(n => !used.includes(n)) || ('Player ' + (listProfiles().length + 1))
  const avatar = listProfiles().length % 2 === 0 ? 'girl' : 'boy'
  const id = addProfile({ name, avatar })
  if (id) setActiveProfile(id)
  showProfiles()
}

function showLevelSelect() {
  S.screen = 'select'
  hideActionBar()
  music.stop()
  const prof = currentProfile()
  let sections = ''
  AREAS.forEach((area) => {
    const areaLocked = area.levelIndices[0] > prof.unlocked
    let tiles = ''
    area.levelIndices.forEach((i, li) => {
      const lv = LEVELS[i]
      const locked = i > prof.unlocked
      const stars = prof.stars[i] || 0
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
  const totalStars = Object.values(prof.stars).reduce((a, b) => a + b, 0)
  ovSelect.innerHTML = `
    <div class="card wide">
      <button class="avatar-chip" id="avatarChip" title="Switch player">
        ${avatarEmoji(prof)} <span>${prof.name}</span>
      </button>
      <h1>Pick a Room</h1>
      <p>⭐ Stars collected: <b>${totalStars} / ${LEVELS.length * 3}</b></p>
      ${sections}
      <div class="hint">Beat a room to unlock the next! Each world ends with a 👑 BOSS.</div>
    </div>`
  twemojify(ovSelect)
  hideAllOverlays()
  ovSelect.classList.remove('hidden')
  document.getElementById('avatarChip').addEventListener('click', () => { sfx.click(); showProfiles() })
  for (const el of ovSelect.querySelectorAll('.lvl')) {
    const i = +el.dataset.i
    if (i > prof.unlocked) continue
    el.addEventListener('click', () => { sfx.click(); startLevel(i) })
  }
}

function startLevel(i) {
  S.G = newGame(i)
  S.screen = 'playing'
  hideAllOverlays()
  hideActionBar()
  setEmojiText(elLevelName, `${LEVELS[i].areaEmoji} ${LEVELS[i].name}`)
  setEmojiText(document.getElementById('speedBtn'), '⏩')
  showPrepBanner()
  refreshPalette()
  music.play(i) // each room has its own tune
}

function computeStars() {
  const lost = S.G.livesMax - S.G.lives
  if (lost <= 1) return 3
  if (lost <= Math.ceil(S.G.livesMax * 0.4)) return 2
  return 1
}

function win() {
  const stars = computeStars()
  const i = S.G.levelIndex
  const prof = currentProfile()
  if (stars > (prof.stars[i] || 0)) prof.stars[i] = stars
  if (i + 1 > prof.unlocked && i + 1 < LEVELS.length) prof.unlocked = i + 1
  if (i + 1 >= LEVELS.length) prof.unlocked = Math.max(prof.unlocked, LEVELS.length - 1)
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
      <h2>${S.G.level.name} cleared!</h2>
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
  S.G.phase = 'done'
  music.stop()
  sfx.lose()
  hidePrepBanner()
  const i = S.G.levelIndex
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

export {
  showStart, showLevelSelect, win, lose,
}
