import { TILE, COLS, ROWS } from './grid.js'

// ===========================================================================
// Path helper: turn a list of grid waypoints into a smooth pixel path,
// and record every tile the path covers (so we can't build there).
// ===========================================================================
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

// Path shapes for the rooms — each AREA gets its own five, so no two worlds
// play the same map. Each segment is axis-aligned (only one of col/row changes
// between waypoints); paths enter at the left (col -1) and exit at the right
// (col 15). The shapes are tuned to each world's feel:
//   M* Mansion  – twisty haunted halls       I* Caverns – long sweeping ice slides
//   J* Dungeon  – tight comb/maze corridors   K* Volcano – bold straight lava bridges
//   L* Void     – wide looping cosmic orbits
const PATHS = {
  // Haunted Mansion — winding corridors
  M1: [[-1, 3], [3, 3], [3, 1], [8, 1], [8, 6], [12, 6], [15, 6]],
  M2: [[-1, 1], [4, 1], [4, 5], [9, 5], [9, 2], [13, 2], [13, 6], [15, 6]],
  M3: [[-1, 4], [2, 4], [2, 1], [6, 1], [6, 6], [10, 6], [10, 2], [15, 2]],
  M4: [[-1, 6], [3, 6], [3, 2], [7, 2], [7, 6], [11, 6], [11, 1], [14, 1], [14, 4], [15, 4]],
  M5: [[-1, 3], [2, 3], [2, 6], [6, 6], [6, 2], [10, 2], [10, 6], [13, 6], [13, 3], [15, 3]],

  // Frozen Caverns — big sweeping switchbacks
  I1: [[-1, 2], [11, 2], [11, 5], [3, 5], [3, 7], [15, 7]],
  I2: [[-1, 5], [13, 5], [13, 1], [3, 1], [3, 3], [15, 3]],
  I3: [[-1, 7], [6, 7], [6, 2], [11, 2], [11, 6], [15, 6]],
  I4: [[-1, 1], [3, 1], [3, 6], [8, 6], [8, 1], [13, 1], [13, 4], [15, 4]],
  I5: [[-1, 4], [2, 4], [2, 7], [7, 7], [7, 1], [12, 1], [12, 5], [15, 5]],

  // Goblin Dungeon — tight comb mazes
  J1: [[-1, 1], [2, 1], [2, 4], [5, 4], [5, 1], [8, 1], [8, 4], [11, 4], [11, 1], [14, 1], [14, 5], [15, 5]],
  J2: [[-1, 6], [2, 6], [2, 3], [5, 3], [5, 6], [8, 6], [8, 3], [11, 3], [11, 6], [14, 6], [14, 2], [15, 2]],
  J3: [[-1, 4], [3, 4], [3, 1], [6, 1], [6, 6], [9, 6], [9, 1], [12, 1], [12, 5], [15, 5]],
  J4: [[-1, 2], [4, 2], [4, 5], [1, 5], [1, 7], [7, 7], [7, 2], [10, 2], [10, 6], [13, 6], [13, 3], [15, 3]],
  J5: [[-1, 5], [2, 5], [2, 2], [5, 2], [5, 6], [8, 6], [8, 2], [12, 2], [12, 6], [15, 6]],

  // Volcano Keep — long straight bridges
  K1: [[-1, 3], [5, 3], [5, 6], [10, 6], [10, 2], [15, 2]],
  K2: [[-1, 6], [6, 6], [6, 1], [15, 1]],
  K3: [[-1, 2], [8, 2], [8, 6], [15, 6]],
  K4: [[-1, 5], [4, 5], [4, 1], [11, 1], [11, 6], [15, 6]],
  K5: [[-1, 1], [7, 1], [7, 5], [13, 5], [13, 2], [15, 2]],

  // Cosmic Void — wide looping orbits
  L1: [[-1, 4], [2, 4], [2, 1], [13, 1], [13, 6], [4, 6], [4, 4], [15, 4]],
  L2: [[-1, 1], [12, 1], [12, 4], [3, 4], [3, 7], [15, 7]],
  L3: [[-1, 3], [10, 3], [10, 7], [5, 7], [5, 5], [13, 5], [13, 2], [15, 2]],
  L4: [[-1, 7], [2, 7], [2, 3], [6, 3], [6, 7], [10, 7], [10, 3], [14, 3], [14, 6], [15, 6]],
  L5: [[-1, 2], [5, 2], [5, 6], [9, 6], [9, 1], [13, 1], [13, 5], [15, 5]],
}

// ===========================================================================
// AREAS — five worlds, five rooms each (the 5th room is a BOSS fight).
// Each wave is a list of spawn groups: { type, count, spacing(sec) }.
// ===========================================================================
const AREA_DEFS = [
  {
    name: 'Haunted Mansion', emoji: '🏚️', bg: '#3a2b5e', floor: '#4a3a72',
    door: '🚪', accent: '#9a6bff', decor: ['🕸️', '🖼️', '🪦', '🕯️', '🦇'],
    rooms: [
      { name: 'Foggy Foyer', path: 'M1', startCoins: 150, lives: 15, hpScale: 1.0, rewardScale: 1.0,
        waves: [
          [{ type: 'boo', count: 6, spacing: 1.1 }],
          [{ type: 'boo', count: 8, spacing: 0.9 }],
          [{ type: 'greenie', count: 8, spacing: 0.6 }, { type: 'boo', count: 4, spacing: 1.0 }],
          [{ type: 'candy', count: 10, spacing: 0.5 }, { type: 'boo', count: 6, spacing: 0.8 }],
        ] },
      { name: 'Dusty Hall', path: 'M2', startCoins: 165, lives: 15, hpScale: 1.12, rewardScale: 1.04,
        waves: [
          [{ type: 'boo', count: 10, spacing: 0.8 }],
          [{ type: 'greenie', count: 12, spacing: 0.5 }],
          [{ type: 'candy', count: 12, spacing: 0.45 }, { type: 'boo', count: 6, spacing: 0.8 }],
          [{ type: 'bat', count: 8, spacing: 0.6 }, { type: 'slammer', count: 3, spacing: 1.4 }],
        ] },
      { name: 'Creaky Stairs', path: 'M3', startCoins: 175, lives: 14, hpScale: 1.25, rewardScale: 1.07,
        waves: [
          [{ type: 'greenie', count: 14, spacing: 0.45 }],
          [{ type: 'flyer', count: 8, spacing: 0.7 }, { type: 'bat', count: 8, spacing: 0.5 }],
          [{ type: 'slammer', count: 4, spacing: 1.3 }, { type: 'candy', count: 12, spacing: 0.4 }],
          [{ type: 'bat', count: 12, spacing: 0.4 }, { type: 'flyer', count: 6, spacing: 0.6 }],
        ] },
      { name: 'Portrait Gallery', path: 'M4', startCoins: 190, lives: 14, hpScale: 1.4, rewardScale: 1.1,
        waves: [
          [{ type: 'flyer', count: 12, spacing: 0.5 }],
          [{ type: 'slammer', count: 5, spacing: 1.1 }, { type: 'greenie', count: 12, spacing: 0.4 }],
          [{ type: 'bat', count: 14, spacing: 0.35 }, { type: 'candy', count: 10, spacing: 0.4 }],
          [{ type: 'slammer', count: 7, spacing: 0.9 }, { type: 'flyer', count: 8, spacing: 0.5 }],
        ] },
      { name: "King Boo's Throne", path: 'M5', boss: true, startCoins: 230, lives: 14, hpScale: 1.5, rewardScale: 1.15,
        waves: [
          [{ type: 'boo', count: 14, spacing: 0.45 }, { type: 'greenie', count: 10, spacing: 0.4 }],
          [{ type: 'slammer', count: 6, spacing: 1.0 }, { type: 'flyer', count: 10, spacing: 0.5 }],
          [{ type: 'bat', count: 16, spacing: 0.35 }, { type: 'candy', count: 14, spacing: 0.35 }],
          [{ type: 'kingboo', count: 1, spacing: 1 }, { type: 'slammer', count: 6, spacing: 1.1 }, { type: 'flyer', count: 8, spacing: 0.5 }],
        ] },
    ],
  },
  {
    name: 'Frozen Caverns', emoji: '🧊', bg: '#1f3550', floor: '#2e5078',
    door: '🧊', accent: '#7fe0ff', decor: ['❄️', '🧊', '💎', '🦴', '⛄'],
    rooms: [
      { name: 'Icy Entrance', path: 'I1', startCoins: 200, lives: 14, hpScale: 1.6, rewardScale: 1.16,
        waves: [
          [{ type: 'blob', count: 10, spacing: 0.7 }],
          [{ type: 'bat', count: 14, spacing: 0.4 }, { type: 'eyeball', count: 8, spacing: 0.5 }],
          [{ type: 'zombie', count: 6, spacing: 1.0 }, { type: 'blob', count: 8, spacing: 0.6 }],
          [{ type: 'spider', count: 8, spacing: 0.6 }, { type: 'eyeball', count: 12, spacing: 0.35 }],
        ] },
      { name: 'Frosty Tunnels', path: 'I2', startCoins: 215, lives: 13, hpScale: 1.75, rewardScale: 1.2,
        waves: [
          [{ type: 'eyeball', count: 16, spacing: 0.35 }],
          [{ type: 'alien', count: 8, spacing: 0.8 }, { type: 'bat', count: 12, spacing: 0.4 }],
          [{ type: 'zombie', count: 8, spacing: 0.8 }, { type: 'blob', count: 10, spacing: 0.5 }],
          [{ type: 'spider', count: 10, spacing: 0.5 }, { type: 'alien', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Crystal Lake', path: 'I3', startCoins: 230, lives: 13, hpScale: 1.9, rewardScale: 1.24,
        waves: [
          [{ type: 'blob', count: 14, spacing: 0.45 }, { type: 'eyeball', count: 10, spacing: 0.4 }],
          [{ type: 'mama', count: 2, spacing: 1.4 }, { type: 'zombie', count: 8, spacing: 0.7 }],
          [{ type: 'alien', count: 12, spacing: 0.5 }, { type: 'spider', count: 8, spacing: 0.5 }],
          [{ type: 'octopus', count: 5, spacing: 1.2 }, { type: 'bat', count: 14, spacing: 0.35 }],
        ] },
      { name: 'Glacier Drop', path: 'I4', startCoins: 250, lives: 12, hpScale: 2.05, rewardScale: 1.28,
        waves: [
          [{ type: 'alien', count: 14, spacing: 0.45 }],
          [{ type: 'octopus', count: 6, spacing: 1.0 }, { type: 'zombie', count: 10, spacing: 0.6 }],
          [{ type: 'spider', count: 12, spacing: 0.45 }, { type: 'eyeball', count: 14, spacing: 0.3 }],
          [{ type: 'octopus', count: 8, spacing: 0.8 }, { type: 'alien', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Frost Titan Lair', path: 'I5', boss: true, startCoins: 290, lives: 13, hpScale: 2.1, rewardScale: 1.3,
        waves: [
          [{ type: 'blob', count: 16, spacing: 0.4 }, { type: 'alien', count: 10, spacing: 0.5 }],
          [{ type: 'zombie', count: 12, spacing: 0.6 }, { type: 'spider', count: 10, spacing: 0.45 }],
          [{ type: 'octopus', count: 8, spacing: 0.8 }, { type: 'eyeball', count: 16, spacing: 0.3 }],
          [{ type: 'frosttitan', count: 1, spacing: 1 }, { type: 'octopus', count: 5, spacing: 1.2 }, { type: 'alien', count: 10, spacing: 0.5 }],
        ] },
    ],
  },
  {
    name: 'Goblin Dungeon', emoji: '⛓️', bg: '#2a2424', floor: '#463a3a',
    door: '🏰', accent: '#ff8a4d', decor: ['⛓️', '🔥', '💀', '🗝️', '🪨'],
    rooms: [
      { name: 'Rusty Gate', path: 'J1', startCoins: 240, lives: 13, hpScale: 2.25, rewardScale: 1.3,
        waves: [
          [{ type: 'spider', count: 12, spacing: 0.5 }],
          [{ type: 'pumpkin', count: 8, spacing: 0.8 }, { type: 'bat', count: 12, spacing: 0.4 }],
          [{ type: 'caterpillar', count: 6, spacing: 1.0 }, { type: 'spider', count: 8, spacing: 0.5 }],
          [{ type: 'octopus', count: 6, spacing: 1.0 }, { type: 'microbe', count: 10, spacing: 0.5 }],
        ] },
      { name: 'Torch Corridor', path: 'J2', startCoins: 255, lives: 12, hpScale: 2.4, rewardScale: 1.33,
        waves: [
          [{ type: 'pumpkin', count: 12, spacing: 0.5 }],
          [{ type: 'sheller', count: 3, spacing: 1.0 }, { type: 'spider', count: 10, spacing: 0.45 }],
          [{ type: 'caterpillar', count: 8, spacing: 0.8 }, { type: 'octopus', count: 6, spacing: 0.8 }],
          [{ type: 'microbe', count: 14, spacing: 0.4 }, { type: 'pumpkin', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Spider Pit', path: 'J3', startCoins: 270, lives: 12, hpScale: 2.55, rewardScale: 1.36,
        waves: [
          [{ type: 'spider', count: 16, spacing: 0.4 }, { type: 'bat', count: 12, spacing: 0.35 }],
          [{ type: 'octopus', count: 8, spacing: 0.8 }, { type: 'caterpillar', count: 8, spacing: 0.7 }],
          [{ type: 'robot', count: 8, spacing: 0.8 }, { type: 'microbe', count: 12, spacing: 0.4 }],
          [{ type: 'octopus', count: 10, spacing: 0.6 }, { type: 'pumpkin', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Iron Forge', path: 'J4', startCoins: 290, lives: 11, hpScale: 2.75, rewardScale: 1.4,
        waves: [
          [{ type: 'robot', count: 10, spacing: 0.6 }],
          [{ type: 'caterpillar', count: 10, spacing: 0.6 }, { type: 'spider', count: 12, spacing: 0.4 }],
          [{ type: 'octopus', count: 10, spacing: 0.6 }, { type: 'microbe', count: 14, spacing: 0.4 }],
          [{ type: 'robot', count: 12, spacing: 0.55 }, { type: 'pumpkin', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Warlord Throne', path: 'J5', boss: true, startCoins: 330, lives: 12, hpScale: 2.8, rewardScale: 1.42,
        waves: [
          [{ type: 'spider', count: 16, spacing: 0.35 }, { type: 'pumpkin', count: 10, spacing: 0.5 }],
          [{ type: 'robot', count: 10, spacing: 0.6 }, { type: 'caterpillar', count: 10, spacing: 0.5 }],
          [{ type: 'octopus', count: 12, spacing: 0.5 }, { type: 'microbe', count: 16, spacing: 0.35 }],
          [{ type: 'goblinking', count: 1, spacing: 1 }, { type: 'robot', count: 8, spacing: 0.7 }, { type: 'octopus', count: 6, spacing: 0.9 }],
        ] },
    ],
  },
  {
    name: 'Volcano Keep', emoji: '🌋', bg: '#3a1a18', floor: '#6e2c22',
    door: '🌋', accent: '#ff5a2d', decor: ['🌋', '🔥', '🪨', '💀', '🌑'],
    rooms: [
      { name: 'Ember Path', path: 'K1', startCoins: 280, lives: 12, hpScale: 3.0, rewardScale: 1.42,
        waves: [
          [{ type: 'pumpkin', count: 14, spacing: 0.45 }, { type: 'bat', count: 12, spacing: 0.35 }],
          [{ type: 'dragon', count: 5, spacing: 1.0 }],
          [{ type: 'robot', count: 8, spacing: 0.7 }, { type: 'microbe', count: 12, spacing: 0.4 }],
          [{ type: 'octopus', count: 10, spacing: 0.6 }, { type: 'pumpkin', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Magma Bridge', path: 'K2', startCoins: 300, lives: 11, hpScale: 3.2, rewardScale: 1.45,
        waves: [
          [{ type: 'dragon', count: 8, spacing: 0.8 }],
          [{ type: 'robot', count: 10, spacing: 0.6 }, { type: 'octopus', count: 8, spacing: 0.6 }],
          [{ type: 'mama', count: 3, spacing: 1.2 }, { type: 'snail', count: 5, spacing: 1.2 }, { type: 'microbe', count: 12, spacing: 0.4 }],
          [{ type: 'dragon', count: 8, spacing: 0.7 }, { type: 'pumpkin', count: 12, spacing: 0.4 }],
        ] },
      { name: 'Cinder Caves', path: 'K3', startCoins: 320, lives: 11, hpScale: 3.4, rewardScale: 1.48,
        waves: [
          [{ type: 'robot', count: 12, spacing: 0.5 }, { type: 'bat', count: 14, spacing: 0.3 }],
          [{ type: 'snail', count: 6, spacing: 1.1 }, { type: 'dragon', count: 6, spacing: 0.8 }],
          [{ type: 'octopus', count: 12, spacing: 0.5 }, { type: 'microbe', count: 16, spacing: 0.35 }],
          [{ type: 'dragon', count: 10, spacing: 0.6 }, { type: 'robot', count: 10, spacing: 0.5 }],
        ] },
      { name: 'Lava Falls', path: 'K4', startCoins: 345, lives: 10, hpScale: 3.6, rewardScale: 1.52,
        waves: [
          [{ type: 'snail', count: 8, spacing: 0.9 }],
          [{ type: 'dragon', count: 10, spacing: 0.6 }, { type: 'octopus', count: 10, spacing: 0.5 }],
          [{ type: 'robot', count: 14, spacing: 0.45 }, { type: 'microbe', count: 16, spacing: 0.35 }],
          [{ type: 'snail', count: 8, spacing: 0.8 }, { type: 'dragon', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Lava Wyrm Nest', path: 'K5', boss: true, startCoins: 390, lives: 11, hpScale: 3.7, rewardScale: 1.55,
        waves: [
          [{ type: 'dragon', count: 12, spacing: 0.5 }, { type: 'pumpkin', count: 12, spacing: 0.4 }],
          [{ type: 'robot', count: 12, spacing: 0.5 }, { type: 'octopus', count: 12, spacing: 0.45 }],
          [{ type: 'snail', count: 8, spacing: 0.8 }, { type: 'microbe', count: 18, spacing: 0.3 }],
          [{ type: 'lavadragon', count: 1, spacing: 1 }, { type: 'dragon', count: 8, spacing: 0.7 }, { type: 'robot', count: 8, spacing: 0.6 }],
        ] },
    ],
  },
  {
    name: 'Cosmic Void', emoji: '🪐', bg: '#10122e', floor: '#262a55',
    door: '🌀', accent: '#b58bff', decor: ['⭐', '🪐', '☄️', '🌟', '🛸'],
    rooms: [
      { name: 'Star Gate', path: 'L1', startCoins: 340, lives: 11, hpScale: 4.0, rewardScale: 1.55,
        waves: [
          [{ type: 'alien', count: 18, spacing: 0.35 }],
          [{ type: 'eyeball', count: 20, spacing: 0.28 }, { type: 'bat', count: 12, spacing: 0.3 }],
          [{ type: 'robot', count: 12, spacing: 0.5 }, { type: 'microbe', count: 14, spacing: 0.4 }],
          [{ type: 'dragon', count: 10, spacing: 0.6 }, { type: 'alien', count: 14, spacing: 0.4 }],
        ] },
      { name: 'Nebula Drift', path: 'L2', startCoins: 360, lives: 10, hpScale: 4.3, rewardScale: 1.58,
        waves: [
          [{ type: 'eyeball', count: 22, spacing: 0.25 }],
          [{ type: 'robot', count: 14, spacing: 0.45 }, { type: 'alien', count: 14, spacing: 0.4 }],
          [{ type: 'snail', count: 6, spacing: 1.0 }, { type: 'dragon', count: 10, spacing: 0.5 }],
          [{ type: 'octopus', count: 12, spacing: 0.5 }, { type: 'microbe', count: 18, spacing: 0.3 }],
        ] },
      { name: 'Asteroid Maze', path: 'L3', startCoins: 380, lives: 10, hpScale: 4.6, rewardScale: 1.6,
        waves: [
          [{ type: 'robot', count: 16, spacing: 0.4 }, { type: 'bat', count: 16, spacing: 0.28 }],
          [{ type: 'dragon', count: 12, spacing: 0.5 }, { type: 'alien', count: 16, spacing: 0.35 }],
          [{ type: 'snail', count: 8, spacing: 0.8 }, { type: 'octopus', count: 12, spacing: 0.45 }],
          [{ type: 'dino', count: 1, spacing: 1 }, { type: 'robot', count: 10, spacing: 0.5 }],
        ] },
      { name: 'Black Hole Rim', path: 'L4', startCoins: 400, lives: 10, hpScale: 4.9, rewardScale: 1.62,
        waves: [
          [{ type: 'alien', count: 20, spacing: 0.3 }, { type: 'eyeball', count: 16, spacing: 0.28 }],
          [{ type: 'dragon', count: 14, spacing: 0.45 }, { type: 'robot', count: 14, spacing: 0.4 }],
          [{ type: 'snail', count: 10, spacing: 0.7 }, { type: 'microbe', count: 20, spacing: 0.28 }],
          [{ type: 'dino', count: 1, spacing: 1 }, { type: 'octopus', count: 12, spacing: 0.45 }, { type: 'dragon', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Overlord Nexus', path: 'L5', boss: true, startCoins: 460, lives: 12, hpScale: 5.0, rewardScale: 1.7,
        waves: [
          [{ type: 'alien', count: 22, spacing: 0.28 }, { type: 'robot', count: 12, spacing: 0.4 }],
          [{ type: 'dragon', count: 14, spacing: 0.45 }, { type: 'octopus', count: 14, spacing: 0.4 }],
          [{ type: 'dino', count: 1, spacing: 1 }, { type: 'snail', count: 8, spacing: 0.7 }],
          [{ type: 'voidlord', count: 1, spacing: 1 }, { type: 'robot', count: 10, spacing: 0.5 }, { type: 'dragon', count: 8, spacing: 0.6 }],
        ] },
    ],
  },
]

// ---------------------------------------------------------------------------
// Flatten the areas into the linear LEVELS array the engine plays through,
// stamping each room with its area's theme + metadata. AREAS keeps the
// grouping so the room picker can show one section per world.
// ---------------------------------------------------------------------------
function level(opts) {
  const { waypoints, pathTiles } = buildPath(opts.path)
  return { ...opts, waypoints, pathTiles }
}

export const LEVELS = []
export const AREAS = AREA_DEFS.map((area, ai) => {
  const levelIndices = []
  area.rooms.forEach((room) => {
    const idx = LEVELS.length
    levelIndices.push(idx)
    LEVELS.push(level({
      ...room,
      path: PATHS[room.path],
      bg: room.bg || area.bg,
      floor: room.floor || area.floor,
      areaName: area.name,
      areaEmoji: area.emoji,
      areaIndex: ai,
      isBoss: !!room.boss,
      door: room.door || area.door,
      accent: room.accent || area.accent,
      decor: room.decor || area.decor,
    }))
  })
  return { name: area.name, emoji: area.emoji, bg: area.bg, levelIndices }
})
