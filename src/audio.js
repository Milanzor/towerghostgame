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
  freeze: () => tone(1200, 0.18, 'sine', 0.1, 500),
  zap: () => { tone(1400, 0.05, 'square', 0.06); setTimeout(() => tone(900, 0.05, 'square', 0.05), 40) },
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

// ===========================================================================
// Background music — a tiny looping sequencer with a unique, gentle tune
// per room. No audio files: just soft cartoon arpeggios over a quiet bass.
// ===========================================================================
// Pentatonic note pools (semitone offsets) keep every random-ish tune happy.
const _ = null // a rest

// One track per level. step = ms per beat, mel = melody (semitones from root),
// bass = low notes, wave = melody timbre. Tunes loop forever.
const MUSIC_TRACKS = [
  // 0 Foggy Foyer — slow & dreamy
  { root: 261.6, step: 360, dur: 0.34, wave: 'sine',
    mel: [0, _, 7, _, 4, _, 9, 7, _, 4, _, 2, 0, _, _, _],
    bass: [0, _, _, _, 5, _, _, _] },
  // 1 Garden Gate — bright & skippy
  { root: 293.7, step: 300, dur: 0.26, wave: 'triangle',
    mel: [0, 4, 7, 9, 7, 4, 0, 2, 4, 7, 9, 12, 9, 7, 4, 2],
    bass: [0, _, 7, _, 5, _, 7, _] },
  // 2 Creepy Kitchen — quirky bounce
  { root: 246.9, step: 270, dur: 0.22, wave: 'square',
    mel: [0, _, 3, 5, _, 7, 5, 3, 0, _, 7, _, 10, 7, 5, 3],
    bass: [0, _, _, 5, _, _, 7, _] },
  // 3 Dusty Library — gentle waltz
  { root: 220.0, step: 340, dur: 0.3, wave: 'triangle',
    mel: [0, 4, 7, _, 9, 7, 4, _, 12, 9, 7, _, 4, 2, 0, _],
    bass: [0, _, _, 7, _, _] },
  // 4 Ballroom Boogie — dancey
  { root: 329.6, step: 240, dur: 0.2, wave: 'square',
    mel: [0, 2, 4, 7, 4, 2, 0, 4, 7, 9, 7, 4, 9, 12, 9, 7],
    bass: [0, 0, 7, 7, 5, 5, 7, 7] },
  // 5 Spider Cellar — spooky minor
  { root: 196.0, step: 300, dur: 0.26, wave: 'sawtooth',
    mel: [0, _, 3, _, 7, _, 6, _, 7, 10, 7, _, 3, _, 0, _],
    bass: [0, _, _, _, 3, _, _, _] },
  // 6 Frosty Attic — high & twinkly
  { root: 392.0, step: 280, dur: 0.24, wave: 'sine',
    mel: [0, 4, 7, 12, 7, 4, 9, 7, 4, 0, 4, 9, 12, 9, 7, 4],
    bass: [0, _, 5, _, 7, _, 5, _] },
  // 7 Candy Caverns — bouncy fast
  { root: 349.2, step: 220, dur: 0.18, wave: 'triangle',
    mel: [0, 2, 4, 2, 7, 4, 2, 0, 9, 7, 4, 7, 12, 9, 7, 4],
    bass: [0, 7, 0, 7, 5, 7, 5, 7] },
  // 8 Goblin Dungeon — low & marchy
  { root: 174.6, step: 320, dur: 0.28, wave: 'sawtooth',
    mel: [0, _, 0, 3, _, 5, 3, _, 7, _, 5, 3, 0, _, _, _],
    bass: [0, 0, _, _, 3, 3, _, _] },
  // 9 Lava Lair — driving
  { root: 220.0, step: 230, dur: 0.2, wave: 'square',
    mel: [0, 3, 7, 3, 0, 3, 7, 10, 7, 3, 0, 7, 10, 12, 10, 7],
    bass: [0, 0, 7, 7, 0, 0, 10, 10] },
  // 10 Starry Space — airy & wide
  { root: 311.1, step: 320, dur: 0.42, wave: 'sine',
    mel: [0, _, 7, _, 12, _, 9, _, 7, _, 4, _, 9, _, 7, _],
    bass: [0, _, _, _, 9, _, _, _] },
  // 11 King Boo's Throne — grand finale
  { root: 261.6, step: 250, dur: 0.22, wave: 'square',
    mel: [0, 4, 7, 12, 11, 7, 4, 0, 7, 12, 16, 12, 11, 9, 7, 4],
    bass: [0, 0, 7, 7, 5, 5, 7, 7] },
]

let musicStep = 0
let musicInterval = null
let musicTrack = null

function musicNote(freq, dur, type, vol) {
  if (muted) return
  const c = ensure()
  if (!c) return
  const t0 = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

export const music = {
  play(levelIndex) {
    this.stop()
    musicTrack = MUSIC_TRACKS[levelIndex % MUSIC_TRACKS.length]
    musicStep = 0
    ensure()
    musicInterval = setInterval(() => {
      const tr = musicTrack
      if (!tr) return
      const m = tr.mel[musicStep % tr.mel.length]
      if (m !== null && m !== undefined) {
        musicNote(tr.root * Math.pow(2, m / 12), tr.dur, tr.wave, 0.05)
      }
      const b = tr.bass[musicStep % tr.bass.length]
      if (b !== null && b !== undefined) {
        musicNote(tr.root / 2 * Math.pow(2, b / 12), tr.step / 1000 * 1.5, 'triangle', 0.045)
      }
      musicStep++
    }, musicTrack.step)
  },
  stop() {
    if (musicInterval) { clearInterval(musicInterval); musicInterval = null }
    musicTrack = null
  },
  isPlaying() { return musicInterval !== null },
}

export function setMuted(m) {
  muted = m
}

export function isMuted() {
  return muted
}
