// ---------------------------------------------------------------------------
// Game content: the towers you can build, the cute monsters you catch,
// and all the rooms (levels), grouped into themed AREAS. Everything kid-facing
// lives here so it's easy to tweak. Numbers are friendly, not scary. 💜
// ---------------------------------------------------------------------------

export const TILE = 64
export const COLS = 15
export const ROWS = 8
export const FIELD_W = COLS * TILE // 960
export const FIELD_H = ROWS * TILE // 512

// ===========================================================================
// Towers — your friendly helpers.
// ---------------------------------------------------------------------------
// range is in tiles. cooldown is seconds between shots.
// `kind` decides how the helper behaves (see main.js updateTowers):
//   beam      – instant zap on a single monster
//   suck      – continuous beam that slows + hurts a monster
//   splash    – lobs a boom that hurts everyone nearby
//   chain     – zap that hops between several monsters (lightning)
//   burn      – zap that sets a monster on (friendly) fire over time
//   poison    – zap that bubbles a monster with goo over time + tiny slow
//   frost     – freezes ALL monsters around the helper (big slow + tiny hurt)
//   pulse     – thumps ALL monsters around the helper for damage
//   multishot – zaps several monsters at once with rainbow beams
//   bank      – makes coins for you over time (no zapping)
// ===========================================================================
export const TOWERS = {
  candle: {
    name: 'Candle', emoji: '🕯️', blurb: 'Tiny cheap zap.', color: '#ffb84d',
    cost: 30, range: 1.9, damage: 5, cooldown: 0.55, kind: 'beam',
    upgrade: { cost: 35, damage: 9, range: 2.2, cooldown: 0.48 },
  },
  flashlight: {
    name: 'Flashlight', emoji: '🔦', blurb: 'Zaps one monster fast!', color: '#ffd34d',
    cost: 55, range: 2.4, damage: 8, cooldown: 0.42, kind: 'beam',
    upgrade: { cost: 65, damage: 15, range: 2.9, cooldown: 0.35 },
  },
  vacuum: {
    name: 'Poltergust', emoji: '🌀', blurb: 'Sucks & slows monsters!', color: '#5bc8ff',
    cost: 80, range: 2.0, damage: 4, cooldown: 0.18, kind: 'suck', slow: 0.5,
    upgrade: { cost: 90, damage: 7, range: 2.4, cooldown: 0.15, slow: 0.38 },
  },
  magnet: {
    name: 'Magnet', emoji: '🧲', blurb: 'Grabs & really slows!', color: '#ff5b7a',
    cost: 95, range: 2.6, damage: 3, cooldown: 0.2, kind: 'suck', slow: 0.3,
    upgrade: { cost: 100, damage: 5, range: 3.0, cooldown: 0.18, slow: 0.2 },
  },
  snowflake: {
    name: 'Frostpuff', emoji: '❄️', blurb: 'Freezes everyone near it!', color: '#9be8ff',
    cost: 120, range: 1.9, damage: 3, cooldown: 0.9, kind: 'frost', slow: 0.45, slowDur: 1.1,
    upgrade: { cost: 130, damage: 6, range: 2.3, cooldown: 0.75, slow: 0.3, slowDur: 1.4 },
  },
  lantern: {
    name: 'Fire Lantern', emoji: '🏮', blurb: 'Sets monsters cozy-ablaze!', color: '#ff7a3d',
    cost: 110, range: 2.2, damage: 6, cooldown: 0.8, kind: 'burn', burnDps: 9, burnDur: 2.2,
    upgrade: { cost: 120, damage: 11, range: 2.6, cooldown: 0.7, burnDps: 16, burnDur: 2.6 },
  },
  mushroom: {
    name: 'Goo Shroom', emoji: '🍄', blurb: 'Bubbly goo hurts over time.', color: '#c065ff',
    cost: 100, range: 2.2, damage: 4, cooldown: 0.7, kind: 'poison', poisonDps: 7, poisonDur: 2.6, slow: 0.8,
    upgrade: { cost: 110, damage: 7, range: 2.6, cooldown: 0.6, poisonDps: 13, poisonDur: 3.0, slow: 0.7 },
  },
  starwand: {
    name: 'Star Wand', emoji: '🌟', blurb: 'Lightning hops monster to monster!', color: '#ffe14d',
    cost: 150, range: 2.6, damage: 11, cooldown: 0.7, kind: 'chain', chainCount: 3, chainRange: 2.2, chainFalloff: 0.7,
    upgrade: { cost: 170, damage: 18, range: 3.0, cooldown: 0.6, chainCount: 5, chainRange: 2.5, chainFalloff: 0.8 },
  },
  bell: {
    name: 'Boom Bell', emoji: '🔔', blurb: 'Thumps everyone around it.', color: '#ffcf6b',
    cost: 135, range: 1.8, damage: 9, cooldown: 0.85, kind: 'pulse',
    upgrade: { cost: 150, damage: 17, range: 2.2, cooldown: 0.7 },
  },
  boobomb: {
    name: 'Boo Bomb', emoji: '💥', blurb: 'Big splash boom!', color: '#ff7ad1',
    cost: 160, range: 2.2, damage: 22, cooldown: 1.5, kind: 'splash', splashRadius: 1.1,
    upgrade: { cost: 170, damage: 40, range: 2.6, cooldown: 1.2, splashRadius: 1.5 },
  },
  cannon: {
    name: 'Pumpkin Cannon', emoji: '🎃', blurb: 'HUGE booms, slow reload.', color: '#ff9a3d',
    cost: 220, range: 2.8, damage: 46, cooldown: 2.0, kind: 'splash', splashRadius: 1.6,
    upgrade: { cost: 240, damage: 80, range: 3.2, cooldown: 1.7, splashRadius: 2.0 },
  },
  rainbow: {
    name: 'Rainbow Ray', emoji: '🌈', blurb: 'Zaps lots of monsters at once!', color: '#7af0c8',
    cost: 200, range: 2.5, damage: 10, cooldown: 0.6, kind: 'multishot', shots: 3,
    upgrade: { cost: 220, damage: 16, range: 2.9, cooldown: 0.5, shots: 5 },
  },
  crystal: {
    name: 'Crystal Eye', emoji: '🔮', blurb: 'Sniper! Far + strong.', color: '#b58bff',
    cost: 240, range: 5.0, damage: 60, cooldown: 1.8, kind: 'beam',
    upgrade: { cost: 260, damage: 110, range: 6.0, cooldown: 1.5 },
  },
  sun: {
    name: 'Sun Beam', emoji: '☀️', blurb: 'Super strong zap!', color: '#ffe14d',
    cost: 300, range: 3.0, damage: 38, cooldown: 0.4, kind: 'beam',
    upgrade: { cost: 330, damage: 70, range: 3.4, cooldown: 0.32 },
  },
  piggybank: {
    name: 'Piggy Bank', emoji: '🐷', blurb: 'Makes you coins! 🪙', color: '#ff9ec0',
    cost: 120, range: 0, damage: 0, cooldown: 4.0, kind: 'bank', income: 22,
    upgrade: { cost: 130, cooldown: 3.0, income: 40 },
  },
}

export const TOWER_ORDER = [
  'candle', 'flashlight', 'vacuum', 'magnet', 'snowflake', 'lantern',
  'mushroom', 'starwand', 'bell', 'rainbow', 'boobomb', 'cannon',
  'crystal', 'sun', 'piggybank',
]

// ===========================================================================
// Monsters — cute, never scary. hp/reward get scaled per level.
// speed is tiles per second.
// `shape: 'ghost'` draws the classic friendly ghost. Anything with an
//   `emoji` is drawn as a round little critter wearing that emoji face.
// Special powers (all optional):
//   armor      – soaks up some of every hit (min 1 damage still lands)
//   shield     – a bubble that eats the first N hits completely
//   regen      – slowly heals back up (hp per second)
//   split      – { type, count } pops into little ones when caught
//   slowImmune – can't be slowed or frozen (bosses)
//   boss       – unique boss abilities, see updateBoss() in main.js:
//                summon{type,count,interval}  – periodically calls minions
//                hex{radius,dur,interval}     – freezes nearby helpers
//                enrage{hpFrac,mult}          – speeds up when hurt
//                blink{dist,interval}         – teleports forward along the path
//                phaseShield{dur,interval}    – becomes invincible for a bit
// ===========================================================================
export const ENEMIES = {
  // --- classic ghosts ---
  boo: { name: 'Boo', shape: 'ghost', hp: 26, speed: 1.05, reward: 6, radius: 20, color: '#ffffff', face: '#3a2a5a' },
  greenie: { name: 'Greenie', shape: 'ghost', hp: 18, speed: 1.95, reward: 5, radius: 17, color: '#9be36b', face: '#2c5a1c' },
  flyer: { name: 'Blue Boo', shape: 'ghost', hp: 42, speed: 1.45, reward: 8, radius: 19, color: '#7fd6ff', face: '#1c3a5a' },
  slammer: { name: 'Big Purple', shape: 'ghost', hp: 95, speed: 0.62, reward: 14, radius: 27, color: '#b88cff', face: '#3a2060' },
  ghostling: { name: 'Ghostling', shape: 'ghost', hp: 10, speed: 2.4, reward: 3, radius: 13, color: '#f3e9ff', face: '#5a3a7a' },

  // --- cute monster critters ---
  candy: { name: 'Candy Hopper', emoji: '🍬', hp: 16, speed: 2.2, reward: 5, radius: 15, color: '#ff8fc6' },
  bat: { name: 'Flappy Bat', emoji: '🦇', hp: 22, speed: 2.05, reward: 7, radius: 16, color: '#7c6bb0' },
  blob: { name: 'Slime Blob', emoji: '🫧', hp: 40, speed: 1.0, reward: 7, radius: 20, color: '#6be3c4' },
  pumpkin: { name: 'Pumpky', emoji: '🎃', hp: 70, speed: 0.95, reward: 11, radius: 22, color: '#ff9a3d' },
  spider: { name: 'Itsy Spider', emoji: '🕷️', hp: 55, speed: 1.3, reward: 10, radius: 18, color: '#8a7bd8', armor: 3 },
  eyeball: { name: 'Peeky', emoji: '👁️', hp: 30, speed: 2.1, reward: 9, radius: 16, color: '#bfe9ff' },
  alien: { name: 'Space Goo', emoji: '👾', hp: 60, speed: 1.25, reward: 12, radius: 19, color: '#8cff9e', shield: 2 },
  zombie: { name: 'Sleepy Zomb', emoji: '🧟', hp: 90, speed: 0.8, reward: 13, radius: 21, color: '#9cc46b', regen: 6 },
  octopus: { name: 'Inky', emoji: '🐙', hp: 130, speed: 0.85, reward: 16, radius: 24, color: '#ff7aa8', armor: 5 },
  robot: { name: 'Bolt Bot', emoji: '🤖', hp: 180, speed: 0.7, reward: 20, radius: 24, color: '#9fb8d8', armor: 8 },
  snail: { name: 'Mega Snail', emoji: '🐌', hp: 320, speed: 0.42, reward: 28, radius: 28, color: '#d6c06b', armor: 4 },
  microbe: { name: 'Wobble Germ', emoji: '🦠', hp: 50, speed: 1.15, reward: 9, radius: 19, color: '#ff9ad6', split: { type: 'ghostling', count: 2 } },
  caterpillar: { name: 'Munch Worm', emoji: '🐛', hp: 80, speed: 1.0, reward: 12, radius: 20, color: '#a8e36b', split: { type: 'candy', count: 3 } },
  dragon: { name: 'Baby Dragon', emoji: '🐉', hp: 260, speed: 0.95, reward: 30, radius: 26, color: '#76d6a0', armor: 4 },
  dino: { name: 'Chompo', emoji: '🦖', hp: 900, speed: 0.6, reward: 120, radius: 38, color: '#8fd98f', armor: 6, split: { type: 'dragon', count: 2 } },

  // --- AREA BOSSES (one per area, each with a unique trick) ---
  kingboo: {
    name: 'King Boo', shape: 'ghost', hp: 1200, speed: 0.5, reward: 200, radius: 42,
    color: '#d6b3ff', face: '#2a0d4a', crown: true,
    boss: { summon: { type: 'ghostling', count: 3, interval: 3.2 } },
  },
  frosttitan: {
    name: 'Frost Titan', emoji: '⛄', hp: 2000, speed: 0.46, reward: 260, radius: 44,
    color: '#9be8ff', armor: 6, slowImmune: true, crown: true,
    boss: { hex: { radius: 2.3, dur: 2.6, interval: 5.0 } },
  },
  goblinking: {
    name: 'Goblin Warlord', emoji: '👹', hp: 2900, speed: 0.5, reward: 320, radius: 44,
    color: '#e0705a', armor: 10, crown: true,
    boss: { enrage: { hpFrac: 0.5, mult: 2.1 } },
  },
  lavadragon: {
    name: 'Lava Wyrm', emoji: '🐲', hp: 4000, speed: 0.6, reward: 400, radius: 46,
    color: '#ff6a3d', armor: 8, regen: 26, crown: true,
    boss: { blink: { dist: 2.6, interval: 4.5 } },
  },
  voidlord: {
    name: 'Cosmic Overlord', emoji: '🛸', hp: 6200, speed: 0.5, reward: 600, radius: 48,
    color: '#b58bff', armor: 12, crown: true,
    boss: { phaseShield: { dur: 2.0, interval: 5.2 }, summon: { type: 'alien', count: 2, interval: 4.0 } },
  },
}

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
      { name: 'Crystal Lake', path: 'H', startCoins: 230, lives: 13, hpScale: 1.9, rewardScale: 1.24,
        waves: [
          [{ type: 'blob', count: 14, spacing: 0.45 }, { type: 'eyeball', count: 10, spacing: 0.4 }],
          [{ type: 'zombie', count: 10, spacing: 0.7 }],
          [{ type: 'alien', count: 12, spacing: 0.5 }, { type: 'spider', count: 8, spacing: 0.5 }],
          [{ type: 'octopus', count: 5, spacing: 1.2 }, { type: 'bat', count: 14, spacing: 0.35 }],
        ] },
      { name: 'Glacier Drop', path: 'B', startCoins: 250, lives: 12, hpScale: 2.05, rewardScale: 1.28,
        waves: [
          [{ type: 'alien', count: 14, spacing: 0.45 }],
          [{ type: 'octopus', count: 6, spacing: 1.0 }, { type: 'zombie', count: 10, spacing: 0.6 }],
          [{ type: 'spider', count: 12, spacing: 0.45 }, { type: 'eyeball', count: 14, spacing: 0.3 }],
          [{ type: 'octopus', count: 8, spacing: 0.8 }, { type: 'alien', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Frost Titan Lair', path: 'E', boss: true, startCoins: 290, lives: 13, hpScale: 2.1, rewardScale: 1.3,
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
    rooms: [
      { name: 'Rusty Gate', path: 'C', startCoins: 240, lives: 13, hpScale: 2.25, rewardScale: 1.3,
        waves: [
          [{ type: 'spider', count: 12, spacing: 0.5 }],
          [{ type: 'pumpkin', count: 8, spacing: 0.8 }, { type: 'bat', count: 12, spacing: 0.4 }],
          [{ type: 'caterpillar', count: 6, spacing: 1.0 }, { type: 'spider', count: 8, spacing: 0.5 }],
          [{ type: 'octopus', count: 6, spacing: 1.0 }, { type: 'microbe', count: 10, spacing: 0.5 }],
        ] },
      { name: 'Torch Corridor', path: 'D', startCoins: 255, lives: 12, hpScale: 2.4, rewardScale: 1.33,
        waves: [
          [{ type: 'pumpkin', count: 12, spacing: 0.5 }],
          [{ type: 'robot', count: 6, spacing: 1.0 }, { type: 'spider', count: 10, spacing: 0.45 }],
          [{ type: 'caterpillar', count: 8, spacing: 0.8 }, { type: 'octopus', count: 6, spacing: 0.8 }],
          [{ type: 'microbe', count: 14, spacing: 0.4 }, { type: 'pumpkin', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Spider Pit', path: 'G', startCoins: 270, lives: 12, hpScale: 2.55, rewardScale: 1.36,
        waves: [
          [{ type: 'spider', count: 16, spacing: 0.4 }, { type: 'bat', count: 12, spacing: 0.35 }],
          [{ type: 'octopus', count: 8, spacing: 0.8 }, { type: 'caterpillar', count: 8, spacing: 0.7 }],
          [{ type: 'robot', count: 8, spacing: 0.8 }, { type: 'microbe', count: 12, spacing: 0.4 }],
          [{ type: 'octopus', count: 10, spacing: 0.6 }, { type: 'pumpkin', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Iron Forge', path: 'H', startCoins: 290, lives: 11, hpScale: 2.75, rewardScale: 1.4,
        waves: [
          [{ type: 'robot', count: 10, spacing: 0.6 }],
          [{ type: 'caterpillar', count: 10, spacing: 0.6 }, { type: 'spider', count: 12, spacing: 0.4 }],
          [{ type: 'octopus', count: 10, spacing: 0.6 }, { type: 'microbe', count: 14, spacing: 0.4 }],
          [{ type: 'robot', count: 12, spacing: 0.55 }, { type: 'pumpkin', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Warlord Throne', path: 'E', boss: true, startCoins: 330, lives: 12, hpScale: 2.8, rewardScale: 1.42,
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
    rooms: [
      { name: 'Ember Path', path: 'A', startCoins: 280, lives: 12, hpScale: 3.0, rewardScale: 1.42,
        waves: [
          [{ type: 'pumpkin', count: 14, spacing: 0.45 }, { type: 'bat', count: 12, spacing: 0.35 }],
          [{ type: 'dragon', count: 5, spacing: 1.0 }],
          [{ type: 'robot', count: 8, spacing: 0.7 }, { type: 'microbe', count: 12, spacing: 0.4 }],
          [{ type: 'octopus', count: 10, spacing: 0.6 }, { type: 'pumpkin', count: 12, spacing: 0.45 }],
        ] },
      { name: 'Magma Bridge', path: 'D', startCoins: 300, lives: 11, hpScale: 3.2, rewardScale: 1.45,
        waves: [
          [{ type: 'dragon', count: 8, spacing: 0.8 }],
          [{ type: 'robot', count: 10, spacing: 0.6 }, { type: 'octopus', count: 8, spacing: 0.6 }],
          [{ type: 'snail', count: 5, spacing: 1.2 }, { type: 'microbe', count: 14, spacing: 0.4 }],
          [{ type: 'dragon', count: 8, spacing: 0.7 }, { type: 'pumpkin', count: 12, spacing: 0.4 }],
        ] },
      { name: 'Cinder Caves', path: 'F', startCoins: 320, lives: 11, hpScale: 3.4, rewardScale: 1.48,
        waves: [
          [{ type: 'robot', count: 12, spacing: 0.5 }, { type: 'bat', count: 14, spacing: 0.3 }],
          [{ type: 'snail', count: 6, spacing: 1.1 }, { type: 'dragon', count: 6, spacing: 0.8 }],
          [{ type: 'octopus', count: 12, spacing: 0.5 }, { type: 'microbe', count: 16, spacing: 0.35 }],
          [{ type: 'dragon', count: 10, spacing: 0.6 }, { type: 'robot', count: 10, spacing: 0.5 }],
        ] },
      { name: 'Lava Falls', path: 'G', startCoins: 345, lives: 10, hpScale: 3.6, rewardScale: 1.52,
        waves: [
          [{ type: 'snail', count: 8, spacing: 0.9 }],
          [{ type: 'dragon', count: 10, spacing: 0.6 }, { type: 'octopus', count: 10, spacing: 0.5 }],
          [{ type: 'robot', count: 14, spacing: 0.45 }, { type: 'microbe', count: 16, spacing: 0.35 }],
          [{ type: 'snail', count: 8, spacing: 0.8 }, { type: 'dragon', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Lava Wyrm Nest', path: 'E', boss: true, startCoins: 390, lives: 11, hpScale: 3.7, rewardScale: 1.55,
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
    rooms: [
      { name: 'Star Gate', path: 'B', startCoins: 340, lives: 11, hpScale: 4.0, rewardScale: 1.55,
        waves: [
          [{ type: 'alien', count: 18, spacing: 0.35 }],
          [{ type: 'eyeball', count: 20, spacing: 0.28 }, { type: 'bat', count: 12, spacing: 0.3 }],
          [{ type: 'robot', count: 12, spacing: 0.5 }, { type: 'microbe', count: 14, spacing: 0.4 }],
          [{ type: 'dragon', count: 10, spacing: 0.6 }, { type: 'alien', count: 14, spacing: 0.4 }],
        ] },
      { name: 'Nebula Drift', path: 'D', startCoins: 360, lives: 10, hpScale: 4.3, rewardScale: 1.58,
        waves: [
          [{ type: 'eyeball', count: 22, spacing: 0.25 }],
          [{ type: 'robot', count: 14, spacing: 0.45 }, { type: 'alien', count: 14, spacing: 0.4 }],
          [{ type: 'snail', count: 6, spacing: 1.0 }, { type: 'dragon', count: 10, spacing: 0.5 }],
          [{ type: 'octopus', count: 12, spacing: 0.5 }, { type: 'microbe', count: 18, spacing: 0.3 }],
        ] },
      { name: 'Asteroid Maze', path: 'G', startCoins: 380, lives: 10, hpScale: 4.6, rewardScale: 1.6,
        waves: [
          [{ type: 'robot', count: 16, spacing: 0.4 }, { type: 'bat', count: 16, spacing: 0.28 }],
          [{ type: 'dragon', count: 12, spacing: 0.5 }, { type: 'alien', count: 16, spacing: 0.35 }],
          [{ type: 'snail', count: 8, spacing: 0.8 }, { type: 'octopus', count: 12, spacing: 0.45 }],
          [{ type: 'dino', count: 1, spacing: 1 }, { type: 'robot', count: 10, spacing: 0.5 }],
        ] },
      { name: 'Black Hole Rim', path: 'H', startCoins: 400, lives: 10, hpScale: 4.9, rewardScale: 1.62,
        waves: [
          [{ type: 'alien', count: 20, spacing: 0.3 }, { type: 'eyeball', count: 16, spacing: 0.28 }],
          [{ type: 'dragon', count: 14, spacing: 0.45 }, { type: 'robot', count: 14, spacing: 0.4 }],
          [{ type: 'snail', count: 10, spacing: 0.7 }, { type: 'microbe', count: 20, spacing: 0.28 }],
          [{ type: 'dino', count: 1, spacing: 1 }, { type: 'octopus', count: 12, spacing: 0.45 }, { type: 'dragon', count: 8, spacing: 0.6 }],
        ] },
      { name: 'Overlord Nexus', path: 'E', boss: true, startCoins: 460, lives: 12, hpScale: 5.0, rewardScale: 1.7,
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
    }))
  })
  return { name: area.name, emoji: area.emoji, bg: area.bg, levelIndices }
})
