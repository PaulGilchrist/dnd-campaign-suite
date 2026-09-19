# bug-mon-MA-0544 — Cyclops Oracle "Portent" reaction inert

- **Row:** MA-0544 | monster `cyclops-oracle` | category reactions | actionIndex 0 | actionType other | recharge "4-6"
- **Verdict:** FAIL(b) — inert prose reaction, zero producer (MA-0516 twin)

## Disk (public/data/monsters.json, cyclops-oracle reactions[0])
```json
{"name":"Portent","trigger":"The cyclops or an ally it can see makes a <strong>D20 Test</strong>.","description":"The cyclops rolls 1d20 and chooses whether to use that roll in place of the d20 rolled for the D20 Test.","recharge":"4-6"}
```
No `automation` field, no `save_dc`, no `attack_bonus`, no dice — trigger is prose-only.

## Code layer
- Gated-reaction chip gate = `action.automation.effect` ONLY: `getGatedMonsterReaction` (src/components/encounter/MonsterCardHelpers.js:1063) returns null without it → `GatedReactionSlot` returns null (MonsterAction.jsx:134-138). No chip renders.
- Authored `recharge:"4-6"` renders ONLY as a cosmetic `<em> (4-6)</em>` note via `RechargeNote` (MonsterAction.jsx:28-32, placed at :201). Not clickable, not an affordance.
- Recharge economy never engages: `rollMonsterRecharges` re-rolls ONLY entries already spent in the `MONSTER_RECHARGE_KEY` map (src/services/encounters/monsterRecharge.js:120-135); the sole spend point `spendMonsterRecharge` fires at row-chip/picker click — with no chip the key is never stamped spent, so no d6 regain ever occurs. Recharge on a reaction without an automation chip is dead metadata.
- Trigger grep: no consumer dispatches monster "D20 Test" reactions. `portentHandler.js` is the PC DivinationWizard class feature (class-wizard automation registry) — not keyed to monster reaction rows.

## Live proof (test-campaign, :5173, 2026-09-19)
- EB join exact-filter "Cyclops Oracle" → cs idx 0 "Cyclops Oracle 1", round 1.
- Card Reactions section innerText: `Portent. The cyclops rolls 1d20 ... (4-6)` — row HTML is `<strong>Portent.</strong> <span>...</span><em> (4-6)</em>`; zero elements with role=button/a/button/mc-dice-link* matching portent|recharge|4-6 anywhere in `.mc-overlay` (`clickable: []`).
- Clicks on the Portent `<strong>` and the `(4-6)` `<em>`: log delta 0, no popup. Inert confirmed.

## Fix direction (DATA, per MA-0516 family policy)
Portent (replace-the-d20 roll pool) has no app-wide seam (d20-test replacement chooser, ally-targeting trigger dispatch, recharge pool). Options: author `automation:{type,trigger,effect}` + register gated effect in GATED_MONSTER_REACTIONS/targetEffectDefinitions with a roll-replacement chooser, or downgrade row to advisory/GM-enforced and drop misleading recharge. Same adjudication as MA-0516 applies.

## Cleanup
admin/clear-change-data 200 + admin/clear-log 200, hard reload back to campaign-select; log verified 0 entries via own curl. Registry merged into `Cyclops Oracle.config.verifiedRowMA0544` (disk JSON.parse-checked). No manifest/git writes.
