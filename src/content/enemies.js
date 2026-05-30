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
//   speedburst – { idle, burst, period } cycles slow↔fast (teaches slow-towers)
//   healAura   – { radius, hps } a "mama" that mends nearby friends each second
//   phase      – { period, kind } goes see-through + dodges ONE tower kind for a bit
//   shielder   – true: hands a one-hit bubble to the friend just behind it
//   burrow     – true: periodically dips underground → can't be caught for a beat
//   slowImmune – can't be slowed or frozen (bosses)
//   boss       – unique boss abilities, see updateBoss() in engine/enemies.js:
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
  bat: { name: 'Flappy Bat', emoji: '🦇', hp: 22, speed: 2.05, reward: 7, radius: 16, color: '#7c6bb0', speedburst: { idle: 0.45, burst: 1.6, period: 1.6 } },
  blob: { name: 'Slime Blob', emoji: '🫧', hp: 40, speed: 1.0, reward: 7, radius: 20, color: '#6be3c4' },
  pumpkin: { name: 'Pumpky', emoji: '🎃', hp: 70, speed: 0.95, reward: 11, radius: 22, color: '#ff9a3d' },
  spider: { name: 'Itsy Spider', emoji: '🕷️', hp: 55, speed: 1.3, reward: 10, radius: 18, color: '#8a7bd8', armor: 3, burrow: true },
  eyeball: { name: 'Peeky', emoji: '👁️', hp: 30, speed: 2.1, reward: 9, radius: 16, color: '#bfe9ff', phase: { period: 2.2, kind: 'beam' } },
  alien: { name: 'Space Goo', emoji: '👾', hp: 60, speed: 1.25, reward: 12, radius: 19, color: '#8cff9e', shield: 2 },
  zombie: { name: 'Sleepy Zomb', emoji: '🧟', hp: 90, speed: 0.8, reward: 13, radius: 21, color: '#9cc46b', regen: 6 },
  octopus: { name: 'Inky', emoji: '🐙', hp: 130, speed: 0.85, reward: 16, radius: 24, color: '#ff7aa8', armor: 5 },
  robot: { name: 'Bolt Bot', emoji: '🤖', hp: 180, speed: 0.7, reward: 20, radius: 24, color: '#9fb8d8', armor: 8 },
  snail: { name: 'Mega Snail', emoji: '🐌', hp: 320, speed: 0.42, reward: 28, radius: 28, color: '#d6c06b', armor: 4 },
  microbe: { name: 'Wobble Germ', emoji: '🦠', hp: 50, speed: 1.15, reward: 9, radius: 19, color: '#ff9ad6', split: { type: 'ghostling', count: 2 } },
  caterpillar: { name: 'Munch Worm', emoji: '🐛', hp: 80, speed: 1.0, reward: 12, radius: 20, color: '#a8e36b', split: { type: 'candy', count: 3 } },
  mama: { name: 'Mama Chick', emoji: '🐤', hp: 110, speed: 0.9, reward: 16, radius: 22, color: '#ffe06b', healAura: { radius: 2.4, hps: 4 } },
  sheller: { name: 'Bubble Shell', emoji: '🐚', hp: 70, speed: 1.05, reward: 13, radius: 20, color: '#ffc1d6', shielder: true },
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
