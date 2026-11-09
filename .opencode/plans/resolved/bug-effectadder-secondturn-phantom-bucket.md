# Bug: EffectAdder on a `(Second Turn)` row stores state into a phantom bucket keyed by the synthetic row name — invisible, unrestorable, orphaned at round wrap

## Summary

The Thief's-Reflexes `(Second Turn)` initiative card keeps its GM "Add condition, effect, or concentration" button, but the row is synthetic transport (never a character file, retired at the round-1 wrap). Applying a condition through it writes `activeConditions` into a **new change-data bucket keyed `"EvasiveFighter (Second Turn)"`**, renders **no badge on any card** (neither the second-turn card nor the holder's), leaves the holder's real bucket untouched, and logs a false-positive `condition applied` audit row. Once the row retires at the round wrap, the bucket is a permanent orphan — no UI surface can view or remove it; only Admin → Clear Change Data sweeps it.

## Steps to reproduce

1. In `test-campaign` (GM tab on localhost), on Initiative: join/clear to a party-seeded board, round 1.
2. Grant Thief's Reflexes (EvasiveFighter Rogue/Thief lv20 rig; card initiative input → `20` + Enter) so the `EvasiveFighter (Second Turn)` row exists at init 10.
3. On the `(Second Turn)` row's card, click the button `Add condition, effect, or concentration to EvasiveFighter (Second Turn)` (`.effect-add-btn`, title-anchored). The `.ea-overlay` modal opens titled with the synthetic name.
4. Conditions tab → `Poisoned` → `Apply`.
5. Observe both EF cards (holder and second-turn row) — badge area `.creature-badge-wrapper`: zero badges on either.
6. GET `/api/campaigns/test-campaign/change-data` → a bucket `"EvasiveFighter (Second Turn)"` exists with `activeConditions: ["poisoned"]`; the holder bucket `EvasiveFighter` has no `activeConditions`.
7. GET the log → last row `{type:'condition', action:'applied', characterName:'EvasiveFighter (Second Turn)', condition:'Poisoned', ability:'con'}`.
8. Walk `Next` past the last creature so the round wraps to 2 (the ST row is retired by design). Re-GET change-data → the phantom bucket is still there with `["poisoned"]`; nothing renders or consumes it.

## Expected behavior

Either the Add button should not be offered on `(Second Turn)` cards (the lane already excludes those rows everywhere else — `CreatureCard.jsx:237` and `useTvPresentation.js:110` filter `secondTurn` out of select/lists), or the apply must route to the holder (`holderName: 'EvasiveFighter'`) so the condition lands on real, visible, removable state (like the AWAY-creature face, which honestly lands + badges + audits).

## Actual behavior

Modal accepts and closes as if successful; one `condition applied` audit row claims the synthetic name; the condition lands in a phantom bucket no component reads or renders; zero observable delta on any card; after the round-1 wrap the bucket is orphaned store pollution (survives Initiative Clear, only removed by Admin clear-change-data).

Control/probes: the same Add→Poisoned→Apply flow on the holder's own card (and ER's AWAY-creature face) lands visibly (`activeConditions` on the real bucket + badge + audit + `broken` audit on removal) — the delta gap is specific to the second-turn row key. Source census: `conditionSaveService.addCondition` writes `setRuntimeValue(targetName, 'activeConditions', …)` keyed by whatever the modal target string is — no `secondTurn`/`holderName` remap; the card that renders `Add` (`CreatureCard.jsx`) has no `isSecondTurnEntry` guard on that button.

Likely same-lane variants (not separately ridden): Effects-tab apply to an ST row would write a `targetEffects` row keyed to the doomed name → invisible zombie te with no × (the exact failure class of the 2026-10-29 `redirect_attack` invisible-badge bug this modal was hardened for); Concentration apply writes `concentration` onto the ST cs row, which then evaporates silently at the round wrap.

## Likely location

Confident (store write + audit observed live, code seam matched by grep):
- `src/components/initiative/CreatureCard.jsx` — the Add button render (no `isSecondTurnEntry(creature)` guard).
- `src/services/combat/conditions/conditionSaveService.js` `addCondition` — keys runtime state by the literal target name.
- Orphan lifecycle by design in `src/components/initiative/navigationHandlers.js` `runRoundWrapHousekeeping` (strips the row but nothing scrubs buckets keyed by it).

## Suggested fix

Cheapest honest lane: hide the Add button on `secondTurn` rows in `CreatureCard.jsx` (`isSecondTurnEntry` import already exists in the initiative family). Slightly richer alternative: remap the EffectAdder target to `creature.holderName` before opening the modal so GM intent lands on the holder. If remapping, the audit row character name should be the holder too. Add a regression test: apply to an ST row → holder bucket carries the condition, no bucket exists under the synthetic key.

## Severity

Data integrity risk — false-positive audit plus permanent phantom change-data (invisible, unrecoverable except by full Admin clear); a GM believes they poisoned a creature that was never affected.

## Resolution

FIXED 2026-11-09 (fix run). Root cause matched the bug file's census: `Initiative.jsx` `openEffectAdder` stored the raw creature row into the `combat-ui-effectAdderTarget` flag, and the modal dispatches ALL three tabs through `data.target = targetName = effectAdderTarget.name`, so every write lane (`conditionSaveService.addCondition` runtime keys, root `targetEffects` row, cs `concentration` row) plus `logConditionEvent` keyed off the literal synthetic name. The fix is NOT a new architecture: it applies the lane's own CLA-360 holder-resolution law (`creature.holderName || creature.name`, `displayCreatureUtils.js:49`, mirrored at `Initiative.jsx:776` — the ST row card already resolves holder HP/AC/conditions through it) to the WRITE side. Remapping at the single open chokepoint routes GM intent to the holder's real, visible, removable state (same face as the accepted AWAY-creature applies) and fixes all three tabs + the audit name in one place; hiding the button would have left the unguarded write seam intact for every other opener.

Files changed:
- `src/components/initiative/Initiative.jsx` — `openEffectAdder` remaps `isSecondTurnEntry(creature)` targets to `{ ...creature, name: creature.holderName }` before writing the flag.
- `src/components/initiative/Initiative.effectAdder-second-turn.test.jsx` — NEW regression test (mirrors the `Initiative.effectAdder-evict.test.jsx` mock family; `isSecondTurnEntry` mocked with real structural semantics): opening from the ST card writes the flag + modal targetName as the HOLDER (never the synthetic name), Apply writes `targetEffects` under `target: holder` with zero calls keyed by the ST name and still evicts the flag, and the holder-card control leg keeps its own name. 3/3 pass.

Verified live in `test-campaign` (synthetic ST-row twin seeded via full-store `combatSummary` POST — the ER-proven merge law keeps `secondTurn` rows whose `holderName` is a campaign character, no fixture surgery needed):
- PRE-fix repro (exact bug-file behavior): modal titled `EvasiveFighter (Second Turn)`; Poisoned Apply → phantom bucket `"EvasiveFighter (Second Turn)": {activeConditions:["poisoned"], activeConditionMeta:{poisoned:{ability:"con"}}}`, holder bucket absent, zero badges on either card, `condition applied` audit claims the synthetic name; Effects-tab Apply → zombie te `{target:"EvasiveFighter (Second Turn)", effect:"slasher_enhanced_critical"}` + `target-effect-applied` naming it; Initiative Clear retires the row while phantom bucket + te survive (orphan confirmed).
- POST-fix re-run of the same steps: NO synthetic-key bucket ever appears; holder bucket carries `activeConditions:["poisoned"]` + meta; `Poisoned` badge renders on BOTH cards (holder card natively, ST card via CLA-360 display resolution) and `Attack Disadv` te targets `EvasiveFighter`; both audit rows name `EvasiveFighter`; modal opened from the ST card is titled `EvasiveFighter`. Adjacent sanity: holder-card badge × evicts (`activeConditions:[]`) + honest `condition broken` audit row.
- Tests: `npx vitest run src/components/initiative` = 90 files / 684 tests green (incl. the new file); `npm run lint` zero warnings. No timers touched (guard not required).

Residuals noted (not filed): the Effects-tab Source dropdown can still list an ST row as a te `source` (attribution string only, not a state key — cosmetic); the ST card's Add-button `title` still names the suffixed row (it identifies the card you clicked; the modal header names the landing holder — kept so lane locators stay stable).

