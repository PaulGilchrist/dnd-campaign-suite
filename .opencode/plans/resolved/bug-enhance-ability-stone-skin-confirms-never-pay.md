# Enhance Ability / Stone Skin confirms never pay any casting resource on the two-stage/custom handler lanes (slot-owe audit, found by 2026-11-15 skip-gate fix)

## Summary
While fixing `bug-revivify-chooser-skip-rollback-inflates-unspent-slot` (resolved — see `resolved/`), the full pay-state audit of the gated chooser lanes established that payment happens ONLY via `createConfirmHandler` → `prepareSpellCast` (which stamps `pending.slotConsumed`). Two confirm lanes bypass that seam entirely and therefore **consume nothing on a successful cast**:

- `handleEnhanceAbilityConfirm` (`src/hooks/combat/useSpellMetamagicFlow/useTwoStageHandlers.js:185-222`): clears pending, logs a `type:'spell'` row, applies the effect — no `prepareSpellCast`, no slot write, no free-cast resource spend. Enhance Ability is NOT in the hardcoded `FREE_CAST_SPELLS` list (`useConfirmableFlow.js:7-11`) and never routes through `isFreeCastAuthorized`, so a 2nd-level concentration spell is currently castable an unbounded number of times per rest from this lane.
- `handleStoneSkinConfirm` (`src/hooks/combat/useSpellMetamagicFlow/useCustomHandlers.js:249-276`): consumes only the `Diamond Dust (100 gp)` MATERIAL via `consumeMaterial` — no slot pay. RAW requires slot AND material; whether the app intends a material-only free cast here is the owner question (see below).

For contrast, the sibling lanes DO pay correctly: `handleProtectionFromEnergyConfirm` pays at type-select via `prepareSpellCast` (SP-093, `useTwoStageHandlers.js:124-140`), and `Resistance` is legitimately resource-free (it is in `FREE_CAST_SPELLS`).

## Steps to reproduce
1. test-campaign, any caster with Enhance Ability prepared/known and slots remaining (record `spell_slots_level_2` in the runtime bucket — a never-written caster shows the key ABSENT, mirror-only).
2. Cast Enhance Ability through its chooser lane (Actions-grid / metamagic flow), confirm on a target.
3. Observe: effect applies + `type:'spell'` cast row logs, but GET change-data shows NO `spell_slots_level_2` write — repeat indefinitely. Same pattern for Stone Skin: material consumed, no slot consumed.

## Expected behavior
Either (a) these lanes pay through the canonical seam (`prepareSpellCast` + `pending.slotConsumed` stamp, keeping the new skip-gate semantics honest for any future paid state), or (b) the owner rules these are intentional material-only/feature free casts, in which case the lane should say so via the established `isFreeCastAuthorized`/`FREE_CAST_SPELLS` machinery (with an audit `ability_use`/free-cast row where that family does one) instead of silently skipping payment.

## Actual behavior
Silent zero-payment: cast succeeds, slot bucket untouched, no free-cast resource decremented, no audit row for the missing spend.

## Likely location
Confident on the FACT (code-confirmed): `useTwoStageHandlers.js:185` (EA confirm) and `useCustomHandlers.js:249` (Stone Skin confirm) contain no pay call of any kind. Uncertain on the INTENT: no bug/experience in this repo's history pins EA/SS payment on these lanes; the 2024 rules may treat some chooser lanes differently — the fixer must first check whether an upstream seam (gate at arm? `applyEnhanceAbilityEffect`/`applyStoneSkinHandler` services) pays anywhere (grep `prepareSpellCast|spell_slots` inside `src/services/` for these spell names) before concluding double-payment isn't happening elsewhere.

## Suggested fix
If no other seam pays: add the `prepareSpellCast` pay (+ `pending.slotConsumed = true` stamp, mirroring `createConfirmHandler` `useConfirmableFlow.js:139-153`) at the top of both confirms — Stone Skin keeps its `consumeMaterial` leg (slot AND dust). Co-located pins: successful confirm decrements the correct slot key exactly once and stamps `slotConsumed`; refusal/no-target legs pay nothing. If owner rules free-by-design, instead register the intent in `FREE_CAST_CHECKS`/`FREE_CAST_SPELLS` machinery with a one-line justification comment.

## Severity
Resource integrity: unlimited Enhance Ability (any buff-caster per rest) and slot-free Stone Skin distort every encounter the app adjudicates; no crash, no data corruption.

## Triage note (owner)
The skip-side inflation for these exact lanes was just fixed (`73bc0c5e7`); the skip gates read `pending.slotConsumed`, which these lanes currently never set — so today their Skip is (correctly) a zero-write dismiss and their CONFIRM is (incorrectly?) a zero-write cast. Fixing payment here needs NO skip-side changes: once the confirm pays via the canonical seam, the already-shipped gate keeps refund semantics correct automatically.
