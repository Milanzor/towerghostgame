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

**Avatar reactions (tiny effort, huge charm):** the chosen mascot lives on the
play screen (e.g. beside the mansion door) and *reacts* to the game so the kid
feels accompanied:
- 🎉 **cheers + jumps** on a level win.
- 🙈 **covers its eyes** when a monster reaches the door (a life is lost).
- 👏 **claps** during Big Zap / a big catch.
- 😴→👋 idle wave/yawn between waves so it never feels static.

Implement as a small reaction state machine — `avatar.react('cheer')` swaps the
emoji/overlay for ~1s, driven by existing events (`win()`, life-lost, ability
cast). No new systems, just hooks into events we already fire. Reuse the
befriend/celebration FX already on screen.

**Files:** `src/cosmetics.js` (new — avatars, hats, reaction states), `main.js`
(shop overlay, save fields, point reward on win, avatar render + reaction hooks),
`style.css` (shop styling), `emoji.js` (re-run `npm run fetch-emoji` for any new
emoji 👦👧🎩🎀🧢🪄🧙🛍️🙈…).

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

### 2a. Earn charges, not just cooldowns  *(more active than a passive timer)*

Instead of every spell being on a silent timer, monsters occasionally **drop a
floating ✨ sparkle** the kid taps to collect; collecting **fills the next spell
charge.** Now casting feels *earned* — the kid is hunting sparkles, not watching
a clock.

- **Player experience:** pop a monster → sometimes a ✨ drifts up from it → tap
  it before it fades → a spell's charge meter ticks up. Lots of little tap-reward
  moments mid-wave.
- **Model:** each ability has `charges` (0..max) instead of (or alongside) a
  cooldown. A ✨ adds 1 charge to a chosen/cheapest un-full spell, or to a shared
  pool the kid spends. Keep cooldown as a gentle floor so spamming isn't possible.
- **Drop logic** (`main.js`, in the enemy-pop path): roll a small chance on kill
  to spawn a `sparkle` pickup entity with a position + lifetime + gentle bob.
- **Pickup entity:** new lightweight type in `G.pickups` (NOT a tower/enemy) —
  update for bob + fade, hit-test on `pointerdown`, `sfx` sparkle on collect,
  then `ability.charges++`.
- **Render:** `drawEmoji(ctx, '✨', …)` with a soft pulse; tray buttons show a
  charge count badge instead of a radial timer.
- **Risk:** keep the drop rate low and the ✨ big & slow so tiny fingers can
  actually catch it; never required to progress (cooldown path still works).

### 2b. Draw-to-aim spell  *(pairs beautifully with branching paths §4)*

A targeted spell the kid **swipes** instead of taps — e.g. a 🌊 **Wave** dragged
across one lane that washes the monsters *on that lane* back to the start.

- **Player experience:** press the 🌊 button → the board highlights the lanes →
  drag a finger across a lane → a wave sweeps it. Directing it themselves feels
  way more powerful than a screen-wide effect.
- **Why it pairs with §4:** with branching/merging lanes, choosing *which* lane
  to wash is a real, kid-readable decision.
- **Engine work (`main.js`):** add an "aiming" input mode — when the spell is
  armed, the next swipe is captured (not a helper drag); resolve which
  lane/`pathId` the swipe crossed; apply pushback to enemies on that lane only.
- **Single-path levels:** with one lane the swipe just confirms direction — still
  works, just less interesting; shines on multi-lane maps.
- **Risk:** must not fight the existing drag-to-place gesture — gate it behind
  the armed spell (like a one-shot targeting cursor), and cancel on second tap.

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

## 5. Endless "Backyard" sandbox  *(no-fail free play)*

**Player experience:** a relaxed mode off the map screen — **infinite waves, no
lives, you can't lose.** Just place helpers, befriend monsters, and play. The
pressure-free home for little kids (and a great showcase for the new towers,
abilities, and avatars).

- **No lives:** monsters reaching the door just float away with a giggle — no
  life counter, no game-over. (Mechanically: skip the life-loss / `win()`/lose
  branch; `G.endless = true`.)
- **Infinite waves:** loop the spawner, slowly ramping count/variety; never a
  "done" phase. Coins still flow so the kid can keep buying/upgrading helpers.
- **Pairs with a global no-fail toggle** (the 😌 *Cozy* vibe in §6) — Backyard is
  always cozy; story levels can opt in.
- **A gentle off-ramp:** a 🏡 "All done!" button to leave whenever, with the
  avatar waving goodbye (no forced end).

**Data shape:** a synthetic level (not in the numbered `LEVELS` progression) —
e.g. `BACKYARD` with a simple path, generous `startCoins`, and a procedural wave
generator instead of a fixed `waves` array.

**Files:** `main.js` (endless flag, looping spawner, skip life/lose logic,
entry from map), `content.js` *(or a new `src/backyard.js` to dodge the
`content.js` collision)* for the sandbox level def, `style.css` (map button).

**Risks:** make sure "no lives" doesn't break wave-clear/HUD assumptions that
read `G.lives`; guard those on `G.endless`. Keep memory bounded — cap on-screen
enemies so a long session doesn't bog down an iPad.

---

## 6. Grown-up corner  *(quiet parental controls)*

**Player experience:** a small ⚙️ entry that opens a **grown-ups-only** panel via
a **hold-to-open** gate (press & hold ~2s, or a "tap the big number" check) so a
4-year-old can't wander in. Gives the parent the controls that make them keep the
app installed.

- **Difficulty / vibe lock:** force 😌 Cozy / 🙂 Just Right / 😄 Big Kid (ties to
  the no-fail toggle in §5).
- **Soft play-timer:** "5 more minutes," then a **gentle wind-down** — music
  slows, palette dims, the avatar starts yawning, and a calm "time to rest"
  screen instead of an abrupt cut. *Graceful off-ramp, not a slammed door.*
- **Reset progress:** wipe `save` (with a confirm), for hand-me-downs / fresh
  start.
- (Hooks for later: toggle learning prompts, per-profile management from §7.)

**Save shape additions:**
```js
save.settings = {
  vibe: 'justright',      // 'cozy' | 'justright' | 'bigkid'
  playMinutes: 0,         // 0 = no limit
}
```

**Files:** `main.js` (gate, panel, timer + wind-down sequence, reset), `style.css`
(panel styling), `audio.js` (wind-down music ramp).

**Risks:** the hold-to-open gate must be reliable but not so fiddly a parent
can't get in; the play-timer must persist across the wind-down and resume sanely
if they tap "5 more minutes." Wind-down should pause cleanly (reuse `G.paused`).

---

## 7. Two kid profiles  *(siblings stop fighting over the save)*

**Player experience:** a **"Who's playing?"** picker on launch — pick a profile
(its own avatar, hats, Points, stars, unlocked levels). Switch any time from the
map. Each kid has their *own* world.

**Save shape — wrap today's flat save in a profiles map (needs migration):**
```js
{
  version: 2,
  activeProfile: 'p1',
  profiles: {
    p1: { name: 'Mia', avatar: 'girl', unlocked, stars, points, owned, hat, settings },
    p2: { name: 'Sam', avatar: 'boy',  …same shape… },
  },
}
```
- **Migration:** on load, if the old flat shape is found (`unlocked`/`stars` at
  top level), wrap it into `profiles.p1` and stamp `version: 2`. Keep it
  one-way and safe so no kid loses progress.
- All current reads/writes of `save.unlocked` / `save.stars` route through
  `currentProfile()` — small, mechanical refactor.

**UI:** a friendly profile-select screen (two big avatar cards + "add"), and a
tiny avatar chip on the map to switch. Profile management (rename, delete) lives
behind the grown-up corner (§6).

**Files:** `main.js` (profile model, migration, `currentProfile()` accessor,
picker screen), `style.css` (picker).

**Risks:** the **save-shape migration is the only real hazard** — write it
defensively and test loading an existing v1 save. Everything downstream is a
find-and-replace from `save.X` → `currentProfile().X`. Do this *before* §1/§2
ship if possible, so points/avatars/abilities write into a profile from day one
(otherwise we migrate those fields twice).

---

## 8. The world map as a *place*, not a level list  *(map → little journey)*

**Player experience:** the level-select screen (today: `showLevelSelect` /
`ovSelect`, areas with `levelIndices`, locked/unlocked + ministars) becomes a
**journey the avatar travels**, so progress feels like *going somewhere*, and the
map doubles as a between-levels fidget toy.

- **The avatar travels the map.** It sits at the latest cleared stop and, on a
  win, **moves one stop forward** along a drawn trail through the areas — riding
  *something* (a wagon? a broom? a befriended monster from §"befriend"?). Visible
  momentum: "look how far I've come."
- **Each area is a pokeable diorama.** Tap the volcano → it puffs 🌋💨, tap the
  moon → it winks 🌙, tap the mansion → the door creaks. Idle, silly, no stakes —
  the map is fun to *be on* while deciding what's next.
- **No-reading wayfinding.** A 🚩 **"you are here"** flag on the avatar's stop,
  and the **next room gently waves / bounces** to pull the eye. A kid always
  knows where to go without a single word.

**Engine/UI work (`main.js` + `style.css`):**
- Reframe the select overlay from a grid of cards into a **trail layout**: stops
  along a path, the avatar token positioned at `save.unlocked` (per
  `currentProfile()` once §7 lands).
- **Travel animation** on win: before showing the result, slide the avatar token
  from the old stop to the new one along the trail (reuse the avatar render +
  reaction hooks from §1 — it cheers on arrival).
- **Diorama taps:** each area gets a tiny tap-reaction (emoji puff / wink via
  `drawEmoji` + `sfx`), no gameplay effect. Keep them on the map canvas/overlay.
- **Next-stop attractor:** a gentle CSS/canvas bounce or glow on the next
  unlocked room; the "you are here" flag follows the avatar token.

**Files:** `main.js` (select-screen layout, avatar token + travel tween, diorama
taps, wayfinding), `style.css` (trail/map styling), `audio.js` (poke blips),
`emoji.js` (re-vendor any new map emoji 🚩🌙💨…). **Avatars/reactions come from
§1** — build this *after* §1 so the token + cheer already exist.

**Risks:** mostly layout — the trail must scale across the 5 areas / 25 stops on
both phone and iPad (respect the existing iPad scaling). Keep it data-driven off
the same `areas` / `levelIndices` so adding levels doesn't break the map. The
diorama taps must not be mistaken for "select this level" — separate the
background pokes from the stop hit-targets.

---

## Suggested sequencing (avoids stepping on the tower agent)

0. **Kid profiles (§7)** — ideally *first*: it changes the save shape, so doing
   it before Points/avatars/abilities land avoids migrating those fields twice.
   Pure `main.js` + save, no `content.js`. (If we'd rather move fast, it can come
   later, but then budget for a second migration.)
1. **Magic Buttons (§2, incl. 2a charges / 2b draw-to-aim)** — fully isolated
   (`abilities.js` + `main.js`), no `content.js` edits. Safe to start immediately.
2. **Avatars + Shop (§1, incl. reactions)** — isolated (`cosmetics.js` +
   `main.js` + save). Safe.
3. **Backyard sandbox (§5)** — mostly `main.js` + a sandbox level def (use
   `src/backyard.js` to dodge `content.js`). Showcases §1/§2. Safe.
4. **Grown-up corner (§6)** — `main.js` + `style.css` + `audio.js`. Safe.
4b. **World map journey (§8)** — `main.js` + `style.css`; build *after* §1 so the
   avatar token + cheer already exist. No `content.js`. Safe.
5. **Enemy powers (§3)** — engine half (`main.js`) anytime; data half
   (`content.js`) *after* the tower agent's content lands, as a small
   rebuild-on-top commit.
6. **Branching paths (§4)** — engine change; do last, its own commit,
   regression-test every level. Unlocks the §2b draw-to-aim spell's best form.

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
- Abilities: **charges-from-sparkles (§2a)**, classic **cooldowns**, or both?
  *(plan assumes both — cooldown floor + sparkles fill faster)*
- Profiles (§7): exactly **two** fixed kids, or "add a player" up to N?
  *(plan assumes 2–3 with an "add" card)*
- Play-timer (§6): hard stop at 0, or always one free "5 more minutes" the parent
  must approve? *(plan assumes parent-approved extension, never an abrupt cut)*
