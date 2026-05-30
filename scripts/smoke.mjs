// Headless smoke test for Ghost Catchers. No deps: serves the built docs/ via
// `vite preview`, drives system chromium over the DevTools protocol with Node's
// global WebSocket, plays through Start → pick room → place a helper → start a
// wave, and fails if any console.error or uncaught exception fires.
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

  // 4) load the game
  await cdp.send('Page.navigate', { url: URL })
  await sleep(1500)

  const step = async (label, expr) => {
    const v = await cdp.eval(expr)
    console.log(`  • ${label}: ${JSON.stringify(v)}`)
    return v
  }

  // boot reached the Start overlay?
  await step('Play button present', `!!document.getElementById('playBtn')`)
  await step('click Play', `(document.getElementById('playBtn').click(), 'ok')`)
  await sleep(400)
  await step('room tiles shown', `document.querySelectorAll('.lvl').length`)
  await step('enter first room', `(document.querySelector('.lvl:not(.locked)').click(), 'ok')`)
  await sleep(800)
  await step('palette built', `document.querySelectorAll('.tower-btn').length`)
  // crank speed so a wave resolves fast
  await step('speed up', `(document.getElementById('speedBtn').click(), document.getElementById('speedBtn').click(), 'ok')`)
  // select a helper and try to place it on several non-path cells
  await step('select helper', `(document.querySelector('.tower-btn').click(), 'ok')`)
  await step('place helper attempts', `(() => {
    const cv = document.getElementById('canvas'); const r = cv.getBoundingClientRect()
    const W = 15, H = 8; let placed = 0
    for (let c = 0; c < W && placed < 6; c++) for (let row = 0; row < H && placed < 6; row++) {
      const x = r.left + r.width * ((c + 0.5) / W), y = r.top + r.height * ((row + 0.5) / H)
      cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }))
      placed++
    }
    return 'attempted'
  })()`)
  await sleep(300)
  // start the wave and let combat run
  await step('start wave', `(document.getElementById('goBtn').click(), 'ok')`)
  await sleep(4000)
  await step('wave/coins/lives snapshot', `({ wave: document.getElementById('wave').textContent, coins: document.getElementById('coins').textContent, lives: document.getElementById('lives').textContent })`)

  // 5) screenshot for eyeballing
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync('scripts/smoke.png', Buffer.from(shot.data, 'base64'))
  console.log('  • screenshot → scripts/smoke.png')

  cleanup()
  if (errors.length) {
    console.error('\n❌ SMOKE FAILED — runtime problems:')
    for (const e of errors) console.error('   ' + e)
    process.exit(1)
  }
  console.log('\n✅ SMOKE PASSED — no console errors or uncaught exceptions.')
  process.exit(0)
}

main().catch((e) => { console.error('harness error:', e); cleanup(); process.exit(2) })
