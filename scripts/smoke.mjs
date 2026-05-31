// Headless "full circle" smoke test for Ghost Catchers. No deps: serves the
// built docs/ via `vite preview`, drives system chromium over the DevTools
// protocol with Node's global WebSocket, and plays a COMPLETE loop through every
// major system, failing if any console.error / uncaught exception fires OR any
// in-test assertion (check) fails.
//
// The circle:
//   boot → Play → "Welcome!" picker (§7: fresh start, make a player) → world-map trail (§8: token,
//   flag, dioramas) → Shop (§1) → Grown-up corner via the hold gate, set Cozy
//   (§6) → enter a room → place + upgrade helpers (leveling) → clear EVERY wave
//   to a real win (Cozy guarantees it) → tidy-up ritual + skip (§9) →
//   result/stars/treats → back to the map with progress advanced → Backyard
//   sandbox: ∞ lives, run a wave, leave (§5). Enemy powers (§3) and branching
//   lanes (§4) ride along in the levels that use them.
//
// Run:  npm run build && node scripts/smoke.mjs
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'

const PORT = 5219
const CDP_PORT = 9347
const URL = `http://127.0.0.1:${PORT}/`
const CHROME = '/usr/bin/chromium'

const procs = []
function cleanup() { for (const p of procs) { try { p.kill('SIGKILL') } catch {} } }
process.on('exit', cleanup)

async function waitFor(fn, label, tries = 50, gap = 200) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v } catch {}
    await sleep(gap)
  }
  throw new Error(`timed out waiting for ${label}`)
}

// --- tiny CDP client over the flat session protocol ---
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [] }
  static async attach(browserWsUrl) {
    const ws = new WebSocket(browserWsUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    const c = new CDP(ws)
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && c.pending.has(m.id)) {
        const { res, rej } = c.pending.get(m.id); c.pending.delete(m.id)
        m.error ? rej(new Error(m.error.message)) : res(m.result)
      } else if (m.method) {
        for (const h of c.handlers) h(m)
      }
    }
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true })
    c.sessionId = sessionId
    return c
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id
    const msg = { id, method, params }
    if (useSession && this.sessionId) msg.sessionId = this.sessionId
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej })
      this.ws.send(JSON.stringify(msg))
    })
  }
  on(handler) { this.handlers.push(handler) }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result?.value
  }
}

async function main() {
  // 1) serve the build
  const preview = spawn('node_modules/.bin/vite', ['preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' })
  procs.push(preview)
  await waitFor(async () => (await fetch(URL)).ok, 'preview server')

  // 2) launch chromium with remote debugging
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=/tmp/gc-smoke-run',
    '--window-size=980,840', 'about:blank',
  ], { stdio: 'pipe' })
  procs.push(chrome)
  const ver = await waitFor(async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(), 'chrome devtools')

  // 3) attach + collect problems
  const errors = []
  const failures = []
  const cdp = await CDP.attach(ver.webSocketDebuggerUrl)
  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      const e = m.params.exceptionDetails
      errors.push('UNCAUGHT: ' + (e.exception?.description || e.text))
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      // ignore network 404s for favicon etc; flag the rest
      if (!/favicon/.test(m.params.entry.text)) errors.push('log.error: ' + m.params.entry.text)
    }
  })
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')
  await cdp.send('Page.enable')

  // 4) load the game — clear any persisted save first so the run is idempotent
  // (fixed --user-data-dir keeps localStorage between runs; wipe it for a fresh
  // two-profile / unlocked:0 / "Just Right" save every time).
  await cdp.send('Page.navigate', { url: URL })
  await sleep(600)
  await cdp.eval(`(localStorage.clear(), 'cleared')`)
  await cdp.send('Page.navigate', { url: URL })
  await sleep(1500)

  const step = async (label, expr) => {
    const v = await cdp.eval(expr)
    console.log(`  • ${label}: ${JSON.stringify(v)}`)
    return v
  }
  // A hard assertion: logs ✓/✗ and records a failure (fails the whole run).
  const check = (label, cond, detail = '') => {
    console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
    if (!cond) failures.push(label + (detail ? ` — ${detail}` : ''))
    return cond
  }
  const click = (sel) => cdp.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'missing'; e.click(); return 'ok' })()`)
  // click + log (click() already runs the eval, so it can't be wrapped in step())
  const act = async (label, sel) => { const r = await click(sel); console.log(`  • ${label}: ${JSON.stringify(r)}`); return r }
  const visible = (id) => cdp.eval(`(() => { const e = document.getElementById(${JSON.stringify(id)}); return !!(e && !e.classList.contains('hidden')) })()`)
  const count = (sel) => cdp.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`)
  const txt = (sel) => cdp.eval(`(document.querySelector(${JSON.stringify(sel)})?.textContent || '').trim()`)

  // tap a grid cell (15×8) at its centre
  const tapCell = (c, row) => `(() => {
    const cv = document.getElementById('canvas'); const r = cv.getBoundingClientRect()
    const x = r.left + r.width * ((${c} + 0.5) / 15), y = r.top + r.height * ((${row} + 0.5) / 8)
    cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }))
    return 'ok'
  })()`
  // ===================================================================
  // BOOT → PROFILE PICKER (§7)
  // ===================================================================
  console.log('\n— boot & profiles (§7) —')
  check('Play button present', await cdp.eval(`!!document.getElementById('playBtn')`))
  await step('click Play', `(document.getElementById('playBtn').click(), 'ok')`)
  await sleep(400)
  // Fresh device / post-reset → no seeded profiles; the kid makes their own.
  const nCards = await count('.profile-card[data-id]')
  check('fresh start has no players', nCards === 0, `${nCards} cards`)
  check('"make a player" card present', await cdp.eval(`!!document.getElementById('addProfileCard')`))
  await act('tap make-a-player', '#addProfileCard')
  await sleep(300)
  check('new-player flow shown', await cdp.eval(`!!document.getElementById('createBtn')`))
  await act('create the player', '#createBtn')
  await sleep(400)

  // ===================================================================
  // WORLD-MAP TRAIL (§8)
  // ===================================================================
  console.log('\n— world map journey (§8) —')
  const tiles = await count('.lvl')
  check('25 room tiles on the trail', tiles === 25, `${tiles} tiles`)
  check('avatar token present', await cdp.eval(`!!document.getElementById('mapToken')`))
  check('"you are here" flag present', await cdp.eval(`!!document.getElementById('mapFlag')`))
  const dioramas = await count('.diorama')
  check('pokeable area dioramas present', dioramas >= 1, `${dioramas} dioramas`)
  if (dioramas) {
    await step('poke a diorama', `(document.querySelector('.diorama').click(), 'ok')`)
    await sleep(150)
    check('poke did NOT start a level (still on map)', await visible('ovSelect') && (await count('.lvl')) === 25)
  }

  // ===================================================================
  // SHOP (§1)
  // ===================================================================
  console.log('\n— shop (§1) —')
  await act('open Shop', '#shopChip')
  await sleep(300)
  check('shop overlay open', await visible('ovShop'))
  const hats = await count('.hat-tile')
  check('shop shows a hat grid', hats >= 3, `${hats} hats`)
  check('treats wallet shown', (await count('.shop-wallet')) >= 1)
  check('an unaffordable hat is greyed (.cant)', (await count('[data-buy].cant')) >= 1)
  await act('close Shop', '#shopDone')
  await sleep(250)
  check('back on the map', await visible('ovSelect'))

  // ===================================================================
  // ENTER A ROOM → LEVELING
  // ===================================================================
  console.log('\n— play: place + level up helpers —')
  await step('enter first room', `(document.querySelector('.lvl:not(.locked)').click(), 'ok')`)
  await sleep(800)
  check('palette built', (await count('.tower-btn')) >= 1, `${await count('.tower-btn')} helpers`)
  check('in-game settings ⚙️ present in HUD (next to room name)', await cdp.eval(`!!document.getElementById('settingsBtn')`))

  // ===================================================================
  // GROWN-UP CORNER (§6) — open the in-game HUD ⚙️ gate, switch to Cozy
  // (no-fail) so the upcoming win is deterministic, then resume the room.
  // No wave has started yet, so flipping to Cozy now can't have cost a life.
  // ===================================================================
  console.log('\n— grown-up corner via in-game HUD gate (§6) —')
  await step('press-and-hold the in-game ⚙️', `(() => {
    const b = document.getElementById('settingsBtn')
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }))
    return 'holding'
  })()`)
  await sleep(2400) // ~2s hold (the rAF ring fills and opens the panel itself)
  check('grown-up panel opened by the hold', await visible('ovGrownup'))
  await step('choose 😌 Cozy', `(() => { const e = document.querySelector('#ovGrownup [data-vibe="cozy"]'); if (!e) return 'missing'; e.click(); return 'ok' })()`)
  await sleep(150)
  await act('close panel (resume room)', '#gpDone')
  await sleep(250)
  check('settings closed → back in the room', !(await visible('ovGrownup')))

  await step('speed up to 3×', `(document.getElementById('speedBtn').click(), document.getElementById('speedBtn').click(), 'ok')`)

  // leveling (headline): place a Candle, upgrade twice
  await step('select Candle', `(document.querySelector('.tower-btn[data-key="candle"]').click(), 'ok')`)
  await step('place Candle @ (0,0)', tapCell(0, 0))
  await step('deselect helper', `(document.querySelector('.tower-btn.active')?.click(), 'ok')`)
  await step('select placed Candle', tapCell(0, 0))
  const upLabel = await txt('.action-bar .up')
  check('action bar offers an upgrade', /Lvl 2/.test(upLabel), upLabel)
  await step('upgrade → Lvl 2', `(document.querySelector('.action-bar .up').click(), 'ok')`)
  await sleep(120)
  await step('upgrade → Lvl 3', `(document.querySelector('.action-bar .up').click(), 'ok')`)
  await sleep(120)
  check('upgrades took (now offers Lvl 4)', /Lvl 4/.test(await txt('.action-bar .up')))
  await step('deselect', `(document.getElementById('canvas').dispatchEvent(new PointerEvent('pointerdown',{clientX:5,clientY:5,bubbles:true})), 'ok')`)

  // a couple more helpers so the board does something
  await step('place Tornado (pull) @ (1,0)', `(document.querySelector('.tower-btn[data-key="tornado"]').click(), 'ok')`)
  await step('  → tap (1,0)', tapCell(1, 0))

  // ===================================================================
  // CLEAR EVERY WAVE → WIN (Cozy guarantees it) → TIDY-UP (§9)
  // ===================================================================
  console.log('\n— clear all waves → win → tidy-up (§9) —')
  const wavesTotal = (await txt('#wave')).split('/')[1] || '?'
  console.log(`  • this room has ${wavesTotal} waves`)
  let won = false
  let pressedGo = 0
  for (let i = 0; i < 60 && !won; i++) {
    // press Start / Next Wave whenever the GO button is live (prep phase)
    const r = await cdp.eval(`(() => { const g = document.getElementById('goBtn'); if (g && !g.disabled) { g.click(); return 'go' } return 'wait' })()`)
    if (r === 'go') pressedGo++
    await sleep(1100)
    // tidy-up button appears after the final wave clears: tap to run, tap to skip
    if (await visible('tidyBtn')) {
      await cdp.eval(`document.getElementById('tidyBtn').click()`) // start the ritual
      await sleep(900)
      await cdp.eval(`(() => { const t = document.getElementById('tidyBtn'); if (t && !t.classList.contains('hidden')) t.click(); return 'skip' })()`) // skip → result
      await sleep(600)
    }
    won = await cdp.eval(`(() => { const r = document.getElementById('ovResult'); return !!(r && !r.classList.contains('hidden') && r.querySelector('.star-on')) })()`)
  }
  check(`pressed Start/Next-Wave through the room`, pressedGo >= 1, `${pressedGo} presses`)
  check('level was WON (tidy-up + result reached)', won)

  // ===================================================================
  // RESULT SCREEN — stars + treats (§1 points)
  // ===================================================================
  console.log('\n— result: stars & treats —')
  const starsOn = await count('.stars .star-on')
  check('stars awarded on the result screen', starsOn >= 1, `${starsOn}/3 lit (Cozy → expect 3)`)
  const treats = await txt('.treats')
  check('treats (points) awarded', /\+\d+/.test(treats), treats)
  await act('back to the map', '#mapBtn')
  await sleep(500)

  // ===================================================================
  // PROGRESS ADVANCED — the next room unlocked (§7 + §8)
  // ===================================================================
  console.log('\n— progress advanced —')
  check('on the map', await visible('ovSelect'))
  const room1Locked = await cdp.eval(`!!document.querySelector('.lvl[data-i="1"]')?.classList.contains('locked')`)
  check('room #2 is now unlocked', room1Locked === false)

  // ===================================================================
  // BACKYARD SANDBOX (§5) — no-fail endless free play
  // ===================================================================
  console.log('\n— backyard sandbox (§5) —')
  check('backyard button present', await cdp.eval(`!!document.getElementById('backyardBtn')`))
  await act('enter Backyard', '#backyardBtn')
  await sleep(700)
  const sandboxLives = await txt('#lives')
  check('lives show ∞ (no-fail)', /∞|inf/i.test(sandboxLives), sandboxLives)
  check('off-ramp "All done!" present in prep', await cdp.eval(`!!document.getElementById('prepDoneBtn')`))
  await step('start an endless wave', `(() => { const g = document.getElementById('goBtn'); if (g && !g.disabled) g.click(); return 'ok' })()`)
  await sleep(3000) // let the endless spawner run — must not lose / error
  const stillSandbox = await cdp.eval(`(() => { return document.getElementById('ovResult')?.classList.contains('hidden') !== false })()`)
  check('no game-over in the sandbox', stillSandbox)
  await act('leave via Home', '#menuBtn')
  await sleep(500)
  check('returned to the map', await visible('ovSelect'))

  // 5) screenshot for eyeballing
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync('scripts/smoke.png', Buffer.from(shot.data, 'base64'))
  console.log('\n  • screenshot → scripts/smoke.png')

  cleanup()
  const problems = errors.length + failures.length
  if (problems) {
    if (errors.length) {
      console.error('\n❌ SMOKE FAILED — runtime problems:')
      for (const e of errors) console.error('   ' + e)
    }
    if (failures.length) {
      console.error('\n❌ SMOKE FAILED — failed checks:')
      for (const f of failures) console.error('   ✗ ' + f)
    }
    process.exit(1)
  }
  console.log('\n✅ SMOKE PASSED — full circle, no console errors, all checks green.')
  process.exit(0)
}

main().catch((e) => { console.error('harness error:', e); cleanup(); process.exit(2) })
