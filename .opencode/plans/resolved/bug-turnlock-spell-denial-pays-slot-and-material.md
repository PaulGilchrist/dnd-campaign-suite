# Turn-lock enforcement denial on the sheet spell-cast lane still pays the spell slot (and consumes costly material components to disk)

## Summary

With enforcement `mode:'on', turnLock:true` and a different creature active, pressing Cast Spell on the character sheet correctly pops "It is <Active>'s turn — <caster> cannot act now." and logs `enforcement_denied` — but the denial is NOT zero-cost on this lane: the spell slot decrements (server change-data) and, for a spell with a consumed Material component, the component is deleted from the caster's backpack ON DISK plus a `material_consumed` row is written. The attack-lane denial under the identical enforcement state remains fully clean (control probe: denial row only, zero rolls, zero deltas), so the spell lane is inconsistent with the enforcement-denial doctrine.

## Steps to reproduce

1. In test-campaign with a board live (EB-joined creatures, e.g. Wolf+Goblin+GB Thug), arm enforcement: `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',turnLock:true}}` and `POST /api/campaigns/test-campaign/activeCreatureName {value:'Goblin'}`.
2. Open DivinationWizard's sheet (a 2024 Wizard with Animate Dead prepared). TEMPORARILY add `"Drop of Blood, Piece of Flesh, Pinch of Bone Dust"` to `inventory.backpack` in `public/campaigns/test-campaign/DivinationWizard.json` on disk, reload + re-select campaign (this clears the material-missing gate; note the baseline `spell_slots_level_3`).
3. Click the Animate Dead spell row → Cast Spell.
4. Observe the denial popup "It is Goblin's turn — DivinationWizard cannot act now." with only a Done button — nothing is cast.
5. `GET /api/campaigns/test-campaign/change-data` → `DivinationWizard.spell_slots_level_3` has DECREMENTED by 1. `GET .../DivinationWizard.json` → backpack item is GONE (disk write). Log gained `material_consumed` + `enforcement_denied` rows.
6. Second face (no material involved): cast Dispel Magic (V/S, prepared, 3rd level) under the same denial state → denial popup + `enforcement_denied` row + `spell_slots_level_3` decrements again.
7. CONTROL (same tab, same enforcement state, same caster): click the sheet attack chip (+5 row in `.attacks`) → identical denial popup, log grows ONLY by `enforcement_denied` — zero roll rows, zero resource deltas.

Live-proved 2026-11-10 (run GB): slots 3→2 (Animate Dead denial, +material disk consumption) and 2→1 (Dispel Magic denial); control attack denial = 1 row, 0 rolls.

## Expected behavior

An enforcement turn-lock denial is an out-of-world permission refusal, not an in-world cast that fizzled. It should cost NOTHING: no slot decrement, no component consumption — matching the attack lane's clean-denial witness law (popup + `enforcement_denied` row + zero deltas; playbook FV2) and the Stunning-Strike refusal precedent (DA run: refusals left focusPoints untouched). If the CLA-389 "out-of-range casts still pay the slot" convention is meant to extend to enforcement denials, at minimum the component consumption (a DISK write of a 0-cost-by-name reagent) on a denied cast is wrong — RAW consumes components only when the spell is actually cast.

## Actual behavior

Denial popup + `enforcement_denied` log row, PLUS:
- `spell_slots_level_3` decremented in change-data (2/2 denial faces reproduced)
- backpack reagent removed from `DivinationWizard.json` ON DISK + `material_consumed` log row (Animate Dead denial)
- `assertCanAct` itself does not charge spell slots (chargeEconomy is action-economy only), so the payment comes from the execution lane running (or a pay/material step executing) despite the denial.

## Likely location

The sheet spells-tab lane: `SpellDetailPopup.jsx` → `CharSpells.jsx handleSpellCast` → `useSpellMetamagicFlow gateMetamagic` → `useSpellCastExecutor.js runCast` — the comment at `useSpellCastExecutor.js:59-63` says the gate site "charges the classified slot" on allow via `assertCanAct({charge:true})`, and `assertCanAct` returns before `chargeSlot` on deny (verified by reading `assertCanAct.js`). Yet the spell slot still decremented — so either an earlier seam in the metamagic/confirmable flow (`useConfirmableFlow.stampPaidSlotLevel` / CLA-086 paid-slot seam, `useSpellMetamagicGates.js:111 stampPaidSlotLevelOn`) pays BEFORE `runCast`'s gate, or `executeSpellCast` runs concurrently (un-awaited) and its slot-spend + `materialComponents.consumeMaterial` steps land despite the denial. The `material_consumed` producer in `src/services/rules/spells/materialComponents.js` runs downstream of the gate (it fired), which points at "execution already in flight past the point of no return" rather than a stale-mirror race (the denial popup itself proves the gate read active=Goblin). Investigation: trace where `spell_slots_level_*` is decremented for a plain non-attack cast (grep the spend site — `useSimpleSpellHandlers.js` / `useConfirmableFlow.js`) and confirm whether it precedes `assertCanAct` or runs inside the un-awaited `executeSpellCast` chain after a separate denial.

## Suggested fix

Move the spell-slot payment and material consumption strictly after the enforcement gate resolves (deny ⇒ zero writes), or add an explicit refund (`available + 1` precedent: `refundSpellBreakerSlot` in `execution/helpers.js:135`) + component restore on `enforcement_denied` for this lane. First check whether the spend site runs pre-gate in `useSpellMetamagicFlow`/`useConfirmableFlow`; if it's the un-awaited `executeSpellCast`, an early-throw guard on the same `assertCanAct` result before the pay/material steps suffices. Pin non-regression with the FV2 clean-denial witness law: denial faces must write ONLY the `enforcement_denied` row.

Owner-decision note: RESOLVED 2026-11-10 by owner ruling — see next section.

## OWNER RULING (Paul, 2026-11-10): Option A — enforcement denials must cost NOTHING

The turn-lock denial is an out-of-world permission gate: a denied spell cast pays no slot, consumes no material component, and writes no disk changes. The fix must make the denial path zero-cost (payment + consumption move strictly behind the gate, or refund on `enforcement_denied` — see Suggested fix), and pin the regression doctrine: **every enforcement denial face (attacks, spells, bonus actions, drags) writes ONLY the `enforcement_denied` row with zero resource deltas** — extending the FV2 clean-denial witness law from the attack lane to all lanes. The CLA-389/391 pay-early convention stays reserved for IN-WORLD cast failures (out-of-range, fizzled), which still pay — this ruling governs only the enforcement-gate denial seam.

## Severity

Data integrity risk — every accidental off-turn cast attempt silently burns a spell slot and (for consumed-component spells) permanently rewrites the character file; the audit rows make it look intentional, so it can persist unnoticed across sessions.

## Resolution (FIXED — 2026-11-10 fix run, owner-ruling Option A implemented)

**What was actually wrong:** the "Likely location" guess #1 was correct and #2 was not. The sheet spell lane's single entry point, `gateMetamagic` (`src/hooks/combat/useSpellMetamagicGates.js`), reaches `handleNonSorcererCast` → `prepareSpellCast` (slot spend) + `consumeMaterial` (backpack disk write) and only THEN calls `onExecute` — which routes to `useSpellCastExecutor runCast`, where the `assertCanAct` gate sat. So the denial popup printed from the executor gate AFTER the payment lanes had already run; `executeSpellCast` never ran (the cast itself never fired). The attack lane was clean because `runAttackClick` gates BEFORE anything executes — the fix mirrors that placement rather than refunding.

**Fix:** added an `assertCanAct({campaignName, creatureName: playerStats.name, bucket: classifyBucket(spell), setPopupHtml, source:'useSpellMetamagicGates'})` early gate in `gateMetamagic`, positioned immediately after the missing-material check (preserving the recorded material-gate-precedence law and the existing unpaid missing-material face) and before every payment/queue lane below it (generic `prepareSpellCast`, Power-Word pay-at-confirm, sorcery/multi-target/chooser queues, deferred-payment short-circuits). `charge` stays false at this site — the executor hold-point keeps the single actionEconomy tap (no double-charge); the `runCast` gate remains as the execute-chokepoint backstop. The lane is ruleset-shared, so one gate covers both 5e and 2024 rows. No refunds, no new events, no new abstractions.

**Files changed:**
- `src/hooks/combat/useSpellMetamagicGates.js` — early enforcement gate + imports (`assertCanAct`, `classifyBucket`).
- `src/services/combat/actionGateSites.test.js` — `useSpellMetamagicGates.js` added to the `GATED_ENTRY_FILES` wiring registry (its payment lanes precede the executor, so it needs its own gate, unlike pure delegators).
- `src/hooks/combat/useSpellMetamagicGates.enforcement-denial-no-spend.test.js` — NEW regression test (no-spend family harness, mirroring sp079/sp080/sp125): denial ⇒ `prepareSpellCast`/`consumeMaterial`/`addEntry`/`onExecute`/`cfSetPending`/`tryGateSpell` ALL zero; gate called once with bucket `action` + source `useSpellMetamagicGates` and NO charge flag; sorcerer denial queues no chooser; controls pin the paid lane (slot + material consumed on allow) and the missing-material precedence (no assertCanAct call).

**Live re-verification (test-campaign, localhost, fresh repro run — Wolf+Goblin EB-joined, enforcement `{mode:'on',turnLock:true}`, cs active=Goblin):**
- BEFORE fix (repro confirmed byte-faithful): Animate Dead denial ⇒ `spell_slots_level_3` 3→2 + reagent removed from `DivinationWizard.json` ON DISK + `material_consumed` row + `enforcement_denied` row; Dispel Magic denial ⇒ 2→1 + denial row; attack-chip control ⇒ 1 row, 0 deltas (the recorded clean witness).
- AFTER fix, same rig: Animate Dead denial (reagent present) ⇒ popup "It is Goblin's turn — DivinationWizard cannot act now." + ONLY 1 `enforcement_denied` row (source `useSpellMetamagicGates`), slot held at 1, backpack intact on disk, zero `material_consumed`. Dispel Magic denial ⇒ same zero-cost shape. Attack-lane denial ⇒ unchanged clean (source `useCharActionsAttackHandlers`).
- Legit-cast control (walked active→DivinationWizard, correct turn, material present): cast proceeds — chooser modal opens, slot 1→0 spent, reagent consumed to disk, `material_consumed` + `spell` rows written — byte-identical to the pre-fix success lane.
- Exit ritual: DW disk file byte-exact restore (md5 `e754d3e7` re-proved — the server's own consumption write re-canonicalized it), change-data `{}` + log `[]` + overlays `[]` via two-pass headless admin clears GET-verified, zero campaign-lock denials in the server log.

**Test/lint results:** new test 7/7 PASS; touched-area run `src/hooks/combat` + action-gate/assertCanAct suites: 238 files / 1999 tests PASS (3 expected-fail, pre-existing); `npm run lint` clean (zero warnings); `no-timers-guard` OK (42 sites, all pre-existing benign UI).

