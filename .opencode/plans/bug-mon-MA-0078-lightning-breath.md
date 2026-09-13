# Bug mon-MA-0078 — Adult Bronze Dragon · Lightning Breath (Recharge 5-6) · aoe-save

**Verdict: FAIL** — MV-21 fingerprint: 90-ft line shape absent (degrades to single-target save) + recharge "5-6" ungated (3 fires same round, no recovery die). Per-target save math EXACT both branches.

## Setup (live, test-campaign, header ✓ MV-18)
- :5173=200; EB tick Adult Bronze Dragon → Join; combatSummary "Adult Bronze Dragon 1" 212hp init 9, immunities [Lightning].
- Armed pre-click (MV-22): POST ElderPaladin currentHitPoints=250 + dragon targetName=ElderPaladin. EP lvl20 Paladin, DEX 16 → save +8 (+5 aura detail shown); resistances/immunities [] in character JSON.

## Defect 1 — Line shape gap (MV-21)
- Row renders clickable dice chip "10d10" + link (SPAN); PRE- and POST-click DOM: `.secondary-target-row`=0, area/line/aoe picker=0. 90-ft×5-ft Line in description never becomes an area selection — handleSaveRoll (MonsterCardModal.jsx:578) resolves single armed target only.

## Defect 2 — Recharge ungated (MV-21)
- "5-6" is display-only `<em>` (MonsterAction.jsx:72; zero gate consumers in src/).
- Live: 3 breath triggers in round 1 — click1 fail(17)→66 full; click2 same round fail(10)→58 full; click3 same round success(24)→half. No d6 recovery roll, no "can't take again" gate anywhere.

## Save math — EXACT (per-target)
- Fail #1: d20[9]+8=17 vs DC 19 → 10d10 [9,1,10,8,6,10,10,8,1,3]=66 FULL → hp −66 (250→184).
- Fail #2: d20[2]+8=10 vs DC 19 → 10d10 [8,5,6,9,3,1,2,10,7,7]=58 FULL → hp −58 (184→126).
- Success: d20[16]+8=24 vs DC 19 → 10d10 [7,1,6,8,8,9,5,7,6,9]=66 → HALF 33 → hp −33 (126→93). Exact halving.
- save_result + named "Lightning Breath (Recharge 5-6)" save-damage logs present each use; runtime prompt saveType Dexterity / saveDc 19 / dcSuccess half correct.

## Notes
- Modal correctly titled DEXTERITY (an early stray "DC 19 Strength" text was a hidden stale element, not the live prompt — runtime prompt verified DEX).
- Stray pre-click dragon DEX save log (rolls [4,16], total 4) observed from navigation noise; incidental, not part of breath chain.

## Cleanup
- Admin clear-change-data + clear-log POSTs (Host: localhost) — confirmed. Browser closed. No manifest/playbook edits.
