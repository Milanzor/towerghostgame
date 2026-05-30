// ---------------------------------------------------------------------------
// Shared, mutable game state. Modules read/write `S.G` (the current game, or
// null on the menus) and `S.screen` ('start' | 'select' | 'playing') through
// this single object so the live values stay in sync across the split engine.
// Also home to save/progress persistence and the per-room game factory.
// ---------------------------------------------------------------------------
import { LEVELS } from '../content.js'
import { BACKYARD } from '../backyard.js'

export const S = {
  screen: 'start', // 'start' | 'select' | 'playing'
  G: null,
}

// ===========================================================================
// Save / progress
// ===========================================================================
const SAVE_KEY = 'ghostcatchers-v3'

// Build a fresh profile, tolerating partial/corrupt incoming data. Seeds ALL
// the fields later features (shop, avatars, settings) will use so we never need
// a second migration.
function makeProfile(p = {}) {
  return {
    name: typeof p.name === 'string' && p.name ? p.name : 'Player',
    avatar: p.avatar === 'boy' ? 'boy' : 'girl',
    unlocked: Number.isFinite(p.unlocked) ? p.unlocked : 0,
    stars: (p.stars && typeof p.stars === 'object') ? p.stars : {},
    points: Number.isFinite(p.points) ? p.points : 0,
    owned: Array.isArray(p.owned) && p.owned.length ? p.owned : ['none'],
    hat: typeof p.hat === 'string' && p.hat ? p.hat : 'none',
    settings: {
      vibe: (p.settings && p.settings.vibe) || 'justright',
      playMinutes: (p.settings && Number.isFinite(p.settings.playMinutes)) ? p.settings.playMinutes : 0,
    },
  }
}

function defaultSave() {
  return {
    version: 2,
    activeProfile: 'p1',
    profiles: {
      p1: makeProfile({ name: 'Mia', avatar: 'girl' }),
      p2: makeProfile({ name: 'Sam', avatar: 'boy' }),
    },
  }
}

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY))
    if (s && typeof s === 'object') {
      // Already the new (v2+) profiles shape — sanitise and keep.
      if (s.profiles && typeof s.profiles === 'object') {
        const profiles = {}
        for (const [id, p] of Object.entries(s.profiles)) profiles[id] = makeProfile(p)
        const ids = Object.keys(profiles)
        if (ids.length === 0) return defaultSave()
        const active = (s.activeProfile && profiles[s.activeProfile]) ? s.activeProfile : ids[0]
        return { version: 2, activeProfile: active, profiles }
      }
      // Old flat v1 shape (unlocked/stars at top level) → wrap into p1, keep progress.
      return {
        version: 2,
        activeProfile: 'p1',
        profiles: {
          p1: makeProfile({ name: 'Player 1', avatar: 'girl', unlocked: s.unlocked, stars: s.stars }),
        },
      }
    }
  } catch { /* ignore */ }
  // Brand-new player: seed two default profiles.
  return defaultSave()
}
export function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* ignore */ }
}
export const save = loadSave()

// ---------------------------------------------------------------------------
// Profiles — always return a valid profile, even if activeProfile is bad.
// ---------------------------------------------------------------------------
export function currentProfile() {
  const p = save.profiles[save.activeProfile]
  if (p) return p
  const firstId = Object.keys(save.profiles)[0]
  save.activeProfile = firstId
  return save.profiles[firstId]
}

export function setActiveProfile(id) {
  if (save.profiles[id]) {
    save.activeProfile = id
    writeSave()
  }
}

// Create a new profile (cap at 3). Returns the new id, or null if at the cap.
export function addProfile({ name, avatar } = {}) {
  const ids = Object.keys(save.profiles)
  if (ids.length >= 3) return null
  let id = 'p1'
  for (let n = 1; n <= 99; n++) { id = 'p' + n; if (!save.profiles[id]) break }
  save.profiles[id] = makeProfile({ name, avatar })
  writeSave()
  return id
}

export function listProfiles() {
  return Object.entries(save.profiles).map(([id, p]) => ({ id, ...p }))
}

// ---------------------------------------------------------------------------
// §6 Grown-up corner — vibe (difficulty) accessors + a full progress wipe.
// The active profile's settings.vibe is one of 'cozy' | 'justright' | 'bigkid'.
// ---------------------------------------------------------------------------
export function currentVibe() {
  const s = currentProfile().settings
  return (s && s.vibe) || 'justright'
}
// Cozy = no-fail: reuses the §5 endless float-away path so a leak never costs a
// life. Read at runtime in the leak handler.
export function isCozy() { return currentVibe() === 'cozy' }
export function isBigKid() { return currentVibe() === 'bigkid' }

// Reset ALL progress for hand-me-downs / a fresh start: wipe the save and
// re-seed the two default profiles, in place so existing imports stay valid.
export function resetAllProgress() {
  const fresh = defaultSave()
  save.version = fresh.version
  save.activeProfile = fresh.activeProfile
  save.profiles = fresh.profiles
  writeSave()
}

// ===========================================================================
// "Stuck helper" — a gentle catch-up so a frustrated kid is never walled out.
// Lose the SAME level twice in a row and every retry after that starts with a
// growing pile of extra coins. The streak is tied to one level: picking a
// DIFFERENT level wipes it, and so does finishing a level (a win). Lives outside
// any single game so it survives the retry that rebuilds S.G.
// ===========================================================================
const STUCK_BONUS = 30 // extra starting coins per loss beyond the first
let stuckLevel = -1     // which level the current losing streak belongs to
let lossStreak = 0      // consecutive losses on that level

// Record a loss on a level. A loss on a different level than the tracked one
// starts a fresh streak for that level.
export function recordLoss(levelIndex) {
  if (levelIndex !== stuckLevel) { stuckLevel = levelIndex; lossStreak = 0 }
  lossStreak++
}
// Extra starting coins a retry of this level should get. Zero until the kid has
// lost it twice in a row, then grows by STUCK_BONUS for each further loss.
export function stuckBonusFor(levelIndex) {
  if (levelIndex !== stuckLevel || lossStreak < 2) return 0
  return (lossStreak - 1) * STUCK_BONUS
}
// Clear the streak — called when a different level is picked or a level is won.
export function resetStuck() { stuckLevel = -1; lossStreak = 0 }

// ===========================================================================
// New game / per-room state factory
// ===========================================================================
// Build the per-room state from a level OBJECT. Both the numbered levels and the
// synthetic Backyard sandbox flow through here so they share all the same engine
// fields. `opts.endless` flags the no-fail infinite sandbox.
export function newGameFromLevel(level, levelIndex, opts = {}) {
  const endless = !!opts.endless
  // §6 Big Kid vibe: a gentle, clearly-optional bump — one fewer starting heart
  // (min 1). Cozy never loses lives anyway; Just Right keeps the level as-authored.
  const lives = (!endless && isBigKid()) ? Math.max(1, level.lives - 1) : level.lives
  return {
    level,
    levelIndex,
    endless,
    coins: level.startCoins + (opts.startBonus || 0),
    startBonus: opts.startBonus || 0, // §stuck — extra coins granted this run (for the HUD note)
    lives: endless ? Infinity : lives,
    livesMax: endless ? Infinity : lives,
    waveIndex: 0,
    // Endless rooms have no fixed wave list — waveCount is unbounded.
    waveCount: endless ? Infinity : level.waves.length,
    phase: 'prep', // 'prep' | 'spawning' | 'cleanup' | 'tidyup' | 'done'
    started: false, // has the player pressed Start at least once?
    spawnQueue: [],
    spawnTimer: 0,
    nextGap: 0,
    spawnCount: 0,        // §4 — running spawn tally; alternates enemies across lanes
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    occupied: new Set(),
    selectedType: null,
    selectedTower: null,
    hoverCell: null,
    speed: 1,
    paused: false,
    time: 0,
    shake: 0,
    flash: 0,
    // --- §9 Closure ritual ("tidy up") — only used on a real level win ---
    tidy: null,           // null until the ritual starts; then { t, coins, coins0, ran }
    rewarded: null,       // set once when win rewards are banked (guards double-award)
  }
}

// Numbered story rooms — read the level from the flat LEVELS array.
export function newGame(levelIndex) {
  // Picking a different level than the one we're stuck on wipes the streak;
  // retrying the same level keeps it so the catch-up bonus can build.
  if (levelIndex !== stuckLevel) resetStuck()
  const startBonus = stuckBonusFor(levelIndex)
  return newGameFromLevel(LEVELS[levelIndex], levelIndex, { startBonus })
}

// The §5 endless Backyard sandbox — no lives, no lose, procedural waves. Built
// from the synthetic BACKYARD def with a sentinel levelIndex (it's NOT in
// LEVELS, so it never touches the save/progress). Seeds nothing extra: the first
// wave is generated on demand by startWave() via level.waveGen(waveIndex).
export function newSandbox() {
  return newGameFromLevel(BACKYARD, -1, { endless: true })
}
