# Bug: Clear Initiative Board resets round to 1 but keeps stale once-per-turn latches — riders silently drop in the new combat's round 1

## Summary

`Clear Initiative Board` rebuilds the board with `round: 1`, but per-character once-per-turn latch stamps (`_*_usedRound` / `_*_skippedRound`) from the previous combat are **not** invalidated. Any new combat whose round number re-collides with a leftover stamp (round 1 vs `{round:1}` — immediate for the very first round of every cleared-and-rejoined fight) makes `checkOncePerTurnWithSkip` treat the latch as "already used/skipped this round", and the rider is dropped **silently with zero feedback**. Live-confirmed for two features on the same fixture: the Shield Bash save-prompt rider (never arms; the STR save + Push/Prone choice is lost for that hit) and the Charge Attack chooser (never mounts). Weapon damage itself commits honestly — only the rider adjudication vanishes.

## Steps to reproduce

Start from test-campaign with EvasiveFighter (Shield Master + Charger feat holder; the app's rider-chain fixture, playbook §2).

1. Encounter Builder → search "Goblin" → check `Select Goblin` → **Join Encounter** (a bare-named Goblin lands after a board clear; suffix law irrelevant).
2. On Initiative, set `select[aria-label="EvasiveFighter target"]` to the Goblin.
3. Open the EvasiveFighter sheet → press the `Glaive` attack row (`.clickable`, text starts `Glaive`). On the roll face, if it stages **✓ HIT**, press `Done`; re-press until a HIT commits (round 1).
4. With round 1 still current, walk one full Shield Bash chain to a Push/Prone **Apply** (this stamps `EvasiveFighter._Shield_Bash_usedRound = {round:1, activeCreature:'EvasiveFighter'}` via `applyShieldBashEffect`), or simply apply any rider that stamps `usedRound` at round 1. (Cancel/Dismiss does NOT stamp — Apply is the trigger.)
5. **Clear Initiative Board → "Yes, Clear Board"** (this resets `combatSummary.round` to 1; the character bucket keeps `_Shield_Bash_usedRound {round:1}`).
6. EB → join a new Goblin → arm it as EF's target → sheet → press Glaive until a HIT commits at the new combat's round 1.

Observe: the weapon `hp_change` commits synchronously, but **no "Saving Throw Required / Source: Shield Bash" `.sp-overlay` ever arms** and (if `_Charge_Attack_skippedRound` also collided) the Charge chooser never mounts — no popup, no log row, nothing.

Control (falsifier, run live): with the board untouched at round 1, `PATCH /api/campaigns/test-campaign/EvasiveFighter` body `{"value":{"_Shield_Bash_usedRound":null,"_Charge_Attack_skippedRound":null}}` (runtime-latch eviction only — no other state changed), join one more Goblin, arm, commit one HIT: the Charge chooser mounts and after Cancel the Shield Bash prompt arms normally. Same board generation, same round number — the ONLY delta was the stale stamps.

## Expected behavior

A cleared board is a NEW combat ("CLA-100: Clear restarts combat"): once-per-turn / once-per-round rider latches from the old combat must not carry over. The first round of the new combat must re-arm the Shield Bash save prompt and the Charge chooser. (In-round skipping is correct; cross-combat leakage is not — the same handleClear already resets the Dread Ambush `dreadAmbushSpeedActive` once-per-combat latch for exactly this reason.)

## Actual behavior

- Post-Clear round-1 HIT commit: damage row `Glaive … -13` lands (and later `-18`), but ZERO Shield Bash rows in the log — grep of the log for "Shield Bash" after that commit finds only rows from the PREVIOUS combat. No `.sp-overlay`, no popup, no "once per turn" refusal copy either — completely silent.
- Server census at the failure: `combatSummary.round = 1`, `EvasiveFighter._Shield_Bash_usedRound = {"round":1,"activeCreature":"EvasiveFighter"}` — the collision.
- After evicting the stamps (control): same press mounts `Charge Attack…Apply Effect/Cancel` and, post-Cancel, `Saving Throw Required … Source: Shield Bash … Roll Save/Dismiss` — green.

## Likely location

Confident on the mechanism seam, guessing on the preferred fix shape:

- `src/components/initiative/createCreatureHandlers.js` → `handleClear`: calls `clearCombat()` (→ `setupCreatures`, `src/services/encounters/initiativeService.js:226` returns `{round:1,…}`), stamps the victory bank, resets `dreadAmbushSpeedActive` per player (CLA-100 precedent) and runs `sweepNewCombatClocks` — but touches NO `_*_usedRound` / `_*_skippedRound` keys.
- `src/services/automation/common/oncePerTurn.js` → `checkOncePerTurnWithSkip` (line 81): pure `stamp.round === cs.round` comparison against the fresh board's round 1 — any holder's stale `{round:1}` stamp suppresses.
- Consumers that silently drop (no refusal popup on the skip-latched path): `src/services/combat/steps/attackRollRiders.js` `buildChargerStep` (returns `{data:{}}` on skip), `src/services/combat/steps/features/shieldBash.js` (returns `{data:prevData}` on skip). The whole `_*_usedRound` family is affected (Cleave `_Cleave_UsedRound`, Cunning Strike skip-latch `_cunningStrikeSkippedRound`, etc. — not individually re-proven here).
- Note the same collision exists for any lane that returns `round` to a previously-stamped number (new initiative roll resetting round), not just Clear.

## Suggested fix

First check: at `handleClear`, mirror the existing Dread Ambush reset loop — evict the combat-scoped latch keys for every creature (at least the party roster; the npc rows are rebuilt anyway). A robust shape is a shared helper (e.g. `clearCombatLatches(campaignName, creatureNames)`) enumerating the known `_*_usedRound`/`_*_skippedRound` keys, or better: stamp latches with a combat EPOCH (the victory-bank `stamp`, or an initiative-generation id bumped by Clear/new-roll) instead of the bare round number, so round reuse can never alias. Additional investigation needed: grep all writers of `_usedRound`/`_skippedRound` to enumerate keys (a missed key silently rules-skips like this one), and decide whether new-initiative-roll (encounter join that restarts the round count) needs the same eviction.

## Severity

**Broken feature.** A rules adjudication the holder earned (Shield Bash STR save → Push/Prone; Charge bonus effect) is silently deleted with no feedback and no log trace — the GM/user cannot tell the rider was skipped vs never gated. Damage itself stays honest, so there is no corruption, but repeated combat cycles (`join → fight → Clear → join`) reproduce it 100% while any round-1 latch survives.

## Resolution

**FIXED (2026-11-18, fix-run).** Reproduced live first, exactly per the steps: EF stamped `_Shield_Bash_usedRound {round:1}` (full Dismiss-free chain: HIT → Charge Cancel → Roll Save fail → Push Apply) + `_Charge_Attack_skippedRound {round:1}` (chooser Cancel) in combat #1 round 1 → Clear → bare-`Goblin` re-join → round-1 HIT committed (`hp_change` −11) with ZERO Charge chooser, ZERO `[data-testid=active-save-prompt]`, and zero Shield Bash/Charge log rows — the collision census (`combatSummary.round=1` + both stamps `{round:1}`) matched the report byte-for-byte.

**Root cause** (the "Likely location" was right on the mechanism seam): every latch in the family stamps the BARE `combatSummary.round` number, and the round-wrap re-arm only ever expires stamps via the `currentRound > stamp.round` COMPARISON — the stamp itself is never evicted at the wrap (skip-latches like `_Charge_Attack_skippedRound` are not even in `PLAYER_ROUND_LATCH_KEYS`; they live on with stale values by design). The comparison lanes therefore cannot distinguish "this round" from "a reused round number", so the fix belongs at the seam that resets the round. Per the owner PER-CREATURE seam law, the board-wipe Clear is the only whole-board new-combat seam (initiative roll/short rest/long rest are roller-scoped; EB Join is never a clear seam and gained no eviction) — mirror of the CLA-100 `dreadAmbushSpeedActive` reset already in `handleClear`.

**Fix (chosen shape: seam eviction, pattern-based — the codebase's established pattern; the epoch alternative would have re-shaped every writer AND reader of the `{round, activeCreature}` stamp for no additional live protection since Clear is the sole round-reset seam):**

- `src/services/automation/common/oncePerTurn.js` — new exported `clearCombatLatches(campaignName, creatureNames)`: for each closing creature it censuses the creature's own runtime store via `getRuntimeKeysByPrefix` and nulls EVERY key ending in "round" (case-insensitive). The store's own key census is authoritative over any hand-maintained list, so the whole family is covered at once — static (`_Shield_Bash_usedRound`, `_Cleave_UsedRound`, `_cunningStrikeSkippedRound`), dynamically named rider keys (`_<Action>_usedRound`/`_skippedRound` — the exact pair this bug shipped with, built from feature names at runtime and thus NOT enumerable statically), named counters (`actionSurgeUsedThisRound`, `relentlessUsedRound`, `_attackActionTakenRound`, `_PsychicBlade_attack_round`, …) AND monster-name latches (a re-joined bare `Goblin` re-collides on the same store key). Non-round keys (booleans, `{round,activeCreature}` "offeredThisTurn" stamps that re-arm at turn start, markers) cannot alias via round reuse and stay byte-untouched. Zero writes when nothing is stamped; logs ONE `automation / new_combat_latch_reset` audit row when it evicts ("Combat board cleared: N once-per-turn latch(es) from the previous combat evicted." — mirrors the zone sweep's board-clear row).
- `src/components/initiative/createCreatureHandlers.js` — `confirmClear` calls `clearCombatLatches(campaignName, closingSummary.creatures.map(c => c.name))` right beside the CLA-100 Dread Ambush reset, keyed on the CLOSING roster (joined monsters included, they leave the board but their buckets survive).
- Dual-ruleset: `oncePerTurn.js` and the rider steps are ruleset-shared (no 2024 twin) — one fix covers both.
- No round-wrap lanes touched: within-round Cancel/Apply suppression is unchanged law.

**Verification:**
- Live repro re-run post-fix in test-campaign (hot-reload via :5173): Clear now evicts the 3 stale stamps (GET-verified `null` + the verbatim audit row); the new combat's round-1 HIT commit RE-ARMS the full chain — Charge chooser mounts (`Charge Attack Choose an effect against Goblin`), Cancel → damage → `[data-testid=active-save-prompt]` arms (`Saving Throw Required … Source: Shield Bash`), Roll Save fails honestly (7 vs DC 17), chooser mounts, Push Apply lands `Shield Bash used against Goblin: pushed 5 ft.` + fresh `{round:1}` stamps.
- Non-regression (same round, both stamps live): a second HIT commit lands damage (`hp_change`) with NO chooser and NO save prompt — the in-round latch still suppresses correctly.
- New tests: `src/services/automation/common/oncePerTurn.clearCombatLatches.test.js` (replays the exact bug fingerprint end-to-end against an in-memory store fake: stamp → collision-suppress → seam-evict → re-arm; family/case coverage; keep-list scoping; log-row-only-when-dirty; roster edge cases) + `src/components/initiative/createCreatureHandlers.clearCombatLatches.test.js` (seam wiring: closing roster incl. monsters, `handleClear`-alone stays inert).
- Mock factories in the three existing files that drive `confirmClear` gained `getRuntimeKeysByPrefix` (`createCreatureHandlers.test.jsx`, `createCreatureHandlers.friendly-fire.test.js`, `initiative.test.jsx` — the seam now reads the store census; the async React-dispatch face of the gap surfaced only as suite-level unhandled `Errors` with all files still "passing", pinning the judge-by-`Errors`+`EXIT` law).
- Touched folders green: `src/components/initiative` + `src/services/automation/common` = 136 files / 1083 tests passing, zero unhandled errors. `npm run lint` = zero warnings. Full suite re-run clean (3375 files, EXIT 0).
- Cleanup: closed-tab two-pass headless admin clears GET-verified `change-data {}` + `log []` + overlays `{"overlays":[]}`, disk cd/log files absent; dev pair left running.

