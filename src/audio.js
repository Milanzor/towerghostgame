// Tiny friendly sound engine built on the Web Audio API.
// No audio files needed — just gentle cartoon beeps and boops.
// Everything is wrapped so the game never crashes if audio is unavailable.

let ctx = null
let muted = false

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      ctx = null
    }
  }
  // Browsers start the context "suspended" until a user gesture.
  if (ctx && ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, dur, type = 'sine', vol = 0.18, slideTo = null) {
  if (muted) return
  const c = ensure()
  if (!c) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

export const sfx = {
  place: () => tone(520, 0.12, 'triangle', 0.2, 720),
  shoot: () => tone(900, 0.05, 'square', 0.05),
  pop: () => { tone(300, 0.14, 'sine', 0.18, 90) },
  coin: () => { tone(880, 0.06, 'square', 0.12); setTimeout(() => tone(1320, 0.08, 'square', 0.12), 60) },
  hurt: () => tone(180, 0.25, 'sawtooth', 0.16, 70),
  upgrade: () => { tone(523, 0.1, 'triangle', 0.18); setTimeout(() => tone(784, 0.14, 'triangle', 0.18), 90) },
  wave: () => { tone(440, 0.12, 'triangle', 0.16); setTimeout(() => tone(660, 0.16, 'triangle', 0.16), 110) },
  win: () => {
    const notes = [523, 659, 784, 1047]
    notes.forEach((n, i) => setTimeout(() => tone(n, 0.22, 'triangle', 0.2), i * 130))
  },
  lose: () => {
    const notes = [392, 330, 262]
    notes.forEach((n, i) => setTimeout(() => tone(n, 0.3, 'sawtooth', 0.16), i * 180))
  },
  click: () => tone(660, 0.05, 'triangle', 0.12),
}

export function setMuted(m) {
  muted = m
}

export function isMuted() {
  return muted
}
