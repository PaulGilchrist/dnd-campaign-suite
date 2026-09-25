# BUG MA-1161 — Mimic Pseudopod: INERT GRAPPLED RIDER (FAIL(a)/DATA)

**Date:** 2026-09-25 · **Campaign:** test-campaign · **Row:** mimic actions[1] "Pseudopod"
**Manifest:** MA-1161 (`conditions:["grappled"]`, actionType "attack+save", attackBonus 5, saveDc 0) → **FAIL(a)**.
**Class:** MA-1157 Mezzoloth Claws / MA-1153 Merrow Bite twin — auto-condition-on-hit rider, no save. §449 transport = hit_conditions/hit_target_effect/hit_condition_roll only; MonsterCardHelpers.js:648 `buildHitConditionClause` → handlePlainDamage.js:543 `applyHitClauseConditions`. MA-0930 Grick authors hit_conditions as byte-shape twin.

## Expected (row quote)
> "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Bludgeoning damage plus 4 (1d8) Acid damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage."

Pseudopod hit on a Large-or-smaller victim (Bandit 1, cs size "Medium or Small") must grant **Grappled** (escape DC 13) alongside the two damage components.

## Disk truth (`public/data/monsters.json` mimic.actions[1]) — byte-checked 2026-09-25
Authored keys ONLY: name, description, `attack_bonus:5 ✓`, `save_dc:0`, save_type:"", save_effect:"", range:"", `reach:"5 ft." ✓`, recharge:"", `damage_dice_primary:"1d8 + 3" ✓`, `damage_type_primary:"Bludgeoning" ✓`, `damage_dice_secondary:"1d8" ✓`, `damage_type_secondary:"Acid" ✓`. Description byte-matches row prose (`<strong>Grappled</strong>`, "(escape DC 13)", Disadvantage clause).
**`hit_conditions` ABSENT · `escape_dc` ABSENT · `hit_target_effect` ABSENT · `hit_condition_roll` ABSENT · `target_prerequisite` ABSENT** — manifest `conditions:["grappled"]` is prose-derived, zero attack-path consumers (§449).

## Escape-economy audit (per task)
- `escape_dc` **HAS live consumers**: buildHitConditionClause (Helpers:656) → clause.escapeDc → handlePlainDamage.js:563-566 stamps `activeConditionMeta[cond].dc/.ability:'str'` → condition badge escape save (displayCreatureUtils.js:6 reads activeConditionMeta). Untouched twins that author it: escape_dc 12-16 across ~22 monster rows; hitClause tests lock MA-0288 Bite escape_dc:13 byte-shape. → **unauthored escape_dc on Pseudopod = genuine data gap, included in this file.**
- **"Ability checks made to escape this grapple have Disadvantage": NO consumer** — grep: grapple-source escape checks roll plain STR badge save (meta.dc); zero disadvantage-on-escape transport tied to a grapple source (only ranger 'escape_the_horde' derived-no-adv te + PC Powerful Build adv CLA-209). → GM-adjudicated advisory clause; NOT part of the fix.

## Transport analysis
Consumer LIVE but UNARMED: clause collapses to null (`conditions.length===0 && !targetEffect && !conditionRoll`) → `maybeApplyHitClause` early-return. Same fingerprint as MA-1157/MA-1153/MA-1116.

## Live E2E (Playwright, test-campaign, 2026-09-25)
Rig: header verified `test-campaign`. Mimic 1/Bandit 1 not in init → EB search+checkbox (Mimic + Bandit exact, pre-join checked enumerated = none retained) → "Join Encounter" → cs: Mimic 1 monsterIndex "mimic" AC12 HP58 + Bandit 1 monsterIndex "bandit" AC12 HP11 size "Medium or Small". §454 HP rig Bandit 999 (trusted click+Meta+A+type+Enter, cs-confirmed 999) BEFORE §148 arm; arm via Mimic own-card Target select (self-excluding options = attacker's own card §449) → cs.creatures['Mimic 1'].targetName="Bandit 1" server-verified pre-fire (§452).
- **Chip audit:** Pseudopod row = exactly ONE `span.mc-dice-link` "+5"; `.mc-dice-link-save` DC chips **0** ✓. Row carries trailing "()" §445 artifact (cosmetic).
- **Baseline log = 3** (join + ×2 monster initiative).
- **9 fires, log-delta ledger (§442), Done-only via `button.dice-roll-reroll-btn` (§458):**
  - #1 honest MISS nat5(+5)=10 ✗ (popup "✗ MISS (10 vs AC 12)"); #2 nat1 CRITICAL MISS=6 ✗ (§32 record); #3 nat3=8 ✗ — each zero-delta, miss popups Done-less click-to-dismiss.
  - #4 HIT nat18=23 → fd 4 [1d8+3: 1+3] + secFD 2 [1d8: 2] → hp_change Δ−6 (999→993).
  - #5 HIT nat18=23 → fd 5 + secFD 6 → Δ−11 (→982).
  - #6 **CRIT nat20=25 (§32):** damage formula log `"1d8*2+3 (6)"` fd15 + secondary `"1d8"` sR[7] **sT/sFD 14 = 2×7** (§460 silent-double convention) → Δ−29 (982→953).
  - #7 HIT nat10=15 → fd 8 + secFD 5 → Δ−13 (→940).
  - #8 nat2=7 ✗, #9 nat5=10 ✗ honest misses.
  - **Every hit = ONE `roll damage` entry** carrying primary "1d8 + 3" Bludgeoning + secondary* keys same entry (§454); **fd+secFD == |hpΔ| on all 4 hits** (6, 11, 29, 13) ✓.
- **GRAPPLE AXIS: ZERO grant** —
  - Bandit 1 cs record keys unchanged: name,type,monsterType,size,initiative,targetName,ac,resistances,immunities,vulnerabilities,concentration,maxHp,currentHp,saveBonuses,monsterIndex — **activeConditions/activeConditionMeta ABSENT**;
  - whole-log `/grappl/i`: **0** lines; `type:'condition'` applied entries: **0**;
  - whole-store change-data `/grappl/gi` scan excluding `viewingMonster` (§457): **0** hits;
  - DOM outside the open Mimic stat-card description echo: **0** grapple lines — zero badges on Bandit 1 row/card; escape_dc stamp N/A (no grant to stamp).
- Console: 0 errors throughout.

## Likely Location & Fix (`public/data/monsters.json` mimic.actions[1])
Add after `damage_type_secondary` (MA-0930 Grick byte-shape):
**`"hit_conditions": ["grappled"]`** and **`"escape_dc": 13`** — DC 13 per row prose "(escape DC 13)" (NOT MA-1157's 14). Consumer live: stamps activeConditions ["grappled"] + activeConditionMeta.grappled.{source:"Mimic 1", dc:13, ability:"str"} + condition-applied log (handlePlainDamage.js:543+). "Large or smaller" gate: consumer `isLargeOrSmallerTarget` handles "Medium or Small" sizes (MA-0553). Escape-check Disadvantage clause stays GM-adjudicated (no transport).

## Verdict
**FAIL(a)/DATA** — numeric axis byte-exact (one "+5" chip, zero DC chips, "1d8 + 3" Bludgeoning + "1d8" Acid one-entry doubles, crit 1d8*2+3+1d8 doubled secondary, |hpΔ|==fd+secFD ×4) but the row's core Grappled clause never applies: grant fields unauthored + manifest `conditions` unconsumed (§449 codified; MA-1157/MA-1153 twin family). DATA fix, two fields.

## Notes
- Cleanup: Admin-panel Clear Change Data + Clear Campaign Log (confirms accepted, campaign text "test-campaign" verified in dialogs); post-GET proof logCount 0, changeData {} in session transcript.
