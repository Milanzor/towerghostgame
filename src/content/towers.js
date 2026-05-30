// ===========================================================================
// Towers — your friendly helpers.
// ---------------------------------------------------------------------------
// range is in tiles. cooldown is seconds between shots.
// EVERY helper can be LEVELED UP (tap a placed helper → ⬆️) all the way to
// level 5. Leveling grows the base stats automatically (see LEVEL_GROWTH in
// engine/towers.js) — damage/range up, cooldown down, etc. — so there are no
// per-level tables here; a new helper just needs its base stats.
// `kind` decides how the helper behaves (see engine/towers.js updateTowers):
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
//   snipe     – always zaps the STRONGEST monster in range (boss-buster)
//   bounty    – zap that pays out bonus coins when it catches a monster
//   boost     – cheer helper: buffs nearby helpers (more damage + faster), no zap
//   pull      – whirls the leading monster back down the path + slows it
// ===========================================================================
export const TOWERS = {
  candle: {
    name: 'Candle', emoji: '🕯️', blurb: 'Tiny cheap zap.', color: '#ffb84d',
    cost: 30, range: 1.9, damage: 5, cooldown: 0.55, kind: 'beam',
  },
  sparkler: {
    name: 'Sparkler', emoji: '✨', blurb: 'Cheap & super fast!', color: '#ffe98a',
    cost: 45, range: 2.0, damage: 6, cooldown: 0.38, kind: 'beam',
  },
  flashlight: {
    name: 'Flashlight', emoji: '🔦', blurb: 'Zaps one monster fast!', color: '#ffd34d',
    cost: 55, range: 2.4, damage: 8, cooldown: 0.42, kind: 'beam',
  },
  glowwand: {
    name: 'Glow Wand', emoji: '🪄', blurb: 'A stronger magic zap.', color: '#c9a0ff',
    cost: 70, range: 2.6, damage: 13, cooldown: 0.5, kind: 'beam',
  },
  vacuum: {
    name: 'Poltergust', emoji: '🌀', blurb: 'Sucks & slows monsters!', color: '#5bc8ff',
    cost: 80, range: 2.0, damage: 4, cooldown: 0.18, kind: 'suck', slow: 0.5,
  },
  jelly: {
    name: 'Wobble Jelly', emoji: '🍮', blurb: 'Sticky! Slows & nibbles.', color: '#ffb6d5',
    cost: 85, range: 2.2, damage: 5, cooldown: 0.2, kind: 'suck', slow: 0.4,
  },
  web: {
    name: 'Web Spinner', emoji: '🕸️', blurb: 'Sticky web slows a crowd.', color: '#cdd7e6',
    cost: 90, range: 2.1, damage: 2, cooldown: 0.8, kind: 'frost', slow: 0.42, slowDur: 1.6,
  },
  magnet: {
    name: 'Magnet', emoji: '🧲', blurb: 'Grabs & really slows!', color: '#ff5b7a',
    cost: 95, range: 2.6, damage: 3, cooldown: 0.2, kind: 'suck', slow: 0.3,
  },
  mushroom: {
    name: 'Goo Shroom', emoji: '🍄', blurb: 'Bubbly goo hurts over time.', color: '#c065ff',
    cost: 100, range: 2.2, damage: 4, cooldown: 0.7, kind: 'poison', poisonDps: 7, poisonDur: 2.6, slow: 0.8,
  },
  lantern: {
    name: 'Fire Lantern', emoji: '🏮', blurb: 'Sets monsters cozy-ablaze!', color: '#ff7a3d',
    cost: 110, range: 2.2, damage: 6, cooldown: 0.8, kind: 'burn', burnDps: 9, burnDur: 2.2,
  },
  chili: {
    name: 'Chili Pepper', emoji: '🌶️', blurb: 'Spicy! Hot burn over time.', color: '#ff5a3d',
    cost: 115, range: 2.2, damage: 7, cooldown: 0.75, kind: 'burn', burnDps: 14, burnDur: 2.4,
  },
  potion: {
    name: 'Bubble Potion', emoji: '🧪', blurb: 'Strong fizzy goo + slow.', color: '#9bff6b',
    cost: 115, range: 2.3, damage: 5, cooldown: 0.65, kind: 'poison', poisonDps: 11, poisonDur: 2.8, slow: 0.75,
  },
  snowflake: {
    name: 'Frostpuff', emoji: '❄️', blurb: 'Freezes everyone near it!', color: '#9be8ff',
    cost: 120, range: 1.9, damage: 3, cooldown: 0.9, kind: 'frost', slow: 0.45, slowDur: 1.1,
  },
  piggybank: {
    name: 'Piggy Bank', emoji: '🐷', blurb: 'Makes you coins!', color: '#ff9ec0',
    cost: 120, range: 0, damage: 0, cooldown: 4.0, kind: 'bank', income: 22,
  },
  icecream: {
    name: 'Frosty Cone', emoji: '🍦', blurb: 'Chilly freeze aura.', color: '#bfefff',
    cost: 130, range: 2.0, damage: 5, cooldown: 0.85, kind: 'frost', slow: 0.4, slowDur: 1.3,
  },
  cupcake: {
    name: 'Cupcake Stand', emoji: '🧁', blurb: 'Bakes up extra coins!', color: '#ffb0c8',
    cost: 130, range: 0, damage: 0, cooldown: 3.5, kind: 'bank', income: 28,
  },
  bell: {
    name: 'Boom Bell', emoji: '🔔', blurb: 'Thumps everyone around it.', color: '#ffcf6b',
    cost: 135, range: 1.8, damage: 9, cooldown: 0.85, kind: 'pulse',
  },
  drum: {
    name: 'Big Drum', emoji: '🥁', blurb: 'BOOM! Thumps a crowd hard.', color: '#ff9a5a',
    cost: 145, range: 1.9, damage: 13, cooldown: 0.8, kind: 'pulse',
  },
  tornado: {
    name: 'Twirly Tornado', emoji: '🌪️', blurb: 'Whirls a monster backwards!', color: '#aee0ff',
    cost: 150, range: 2.6, damage: 8, cooldown: 1.0, kind: 'pull', pull: 1.2,
  },
  starwand: {
    name: 'Star Wand', emoji: '🌟', blurb: 'Lightning hops monster to monster!', color: '#ffe14d',
    cost: 150, range: 2.6, damage: 11, cooldown: 0.7, kind: 'chain', chainCount: 3, chainRange: 2.2, chainFalloff: 0.7,
  },
  magichat: {
    name: 'Magic Hat', emoji: '🎩', blurb: 'Pays bonus coins per catch!', color: '#6b7cff',
    cost: 155, range: 2.5, damage: 14, cooldown: 0.6, kind: 'bounty', bounty: 8,
  },
  boobomb: {
    name: 'Boo Bomb', emoji: '💥', blurb: 'Big splash boom!', color: '#ff7ad1',
    cost: 160, range: 2.2, damage: 22, cooldown: 1.5, kind: 'splash', splashRadius: 1.1,
  },
  megaphone: {
    name: 'Cheer Captain', emoji: '📣', blurb: 'Buffs nearby helpers!', color: '#ffd36b',
    cost: 165, range: 2.4, damage: 0, cooldown: 1.0, kind: 'boost', boostDmg: 1.3, boostRate: 0.78,
  },
  thunder: {
    name: 'Thunder Cloud', emoji: '⛈️', blurb: 'Zappy lightning hops!', color: '#8ab6ff',
    cost: 175, range: 2.6, damage: 13, cooldown: 0.7, kind: 'chain', chainCount: 4, chainRange: 2.3, chainFalloff: 0.8,
  },
  firework: {
    name: 'Firework', emoji: '🎆', blurb: 'Sparkly splash boom!', color: '#ff7ad1',
    cost: 185, range: 2.4, damage: 26, cooldown: 1.4, kind: 'splash', splashRadius: 1.2,
  },
  rainbow: {
    name: 'Rainbow Ray', emoji: '🌈', blurb: 'Zaps lots of monsters at once!', color: '#7af0c8',
    cost: 200, range: 2.5, damage: 10, cooldown: 0.6, kind: 'multishot', shots: 3,
  },
  anchor: {
    name: 'Heavy Anchor', emoji: '⚓', blurb: 'Heavy splash thump.', color: '#7fb0d8',
    cost: 205, range: 2.2, damage: 30, cooldown: 1.6, kind: 'splash', splashRadius: 1.3,
  },
  bolt: {
    name: 'Lightning Bolt', emoji: '⚡', blurb: 'Fast lightning, many hops!', color: '#ffe14d',
    cost: 215, range: 2.8, damage: 16, cooldown: 0.5, kind: 'chain', chainCount: 5, chainRange: 2.5, chainFalloff: 0.85,
  },
  cannon: {
    name: 'Pumpkin Cannon', emoji: '🎃', blurb: 'HUGE booms, slow reload.', color: '#ff9a3d',
    cost: 220, range: 2.8, damage: 46, cooldown: 2.0, kind: 'splash', splashRadius: 1.6,
  },
  disco: {
    name: 'Disco Ball', emoji: '🪩', blurb: 'Dazzles many monsters!', color: '#d59bff',
    cost: 225, range: 2.6, damage: 12, cooldown: 0.55, kind: 'multishot', shots: 4,
  },
  crystal: {
    name: 'Crystal Eye', emoji: '🔮', blurb: 'Sniper! Far + strong.', color: '#b58bff',
    cost: 240, range: 5.0, damage: 60, cooldown: 1.8, kind: 'beam',
  },
  owl: {
    name: 'Sniper Owl', emoji: '🦉', blurb: 'Hits the toughest monster!', color: '#b89a6b',
    cost: 245, range: 4.5, damage: 55, cooldown: 1.6, kind: 'snipe',
  },
  rocket: {
    name: 'Rocket', emoji: '🚀', blurb: 'Mega splash blast-off!', color: '#ff6a4d',
    cost: 260, range: 3.0, damage: 55, cooldown: 1.8, kind: 'splash', splashRadius: 1.7,
  },
  diamond: {
    name: 'Diamond Beam', emoji: '💎', blurb: 'Super sniper, very far!', color: '#9be8ff',
    cost: 280, range: 5.5, damage: 72, cooldown: 1.7, kind: 'beam',
  },
  sun: {
    name: 'Sun Beam', emoji: '☀️', blurb: 'Super strong zap!', color: '#ffe14d',
    cost: 300, range: 3.0, damage: 38, cooldown: 0.4, kind: 'beam',
  },
}

export const TOWER_ORDER = [
  'candle', 'sparkler', 'flashlight', 'glowwand',
  'vacuum', 'jelly', 'web', 'magnet',
  'mushroom', 'lantern', 'chili', 'potion',
  'snowflake', 'icecream', 'piggybank', 'cupcake',
  'bell', 'drum', 'tornado', 'starwand', 'magichat',
  'boobomb', 'megaphone', 'thunder', 'firework',
  'rainbow', 'anchor', 'bolt', 'cannon', 'disco',
  'crystal', 'owl', 'rocket', 'diamond', 'sun',
]
