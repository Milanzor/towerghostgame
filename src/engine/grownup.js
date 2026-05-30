// ---------------------------------------------------------------------------
// §6 Grown-up corner — quiet parental controls behind a hold-to-open gate.
//
//   • A small ⚙️ button (start screen + level select) opens a hold-to-open gate
//     (press & hold ~2s, filling ring) so a 4-year-old can't wander in.
//   • The grown-up panel: difficulty / vibe lock, a soft play-timer, and a
//     two-step "reset progress" wipe.
//   • A gentle wind-down when the play-timer runs out: music slows and the field
//     dims, then a calm "Time to rest 😴" screen — with a parent-approved
//     "5 more minutes" (gated again, never a hard auto-cut).
//
// The play timer counts only real PLAY seconds (S.screen==='playing' && !paused)
// and PERSISTS across the session (entering/leaving rooms, the sandbox, menus).
// ---------------------------------------------------------------------------
import { S, currentProfile, writeSave, currentVibe, resetAllProgress } from './state.js'
import { sfx, music } from '../audio.js'
import { twemojify } from '../emoji.js'
import { ovGrownup, ovRest, hideAllOverlays } from './dom.js'

const HOLD_MS = 2000 // press-and-hold duration to clear the gate

// ===========================================================================
// Session play timer
// ===========================================================================
const timer = {
  elapsed: 0,     // real PLAY seconds this session (across rooms)
  budget: 0,      // seconds allowed before wind-down (0 = no limit)
  windingDown: false, // ramp/rest sequence currently running
  rampT: 0,       // 0..RAMP_SECS while the music slows + field dims
}
const RAMP_SECS = 4 // gentle ramp before the rest screen appears

function limitSeconds() {
  const m = currentProfile().settings.playMinutes
  return Number.isFinite(m) && m > 0 ? m * 60 : 0
}

// Pick up the configured limit at the start of a play session (only if we're
// not already counting down toward a wind-down).
function syncBudget() {
  const lim = limitSeconds()
  if (lim <= 0) { timer.budget = 0; return }
  // First time arming, or the parent raised the limit above what we've used.
  if (timer.budget <= 0) timer.budget = lim
}

// Tick from the frame loop with REAL elapsed seconds. Counts only while a room
// is actually being played and not paused, so menus never burn the budget.
export function tickPlayTimer(dtReal) {
  if (S.screen !== 'playing' || !S.G || S.G.paused) {
    // Not actively playing — but if a wind-down ramp is mid-flight keep it
    // moving (it pauses the game itself once the rest screen shows).
    if (timer.windingDown && timer.rampT < RAMP_SECS) advanceRamp(dtReal)
    return
  }
  syncBudget()
  if (timer.windingDown) { advanceRamp(dtReal); return }
  if (timer.budget <= 0) return // no limit set
  timer.elapsed += dtReal
  if (timer.elapsed >= timer.budget) beginWindDown()
}

function advanceRamp(dtReal) {
  if (timer.rampT >= RAMP_SECS) return
  timer.rampT += dtReal
  // ramp music from normal → half speed across the window
  const f = 1 + Math.min(1, timer.rampT / RAMP_SECS)
  music.slow(f)
  if (timer.rampT >= RAMP_SECS) showRestScreen()
}

function beginWindDown() {
  if (timer.windingDown) return
  timer.windingDown = true
  timer.rampT = 0
  document.body.classList.add('winddown') // CSS dims palette + field
}

// Calm "time to rest" screen — never slams the door. Pauses the game cleanly.
function showRestScreen() {
  if (S.G) S.G.paused = true
  music.stop()
  ovRest.innerHTML = `
    <div class="card rest-card">
      <div class="rest-face">😴</div>
      <h1>Time to rest!</h1>
      <p>Great playing today! 💜 The ghosts are getting sleepy too.</p>
      <div>
        <button class="big-btn hold-btn" id="restMoreBtn"><span class="hold-ring-fill"></span><span class="hold-label">⏰ 5 more minutes</span></button>
        <button class="big-btn green" id="restDoneBtn">😴 All done</button>
      </div>
      <div class="hint">A grown-up can <b>hold</b> ⏰ for 5 more minutes.</div>
    </div>`
  twemojify(ovRest)
  hideAllOverlays()
  ovRest.classList.remove('hidden')
  // "5 more minutes" is parent-approved: it sits behind the SAME hold gate so a
  // kid can't grant it themselves.
  attachHold(document.getElementById('restMoreBtn'), () => grantFiveMore())
  document.getElementById('restDoneBtn').addEventListener('click', () => {
    sfx.click()
    endWindDown()
    // back to the room picker, where the parent can hand it over or stop.
    import('./screens.js').then(m => m.showLevelSelect())
  })
}

function grantFiveMore() {
  sfx.win()
  // Extend the budget by 5 min from where we are. elapsed is preserved, so the
  // total only grows by 5 minutes — no time is lost or double-counted.
  timer.budget = timer.elapsed + 5 * 60
  endWindDown()
  if (S.G) {
    S.G.paused = false
    // resume the room's own tune at full pace
    music.play(S.G.endless ? 0 : S.G.levelIndex)
  }
}

function endWindDown() {
  timer.windingDown = false
  timer.rampT = 0
  document.body.classList.remove('winddown')
  music.slow(1)
  ovRest.classList.add('hidden')
}

// ===========================================================================
// Hold-to-open gate — reliable on mouse + touch via Pointer Events. A quick tap
// does nothing; a ~2s hold (with a filling ring) clears it. Cancels on early
// release or if the finger/pointer leaves the button.
// ===========================================================================
function attachHold(btn, onOpen) {
  if (!btn) return
  let raf = null
  let start = 0
  let pointerId = null

  const cancel = () => {
    if (raf) { cancelAnimationFrame(raf); raf = null }
    start = 0
    pointerId = null
    btn.classList.remove('holding')
    btn.style.removeProperty('--hold')
  }

  const tick = () => {
    const p = Math.min(1, (performance.now() - start) / HOLD_MS)
    // CSS reads --hold (0..1) and draws the fill appropriate to the button shape
    // (a conic ring on the round ⚙️ gate, a left-to-right wipe on the pill).
    btn.style.setProperty('--hold', p)
    if (p >= 1) {
      cancel()
      sfx.click()
      onOpen()
      return
    }
    raf = requestAnimationFrame(tick)
  }

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (pointerId !== null) return
    pointerId = e.pointerId
    try { btn.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    start = performance.now()
    btn.classList.add('holding')
    raf = requestAnimationFrame(tick)
  })
  const release = (e) => { if (pointerId === null || e.pointerId === pointerId) cancel() }
  btn.addEventListener('pointerup', release)
  btn.addEventListener('pointercancel', release)
  btn.addEventListener('pointerleave', release)
}

// The little ⚙️ corner button — markup includes the fill ring used by the hold.
export function gearButtonHTML() {
  return `<button class="gear-btn" id="gearBtn" title="Grown-ups">
    <span class="hold-ring-fill"></span><span class="gear-ico">⚙️</span></button>`
}

// Wire a freshly-rendered ⚙️ button (called after a screen draws it). Holding it
// opens the grown-up panel; a quick tap shows a tiny "hold me" nudge.
export function wireGearButton() {
  wireHoldGate(document.getElementById('gearBtn'))
}

// The permanent in-game ⚙️ in the HUD top bar (next to the room name). Wired once
// at boot — same hold-to-open gate, so opening it mid-game is parent-only.
export function wireSettingsButton() {
  wireHoldGate(document.getElementById('settingsBtn'))
}

function wireHoldGate(btn) {
  if (!btn) return
  attachHold(btn, () => showGrownupPanel())
  // a quick tap (no hold) gives a gentle, discoverable hint
  let downAt = 0
  btn.addEventListener('pointerdown', () => { downAt = performance.now() })
  btn.addEventListener('pointerup', () => {
    if (performance.now() - downAt < 350) {
      btn.classList.add('nudge')
      setTimeout(() => btn.classList.remove('nudge'), 600)
    }
  })
}

// ===========================================================================
// Grown-up panel
// ===========================================================================
const VIBES = [
  { id: 'cozy',      emoji: '😌', name: 'Cozy',      blurb: 'No fail — monsters just float away. Pure relaxing play.' },
  { id: 'justright', emoji: '🙂', name: 'Just Right', blurb: 'The normal game.' },
  { id: 'bigkid',    emoji: '😄', name: 'Big Kid',   blurb: 'A gentle bump — one fewer heart to start. Still friendly.' },
]
const MINUTE_OPTS = [0, 10, 20, 30] // 0 = no limit

function showGrownupPanel() {
  const prevScreen = S.screen
  S.screen = 'grownup'
  const render = () => {
    const prof = currentProfile()
    const vibe = currentVibe()
    const mins = prof.settings.playMinutes || 0

    const vibeTiles = VIBES.map(v => `
      <button class="gp-vibe ${vibe === v.id ? 'on' : ''}" data-vibe="${v.id}">
        <div class="gp-vibe-emoji">${v.emoji}</div>
        <div class="gp-vibe-name">${v.name}</div>
        <div class="gp-vibe-blurb">${v.blurb}</div>
      </button>`).join('')

    const minTiles = MINUTE_OPTS.map(m => `
      <button class="gp-min ${mins === m ? 'on' : ''}" data-min="${m}">
        ${m === 0 ? 'Off' : m + ' min'}
      </button>`).join('')

    ovGrownup.innerHTML = `
      <div class="card wide gp-card">
        <h1>⚙️ Grown-up corner</h1>

        <div class="gp-section">
          <h2>Difficulty</h2>
          <div class="gp-vibes">${vibeTiles}</div>
        </div>

        <div class="gp-section">
          <h2>Play timer</h2>
          <p class="gp-sub">A gentle wind-down (the music slows and a "time to rest" screen appears) when the time is up. You can always grant 5 more minutes.</p>
          <div class="gp-mins">${minTiles}</div>
        </div>

        <div class="gp-section">
          <h2>Reset progress</h2>
          <p class="gp-sub">Wipes all players, stars and treats — for a hand-me-down or a fresh start.</p>
          <button class="big-btn gp-reset" id="gpReset">🗑️ Reset everything…</button>
        </div>

        <button class="big-btn green" id="gpDone">✅ Done</button>
      </div>`
    twemojify(ovGrownup)

    for (const el of ovGrownup.querySelectorAll('[data-vibe]')) {
      el.addEventListener('click', () => {
        currentProfile().settings.vibe = el.dataset.vibe
        writeSave()
        sfx.click()
        render()
      })
    }
    for (const el of ovGrownup.querySelectorAll('[data-min]')) {
      el.addEventListener('click', () => {
        const m = +el.dataset.min
        currentProfile().settings.playMinutes = m
        writeSave()
        sfx.click()
        // Re-arm the live budget so a change takes effect immediately.
        timer.budget = m > 0 ? Math.max(timer.elapsed, m * 60) : 0
        render()
      })
    }

    // Two-step reset so it can't be tapped through by accident.
    const resetBtn = document.getElementById('gpReset')
    resetBtn.addEventListener('click', () => {
      sfx.click()
      resetBtn.outerHTML = `
        <div class="gp-confirm" id="gpConfirm">
          <p class="gp-sub"><b>Really erase everything?</b> This can't be undone.</p>
          <button class="big-btn gp-reset" id="gpResetYes">🗑️ Yes, erase it all</button>
          <button class="big-btn" id="gpResetNo">Keep my progress</button>
        </div>`
      twemojify(document.getElementById('gpConfirm'))
      document.getElementById('gpResetNo').addEventListener('click', () => { sfx.click(); render() })
      document.getElementById('gpResetYes').addEventListener('click', () => {
        resetAllProgress()
        // also clear the live session timer so the fresh start really is fresh
        timer.elapsed = 0; timer.budget = 0; endWindDown()
        sfx.win()
        hideAllOverlays()
        import('./screens.js').then(m => m.showStart())
      })
    })

    document.getElementById('gpDone').addEventListener('click', () => {
      sfx.click()
      hideAllOverlays()
      // Return to wherever the parent opened the panel from. Opened mid-game
      // (via the HUD ⚙️) → just resume the room; otherwise back to the menu.
      if (prevScreen === 'playing') { S.screen = 'playing'; return }
      import('./screens.js').then(m => prevScreen === 'start' ? m.showStart() : m.showLevelSelect())
    })
  }
  render()
  hideAllOverlays()
  ovGrownup.classList.remove('hidden')
}
