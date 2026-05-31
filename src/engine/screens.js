// Start screen, room picker, and the win/lose result screens.
import { S, writeSave, newGame, newSandbox, currentProfile, setActiveProfile, addProfile, updateProfile, listProfiles, recordLoss, stuckBonusFor, resetStuck } from './state.js'
import { LEVELS, AREAS, ENEMIES } from '../content.js'
import { BACKYARD } from '../backyard.js'
import { sfx, music } from '../audio.js'
import { twemojify, setEmojiText } from '../emoji.js'
import { ovStart, ovProfiles, ovSelect, ovResult, ovShop, ovAlbum, hideAllOverlays, elLevelName, tidyBtn } from './dom.js'
import { drawEnemyBody } from './critters.js'
import { hideActionBar } from './towers.js'
import { refreshPalette, showPrepBanner, hidePrepBanner } from './ui.js'
import { AVATARS, HATS, HAT_ORDER } from '../cosmetics.js'
import { popEffect, floatText } from './effects.js'


// ===========================================================================
// Screens
// ===========================================================================
function showStart() {
  S.screen = 'start'
  hideActionBar()
  music.stop()
  ovStart.innerHTML = `
    <div class="card wide">
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

function avatarEmoji(p) { return (AVATARS[p.avatar] || AVATARS.girl).emoji }
function totalStarsFor(p) { return Object.values(p.stars || {}).reduce((a, b) => a + b, 0) }

// §8 — remember which stop the avatar token last sat on, so we can detect when
// a win has unlocked a NEW stop and animate the token travelling to it (and only
// then). null = no map shown yet this session.
let lastShownUnlocked = null

// "Who's playing?" picker — sits between Play and the level select.
function showProfiles() {
  S.screen = 'profiles'
  lastShownUnlocked = null // switching players must not trigger a travel tween
  hideActionBar()
  music.stop()
  const profiles = listProfiles()
  let cards = profiles.map((p) => `
    <div class="profile-card-wrap">
      <button class="profile-card" data-id="${p.id}">
        <div class="pc-avatar">${avatarEmoji(p)}</div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-stars">⭐ ${totalStarsFor(p)}</div>
      </button>
      <button class="profile-edit" data-edit="${p.id}" title="Change name & face" aria-label="Change ${p.name}'s name and face">✏️</button>
    </div>`).join('')
  const empty = profiles.length === 0
  if (profiles.length < 3) {
    cards += `
      <button class="profile-card add-card" id="addProfileCard">
        <div class="pc-avatar">➕</div>
        <div class="pc-name">${empty ? 'Make a player' : 'Add player'}</div>
      </button>`
  }
  ovProfiles.innerHTML = `
    <div class="card wide">
      <h1>${empty ? 'Welcome! 👋' : "Who's playing?"}</h1>
      <div class="profile-grid">${cards}</div>
      <div class="hint">${empty
        ? 'Tap the ➕ to make your player and start catching ghosts! 💜'
        : 'Tap your face to play! Each player has their own rooms and stars. 💜'}</div>
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
  for (const el of ovProfiles.querySelectorAll('[data-edit]')) {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      sfx.click()
      profileEditorFlow(el.dataset.edit)
    })
  }
  const addBtn = document.getElementById('addProfileCard')
  if (addBtn) addBtn.addEventListener('click', () => { sfx.click(); profileEditorFlow() })
}

// A few cheery default names to pre-fill the box (the kid can type their own).
const DEFAULT_NAMES = ['Lily', 'Max', 'Zoe', 'Leo', 'Ruby', 'Finn']

// Pick-a-face + type-a-name flow. With no id it CREATES a new player; with an
// existing profile id it EDITS that player's name + face (progress untouched).
// Lives in the profiles overlay either way.
function profileEditorFlow(editId = null) {
  S.screen = 'profiles'
  hideActionBar()
  const editing = editId ? listProfiles().find(p => p.id === editId) : null
  // For a new player, suggest an unused cheery name; for an edit, prefill theirs.
  const used = listProfiles().filter(p => p.id !== editId).map(p => p.name)
  const suggested = editing ? editing.name : (DEFAULT_NAMES.find(n => !used.includes(n)) || '')
  let chosen = editing ? editing.avatar : 'girl'
  const avatarChoices = Object.entries(AVATARS).map(([id, a]) => `
    <button class="avatar-pick ${chosen === id ? 'on' : ''}" data-av="${id}" aria-label="${a.name}">
      <span class="ap-face">${a.emoji}</span>
    </button>`).join('')
  ovProfiles.innerHTML = `
    <div class="card">
      <h1>${editing ? 'Change me!' : 'New player'}</h1>
      <p>Pick a face, then type your name! 💜</p>
      <div class="avatar-picks">${avatarChoices}</div>
      <input class="name-input" id="nameInput" type="text" maxlength="12"
             placeholder="Your name" value="${suggested}" autocomplete="off"
             autocapitalize="words" spellcheck="false" />
      <div>
        <button class="big-btn green" id="createBtn">${editing ? '💾 Save' : '✅ Let\'s play!'}</button>
        <button class="big-btn" id="createBack">↩ Back</button>
      </div>
    </div>`
  twemojify(ovProfiles)
  hideAllOverlays()
  ovProfiles.classList.remove('hidden')
  const input = document.getElementById('nameInput')
  // Toggle the chosen face without re-rendering (so the typed name is kept).
  for (const el of ovProfiles.querySelectorAll('[data-av]')) {
    el.addEventListener('click', () => {
      sfx.click()
      chosen = el.dataset.av
      for (const b of ovProfiles.querySelectorAll('[data-av]')) b.classList.toggle('on', b === el)
    })
  }
  const commit = () => {
    const name = (input.value || '').trim() || suggested || 'Player'
    if (editing) {
      updateProfile(editId, { name, avatar: chosen })
      showProfiles() // back to the picker so the change is visible right away
    } else {
      const id = addProfile({ name, avatar: chosen })
      if (id) setActiveProfile(id)
      showLevelSelect()
    }
  }
  document.getElementById('createBtn').addEventListener('click', () => { sfx.click(); commit() })
  document.getElementById('createBack').addEventListener('click', () => { sfx.click(); showProfiles() })
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit() })
  setTimeout(() => { try { input.focus() } catch { /* ignore */ } }, 60)
}

// §8 — the avatar token (face + equipped hat layered) that travels the trail.
function tokenHTML(prof) {
  const face = avatarEmoji(prof)
  const hat = (HATS[prof.hat] || HATS.none).emoji
  return `${hat ? `<span class="tok-hat">${hat}</span>` : ''}<span class="tok-face">${face}</span>`
}

// §8 — the world map reframed as a winding TRAIL the avatar walks. One serpentine
// row per AREA (data-driven off AREAS/levelIndices — never hardcodes 25): a
// pokeable diorama at the row head, then its rooms as `.lvl` stops connected by a
// drawn trail line. The avatar token sits on the latest unlocked stop, marked by
// a 🚩 flag; the NEXT playable stop bounces to pull the eye. Returning after a win
// that unlocked a new stop slides the token forward, then puffs a little cheer.
function showLevelSelect() {
  // If the kid leaves mid-tidy-up (Home), still bank the win — progression must
  // never hinge on finishing the animation. Rewards are guarded to fire once.
  if (S.G && S.G.phase === 'tidyup') {
    applyWinRewards(S.G.tidy ? S.G.tidy.leftover : S.G.coins)
    S.G.phase = 'done'
    S.G.tidy = null
  }
  S.screen = 'select'
  hideActionBar()
  hideTidyButton()
  music.stop()
  const prof = currentProfile()
  // The stop the token rests on = latest unlocked (clamped into range).
  const here = Math.min(prof.unlocked, LEVELS.length - 1)
  // Detect a fresh advance vs a normal map open (animate only on advance).
  const animateFrom = (lastShownUnlocked != null && here > lastShownUnlocked) ? lastShownUnlocked : null

  let rows = ''
  AREAS.forEach((area, ai) => {
    const areaLocked = area.levelIndices[0] > prof.unlocked
    let tiles = ''
    area.levelIndices.forEach((i, li) => {
      const lv = LEVELS[i]
      const locked = i > prof.unlocked
      const stars = prof.stars[i] || 0
      const num = locked ? '🔒' : (lv.isBoss ? '👑' : li + 1)
      // The single "next room to play" gets the attractor bounce.
      const isNext = i === here
      tiles += `
        <div class="lvl ${locked ? 'locked' : ''} ${lv.isBoss ? 'boss' : ''} ${isNext ? 'next' : ''}" data-i="${i}">
          <div class="num">${num}</div>
          <div class="lname">${locked ? '???' : lv.name}</div>
          <div class="ministars">${locked ? '' : starString(stars)}</div>
        </div>`
    })
    // serpentine: even rows flow left→right, odd rows right→left.
    rows += `
      <div class="trail-row ${ai % 2 ? 'rtl' : ''} ${areaLocked ? 'area-locked' : ''}">
        <button class="diorama" data-area="${ai}" title="${area.name}" aria-label="${area.name}">${area.emoji}</button>
        <div class="trail-stops">${tiles}</div>
      </div>`
  })
  const totalStars = Object.values(prof.stars).reduce((a, b) => a + b, 0)
  ovSelect.innerHTML = `
    <div class="card wide map-card">
      <button class="avatar-chip" id="avatarChip" title="Switch player">
        ${avatarEmoji(prof)} <span>${prof.name}</span>
      </button>
      <button class="shop-chip" id="shopChip" title="Shop">🛍️ <span>✨ ${prof.points}</span></button>
      <h1>Your Journey</h1>
      <p>⭐ Stars collected: <b>${totalStars} / ${LEVELS.length * 3}</b></p>
      <button class="big-btn backyard-btn" id="backyardBtn">🏡 Backyard — free play, no rush!</button>
      <button class="big-btn album-btn" id="albumBtn">📖 Sticker Album — see who you caught!</button>
      <div class="trail" id="trail">
        ${rows}
        <div class="map-token" id="mapToken">${tokenHTML(prof)}</div>
        <div class="map-flag" id="mapFlag">🚩</div>
      </div>
      <div class="hint">Follow the path! Each world ends with a 👑 BOSS.</div>
    </div>`
  twemojify(ovSelect)
  hideAllOverlays()
  ovSelect.classList.remove('hidden')
  document.getElementById('avatarChip').addEventListener('click', () => { sfx.click(); showProfiles() })
  document.getElementById('shopChip').addEventListener('click', () => { sfx.click(); showShop(showLevelSelect) })
  document.getElementById('backyardBtn').addEventListener('click', () => { sfx.click(); startSandbox() })
  document.getElementById('albumBtn').addEventListener('click', () => { sfx.click(); showAlbum(showLevelSelect) })
  for (const el of ovSelect.querySelectorAll('.lvl')) {
    const i = +el.dataset.i
    if (i > prof.unlocked) continue
    el.addEventListener('click', () => { sfx.click(); startLevel(i) })
  }
  // Pokeable area dioramas — stakes-free puff/wink, never selects a level.
  for (const el of ovSelect.querySelectorAll('.diorama')) {
    el.addEventListener('click', (e) => { e.stopPropagation(); pokeDiorama(el, +el.dataset.area) })
  }
  // Place the token + flag once layout settles, then animate the advance.
  requestAnimationFrame(() => placeToken(here, animateFrom))
  lastShownUnlocked = here
}

// Position the avatar token (and its 🚩 flag) over a stop. If `from` is given,
// start the token on that stop and slide it to `to`, cheering on arrival.
function placeToken(to, from) {
  const trail = document.getElementById('trail')
  const token = document.getElementById('mapToken')
  const flag = document.getElementById('mapFlag')
  if (!trail || !token) return
  const stopOf = (i) => trail.querySelector(`.lvl[data-i="${i}"]`)
  const centreOf = (el) => {
    const tr = trail.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    return { x: r.left - tr.left + r.width / 2, y: r.top - tr.top + r.height / 2 }
  }
  const target = stopOf(to)
  if (!target) return
  const place = (el, p, anchorTop) => {
    el.style.left = p.x + 'px'
    el.style.top = (anchorTop ? p.y - el.offsetHeight * 0.55 : p.y) + 'px'
  }
  const arrive = () => {
    const p = centreOf(stopOf(to))
    place(token, p, false)
    if (flag) place(flag, { x: p.x + 22, y: p.y }, true)
  }
  if (from != null && stopOf(from)) {
    // start at the old stop, then transition to the new one — a short slide.
    const start = centreOf(stopOf(from))
    place(token, start, false)
    if (flag) flag.style.opacity = '0'
    token.classList.add('travelling')
    // next frame: move + cheer
    requestAnimationFrame(() => {
      const p = centreOf(stopOf(to))
      place(token, p, false)
      token.classList.add('cheer')
    })
    setTimeout(() => {
      token.classList.remove('travelling', 'cheer')
      if (flag) { flag.style.opacity = ''; arrive() }
      sfx.win()
    }, 1100)
  } else {
    arrive()
  }
}

// §8 — diorama tap: a soft puff/twinkle floats up off the area emoji + a blip.
// Per-area flavour: volcano puffs 💨, void twinkles 🌙, mansion door creaks 🚪…
const DIORAMA_PUFF = ['💨', '🌙', '💨', '💨', '⭐']
function pokeDiorama(el, ai) {
  sfx.poke()
  el.classList.remove('poked'); void el.offsetWidth; el.classList.add('poked')
  const puff = document.createElement('span')
  puff.className = 'diorama-puff'
  puff.textContent = DIORAMA_PUFF[ai] || '✨'
  el.appendChild(puff)
  twemojify(puff)
  setTimeout(() => puff.remove(), 800)
}

function startLevel(i) {
  S.G = newGame(i)
  S.screen = 'playing'
  hideAllOverlays()
  hideActionBar()
  hideTidyButton()
  setEmojiText(elLevelName, `${LEVELS[i].areaEmoji} ${LEVELS[i].name}`)
  setEmojiText(document.getElementById('speedBtn'), '⏩')
  showPrepBanner()
  refreshPalette()
  music.play(i) // each room has its own tune
}

// §5 — start the no-fail endless Backyard sandbox. Mirrors startLevel() but
// builds the synthetic BACKYARD state (G.endless) and never touches the save.
function startSandbox() {
  S.G = newSandbox()
  S.screen = 'playing'
  hideAllOverlays()
  hideActionBar()
  hideTidyButton()
  setEmojiText(elLevelName, `${BACKYARD.areaEmoji} ${BACKYARD.name}`)
  setEmojiText(document.getElementById('speedBtn'), '⏩')
  showPrepBanner()
  refreshPalette()
  music.play(0) // a cheery tune for the garden
}

// The gentle off-ramp: drift back to the map — no game-over.
function leaveSandbox() {
  music.stop()
  hidePrepBanner()
  showLevelSelect()
}

function computeStars() {
  const lost = S.G.livesMax - S.G.lives
  if (lost <= 1) return 3
  if (lost <= Math.ceil(S.G.livesMax * 0.4)) return 2
  return 1
}

// ===========================================================================
// §9 Closure ritual — "tidy up". A calm, ~3s, SKIPPABLE put-away the kid taps
// once. Slots BETWEEN win-detection (checkWaveCleared) and the result/stars.
// The board stays on screen; helpers hop off, leftover coins swoosh into a 🐷,
// the house tucks in, the avatar claps — then the result reveals.
//
// Reward integrity: we SNAPSHOT leftover coins here (before the swoosh animation
// drains them) and pass it to win(), so the §1 points formula is unaffected by
// the animation. win()'s rewards (stars/unlock/points/save) fire EXACTLY ONCE,
// on the single transition into the result — whether the ritual plays out or the
// kid skips/taps away.
// ===========================================================================
const TIDY_DUR = 3.0 // target ritual length (seconds); we hard-cap the loop too

function beginTidyUp() {
  const G = S.G
  // Snapshot leftover coins NOW — the swoosh visually drains G.coins toward 0,
  // but the reward math must use this captured total.
  const leftover = G.coins
  G.phase = 'tidyup'
  G.tidy = { t: 0, coins0: leftover, coins: leftover, leftover, ran: false }
  // give each placed helper a staggered exit time + a gentle random hop arc
  G.towers.forEach((t, idx) => {
    t.exitAt = 0.15 + idx * 0.18
    t.exitDir = (idx % 2 === 0 ? -1 : 1)
    t.popped = false
  })
  lastSwooshAt = -1
  music.stop() // gentle hush; the ritual has its own little cues
  showTidyButton()
}

function showTidyButton() {
  setEmojiText(tidyBtn, '✨ Tidy up!')
  tidyBtn.classList.remove('hidden', 'skip')
  tidyBtn._mode = 'tidy'
  tidyBtn.onclick = onTidyTap
}

function onTidyTap() {
  sfx.click()
  const G = S.G
  if (!G || G.phase !== 'tidyup' || !G.tidy) return
  if (!G.tidy.ran) {
    // First tap → play the ritual. Swap the button to a friendly "skip".
    G.tidy.ran = true
    setEmojiText(tidyBtn, '⏩ Skip')
    tidyBtn.classList.add('skip')
  } else {
    // Second tap → fast-forward straight to the result.
    finishTidyUp()
  }
}

let lastSwooshAt = -1
// Ticked from the main loop while phase==='tidyup' (real-ish dt, scaled by speed
// like the rest of the sim). Drives the staggered helper hops, the coin swoosh
// and the house tuck-in. Auto-reveals the result when the timeline completes.
function tickTidyUp(dt) {
  const G = S.G
  if (!G || G.phase !== 'tidyup' || !G.tidy) return
  if (!G.tidy.ran) return // waiting for the kid's first tap — board just sits there
  const td = G.tidy
  td.t += dt
  // 1) helpers wave + hop off, one by one, each with a soft pop.
  for (const t of G.towers) {
    if (!t.popped && td.t >= (t.exitAt || 0)) {
      t.popped = true
      popEffect(t.cx, t.cy - 4, t.def.color)
      floatText(t.cx, t.cy - 18, 'bye! 👋', '#ffd34d', 16)
      sfx.hop()
    }
  }
  // 2) coins swoosh into the piggy — drain the (display-only) counter toward 0
  //    over ~1.2s starting a beat in, with a rising-pitch tick each step.
  const drainStart = 0.5, drainDur = 1.3
  if (td.coins0 > 0 && td.t >= drainStart) {
    const f = clampTidy((td.t - drainStart) / drainDur, 0, 1)
    td.coins = Math.round(td.coins0 * (1 - f))
    G.coins = td.coins // visually drain the HUD (reward already snapshotted)
    const step = Math.floor((td.t - drainStart) * 9)
    if (step !== lastSwooshAt && f < 1) { lastSwooshAt = step; sfx.swoosh(step % 6) }
  }
  // 3) house tucks in near the end — the door dim is read by drawDoor() off
  //    G.tidy.t, and a one-shot cozy "tuck" cue fires once.
  if (!td.tucked && td.t >= TIDY_DUR - 1.1) {
    td.tucked = true
    sfx.tuck()
  }
  // done → reveal the stars
  if (td.t >= TIDY_DUR) finishTidyUp()
}

function clampTidy(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

// Single transition into the result — fires the reward exactly once via win()
// with the captured leftover coins. Reached by natural finish OR a skip tap.
function finishTidyUp() {
  const G = S.G
  if (!G || G.phase !== 'tidyup') return
  const leftover = G.tidy ? G.tidy.leftover : G.coins
  G.phase = 'done'
  G.tidy = null
  hideTidyButton()
  win(leftover)
}

function hideTidyButton() {
  tidyBtn.classList.add('hidden')
  tidyBtn.onclick = null
}

// Apply the win rewards (stars / unlock / §1 points / save) EXACTLY ONCE per
// game, guarded by G.rewarded. Called from win() on the result reveal, and also
// if the kid taps away mid-tidy-up (so progression is never lost). Returns the
// { stars, earned, coins } it used so win() can render them.
function applyWinRewards(leftoverCoins) {
  const G = S.G
  if (G.rewarded) return G.rewarded // already applied — reuse the snapshot
  const coins = Number.isFinite(leftoverCoins) ? leftoverCoins : G.coins
  const stars = computeStars()
  const i = G.levelIndex
  const prof = currentProfile()
  if (stars > (prof.stars[i] || 0)) prof.stars[i] = stars
  if (i + 1 > prof.unlocked && i + 1 < LEVELS.length) prof.unlocked = i + 1
  if (i + 1 >= LEVELS.length) prof.unlocked = Math.max(prof.unlocked, LEVELS.length - 1)
  // Persistent Points wallet (§1, separate from stars): a clear bonus + the
  // stars earned + a little for leftover coins. Hats are bought with these.
  const earned = 3 + stars + Math.floor(coins / 25)
  prof.points += earned
  writeSave()
  // Beating a level (incl. the final one — finishing the map) ends any stuck
  // streak: the kid clearly isn't stuck on it anymore.
  resetStuck()
  G.rewarded = { stars, earned, coins }
  return G.rewarded
}

function win(leftoverCoins) {
  // leftoverCoins is the coin total captured at win-time (before the tidy-up
  // swoosh drained the HUD). Fall back to the live total if called directly.
  const { stars, earned } = applyWinRewards(leftoverCoins)
  const i = S.G.levelIndex
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
      <p class="treats">✨ +${earned} treats!</p>
      <p>${stars === 3 ? 'Perfect! Not a single monster got by! 🌟' : 'Great catching! Can you get all 3 stars? 💪'}</p>
      <div>
        ${!isLast ? '<button class="big-btn green" id="nextBtn">▶ Next Room</button>' : '<p>🏆 You finished every room! You are a Ghost Master! 🏆</p>'}
        <button class="big-btn" id="replayBtn">🔁 Play Again</button>
        <button class="big-btn" id="shopBtn">🛍️ Shop</button>
        <button class="big-btn" id="mapBtn">🗺️ Rooms</button>
      </div>
    </div>`
  twemojify(ovResult)
  ovResult.classList.remove('hidden')
  const next = document.getElementById('nextBtn')
  if (next) next.addEventListener('click', () => { sfx.click(); startLevel(i + 1) })
  document.getElementById('replayBtn').addEventListener('click', () => { sfx.click(); startLevel(i) })
  // Re-show the (already-built) result overlay on Done — never re-run win(),
  // which would re-award points.
  document.getElementById('shopBtn').addEventListener('click', () => {
    sfx.click()
    showShop(() => { hideAllOverlays(); ovResult.classList.remove('hidden') })
  })
  document.getElementById('mapBtn').addEventListener('click', () => { sfx.click(); showLevelSelect() })
}

function lose() {
  S.G.phase = 'done'
  music.stop()
  sfx.lose()
  hidePrepBanner()
  const i = S.G.levelIndex
  // §stuck — count this loss, then peek at what the NEXT retry of this room will
  // start with. Two losses in a row here onward earns a growing coin boost.
  recordLoss(i)
  const boost = stuckBonusFor(i)
  const boostNote = boost > 0
    ? `<p class="treats">💰 Here's <b>${boost}</b> extra coins to help you catch them this time!</p>`
    : ''
  ovResult.innerHTML = `
    <div class="card">
      <h1>😅 Oh no!</h1>
      <h2>The monsters got through!</h2>
      <p>That's okay — every ghost catcher needs practice. Try again, you've got this! 💜</p>
      ${boostNote}
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
// Shop (§1) — spend persistent Points on cosmetic hats for the chosen avatar.
// `back` is called when the kid taps Done (returns to wherever they came from).
// ===========================================================================
function showShop(back) {
  S.screen = 'shop'
  hideActionBar()
  const render = () => {
    const prof = currentProfile()
    const av = AVATARS[prof.avatar] || AVATARS.girl
    const hat = HATS[prof.hat] || HATS.none
    const tiles = HAT_ORDER.map((id) => {
      const h = HATS[id]
      const owned = prof.owned.includes(id)
      const equipped = prof.hat === id
      const afford = prof.points >= h.cost
      let action
      if (equipped) action = `<div class="hat-state equipped">Equipped ✓</div>`
      else if (owned) action = `<button class="hat-btn equip" data-equip="${id}">Equip</button>`
      else action = `<button class="hat-btn buy ${afford ? '' : 'cant'}" data-buy="${id}">Buy ✨${h.cost}</button>`
      return `
        <div class="hat-tile ${equipped ? 'on' : ''}">
          <div class="hat-emoji">${h.emoji || '🚫'}</div>
          <div class="hat-name">${h.name}</div>
          ${action}
        </div>`
    }).join('')
    ovShop.innerHTML = `
      <div class="card wide">
        <h1>🛍️ Hat Shop</h1>
        <div class="shop-top">
          <div class="shop-preview">
            <div class="sp-avatar">
              <span class="sp-face">${av.emoji}</span>
              ${hat.emoji ? `<span class="sp-hat">${hat.emoji}</span>` : ''}
            </div>
            <div class="sp-name">${av.name}</div>
          </div>
          <div class="shop-wallet">✨ <b>${prof.points}</b><div class="sw-label">treats</div></div>
        </div>
        <div class="hat-grid">${tiles}</div>
        <button class="big-btn green" id="shopDone">✅ Done</button>
      </div>`
    twemojify(ovShop)
    for (const el of ovShop.querySelectorAll('[data-buy]')) {
      el.addEventListener('click', () => {
        const id = el.dataset.buy
        const h = HATS[id]
        const p = currentProfile()
        if (p.points < h.cost || p.owned.includes(id)) return
        p.points -= h.cost
        p.owned.push(id)
        p.hat = id // auto-equip the freshly bought hat — instant delight
        writeSave()
        sfx.buy()
        render()
      })
    }
    for (const el of ovShop.querySelectorAll('[data-equip]')) {
      el.addEventListener('click', () => {
        const p = currentProfile()
        p.hat = el.dataset.equip
        writeSave()
        sfx.buy()
        render()
      })
    }
    document.getElementById('shopDone').addEventListener('click', () => { sfx.click(); back() })
  }
  render()
  hideAllOverlays()
  ovShop.classList.remove('hidden')
}

// ===========================================================================
// Sticker Album — a scrapbook of every monster kind. Caught ones show in full
// hand-drawn colour with their name; ones never caught are blacked-out "???"
// silhouettes to spark the "gotta catch 'em all" itch. Reads the active
// profile's `caught` set (filled by recordCaught in killEnemy). `back` is the
// return callback (the level select).
// ===========================================================================
function showAlbum(back) {
  S.screen = 'album'
  hideActionBar()
  const prof = currentProfile()
  const caught = prof.caught || {}
  const entries = Object.entries(ENEMIES)
  const monsters = entries.filter(([, def]) => !def.boss)
  const bosses = entries.filter(([, def]) => def.boss)
  const total = entries.length
  const have = entries.filter(([key]) => caught[key]).length

  const tile = ([key, def]) => {
    const got = !!caught[key]
    return `
      <div class="album-tile ${got ? 'on' : 'locked'}">
        <canvas class="album-art" width="100" height="100" data-key="${key}"></canvas>
        <div class="album-name">${got ? def.name : '???'}</div>
      </div>`
  }
  const section = (list) => list.map(tile).join('')

  ovAlbum.innerHTML = `
    <div class="card wide album-card">
      <h1>📖 Sticker Album</h1>
      <p>You've caught <b>${have} / ${total}</b> spooky friends! ${have >= total ? '🏆 All of them!' : 'Catch them all! 💜'}</p>
      <h2 class="album-sub">Monsters</h2>
      <div class="album-grid">${section(monsters)}</div>
      <h2 class="album-sub">👑 Bosses</h2>
      <div class="album-grid">${section(bosses)}</div>
      <button class="big-btn green" id="albumDone">✅ Done</button>
    </div>`
  twemojify(ovAlbum)
  hideAllOverlays()
  ovAlbum.classList.remove('hidden')

  // Paint each sticker onto its canvas — full colour if caught, else a dark
  // silhouette (draw the body, then flood dark only over its pixels) with a "?".
  for (const cv of ovAlbum.querySelectorAll('.album-art')) {
    const key = cv.dataset.key
    const def = ENEMIES[key]
    const g = cv.getContext('2d')
    const fake = { def, type: key, facing: 1, bobPhase: 0 }
    g.save()
    drawEnemyBody(g, fake, 50, 48, 30, 0)
    g.restore()
    if (!caught[key]) {
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = '#1c1338'
      g.fillRect(0, 0, cv.width, cv.height)
      g.globalCompositeOperation = 'source-over'
      g.fillStyle = 'rgba(255,255,255,0.55)'
      g.font = '900 38px system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('?', 50, 52)
    }
  }
  document.getElementById('albumDone').addEventListener('click', () => { sfx.click(); back() })
}

export {
  showStart, showLevelSelect, win, lose, showShop, showAlbum, startSandbox, leaveSandbox,
  beginTidyUp, tickTidyUp,
}
