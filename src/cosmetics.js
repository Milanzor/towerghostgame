// ---------------------------------------------------------------------------
// Avatars, hats and the on-field mascot reaction state machine (PLAN §1).
//
// The kid picks a character (per-profile `avatar`), who appears as a mascot on
// the play field beside the mansion door and *reacts* to the game. Points are a
// persistent wallet (on the profile) spent in the Shop on hats. Hats are PURELY
// COSMETIC — zero gameplay/balance effect.
//
// Kept out of the contested content.js. The avatar render + reaction API here is
// deliberately small and exported so §8 (world-map journey) can reuse the token.
// ---------------------------------------------------------------------------
import { drawEmoji } from './emoji.js'

// Two friendly characters; both share the same hat anchor so any hat fits.
export const AVATARS = {
  boy:  { name: 'Sam', emoji: '👦', hatAnchor: { dx: 0, dy: -18 } },
  girl: { name: 'Mia', emoji: '👧', hatAnchor: { dx: 0, dy: -18 } },
}

// All hats are cheap so a kid affords one fast. `none` is always owned.
export const HATS = {
  none:    { name: 'No hat',  emoji: '',   cost: 0 },
  top:     { name: 'Top Hat', emoji: '🎩', cost: 5 },
  cap:     { name: 'Cap',     emoji: '🧢', cost: 5 },
  bow:     { name: 'Bow',     emoji: '🎀', cost: 6 },
  pumpkin: { name: 'Pumpkin', emoji: '🎃', cost: 8 },
  wizard:  { name: 'Wizard',  emoji: '🧙', cost: 10 },
  crown:   { name: 'Crown',   emoji: '👑', cost: 12 },
}

export const HAT_ORDER = ['none', 'top', 'cap', 'bow', 'pumpkin', 'wizard', 'crown']

// Reaction states — each swaps the mascot's face emoji for ~its duration, then
// falls back to idle. `cheer` / `clap` add a little hop, `hide` covers eyes.
export const REACTIONS = {
  idle:  { emoji: '🙂', hop: 0 },
  cheer: { emoji: '🎉', hop: 14, dur: 1.4 },
  clap:  { emoji: '👏', hop: 8,  dur: 1.0 },
  hide:  { emoji: '🙈', hop: 0,  dur: 1.2 },
  sleep: { emoji: '😴', hop: 0 },
  wave:  { emoji: '👋', hop: 4 },
}

// Every emoji this module can draw — handy for the preload list.
export const COSMETIC_EMOJI = [
  ...Object.values(AVATARS).map(a => a.emoji),
  ...Object.values(HATS).map(h => h.emoji).filter(Boolean),
  ...Object.values(REACTIONS).map(r => r.emoji),
  '🛍️', '✨',
]

export function avatarDef(id) { return AVATARS[id] || AVATARS.girl }
export function hatDef(id) { return HATS[id] || HATS.none }

// ---------------------------------------------------------------------------
// Mascot reaction state machine — module-level so it survives across frames,
// reset per level via resetMascot() (mirrors resetAbilities()).
// ---------------------------------------------------------------------------
const mascot = {
  state: 'idle',  // current reaction key (REACTIONS)
  timer: 0,       // seconds left on a timed reaction
  hop: 0,         // 0..1 little jump progress (decays)
  idleClock: 0,   // drives the gentle between-waves yawn/wave loop
}

export function resetMascot() {
  mascot.state = 'idle'
  mascot.timer = 0
  mascot.hop = 0
  mascot.idleClock = 0
}

// Trigger a reaction; timed ones (cheer/clap/hide) auto-return to idle.
export function avatarReact(kind) {
  const r = REACTIONS[kind]
  if (!r) return
  mascot.state = kind
  mascot.timer = r.dur || 0
  if (r.hop) mascot.hop = 1
}

// Advance the reaction clock (call once per frame with real dt).
export function updateMascot(dt) {
  mascot.idleClock += dt
  if (mascot.hop > 0) mascot.hop = Math.max(0, mascot.hop - dt * 1.6)
  if (mascot.timer > 0) {
    mascot.timer -= dt
    if (mascot.timer <= 0) { mascot.timer = 0; mascot.state = 'idle' }
  }
}

// What face to show right now. During the prep lull (between waves) the idle
// mascot gently alternates a yawn and a wave so it never feels static.
function currentFace(prep) {
  if (mascot.state !== 'idle') return REACTIONS[mascot.state]
  if (prep) {
    // ~4s cycle: mostly content idle, an occasional yawn then a little wave.
    const t = mascot.idleClock % 5
    if (t < 0.9) return REACTIONS.sleep
    if (t < 1.7) return REACTIONS.wave
  }
  return REACTIONS.idle
}

// ---------------------------------------------------------------------------
// Drawing — used on the play field (render.js) and reusable by §8's map token.
// Draws the avatar at (cx, cy) at `size` px with the equipped hat on top, plus
// the current reaction face floating above and a soft bob/hop. `time` drives the
// idle bob; `opts.prep` lets the idle face yawn/wave between waves.
// ---------------------------------------------------------------------------
export function drawAvatar(ctx, { avatar, hat }, cx, cy, size, time = 0, opts = {}) {
  const av = avatarDef(avatar)
  const face = currentFace(opts.prep)
  const bob = Math.sin(time * 2.5) * (size * 0.04)
  const hopY = mascot.hop * (face.hop || 0)
  const y = cy - hopY + bob

  // soft shadow
  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(cx, cy + size * 0.45, size * 0.4, size * 0.12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // the character
  drawEmoji(ctx, av.emoji, cx, y, size)

  // equipped hat sits at the anchor, scaled to the avatar
  const hd = hatDef(hat)
  if (hd.emoji) {
    const hs = size * 0.62
    const ax = av.hatAnchor.dx * (size / 64)
    const ay = av.hatAnchor.dy * (size / 64)
    drawEmoji(ctx, hd.emoji, cx + ax, y + ay - size * 0.18, hs)
  }

  // reaction face bubble floating just above (only when reacting / lulling)
  if (face.emoji && face !== REACTIONS.idle) {
    drawEmoji(ctx, face.emoji, cx + size * 0.42, y - size * 0.42, size * 0.5)
  }
}
