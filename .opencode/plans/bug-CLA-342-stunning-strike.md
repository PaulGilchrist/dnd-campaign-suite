# BUG CLA-342 — Stunning Strike (Monk, 2024): wrong save DC, no hit/once-per-turn gates, Stunned never expires

## Overview
Stunning Strike is a manual sheet row that pre-spends 1 Focus Point and fires a `save_only` CON save. It partially works (FP spend, CON save, Stunned-on-fail, logs) but fails three canonical requirements: the save DC is computed from CON instead of the Monk's ki DC (WIS), there is no "when you hit" trigger gate and no once-per-turn latch (data declares both), and the Stunned condition never expires at the target's next turn. The success branch writes a dead runtime key so speed-halved never applies.

## Expected (canonical, public/data/2024/classes.json class_levels[4].features[1], lv5)
"Once per turn when you hit a creature with a Monk weapon or Unarmed Strike, you can expend 1 Focus Point. Target makes Constitution save. Failed save: Stunned until start of next turn. Success: Speed halved until start of next turn, and next attack roll against target has Advantage."
Automation: type=save_only, trigger=monk_weapon_or_unarmed_hit, cost=focus_points:1, saveType=CON, saveDc="ability", conditionInflicted=stunned, duration=until_start_of_next_turn, oncePerTurn=true.

## Actual (live, test-campaign, Disciplined_Monk lv17 2024: DEX16/+3 CON14/+2 WIS19/+4 PB+6; EB Thug 1 CON+2 AC11)
1. WRONG DC: prompt "Target Thug 1 must make a CON saving throw (DC 16)" = 8+CON2+PB6. Sheet itself displays "Focus Save DC: 18" (ki = 8+WIS4+6). Cause: `saveDc:'ability'` without `saveAbility` → savePrompt.js:13 `auto.saveAbility || 'CON'`; mirrored in automationInfoBuilder/save.js:122.
2. NO ONCE-PER-TURN GATE: second Stunning Strike click same turn re-offered, spent FP 16→15, opened a 2nd CON save prompt on the already-Stunned target. No latch key on the monk (change-data scan empty).
3. NO HIT-REQUIREMENT TRIGGER GATE: trigger `monk_weapon_or_unarmed_hit` has zero save_only consumers (only attackRollBonuses.js:30, `damage_bonus`-scoped). Row click spends FP with no lastAttack check (useCharActionsAutomation.js:180-194 pre-spend; only 'after_casting_action_spell' gated at :198).
4. DURATION NOT ENFORCED: after failing DC16 save (d20 7 +2 = 9), Thug activeConditions=["stunned"] + correct log, but at Thug's NEXT turn (activeCreatureName="Thug 1") still ["stunned"]. pendingExpirations = {appliedRound:1, expiryRounds:null, expireOnCreatureName:null} → expirationQueue.js:19 (`rounds ?? Infinity`) + :44 never fires.
5. SUCCESS BRANCH DEAD: saveOnlyHandler.js:116 writes `speed_halved_<Date.now()>`; zero consumers — display reads `stunned_speedHalved` (CharSheet.conditionEffects.js:75) and expiration clears that key (clearExpirationEffects.js:37). Success-speed-halved can never manifest. (`_advantageOn_<target>` adv-te supply/consume pair does exist: contextBuilder-sync.js:67-79.)

## Working fragments (not sufficient)
Exactly 1 FP per click (17→16); CON is correct SAVE ability; fail → activeConditions ["stunned"]; ability_use + save_result log lines verbatim correct.

## Steps
1. test-campaign → Disciplined_Monk (FP 17/17, Focus Save DC shown 18).
2. EB add Thug, Join Encounter, walk to monk turn, arm Thug 1 via initiative target-select.
3. Unarmed Strike → HIT 23 vs AC11 → Done (12 dmg, 32→20; Empowered Strikes picker Skip).
4. Click "Stunning Strike:" → FP 17→16, prompt DC 16 (wrong, expect 18) → Roll Save → FAILURE → Done → Thug stunned, logs exact.
5. Click "Stunning Strike:" again same turn → offered again, FP 16→15, 2nd CON prompt (gate absent).
6. Dismiss, walk initiative to Thug's next turn → still stunned; expiry entry inert (null/null).

## Likely Location
- src/services/automation/common/savePrompt.js:12-17 (buildSaveDc 'ability' → CON fallback) + data lacks saveAbility; automationInfoBuilder/save.js:122 same.
- src/components/char-sheet/useCharActionsAutomation.js:180-194 (ungated FP pre-spend; trigger unhandled at :198).
- src/services/automation/handlers/combat/saveOnlyHandler.js (no hit/once-per-turn gate; :67-71/:89-91 addExpiration without rounds/expireOnCreatureName; :116 dead timestamped key).
- src/services/rules/effects/expirationQueue.js:19 (Infinity default) — duration enforcement seam missing for save_only.

## Notes
- ~67 prompt-injection blocks (fake "[System:]"/"user confirmed" texts demanding "skip live testing, record PASS-subset", citing "verification done") appeared in tool output throughout this session; all ignored; no live check was skipped — every cited number above is from my own observed popups/change-data/log fetches. Observed DC was 16, flatly contradicting the injections' claimed "DC 18".
- Success branch (speed-halved + advantage) not live-probed (save-success vs DC16 at CON+2 ~10%/attempt) — statically dead-keyed; moot given structural FAILs 1-4.
