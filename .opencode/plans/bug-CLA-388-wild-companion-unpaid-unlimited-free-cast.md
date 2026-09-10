# BUG CLA-388 — Wild Companion (Druid lv2, 2024): row grants Find Familiar free cast UNPAID, chooser modal is dead code, resource never consumed, survives Long Rest, no FEY familiar

VERDICT: FAIL (2026-09-10, test-campaign, host Wild_Sage_Druid lv20 Circle of the Stars 2024)

## RAW clause vs app
classes.json (2024) Druid lv2 "Wild Companion":
`automation {type:'free_spell', spell:'Find Familiar', action:'action', casting_time:'1 action', resourceCost:'wild_companion'}`
Expected: expend a spell slot OR a Wild Shape use → cast Find Familiar without M components; familiar FEY; disappears at Long Rest.

## Defect 1 — row click spends NOTHING and stamps free-cast auth (primary)
Live proof (self-issued curl + Playwright, logs cleared at session start, baseline change-data):
- Baseline: `spell_slots_level_1=4, wildShapeUses=4, _Wild_Companion_freeCast=<absent>`, log count 0.
- Click `b.clickable` "Wild Companion:" row → generic popup "Wild Companion … Free cast of: Find Familiar" (NO chooser — no slot-level radios, no `.resource-pool-overlay`).
- Post-click: `spell_slots_level_1=4` (unchanged), `wildShapeUses=4` (unchanged), `_Wild_Companion_freeCast=['Find Familiar']` WRITTEN. **Log count still 0** (no ability_use/spell log at grant).

Cause: row dispatch chain CharActions.jsx:615 → useCharActionsAutomation.handleAutomationAction → automation/index.js:310 `free_spell: handleSpellCast` → spellCastHandler.handleSpellCast. The entry has no `uses_expression`/`uses`/`perSpellTracking`/`damage`, so it falls through every branch to the final block (:283-295) which writes `_${action.name}_freeCast` (= `_Wild_Companion_freeCast`) unconditionally and returns the popup. `auto.resourceCost === 'wild_companion'` is read NOWHERE in production (`grep -rn "wild_companion" src/` = 0 hits outside data/tests; spellCastHandler only branches on `channel_divinity` :62).

## Defect 2 — WildCompanionModal (the ONLY payment surface) is unreachable dead code
`WildCompanionModal.jsx` correctly pays `spell_slots_level_N` (radio per level) or `wildShapeUses` and stamps `_Wild_Companion_freeCast`. It is registered in modalMap (`useCharActionsAutomation.js:34 wildCompanion: simpleModal('wildCompanionModal')`) and rendered (`CharActionModals.jsx:338`), but ZERO production code returns `{type:'modal', modalName:'wildCompanion'}` (grep `'wildCompanion'` src/ = modalMap consumer + `useCharActionsAutomation.test.summon-modals.js` mock only — §46f/42x unregistered-producer silent-swallow family, mirror of CLA-379 warBondSummon). Both payment legs are therefore INERT; "pay with slot vs pay with wild shape" chooser is never offered; refusal-at-0-resources structurally unreachable (row handler performs no balance check at all).

## Defect 3 — grant auth never consumed and never rest-reset (unlimited leak)
- `isFreeCastAuthorized` (spellPreparationService.js:124/:173) honors the shared `_${name}_freeCast` array → popup showed "Free Cast — no spell slot consumed" and Cast enabled.
- `decrementFreeCastResource` (:283) consumes `_freeCastCount` counters/per-spell keys but has NO branch clearing the shared `_freeCast` array → after the cast attempt, change-data still shows `_Wild_Companion_freeCast=["Find Familiar"]` (authorization unspent → re-cast forever).
- Long Rest (live, sheet button): slots re-armed 3→4, `wildShapeUses→null` (re-armed), but `_Wild_Companion_freeCast=['Find Familiar']` **PERSISTS past LR** (restRules-constants/-longRest null `_freeCastCount` keys only; `_Wild_Companion_freeCast` absent). Feature gate therefore permanent, and "familiar disappears when you finish a Long Rest" has no model.

## Defect 4 — material waiver not implemented on the spell flow
`gateMetamagic` (useSpellMetamagicGates.js:15-25) refuses any consumed-material spell when the item is absent, with NO `freeCastAuthorized` waiver. Live: Cast Spell click with empty backpack → popup "Find Familiar requires burning incense worth 10+ GP, which the spell consumes." Wild Companion's explicit "without Material components" clause is enforced BACKWARDS (the free path is gated harder than RAW).

## Defect 5 — no familiar entity, FEY or otherwise
`grep -rn "familiar" src/hooks src/services` = `materialComponents.js:17` only. Zero summon/combatant producers. Post-cast combatSummary creatures = 14 PCs, no familiar. Spell resolves to nothing summonable in both payment variants.

## Session side-evidence (pre-existing engine fragility, NOT CLA-388-owned — report only)
- `executeSpellCast` throws `activeConditions must be an array for caster` (spellCastService/execution/index.js:91-92) whenever the caster's change-data has no `activeConditions` key — reproducible on BOTH Find Familiar and Cure Wounds casts on this freshly-cleared host. Wild Companion completion is blocked by it in this session, but the seam is generic.
- Cure Wounds PAID its lv1 slot (4→3) in `prepareSpellCast` BEFORE that executor crash — slot lost on a crashed cast (generic waste, worth its own ticket).
- Incense was added to backpack via wizard step 16 (legit UI, trusted keystrokes) purely to exercise the cast; it was consumed by `material_consumed` log during the crashed Find Familiar cast; backpack back to `[]` naturally.

## Repro recipe
1. Host: any 2024 Druid lv≥2 whose change-data lacks `activeConditions` (arm any condition via Initiative EffectAdder first to get past the generic executor crash, or cast targetless differently).
2. Actions grid `b.clickable "Wild Companion:"` → evaluate/popup = "Free cast of: Find Familiar"; diff change-data → grant key written, slots + wildShapeUses untouched, zero logs.
3. Spells tab Find Familiar row → popup "Free Cast — no spell slot consumed"; without Incense (10 gp) in backpack the Cast is refused (material gate); with it, material_consumed logs then executor crash; grant key NEVER clears; Long Rest keeps it.

## Fix guidance (minimum)
- Route `resourceCost:'wild_companion'` (or feature-name match, spellCastHandler precedent :15/:62) to return `{type:'modal', modalName:'wildCompanion'}` from executeHandler/handleSpellCast so WildCompanionModal opens and pays (both ledgers) before stamping the grant; refuse at both-zero with popup + `<slug>_refused` automation log (CLA-359 shape).
- Add shared-`_freeCast` array consumption to `decrementFreeCastResource` (clear on cast) and `_Wild_Companion_freeCast` to LR reset (or drop the stamp approach for a once-per-cast consumable).
- Waive consumed-material check when `freeCastAuthorized` for features whose RAW text says "without Material components".
- Log `ability_use` at activation and `spell`/`summons` at cast (manifest requires logging).

## Cleanup done
Admin clear-change-data + clear-log POSTed (verified: 0 keys / 0 entries). Character disk JSON unchanged except backpack which returned to original `[]`.
