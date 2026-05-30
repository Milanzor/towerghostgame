// ---------------------------------------------------------------------------
// Avatars and hats — the per-profile character cosmetics.
//
// The kid picks a character (per-profile `avatar`) when creating a player; it
// shows on the profile picker, the world-map token and the Hat Shop preview.
// Points are a persistent wallet (on the profile) spent in the Shop on hats.
// Hats are PURELY COSMETIC — zero gameplay/balance effect.
// ---------------------------------------------------------------------------

// Two friendly characters the player chooses between when making a profile.
export const AVATARS = {
  boy:  { name: 'Sam', emoji: '👦' },
  girl: { name: 'Mia', emoji: '👧' },
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

// Every emoji this module can show — handy for the preload list.
export const COSMETIC_EMOJI = [
  ...Object.values(AVATARS).map(a => a.emoji),
  ...Object.values(HATS).map(h => h.emoji).filter(Boolean),
  '🛍️', '✨',
]

export function avatarDef(id) { return AVATARS[id] || AVATARS.girl }
export function hatDef(id) { return HATS[id] || HATS.none }
