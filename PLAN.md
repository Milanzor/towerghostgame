# 👻 Ghost Catchers — Feature Plan

Scope for the next batch of work. Another agent is concurrently adding **tower
leveling + ~20 new tower types** (all in `content.js` `TOWERS`), so this plan
deliberately stays out of `TOWERS` and leans on `main.js`, `audio.js`,
`style.css`, `emoji.js`, and the `ENEMIES` / `LEVELS` / `PATHS` data.

Guiding rule: everything stays **bright, friendly, and easy for a 4-year-old.**
No fail-shaming, big tap targets, lots of happy feedback.

---

## 0. Currencies — keep two clearly separate

The game already has two persistent ideas in `save`: `unlocked` and per-level
`stars`. We add **one persistent wallet** for the meta-shop.

| Name | Emoji | Lives | Earned by | Spent on |
|------|-------|-------|-----------|----------|
| **Coins** (existing) | 🪙 | one level only, reset each level | popping monsters, bank tower, wave bonus | placing/upgrading helpers *during* a level |
| **Points** (new) | ⭐ *(tbd)* | persistent, in `save` | awarded on the level-win screen | avatars & hats in the Shop |
| **Stars** (existing) | ⭐ | persistent per-level rating (0–3) | lives left at win | (display only — gates nothing yet) |

> ⚠️ Open question: should the new spendable **Points** just *be* the existing
> star total, or a separate "treats" wallet? Default plan: **separate wallet**
> (`save.points`) so spending it doesn't erase the star rating the kid earned.
> Reward formula suggestion: `points = 3 (clear) + starsThisLevel + floor(leftoverCoins / 25)`.

---

## 1. Avatars + Hats + Shop  *(biggest new system)*

**Player experience:** pick a character (a blond-haired boy or a blond-haired
girl) who appears on the screen — e.g. standing by the mansion door cheering, or
as the cursor/helper-placer mascot. Earn **Points** each level, spend them in a
**Shop** to buy hats the avatar wears. Pure delight, no gameplay balance impact.

**Avatars (v1):**
- 👦 Blond Boy
- 👧 Blond Girl
- (both share the same hat anchor point so any hat fits either)

**Hats (start with ~5, all cheap):** 🎩 top hat, 👑 crown, 🧢 cap, 🎀 bow,
🪄→🧙 wizard hat, 🎃 pumpkin, etc. Each has a `cost` in Points.

**Data shape** (new `src/cosmetics.js`, keeps it out of the contested `content.js`):
```js
export const AVATARS = {
  boy:  { name: 'Sam',  emoji: '👦', hatAnchor: { dx: 0, dy: -18 } },
  girl: { name: 'Mia',  emoji: '👧', hatAnchor: { dx: 0, dy: -18 } },
}
export const HATS = {
  none:    { name: 'No hat', emoji: '',   cost: 0 },
  top:     { name: 'Top Hat', emoji: '🎩', cost: 5 },
  crown:   { name: 'Crown',   emoji: '👑', cost: 12 },
  // …
}
```

**Save shape additions:**
```js
save.points    = 0
save.avatar    = 'girl'          // chosen character
save.owned     = ['none']        // hat ids purchased
save.hat       = 'none'          // equipped hat
```

**UI:**
- A 🛍️ **Shop** button on the level-select / map screen.
- Shop overlay: avatar preview (with currently-equipped hat drawn on top),
  Points balance, a grid of hats (owned → "Equip", unowned → "Buy ⭐N",
  greyed if unaffordable — reuse the `.cant` pattern from the helper strip).
- A tiny avatar+hat render helper used both in the shop and (optionally) on the
  play field. Draw with `drawEmoji` so it's canvas-safe on iPad.

**Files:** `src/cosmetics.js` (new), `main.js` (shop overlay, save fields, point
reward on win, avatar render), `style.css` (shop styling), `emoji.js`
(re-run `npm run fetch-emoji` for any new emoji 👦👧🎩🎀🧢🪄🧙🛍️…).

**Risks/notes:** none gameplay-affecting. Make sure new emoji get vendored
(`node scripts/fetch-emoji.mjs`) or they'll blank on iPad canvas.

---

## 2. Magic Buttons — rechargeable active abilities  *(isolated, kid-pleasing)*

**Player experience:** a small tray of big tappable spell buttons. Each has a
cooldown (a sweeping radial fill). Tapping fires an instant, screen-wide effect.
Gives the kid a panic-button when the board gets scary — separate system from
placing helpers, so **zero overlap with the tower work.**

**Abilities (v1):**
| Button | Effect | Cooldown |
|--------|--------|----------|
| 🧹 **Sweep** | shove every monster back ~1 tile along its path | ~12s |
| 💤 **Nap** | freeze all monsters for 2s | ~18s |
| 🍬 **Candy Rain** | +X coins instantly | ~20s |
| 🌟 **Big Zap** | clear all non-boss monsters on screen (once per level) | once |

**Data shape** (new `src/abilities.js`):
```js
export const ABILITIES = [
  { id: 'sweep', name: 'Sweep', emoji: '🧹', cooldown: 12, kind: 'pushback', amount: 60 },
  { id: 'nap',   name: 'Nap',   emoji: '💤', cooldown: 18, kind: 'freeze',  duration: 2 },
  { id: 'candy', name: 'Candy', emoji: '🍬', cooldown: 20, kind: 'coins',   amount: 30 },
  { id: 'zap',   name: 'Big Zap', emoji: '🌟', once: true,  kind: 'clear' },
]
```

**Engine work in `main.js`:**
- Add `G.abilityCD = {}` (id → seconds remaining), tick down in the main loop
  (respecting `G.paused` / `G.speed`).
- `pushback`: move each enemy's path progress back by `amount`, clamp ≥ 0.
- `freeze`: set a `G.freezeTimer`; while > 0, skip enemy movement (towers still
  fire — feels powerful and safe).
- `coins`: `G.coins += amount` (palette auto-refreshes via the coin-change hook
  we already added).
- `clear`: kill all enemies where `!e.def.boss`, with the existing pop FX.
- Render the tray (DOM buttons over the canvas) with cooldown overlay; little
  `sfx` cue per cast (`audio.js`).

**Files:** `src/abilities.js` (new), `main.js`, `style.css`, `audio.js`,
re-vendor emoji.

**Risks:** balance — keep cooldowns generous so it's a treat, not a crutch.
Freeze + boss interaction: boss should still be freezable (fair) but Big Zap must
skip bosses.

---

## 3. New enemy powers  *(in `content.js` `ENEMIES` — coordinate!)*

Extends the existing `armor / shield / regen / split` vocabulary. Each is an
optional field on an enemy def, handled in `main.js`'s enemy update/render.

| Power | Field | Behaviour |
|-------|-------|-----------|
| **speedburst** | `speedburst: { idle: 0.4, burst: 2.5, period: 2 }` | cycles slow→fast; teaches placing slow-towers early |
| **heal-aura** | `healAura: { radius, hps }` | heals nearby monsters each second; a "mama ghost" you want to kill first |
| **phase** | `phase: { period, kind: 'beam' }` | goes translucent periodically and ignores one tower `kind` |
| **shielder** | `shielder: true` | grants a one-hit bubble to the monster *behind* it |
| **burrow** | `burrow: true` | on certain path tiles, dips underground → untargetable for a beat |

**Engine work in `main.js`:**
- `updateEnemies`: per-power timers (speedburst phase, phase-in/out, heal tick).
- Targeting (`updateTowers`): skip enemies that are currently phased (for the
  matching kind) or burrowed/untargetable.
- Damage application: respect shielder bubble like the existing `shield`.
- Render cues: translucent alpha for phase, a little 🫧/sparkle for shielded,
  dust puff for burrow, a soft glow ring for heal-aura.

**⚠️ Collision risk:** `ENEMIES` lives in `content.js`, which the tower agent is
editing. **Do enemy-power work last, or in a tightly-scoped separate commit,**
and rebuild after their content lands. The *engine* handling (in `main.js`) is
safe to write anytime.

---

## 4. Branching paths that merge  *(in `PATHS` + engine)*

**Player experience:** some rooms split into two lanes that rejoin, so monsters
spread out and the kid must cover both branches instead of stacking helpers on
one chokepoint.

**Current limitation:** `buildPath` takes a single list of `cells` → one
`waypoints` polyline; every enemy follows the same path. Branching needs:
- A level to define **2+ path variants** that share start & end tiles.
- Each spawned enemy assigned a `pathId` (e.g. alternate, or random) and follow
  *its* waypoint list.
- `pathTiles` = union of all variants (no building on any lane).

**Data shape (additive, backwards compatible):**
```js
// single path (today) still works; OR:
paths: [ buildPath([...laneA]), buildPath([...laneB]) ]
```

**Engine work in `main.js`:**
- Enemy gets `e.pathId`; movement reads `level.paths[e.pathId].waypoints`.
- Spawner assigns `pathId` (alternate per spawn for an even split).
- Rendering `drawPath` loops over all variants.

**Files:** `content.js` (`PATHS`/`LEVELS` — coordinate), `main.js` (enemy
follow + spawn assignment + path render).

**Risks:** medium engine change to the movement core. Ship this as its own
commit and test each existing level still plays (single-path path must keep
working unchanged).

---

## Suggested sequencing (avoids stepping on the tower agent)

1. **Magic Buttons** — fully isolated (`abilities.js` + `main.js`), no
   `content.js` edits. Safe to start immediately.
2. **Avatars + Shop** — isolated (`cosmetics.js` + `main.js` + save). Safe.
3. **Enemy powers** — engine half (`main.js`) anytime; data half (`content.js`)
   *after* the tower agent's content lands, as a small rebuild-on-top commit.
4. **Branching paths** — engine change; do last, its own commit, regression-test
   every level.

## Workflow reminder (from CLAUDE.md)

Every change: **edit → `npm run build` → `git add -A` → commit → push.** Re-run
`node scripts/fetch-emoji.mjs` whenever a new emoji is introduced so it's
self-hosted (otherwise it blanks on the iPad canvas). While two agents share one
working tree, prefer scoped `git add <paths>` over `git add -A` to avoid
scooping up the other agent's in-progress files.

## Open questions

- Points wallet: separate from stars, or reuse star total? *(plan assumes separate)*
- Where does the avatar appear during play — by the door, as the placer cursor,
  or only in the shop? *(plan assumes shop + optional door cameo)*
- Should hats be purely cosmetic, or give a tiny fun perk (e.g. crown = +1 start
  coin)? *(plan assumes purely cosmetic — zero balance risk)*
