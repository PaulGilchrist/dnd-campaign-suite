# MN-009 Goading Attack — Disadvantage also applies vs the goader (exemption not honored on NPC lane)

## Title
Goading Attack (Battle Master) — goadee's attack rolls have Disadvantage against ALL targets, including the goader; "other than you" exemption never engages.

## Overview
E2E in test-campaign with EvasiveFighter (lv18 Battle Master) vs Bandit 1 + Knight 1. The rider offer, superiority-die math, pool spend, WIS save prompt/DC, and `taunting_step` te stamp all work. But after te lands, the goadee's attack roll against the GOADER rolls 2d20 with `mode:"disadvantage"` (should be `normal`); only the vs-other-target leg is correct.

## Expected Behavior (canonical app-data, public/data/2024/maneuvers.json → Goading Attack)
"When you hit a creature with an attack roll, you can expend one Superiority Die to attempt to goad the target into attacking you. Add the Superiority Die to the attack's damage roll. The target must succeed on a Wisdom saving throw or have Disadvantage on attack rolls against targets other than you until the end of your next turn."

## Actual Behavior (machine truth)
- HIT offer live: "Battle Master — Attack Rider Maneuver … Goading Attack— adds superiority die to damage— WIS save".
- Die+damage OK: 1st use round 1 = Relentless free fixed d8=5 added to damage (CLA-286 by design, combatSuperiorityUtils.js:96-102); subsequent real uses expend d12 → Superiority Dice 6/6 → 4/6 (exactly 2 spends); MISS = no offer, no spend (control OK).
- WIS save OK: DC 16 (8 + 2 + 6). saveResult-Bandit 1 {success:false,total:10,mode:"normal"}; saveResult-Knight 1 {success:false,total:1}.
- te stamp OK: {target:"Knight 1", source:"EvasiveFighter", effect:"taunting_step", duration:"until_end_of_user_next_turn"} (runtime te key is `taunting_step`, NOT "goaded" — the mission brief's 'goaded' claim does not exist in code; conditionInflicted:"goaded" in data is inert).
- DIFFERENTIAL BROKEN:
  - Knight 1 (goadee) → EvasiveFighter: roll log {attackerName:"Knight 1", rolls:[8,19], mode:"disadvantage"} — 2d20 vs the GOADER. Expected mode:"normal" (RAW "other than you").
  - Knight 1 → ElderPaladin: {rolls:[4,10], mode:"disadvantage"} — correct half.
  - Popup carried the "Disadv (conditions)" marker on BOTH legs.

## Steps to Reproduce
1. test-campaign, initiative live; EvasiveFighter (maneuvers must be selected first: sheet "Combat Superiority:" → Select Maneuvers → tick Goading Attack → Confirm; 0/9 selected = no rider offer).
2. Arm EF (initiative-card target-select) → Knight 1; Scimitar HIT → prompt → Use Goading Attack → Roll Save → FAIL (stamp te taunting_step).
3. Arm Knight 1's card → EvasiveFighter; Greatsword chip (.mc-dice-link +5) → popup shows Disadv + log mode:"disadvantage" (BUG; must be normal).
4. Re-arm → ElderPaladin; attack → mode:"disadvantage" (correct).

## Likely Location
- Correct gates exist but the NPC attack-roll lane (Knight modal chip roll) does not consume them:
  - src/services/combat/conditions/conditionEffects.js:864 — gate `targetName !== attackerEffects.attacksOtherDisadvantageSource` (PC lane).
  - src/hooks/combat/targetResolution.js:41-55 applySourceGatedDisadvantage — correctly skips when `te.source === target.name`.
  - Monster/NPC chip roll path (MonsterCardModal roll handlers / useLoggedDiceRollAttack NPC lane) applies the te-derived disadvantage unconditionally (or without targetName threading) → grep of the NPC roll path shows no applySourceGatedDisadvantage call.

## Notes
- Runtime te stamped TWICE for Knight 1 (duplicate entries accumulate; also Bandit 1 te persists post-death).
- Bandit 1 died during test (scimitar 6 + goad). Superiority d8 on the Bandit leg = Relentless free-d8 (CLA-286), not a die-size bug; d12 size table itself is live (sheet "Superiority Die: d12").
- Admin cleanup done: change-data cleared ({}), log cleared (one benign post-clear encounter-join entry remains).
