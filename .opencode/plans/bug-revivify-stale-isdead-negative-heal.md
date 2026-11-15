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
