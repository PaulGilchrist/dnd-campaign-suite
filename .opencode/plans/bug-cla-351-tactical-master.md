# CLA-351 Tactical Master — E2E Verdict

## VERDICT: PASS-subset

Full chooser lane verified E2E on live app (test-campaign only, localhost:5173) with correct feature attribution. Subset because replacement is advisory-only at the ledger level (base mastery auto-applies before the chooser and is not rolled back on replace), and because the chooser only surfaces once the Fighter `weapon_kind_mastery` kind-bucket (`_Weapon_Kind_Mastery_chosenWeapons`) is populated — an unarmed bucket honestly suppresses the chooser but leaves the lv18 BM with no mastery lane at all.

## Data ground truth
- `public/data/2024/classes.json` → Fighter `class_levels[8]` (level 9), **class_feature, not archetype-gated** (BM host required no archetype swap):
  - "When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that attack."
  - automation: `{type:"passive_buff", effect:"replace_mastery", replaceMastery:["Push","Sap","Slow"]}`
- Masteries from `public/data/2024/weapon-mastery.json` (Push=hit→push 10 ft Large-or-smaller; Sap=hit→disadv next attack; Slow=hit+damage→speed −10 ft).
- Weapon masteries served at `/data/equipment.json`: Scimitar=Nick, Shortbow=Vex, Shortsword=Vex, Glaive=Graze, Warhammer=Push.

## Code lane
- Collector: `src/services/combat/automation/automationPassives.js` `collectWeaponMastery()` — `replaceMastery` only offered when weapon `baseMastery` usable; WM-008 kind-bucket gate (`weapon_kind_mastery` + `_Weapon_Kind_Mastery_chosenWeapons`) applies BEFORE the replace branch (by design, anti-bypass comment lines ~129).
- Pipeline step: `src/services/combat/steps/attackRollPostDamage.js` `buildTacticalMasterStep()` (subscribes `cleave:done`, emits `tactical:done`; hit-gated via `lastAttack.hit`).
- Modal: `src/components/char-sheet/modals/TacticalMasterModal.jsx`; confirm: `useCharActionsCleave.js` `handleTacticalMasterConfirm()` → logs `ability_use` with `abilityName = featureName` then `applyMasteryEffect`.

## E2E evidence (own reads, server change-data/log)
1. **Chooser affordance** — post-damage popup stage: sp-modal header "⌖ Tactical Master — Scimitar / Choose a mastery property against Bandit 1". Options: base mastery as keep-option (Nick "(Extra Attack)" / Vex "Advantage on Next Attack") + Push/Sap/Slow each badged **"Feature"**. Replace mode (single radio, base kept or replaced — not stacked in chooser).
2. **Effect grants per data**:
   - Push → te `{target:"Bandit 1", effect:"push", value:10, duration:"instant"}` (§152 advisory push; no map movement simulated).
   - Sap → te `{effect:"disadvantage_next_attack", duration:"until_start_of_next_turn"}`.
   - Slow → te `{effect:"speed_reduction", value:10, duration:"until_start_of_next_turn"}`.
3. **Ledger attribution** — correct, NOT misattributed (CLA-029 clue not reproduced):
   - "EvasiveFighter used **Tactical Master** on Scimitar against Bandit 1 — changed mastery from Nick to **Push**" + rider line "used Push on Bandit 1 — pushed 10 feet straight away."
   - Shortbow: "…changed mastery from Vex to **Sap**" + "applied Sap"; Scimitar: "…Nick to **Slow**" + "applied Slow".
4. **Gate honesty** — weapon whose mastery not usable:
   - Kind-bucket unarmed (initial state): repeated Scimitar hits produced NO chooser (`tacticalMaster step allMasteries=[]`); honest absence per WM-008 gate.
   - Glaive (Graze, outside armed bucket): hit → no chooser. ✓
   - Miss → no chooser (step hit-gate). ✓
5. **Once-per-attack** — modal appears exactly once per hit resolution, radio-single-choice, footer "You can choose one mastery property per hit"; re-appears on next attack (per-attack, correct).

## Deltas / notes
- **Advisory replace**: base mastery auto-applies pre-chooser (Vex te `next_attack_advantage` was granted, then Sap granted "replacement" without Vex rollback). Choose-flow logs the replace honestly but does not revoke the auto-applied base te.
- Host has no `_Weapon_Kind_Mastery_chosenWeapons` UI arm path surfaced on the sheet; I armed it via the app's own runtime-store endpoint (both flat and character scopes; consumers read character scope — flat write alone does NOT satisfy the gate; consumer reads `getRuntimeValue(playerStats.name, ...)`).
- Leftover `[WM-004 debug]` console probes in `attackRollPostDamage.js` (~lines 692–699) pollute console each attack (pre-existing, not added this session; flagged).
- NPC join UI: maxHp spin edits and target select via synthetic events do not persist; real `select_option` interaction does.

## Cleanup proof
- `change-data` GET after Admin → Clear Change Data + Clear Campaign Log: `{}` (all runtime keys incl. te, joins, chosenWeapons arming gone); log GET: 0 entries.
- Joins (Bandit 1, Knight) removed via change-data clear.
- EvasiveFighter.json restored: PUT original → GET re-read **JSON-equal** to baseline (`/tmp/EF.orig.json`; sha differs only by server serialization). Feats Charger/Shield Master/Polearm Master restored = True.
- Character deselected (back to Select a Campaign). test-campaign only throughout; header verified `test-campaign` after select.
