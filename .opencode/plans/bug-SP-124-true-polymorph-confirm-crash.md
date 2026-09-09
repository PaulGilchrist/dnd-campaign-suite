# Bug SP-124 — True Polymorph: target-confirm wiring crash makes core transformation unreachable

**Verdict: FAIL** (core transformation absent from live UI — row FAIL per trichotomy rule)
**Run:** 2026-09-09, test-campaign, lv20 DivinationWizard (INT 17 → DC 17, lv9 slot 1, True Polymorph permanently PREPARED disk spells[] 43→44) vs EB Thug 1 (CR 0.5 WIS +0).

## PRIMARY BUG — TypeError at target confirm (creature→creature + creature→object legs DEAD)
`useComplexSpellHandlers.js handleTruePolymorphTargetConfirm = useCallback(async (pending, result) => …)` is bound DIRECTLY as `onConfirm={handleTruePolymorphTargetConfirm}` (CreatureTargetPopups.jsx:207 and :220). But `CreatureSelectionModal.handleConfirm` calls `onConfirm(selected)` with ONE argument — the app-wide contract is `createConfirmHandler(type, applyFn)` (useConfirmableFlow.js:54) which injects `pending = pendingOpsRef.current[type]` into `applyFn(pending, result)`. The raw callback receives `pending = ['Thug']`, `result = undefined` → `pending.spell` undefined → `applyTruePolymorph` throws:

```
TypeError: Cannot read properties of undefined (reading 'name')
    at applyTruePolymorph (truePolymorphService.js spell.name deref)
    at useComplexSpellHandlers.js handleTruePolymorphTargetConfirm
    at CreatureSelectionModal.jsx handleConfirm
```
Reproduced deterministically 2/2 clicks on "Cast True Polymorph (1)". Consequences (all verified post-crash):
- NO WIS save prompt ever created (`pendingSavePrompts` null; handler's createSaveListener never reached)
- NO form chooser, NO te `true_polymorph`, NO tempHp/polymorphTempHp, NO cs stat swap (Thug maxHp 32 ac 11 unchanged, beastName null)
- `cfClearPending('truePolymorph')` never runs → picker stays stuck open; Skip required
- Campaign log: ZERO spell/save/automation entries for either attempt (logging gap at crash per AGENTS.md)
- lv9 slot ledger `spell_slots_level_9` stayed 1 across BOTH attempts — the paid lv9 slot is NEVER consumed on any leg (see secondary bug)

Fix shape: wrap legs in `createConfirmHandler('truePolymorph', …)` OR change bindings to `onConfirm={(result) => handleTruePolymorphTargetConfirm(getPending('truePolymorph'), result)}`; also guard `spell?.name` in applyTruePolymorph.

## Secondary — reachable object→creature leg works but with defects
`handleTruePolymorphPathSelect` DOES use `getPending('truePolymorph')` correctly → live-verified chain: path modal ("Choose the type of transformation", 3 paths) → CR≤9 form chooser → transform Gazer:
- cs NEW npc combatant `Gazer` monsterIndex gazer hp 13, `summonedBy DivinationWizard`, `summonSource true_polymorph` ✓
- cs.concentration {spell 'True Polymorph', dc 14 = 8+PB6+CON0} ✓
- Log: `ability_use — DivinationWizard transforms an object into Gazer. The creature is friendly…` ✓
- DEFECT A: summoned `ac: 22` — `summonCreatureFromObject` computes `ac = baseAc + slotLevel` (13+9). Canonical 13; violates the 43g precedent ("AC no longer slot-scales" — summonSpirit fixed, this one didn't).
- DEFECT B: "takes its turns immediately after yours" only holds when caster has initiative — caster cs.initiative was `''` here → random fallback 5−0.1=4.9 (no GM stamp enforcement).
- DEFECT C: `summoned` te NOT present in `__campaign__.targetEffects` (write lost/raced); cs-entity tracking is the only survivor.
- DEFECT D (accounting, all legs): lv9 spell slot never decrements (`spell_slots_level_9` 1→1 after two full cast attempts). prepareSpellCast payment is never invoked on this modal chain.

## Grep-documented gaps (no producer/consumer anywhere)
- "can't speak or cast spells" in new form: ZERO consumers (grep empty)
- "gear melds / can't benefit from equipment": ZERO consumers
- Permanent-until-dispelled after concentrating full 1 hour: `pendingExpirations expiryRounds: Infinity`, no 1-hour clock, no permanency flag (restRules strip te + summons only)
- object size ≤ object size gate: no object-size model

## Implemented-but-unreachable (behind the crash seam — do NOT count as pass)
Handler gates (0-HP/shapechanger/already-transformed), real-DC WIS save, target-CR form cap (`resolveTruePolymorphMaxCR`), THP=new-form-HP (`confirmTruePolymorphTransform`), THP-0 early revert (`applyDamage.js:329-333`, shared key live-proven by SP-086 Polymorph), creature→object incapacitated transform. All producers exist in code but are gated behind `applyTruePolymorph` called ONLY from the crashing `handleTruePolymorphTargetConfirm` (+ CharSheet form-confirm which needs its popup payload).

## Fix acceptance test
Cast creature→creature on Thug: expect Roll Save prompt WIS DC 17 → fail → form chooser CR≤0.5 → Thug cs maxHp→form HP, ac→form AC, beastName set, runtime tempHp=polymorphTempHp=form HP, te `true_polymorph` in campaign targetEffects, cs.concentration dc 17-style real, `spell_slots_level_9` 1→0, save-polymorph log lines. No console TypeError.

Cleanup done: change-data + log cleared, servers up. True Polymorph remains PREPARED on DivinationWizard disk (permanent, re-arm-ready for retest post-fix).
