# Bug: Revivify "heals" a desynced corpse (isDead:1, HP > 0) DOWNWARD — the revive formula can damage the target and still bills slot + diamond

## Summary
`triggerRevivify` gates on `isCreatureDead` (which ORs `isDead || currentHp <= 0`) but then computes the heal as `1 - oldHp` where `oldHp` is the runtime `currentHitPoints`. When a bucket desyncs — `isDead: 1` with `currentHitPoints: 18` — the dead-gate opens while `oldHp` is positive, so the "heal" delta goes NEGATIVE: Revivify drains the target toward 1 HP, still consumes the 300 gp diamond and the spell slot, and logs `delta:-17 / isHealing:false` while the success popup claims `1 HP (revived)`. A resurrection spell becomes a damage spell. A real generator of exactly this desync state exists live (see `bug-revivification-handler-leaves-isdead-stuck.md`), but the service should refuse honestly for ANY `oldHp > 0` rather than invert.

## Steps to reproduce
1. In test-campaign with the Initiative board mounted, seed a divergent player bucket — any of:
   - the live generator: Barbarian Zealot Revivification reaction on a corpse (leaves `currentHitPoints:18, isDead:1`), or
   - direct rig: full-store `POST /api/campaigns/test-campaign/AasimarTest` `{"value":{"currentHitPoints":18,"hitPoints":143,"isDead":1}}` (simulates any desynced writer), then reload/re-select so the mirror carries it.
2. Ensure War_Cleric holds `Diamond (300 gp)` in the backpack (sanctioned disk edit: `"backpack": ["Diamond (300 gp)"]` in `public/campaigns/test-campaign/War_Cleric.json`; restore byte-exact after). Open War_Cleric's sheet.
3. Click the `Revivify` row (Actions table) → `Cast Spell`.
4. Observe the Revivify chooser: **`Select AasimarTest` is offered** even though the target sits at 18/143 HP (picker shows no HP chip, so the inversion is invisible at selection time).
5. Select the target → `Cast Revivify`.

## Expected behavior
Revivify should refuse when there is nothing to revive: the dead-for-the-purpose-of-reviving check and the heal arithmetic must agree. A target at 18 HP must not be offered as a corpse, and even if one slips through, `validateBeforeConsume` should refuse BEFORE consuming the diamond ("no resurrection to perform") — never write HP downward, never bill the slot or the 300 gp material.

## Actual behavior
- Chooser offers the 18-HP target as a valid corpse.
- Commit writes the full sequence: `POST log {type:'spell'…}`, slot paid (level_3 2→1→0 across the session), `PATCH War_Cleric.json {"inventory":{"backpack":[]}}` (diamond consumed), `POST log {type:'material_consumed'…}`.
- HP is drained 18 → 1. Audit row: `{"type":"hp_change","targetName":"AasimarTest","delta":-17,"currentHp":1,"maxHp":143,"isHealing":false,"sourceName":"War_Cleric","note":"Revivify"}`.
- The success popup renders `Revivify … 1 HP (revived): AasimarTest is already at full HP` — internally contradictory AND contradicted by the -17 log row.
- The bucket ends `currentHitPoints:1, isDead:1` — still flagged dead, further poisoning every downstream death gate.

## Likely location
Confident: `src/services/rules/features/revivifyService.js` — the gate pair at :64 (`isCreatureDead`, isDead-OR per `src/services/shared/hpModifier.js:6-15`) vs `validateBeforeConsume` resolving `oldHp` from runtime `currentHitPoints` (~:41) without ever checking `oldHp <= 0`, and the heal commit `applyHealingToTarget(combatSummary, targetName, 1 - oldHp, …)` (~:100). With `oldHp > 0` the delta is negative and `applyHealingToTarget`/`modifyHitPoints` treat a negative delta as damage (the heal-never-drains floor in `clampHpLadder` only guards `delta > 0`). Secondary contributor: the picker in `TargetSpellPopups.jsx` (pendingRevivify) renders `{name, type:'creature'}` with no HP face, so the offering face cannot be sanity-checked by eye.

## Suggested fix
In `triggerRevivify`, after resolving the frame, refuse when `oldHp > 0`: `if (oldHp > 0) return refusalPopup(spell, \`${targetName} is not at 0 Hit Points. ${spellName} was refused and no diamond was consumed.\`)` — placed with the other validate-before-consume guards so the diamond/slot are never billed. Deeper: make the corpse census in `spellGates.js gateRevivify` (and `isCreatureDead` itself, shared with HoUoM) require HP consistency — e.g. treat a player as revivable only when `currentHp <= 0`, using `isDead` as a corroborating (not OR-ing) signal — so desynced buckets are not offered. Root-cause generator fix is tracked separately in `bug-revivification-handler-leaves-isdead-stuck.md`. Unit pins: divergent bucket refuses zero-spend; classic 0-HP corpse bytes unchanged.

## Severity
Data integrity risk — a healing spell silently drains a live ally and destroys a 300 gp consumable, with the popup and the audit log contradicting each other. Reachable without this rig via the Revivification-handler desync (filed alongside), i.e. purely through in-game lanes.

## Resolution
FIXED 2026-11-15 (fix run). The "Likely location" was confirmed exactly: `isCreatureDead` (`src/services/shared/hpModifier.js`) OR-ed `isDead || currentHp <= 0`, so a desynced bucket (`isDead:1`, `currentHitPoints:18`) passed BOTH the corpse census (`spellGates.js gateRevivify`) and the service's pre-consume dead gate; `validateBeforeConsume` then resolved `oldHp` from the runtime bucket without ever asserting `oldHp <= 0`, so the heal delta `1 - oldHp` went negative and `clampHpLadder`'s heal-never-drains floor (guards `delta > 0` only) let the drain through while the diamond + slot were billed.

The live generator (Revivification handler leaving `isDead` stuck) was already fixed in `resolved/bug-revivification-handler-leaves-isdead-stuck.md`, so the defect was armed via the bug file's sanctioned direct rig: full-store `POST /api/campaigns/test-campaign/AasimarTest {value:{currentHitPoints:18,hitPoints:143,isDead:1}}` + reload/re-select. Reproduced EXACTLY on :5173 before touching code: chooser radio `Select AasimarTest` offered at 18/143 HP; commit paid slot (lv3 3→2), consumed the diamond (`PATCH War_Cleric.json` + `material_consumed` row), logged `hp_change {delta:-17, currentHp:1, maxHp:143, isHealing:false, note:'Revivify'}`, drained the bucket 18→1 (still `isDead:1`), popup `1 HP (revived): AasimarTest is already at full HP`.

Fix (mirrors the working HoUoM pattern — `collectCorpseTargets` bucket-HP-consistent census + `commitResurrection`'s `targetHp > 0` pre-spend refusal; no new architectures):
- `src/services/shared/hpModifier.js` — `isCreatureDead` player arm now HP-consistent: the bucket `currentHitPoints` DECIDES (dead only at `Number(hp) <= 0`); the `isDead` latch only corroborates when the bucket carries no HP key. Read order (isDead, then currentHitPoints) preserved so the pinned read censuses stay byte-identical. Desynced buckets are no longer offered by the corpse census or passed by the service gate. Monster arm unchanged (already summary-HP-consistent).
- `src/services/rules/features/revivifyService.js` — `validateBeforeConsume` now asserts the revive invariant `oldHp > 0` → refuse with `"<Target> is not at 0 Hit Points. Revivify was refused and no diamond was consumed."` placed with the other validate-before-consume guards (pre-`consumeMaterial`, zero-spend, zero-write, loud `console.error`) — the "even if one slips through" lock.
- Shared service, no 2024 twin needed: both rulesets route through this one `triggerRevivify` (disk-canoneity pinned by the edge-cases lane).

Tests:
- NEW `src/services/rules/features/revivifyService.stale-corpse.test.js` (3 pins): divergent bucket through the REAL gate refuses zero-spend (no diamond, no writes, no log, no dispatch, HP stays 18); slip-through rig (gate force-opened) proves the service `oldHp` assert refuses pre-diamond with exact bytes and short-circuited read census; classic 0-HP corpse contract byte-unchanged (pays, heals to 1, resets death state, `hp_change +1 isHealing:true maxHp` row).
- `src/services/shared/hpModifier.test.js` — the truth-table pin `player with isDead latch set is dead despite 7 HP → dead` ENSHRINED the buggy OR; flipped to ALIVE with a corruption note, plus a new corroborate-absent-HP pin (`isDead:1`, no HP key → dead, unchanged).
- `src/hooks/combat/spellGates.revivify.test.js` — new census pin: an isDead:1/18-HP PC is excluded from `creatureTargets` (only the honest 0-HP monster corpse offered).
- `npx vitest run` on the new file → 3/3; touched area (`src/services/shared` + all revivify lanes + `spellGates.revivify`) → 14 files/114 pass; broader (`src/services/rules/features` + `src/hooks/combat` + healing + cleric-paladin handlers) → 393 files/3849 pass. `npm run lint` → 0 warnings. `node .opencode/plans/no-timers-guard.mjs` → OK.

Live re-verification (:5173, fresh navs + re-selects, campaign header verified `test-campaign`):
1. Divergent bucket re-seeded (18/143/`isDead:1`) → Revivify row → `Cast Spell` → NO chooser, NO `Select AasimarTest` radio; refusal popup `No creature has died within the last minute.`; GET census afterwards: bucket untouched (18, `isDead:1`), lv3 slots unchanged, zero new log rows — expected behavior achieved.
2. Adjacent sanity (classic corpse unchanged): canonical corpse `currentHitPoints:0, isDead:1` → chooser offers `Select AasimarTest` → `Cast Revivify` → popup `1 HP (revived): 1 healing applied to AasimarTest`; bucket 0→1 with `isDead:0` + `deathSaves/deathFailures` reset; log trio `spell` / `material_consumed` / `hp_change {delta:1, currentHp:1, maxHp:143, isHealing:true, note:'Revivify'}`; slot paid.
3. Bonus face seen for free: with no diamond in the backpack, the material gate refused pre-census "Nothing spent." (gate precedence intact).

Exit ritual: sanctioned War_Cleric diamond grants ×2 both self-restored to canonical md5 `1a4c9643` by the consume PATCH; all 13 char files md5-identical to the PX baseline census (AasimarTest `3bfe7eca` never disk-touched); closed-tab clears GET-verified change-data `{}` + log `[]` + overlays `[]`; `git status` = only the 3 touched source/test files + the new test file.

## Commit summary
Revivify computed its revive heal as `1 - currentHitPoints` behind an `isDead || hp <= 0` dead gate, so a desynced bucket (`isDead:1` with 18 HP) turned the resurrection into a −17 DRAIN to 1 HP while still billing the 300 gp diamond and the spell slot, with the popup and audit log contradicting each other. Fixed HP-consistently, mirroring the HoUoM pattern: `isCreatureDead` now lets the bucket HP decide (the `isDead` latch only corroborates an absent HP key), so desynced corpses are never offered; and `validateBeforeConsume` asserts `oldHp <= 0`, refusing "is not at 0 Hit Points … no diamond was consumed" before any spend. Live-verified: 18-HP zombie refused zero-write; classic 0-HP corpse revive contract byte-unchanged; 3 new pins + 3849 touched-area tests green, lint clean.
