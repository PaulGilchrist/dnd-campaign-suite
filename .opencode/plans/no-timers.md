# No-Timers Plan — Turn-Based Durations & Timer Removal

> Status: **ACTIVE — pauses Level 5 continuation until complete.**
> Origin: 2026-10-13 user directive — *"This is a turn-based game, not a time-based
> game. All users have as much time as they need to execute their turn… this game
> should have no actual timers."*
> Decisions this session: **D-T1** remove `TurnTimer` entirely · **D-T2** ≥1-minute
> authored durations become combat-scoped flags (not round countdowns) · **D-T3**
> adjudication prompts wait forever (no auto-resolve by the clock).

## 0. The Principle (now permanent — mirrored in AGENTS.md)

Game state **never** advances, expires, resolves, or penalizes on wall-clock time.
The only things that move the game forward are player/GM actions: clicking an
action, clicking End Turn, rolling initiative, resting. A "clock" in this codebase
means **a round-count integer matured at initiative seams** — nothing else.

Author-duration conversion policy:

| Authored duration | Engine representation |
|---|---|
| "1 round", "until end of your/next turn", etc. | round clock (`expiryRounds`), matured at turn/round boundaries |
| **≥ 1 minute** (1 min, 10 min, 1 hour, "until dispelled"…) | **combat-scoped flag** — `expiryRounds: Infinity` + `until: 'combat'`; cleared by a **new initiative roll (new combat)**, **short rest**, or **long rest** |
| concentration | concentration machinery (never a fabricated clock — MA-1215 discipline, unchanged) |

The old CLA-334 recipe (`minutes×10 / hours×600` round countdowns) is **retired**
for ≥1-minute durations: a 10-minute zone no longer counts 100 rounds, it lasts
the whole combat and sweeps at the next combat/rest boundary.

## 1. Audit — every time-related machine in the app (2026-10-13)

### 1a. Round counters — CORRECT, keep (no change)
*All mature on initiative seams only; a paused table freezes them.*

| Machine | Progression rule | Evidence |
|---|---|---|
| `expirationQueue.js` pendingExpirations | `currentRound >= appliedRound + expiryRounds` | round integers, drained at turn boundaries |
| §8.3 zone clocks (`zoneDurationClock.js`) | `armDurationClockIfEnforced` writes rounds onto the queue | producer stamps round numbers |
| §8.3 initiative-20 cadence | `drainRoundWrapClocks` at the round wrap | fires on round increment, never on time |
| §8.3 cover stamps | `{attacker, target, round}` match | no timestamp comparison |
| Economy latches (`turnState.js`) | round-keyed | End-Turn advances |
| Recharge / once-per-turn / spell-gates | round-keyed latches | pre-existing |

### 1b. REAL TIMERS — REMOVE (violations)

| # | Site | Violation | Fix |
|---|---|---|---|
| V1 | `src/components/initiative/TurnTimer.jsx` (+`TurnTimer.css`, `.test.jsx`; rendered `Initiative.jsx:705`; key `turnTimer` in `campaignKeys.js:48`; validator `keyValidators.js:90–95,135`) | per-turn `Date.now()` countdown; **auto-advances initiative at zero** — a thinking player loses their turn to the clock | **D-T1: delete entirely** — component, CSS, render site, runtime key, validator, plan §7.5 marked abandoned. Server restart (validator is server-side). |
| V2 | `hitResolution.js` Unbreakable Majesty save prompt — `setTimeout(..., 30000)` ⇒ *"attack stands unresolved (fail-open)"* | 30-second wall on a d20 save; slow players silently lose the protection | **D-T3: wait indefinitely** — drop the timeout; prompt resolves only via the player's action (or GM fiat elsewhere). |
| V3 | `hitResolution.js` Veer confirm — `setTimeout(..., 15000)` ⇒ auto-resolves `true` | the clock makes the player's decision for them | **D-T3: wait indefinitely.** |
| V4 | `attackRollRiders.js` Bardic Inspiration (offense) prompt — `setTimeout(..., 30000)` ⇒ silently resolves with nothing | 30-second wall on choosing to use a resource | **D-T3: wait indefinitely.** |

### 1c. Benign UI timing — ALLOW (documented allowlist; adjudicates nothing)
Debounced map autosave / spell-overlay saves · toast & feedback auto-hide (2–3s) ·
animation-close (`onClose` 500ms after a selection already made) · drag-ghost
cleanup (0ms) · event-loop yields (50ms) · autocomplete debounce · network fetch
timeout (`useSpellPositionResolver` 3s — a failed request, not a game decision) ·
popup-visibility DOM poll (`useCombatSuperiorityModal` 500ms — UI, state is
event-driven).

### 1d. Duration-semantics gaps — FIX per D-T2
| Gap | Today | Target |
|---|---|---|
| ≥1-minute authored durations | `zoneDurationClock.js` parser converts minutes×10 / hours×600 into round countdowns (turn-based, but a 600-round fiction) | combat-scoped: `expiryRounds: Infinity` + `until:'combat'` marker on the expiration entry |
| Short/long rest sweep | `restRules-longRest` / `-shortRest` clear `activeBuffs`, **never** `pendingExpirations` | both rests sweep `pendingExpirations` (and any `until:'combat'` markers) |
| New initiative roll (new combat) | round resets to 1; stale `pendingExpirations` from the previous combat linger until they happen to mature | combat start sweeps `pendingExpirations` across all stores + clears `until:'combat'` flags + cover stamps |

## 2. Remediation slices (execute in order, commit between)

### T1 — TurnTimer removal (D-T1)
Delete `TurnTimer.jsx/.css/.test.jsx`; remove the render + `onExpire` wiring in
`Initiative.jsx`; drop `'turnTimer'` from `campaignKeys.js`; delete
`validateTurnTimer` + registry entry in `keyValidators.js`; POST `turnTimer:null`
if present in test-campaign. Server restart (validator). Verify Initiative panel
renders clean with enforcement on.

### T2 — Prompt timeouts ⇒ indefinite waits (D-T3)
V2/V3/V4: remove the `setTimeout` + `resolved`-race branches; the listener
resolves only on the user's event. Hygiene: if the surrounding combat context
tears down (turn wrap/unmount), cancel the listener and log — a prompt may wait
forever, but must not leak across combats. Update tests that assert timeouts.

### T3 — Duration parser policy (D-T2)
`zoneDurationClock.js`: parse result ≥10 rounds (≥1 minute) ⇒ **not** a countdown —
emit `{ expiryRounds: Infinity, until: 'combat' }` (ONE merged write, same lane);
<1-minute stays a round clock; indefinite stays indefinite (never fabricated).
Prose flips: armed-clock wording ⇒ "lasts until combat ends" for combat-scoped.
Registry descs updated for affected authored rows.

### T4 — Combat & rest boundary sweeps (D-T2)
- `expirationQueue.js` gains `sweepCombatScopedExpirations(storeKeys|all)` — drains
  entries with `until:'combat'` **and** (combat-start case) every stale round clock.
- **New initiative roll**: `initiativeService.js` / `Initiative.jsx` combat-start
  seams + `encounterToInitiative.js` ⇒ sweep all stores' `pendingExpirations`,
  cover stamps (`_cover_shot`), and log `automation` "New combat: N combat-scoped
  effects ended."
- **Short Rest** (`restRules-shortRest.js`) & **Long Rest** (`restRules-longRest.js`)
  ⇒ sweep the resting creature's combat-scoped flags + pendingExpirations (long rest:
  all stores' combat markers too? — decision at implementation: resting creature's +
  any campaign-zone markers for long rest; short rest: resting creature's).
- Enforcement-gated (`zones` flag) where the producer was gated; rests are legacy
  features — make the sweep unconditional there (rests previously clearing nothing
  about clocks is a bug by this principle, and the fix is invisible when no clocks
  exist ⇒ byte-parity naturally holds when nothing is armed).

### T5 — Permanent guard (never again)
- AGENTS.md "No Game Timers (MANDATORY)" section (written first, with this plan).
- `node .opencode/plans/no-timers-guard.mjs` — deterministic grep guard: every
  `setTimeout`/`setInterval` in `src/` must match the §1c benign-pattern allowlist
  (or a file:purpose allowlist); anything else FAILs with file:line. npm script
  `guard:no-timers`. Run alongside lint/test per AGENTS.md.

## 3. Exit criteria
- Zero `setTimeout`/`setInterval` in `src/` outside the §1c allowlist (guard green).
- `TurnTimer` nowhere in src/, keys, validators; Initiative panel clean.
- All three adjudication prompts verifiably wait forever (tests + live).
- ≥1-minute authored zone duration live ⇒ combat-scoped (no countdown), swept at
  new-initiative / short / long rest.
- Enforcement-off byte-parity for everything except the sanctioned V2/V3/V4
  timeout removals (documented in Appendix B of the Level 5 plan).
- Full suite + lint green; live verification on `test-campaign` :80 only; restored
  after each check; plan marked COMPLETE → Level 5 resumes (§16 backlog).
