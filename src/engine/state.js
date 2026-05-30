// ---------------------------------------------------------------------------
// Shared, mutable game state. Modules read/write `S.G` (the current game, or
// null on the menus) and `S.screen` ('start' | 'select' | 'playing') through
// this single object so the live values stay in sync across the split engine.
// Also home to save/progress persistence and the per-room game factory.
// ---------------------------------------------------------------------------
import { LEVELS } from '../content.js'

export const S = {
  screen: 'start', // 'start' | 'select' | 'playing'
  G: null,
}

// ===========================================================================
// Save / progress
// ===========================================================================
const SAVE_KEY = 'ghostcatchers-v3'

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY))
    if (s && typeof s === 'object') {
      return { unlocked: s.unlocked || 0, stars: s.stars || {} }
    }
  } catch { /* ignore */ }
  return { unlocked: 0, stars: {} }
}
export function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* ignore */ }
}
export const save = loadSave()

// ===========================================================================
// New game / per-room state factory
// ===========================================================================
export function newGame(levelIndex) {
  const level = LEVELS[levelIndex]
  return {
    level,
    levelIndex,
    coins: level.startCoins,
    lives: level.lives,
    livesMax: level.lives,
    waveIndex: 0,
    waveCount: level.waves.length,
    phase: 'prep', // 'prep' | 'spawning' | 'cleanup' | 'done'
    started: false, // has the player pressed Start at least once?
    spawnQueue: [],
    spawnTimer: 0,
    nextGap: 0,
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
  }
}
