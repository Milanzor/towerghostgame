# 👻 Ghost Catchers — Feature Plan

The original roadmap (currencies, abilities, avatars/shop, sandbox, grown-up
corner, profiles, map journey, tidy-up, enemy powers, branching paths) has been
**fully implemented and shipped**. Each item below links to the commit that
landed it. There are no outstanding planned features — add new ideas under
"Next ideas" as they come up.

## Shipped ✅

| # | Feature | Commit |
|---|---------|--------|
| §7 | Two kid profiles — save v2 migration + "Who's playing?" picker + `currentProfile()` | `0fd5ca8` |
| §2 | Magic Buttons — rechargeable spell tray, earned ✨ sparkle charges (§2a), draw-to-aim Wave (§2b) | `858f7c5` |
| §1 + §0 | Avatars + Hats + Shop + mascot reactions, persistent **Points** wallet | `b086423` |
| §5 | Endless Backyard sandbox — no-fail free play | `5cda49b` |
| §6 | Grown-up corner — hold-to-open gate, vibe lock, soft play-timer + gentle wind-down | `045aac6` |
| §8 | World map as a journey — winding trail, traveling avatar token, pokeable dioramas | `6a8a87d` |
| §9 | Closure tidy-up ritual — skippable put-away before the result | `ef6b60c` |
| §3 | New enemy powers — speedburst, heal-aura, phase, shielder, burrow | `a33fc1e` |
| §4 | Branching paths that merge — additive `paths[]` lanes, backwards-compatible | `17d440c` |

## Resolved design decisions

These were the plan's open questions; the shipped game settled them as follows:

- **Points wallet** is a separate persistent `points` value on each profile (not
  the star total) — earned `3 + stars + floor(leftoverCoins / 25)` per win.
- **Avatar** appears in the shop, on the play field beside the door (reacting to
  the game), and as the traveling token on the world map.
- **Hats** are purely cosmetic — zero gameplay/balance effect.
- **Abilities** use *both* a cooldown floor *and* earned sparkle charges.
- **Profiles**: 2 seeded defaults (Mia/Sam), "add player" up to 3.
- **Play-timer**: a gentle wind-down with a parent-approved "5 more minutes"
  (behind the same hold gate) — never an abrupt cut.

## Next ideas

_(empty — nothing planned yet)_

## Workflow reminder (from CLAUDE.md)

Every change: **edit → `npm run build` → `git add -A` → commit → push.** Re-run
`node scripts/fetch-emoji.mjs` whenever a new emoji is introduced so it's
self-hosted (otherwise it blanks on the iPad canvas).
