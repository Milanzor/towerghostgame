// ---------------------------------------------------------------------------
// Game content: the towers you can build, the ghosts you fight, and the levels.
// Everything kid-facing lives here so it's easy to tweak.
// ---------------------------------------------------------------------------

export const TILE = 64
export const COLS = 15
export const ROWS = 8
export const FIELD_W = COLS * TILE // 960
export const FIELD_H = ROWS * TILE // 512

// --- Towers (your friendly ghost-catching helpers) -------------------------
// range is in tiles. cooldown is seconds between shots.
export const TOWERS = {
  flashlight: {
    name: 'Flashlight',
    emoji: '🔦',
    blurb: 'Zaps one ghost fast!',
    color: '#ffd34d',
    cost: 50,
    range: 2.4,
    damage: 7,
    cooldown: 0.45,
    kind: 'beam', // instant light beam
    upgrade: { cost: 60, damage: 13, range: 2.9, cooldown: 0.38 },
  },
  vacuum: {
    name: 'Poltergust',
    emoji: '🌀',
    blurb: 'Sucks & slows ghosts!',
    color: '#5bc8ff',
    cost: 80,
    range: 2.0,
    damage: 4,
    cooldown: 0.18,
    kind: 'suck', // continuous beam, applies slow
    slow: 0.5, // ghost moves at 50% speed while caught
    upgrade: { cost: 90, damage: 7, range: 2.4, cooldown: 0.15, slow: 0.4 },
  },
  fan: {
    name: 'Boo Bomb',
    emoji: '💥',
    blurb: 'Big splash boom!',
    color: '#ff7ad1',
    cost: 130,
    range: 2.2,
    damage: 20,
    cooldown: 1.5,
    kind: 'splash', // lobbed projectile with area damage
    splashRadius: 1.1, // tiles
    upgrade: { cost: 140, damage: 36, range: 2.6, cooldown: 1.2, splashRadius: 1.4 },
  },
}

export const TOWER_ORDER = ['flashlight', 'vacuum', 'fan']

// --- Ghosts (cute, never scary) --------------------------------------------
// hp/reward get scaled per level. speed is tiles per second.
export const ENEMIES = {
  boo: {
    name: 'Boo',
    hp: 26,
    speed: 1.05,
    reward: 6,
    radius: 20,
    color: '#ffffff',
    face: '#3a2a5a',
  },
  greenie: {
    name: 'Greenie',
    hp: 18,
    speed: 1.9,
    reward: 5,
    radius: 17,
    color: '#9be36b',
    face: '#2c5a1c',
  },
  slammer: {
    name: 'Big Purple',
    hp: 95,
    speed: 0.62,
    reward: 14,
    radius: 27,
    color: '#b88cff',
    face: '#3a2060',
  },
  flyer: {
    name: 'Blue Boo',
    hp: 42,
    speed: 1.45,
    reward: 8,
    radius: 19,
    color: '#7fd6ff',
    face: '#1c3a5a',
  },
  king: {
    name: 'King Boo',
    hp: 520,
    speed: 0.55,
    reward: 80,
    radius: 38,
    color: '#d6b3ff',
    face: '#2a0d4a',
    crown: true,
  },
}

// Helper: turn a list of grid waypoints into a smooth pixel path,
// and figure out every tile the path covers (so we don't build there).
function buildPath(cells) {
  const waypoints = cells.map(([c, r]) => ({
    x: c * TILE + TILE / 2,
    y: r * TILE + TILE / 2,
  }))
  const pathTiles = new Set()
  for (let i = 0; i < cells.length - 1; i++) {
    const [c1, r1] = cells[i]
    const [c2, r2] = cells[i + 1]
    const dc = Math.sign(c2 - c1)
    const dr = Math.sign(r2 - r1)
    let c = c1
    let r = r1
    pathTiles.add(`${c},${r}`)
    while (c !== c2 || r !== r2) {
      c += dc
      r += dr
      pathTiles.add(`${c},${r}`)
    }
  }
  return { waypoints, pathTiles }
}

// --- Levels ----------------------------------------------------------------
// Each wave is a list of spawn groups: { type, count, spacing(sec) }.
// hpScale / rewardScale make later levels meatier but still fair.
function level(opts) {
  const { waypoints, pathTiles } = buildPath(opts.path)
  return { ...opts, waypoints, pathTiles }
}

export const LEVELS = [
  level({
    name: 'Foggy Foyer',
    bg: '#3a2b5e',
    floor: '#4a3a72',
    startCoins: 160,
    lives: 15,
    hpScale: 1,
    rewardScale: 1,
    path: [
      [-1, 3], [3, 3], [3, 1], [8, 1], [8, 6], [12, 6], [15, 6],
    ],
    waves: [
      [{ type: 'boo', count: 6, spacing: 1.1 }],
      [{ type: 'boo', count: 8, spacing: 0.9 }],
      [{ type: 'greenie', count: 6, spacing: 0.7 }, { type: 'boo', count: 4, spacing: 1.0 }],
    ],
  }),
  level({
    name: 'Garden Gate',
    bg: '#243f2e',
    floor: '#356048',
    startCoins: 180,
    lives: 14,
    hpScale: 1.25,
    rewardScale: 1.1,
    path: [
      [-1, 1], [4, 1], [4, 5], [9, 5], [9, 2], [13, 2], [13, 6], [15, 6],
    ],
    waves: [
      [{ type: 'boo', count: 8, spacing: 0.9 }],
      [{ type: 'greenie', count: 10, spacing: 0.55 }],
      [{ type: 'slammer', count: 3, spacing: 1.6 }, { type: 'boo', count: 6, spacing: 0.8 }],
      [{ type: 'greenie', count: 8, spacing: 0.5 }, { type: 'slammer', count: 4, spacing: 1.4 }],
    ],
  }),
  level({
    name: 'Creepy Corridor',
    bg: '#4a2a2a',
    floor: '#6e4040',
    startCoins: 200,
    lives: 13,
    hpScale: 1.55,
    rewardScale: 1.15,
    path: [
      [-1, 4], [2, 4], [2, 1], [6, 1], [6, 6], [10, 6], [10, 2], [15, 2],
    ],
    waves: [
      [{ type: 'greenie', count: 12, spacing: 0.5 }],
      [{ type: 'flyer', count: 8, spacing: 0.7 }],
      [{ type: 'slammer', count: 5, spacing: 1.3 }, { type: 'boo', count: 8, spacing: 0.7 }],
      [{ type: 'flyer', count: 8, spacing: 0.55 }, { type: 'greenie', count: 10, spacing: 0.45 }],
      [{ type: 'slammer', count: 6, spacing: 1.1 }, { type: 'flyer', count: 6, spacing: 0.6 }],
    ],
  }),
  level({
    name: 'Ballroom Boogie',
    bg: '#2a2f5e',
    floor: '#3d4488',
    startCoins: 220,
    lives: 12,
    hpScale: 1.9,
    rewardScale: 1.2,
    path: [
      [-1, 6], [3, 6], [3, 2], [7, 2], [7, 6], [11, 6], [11, 1], [14, 1], [14, 4], [15, 4],
    ],
    waves: [
      [{ type: 'boo', count: 12, spacing: 0.6 }, { type: 'greenie', count: 8, spacing: 0.4 }],
      [{ type: 'flyer', count: 12, spacing: 0.5 }],
      [{ type: 'slammer', count: 7, spacing: 1.1 }],
      [{ type: 'greenie', count: 16, spacing: 0.35 }, { type: 'flyer', count: 8, spacing: 0.6 }],
      [{ type: 'slammer', count: 8, spacing: 0.9 }, { type: 'boo', count: 12, spacing: 0.5 }],
    ],
  }),
  level({
    name: "King Boo's Throne",
    bg: '#1f1430',
    floor: '#34204f',
    startCoins: 260,
    lives: 12,
    hpScale: 2.2,
    rewardScale: 1.25,
    path: [
      [-1, 3], [2, 3], [2, 6], [6, 6], [6, 2], [10, 2], [10, 6], [13, 6], [13, 3], [15, 3],
    ],
    waves: [
      [{ type: 'flyer', count: 14, spacing: 0.45 }],
      [{ type: 'slammer', count: 8, spacing: 0.9 }, { type: 'greenie', count: 12, spacing: 0.35 }],
      [{ type: 'flyer', count: 16, spacing: 0.4 }, { type: 'slammer', count: 6, spacing: 1.0 }],
      [{ type: 'boo', count: 20, spacing: 0.35 }, { type: 'slammer', count: 8, spacing: 0.8 }],
      [{ type: 'king', count: 1, spacing: 1 }, { type: 'slammer', count: 6, spacing: 1.2 }, { type: 'flyer', count: 10, spacing: 0.5 }],
    ],
  }),
]
