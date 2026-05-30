// ===========================================================================
// §5 — Endless "Backyard" sandbox.
// A relaxed, no-fail, infinite free-play room reachable from the map. NOT part
// of the numbered LEVELS progression: it's a synthetic level def with a simple
// path, generous coins, a bright friendly garden theme, and a *procedural* wave
// generator (so the waves never run out). The kid taps Start/Next Wave just like
// a normal room — monsters that reach the door simply float away with a giggle.
// ===========================================================================
import { TILE, COLS, ROWS } from './content.js'

// A gentle S-curve across the lawn — long, simple, lots of building room.
function buildPath(cells) {
  const waypoints = cells.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }))
  const pathTiles = new Set()
  for (let i = 0; i < cells.length - 1; i++) {
    const [c1, r1] = cells[i]
    const [c2, r2] = cells[i + 1]
    const dc = Math.sign(c2 - c1)
    const dr = Math.sign(r2 - r1)
    let c = c1, r = r1
    pathTiles.add(`${c},${r}`)
    while (c !== c2 || r !== r2) { c += dc; r += dr; pathTiles.add(`${c},${r}`) }
  }
  return { waypoints, pathTiles }
}

const PATH_CELLS = [[-1, 2], [3, 2], [3, 6], [7, 6], [7, 2], [11, 2], [11, 6], [15, 6]]
const { waypoints, pathTiles } = buildPath(PATH_CELLS)

// The friendly types the ramp draws from, ordered easiest → bouncier. Kept to
// the cheerful early monsters (no bosses, nothing tough) so it always stays
// breezy. Variety widens as the wave number climbs.
const RAMP = ['boo', 'greenie', 'candy', 'bat', 'eyeball', 'blob', 'ghostling', 'pumpkin']

// Procedural wave generator. `waveIndex` is 0-based. Returns an array of spawn
// groups: { type, count, spacing }. Counts/variety ramp slowly; spacing eases so
// it never feels frantic. HP stays modest (see hpScale below) and rewards flow.
function waveGen(waveIndex) {
  const w = waveIndex
  // how many *kinds* of monster appear this wave (1 → up to 3)
  const variety = Math.min(3, 1 + Math.floor(w / 3))
  // how far down the friendly ramp we may reach (widens over time)
  const reach = Math.min(RAMP.length, 2 + Math.floor(w / 2))
  const base = 4 + Math.floor(w * 0.7) // base monsters per group, grows gently
  const spacing = Math.max(0.5, 1.0 - w * 0.03) // ease spawn gap toward 0.5s
  const groups = []
  for (let g = 0; g < variety; g++) {
    const type = RAMP[(w + g * 2) % reach]
    const count = base + g // later groups slightly bigger
    groups.push({ type, count, spacing })
  }
  return groups
}

// The synthetic level def. Mirrors a LEVELS entry's shape so the engine, render
// and HUD all "just work" — plus `waveGen` (used instead of a fixed `waves`).
export const BACKYARD = {
  name: 'The Backyard',
  areaName: 'Backyard',
  areaEmoji: '🏡',
  isBoss: false,
  waypoints,
  pathTiles,
  waveGen,
  startCoins: 320, // generous — buy and upgrade lots of helpers
  lives: Infinity, // never used in endless, but keeps shape sane
  hpScale: 0.9, // modest HP so catching stays satisfying
  rewardScale: 1.2, // coins flow freely
  bg: '#bfe9a8',
  floor: '#86c46b',
  door: '🏡',
  accent: '#ffd34d',
  decor: ['🌻', '🌷', '🌼', '🦋', '🐝', '🌳'],
}

// Path is COLS×ROWS aware; re-export the dims so callers needn't reimport.
export { COLS, ROWS }
