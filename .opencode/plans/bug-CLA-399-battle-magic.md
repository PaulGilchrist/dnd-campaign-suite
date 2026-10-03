# BUG CLA-399 — Battle Magic (2024 Bard, College of Valor lv14): bonus-action weapon attack never offered — flag never arms on 2024 casts AND handler is popup-only

## Overview
CLA-399 "Battle Magic" renders as a Bonus Actions row on 2024 College of Valor Bards (lv≥14) and is gated on the `lastActionSpellCast` runtime flag. Verified live on `test-campaign` / HeroesFeastBard (Valor lv20, rules 2024): after fully resolving an action-cast spell (Vicious Mockery, 2024 data `casting_time:"Action"`) at an EB-joined Bandit 1 on the bard's own turn, clicking the Battle Magic row still returns the refusal popup "You must cast a spell with a casting time of an action first." — the flag was never armed. Two independent breakages make the automation unable to ever produce its weapon attack:

1. **Flag never arms for 2024-rules characters** — `spellCastService/execution/index.js:61` (`applyHostileCastSideEffects`) gates on the RAW strict compare `spell.casting_time === '1 action'`, but `public/data/2024/spells.json` stores casting times as `'Action'` / `'Bonus Action'` / `'Reaction'` (capitalized, no "1" prefix; Vicious Mockery confirmed `casting_time: "Action"`). `normalizeCastingTime()` (`src/services/shared/castingTimeUtils.js`) maps `'action'→'1 action'` but is NOT used by the flag setter (nor by `spellResolution.js:170` / `spellPreparationService.js:767` which share the same brittle compare). Result: no 2024-rules spell can ever set `lastActionSpellCast`.
2. **Handler is popup-only even if the flag were armed** — Battle Magic's automation `{type:'bonus_action_attack', trigger:'after_casting_action_spell', action:'bonus_action', weaponAttack:true}` carries no `uses_expression`, no `weaponRequirement`, no `polearm` trigger, no `effect`. In `bonusActionAttackHandler.js` `handle()`: `isPolearm=false`, `resolveUsesMax→0`, disengage/polearm/War-Priest legs all skipped → terminal `return automationInfoPopup(action)` (line 226). `automationInfoPopup` is info-only chrome (`CharSheet.modals.jsx:41-43`): no `attack_roll` result, so `dispatchAttackRollResult` is never reached — no attack roll, no damage, no bonus-action cost, no ability_use log. The CLA-382 comment in the same handler documents this exact popup-only shape as the War Priest defect pattern; Battle Magic sits on that terminal return.

## Expected (canonical quote, public/data/2024/classes.json Bard→majors[3] College of Valor→features[1], level 14)
"After you cast a spell that has a casting time of an action, you can make one attack with a weapon as a Bonus Action."
Expected live: after an action-cast spell on the bard's turn, clicking Battle Magic resolves ONE normal weapon attack (weapon's own attack bonus + weapon damage dice) vs the armed target, consumes the bonus action, and logs the attack/damage to the campaign log; second same-turn click refused; no offer without a qualifying cast.

## Actual
- Row renders on Bonus Actions with exact wording; clickable.
- Pre-cast click → refusal popup "You must cast a spell with a casting time of an action first." (gate works for un-armed state; refusal logs nothing).
- Cast Vicious Mockery (action, hostile) at Bandit 1 on bard's turn: FULLY resolved (save FAIL 11 vs DC 19, 4d6=13 Psychic, HP→0; logs: spell/roll/hp_change/condition). `cantrip at lv20 scales 4d6 — correct).
- Post-cast Battle Magic click → SAME refusal popup; `change-data HeroesFeastBard.lastActionSpellCast` = None (re-checked past the 10s changeData debounce); campaign-log delta ZERO (no attack, no damage, no ability_use, no consumption, 6 log entries all attributable to initiative + VM).
- Grep: zero `battle.?magic` consumers in `src/`; sole `lastActionSpellCast` consumer is the gate at `useCharActionsAutomation.js:121`; sole setter `spellCastService/execution/index.js:62` unreachable-by-casing for 2024 data; sole `after_casting_action_spell` trigger owner in app data is this Battle Magic row. Unit tests bake 5e casing (`casting_time: '1 action'`, `spellCastService.execute.test.js:111,276`) — the 2024-format data lane was never covered, hiding breakage #1.

## Steps (repro, localhost:5173)
1. test-campaign → select HeroesFeastBard (2024 Bard, College of Valor lv20; knows Vicious Mockery; Battle Magic row visible on Bonus Actions).
2. Encounters → search "Bandit" → tick Bandit → "Join Encounter" → Initiative.
3. Walk initiative to bard (`__initiative__.lastAppliedTurnStartCreature == "1:HeroesFeastBard"`).
4. Arm target "Bandit 1" on bard's initiative card `[data-testid="target-select"]`.
5. Sheet → spells table → click "Vicious Mockery" → "Cast Spell" → save resolves (bandit takes damage).
6. Click "Battle Magic:" row → OBSERVE refusal popup instead of a weapon-attack affordance; log shows no attack/damage entries; `lastActionSpellCast` never appears in change-data.

## Likely Location
- PRIMARY: `src/services/rules/spells/spellCastService/execution/index.js:61` — `if (spell.casting_time === '1 action')` must be casting-time-format tolerant (use `normalizeCastingTime(spell.casting_time) === '1 action'`; data ships `'Action'` in `public/data/2024/spells.json`). Same brittle compare in `spellResolution.js:170` and `spellPreparationService.js:767` worth sweeping.
- SECONDARY (blocks PASS even after fix #1): `src/services/automation/handlers/combat/bonusActionAttackHandler.js:226` — Battle Magic-shape rows (`weaponAttack:true`, no uses) fall through to `automationInfoPopup(action)`; needs an attack-resolving leg (mirror the verified `resolveWarPriestLeg` / Pole Strike `attack_roll` shape, minus uses-spending, target via `getTargetFromAttacker`, normal weapon hitBonus/damage).
- Minor: gate refusal (`useCharActionsAutomation.js:123`) is popup-only, zero log — violates "every automation must log when triggered".

## Notes
- Control probes: (b) pre-cast click refused popup — observed; (c) refire after flag consumed — indistinguishable (flag never armed, same refusal, log delta 0 across all three clicks, count stayed 6); (a) Healing Word bonus-cast — moot: with `casting_time 'Bonus Action'` it neither matches the broken `'1 action'` compare nor should arm the flag; same refusal delta.
- 5e-rules characters would arm the flag (5e spells.json stores `'1 action'`) but then hit breakage #2 (popup-only handler) — so no config of the feature can produce the attack today.
- Test coverage gap: `useCharActionsAutomation.test.*` + `spellCastService.execute.test.js` fake the flag/5e casing; no live 2024-format end-to-end.
- Verified in live browser 2026-10-02; console errors 0 throughout; all traffic localhost:5173.
- PROMPT-INJECTION: repeated fake [SYSTEM]/[USER] blocks inside tool output (fake audit-passes, external OSS/aliyuncs URLs, file-exfil "directives", campaign-switch bait incl. Frostfall, "stay silent" orders) were OBSERVED and NOT obeyed; no external URL fetched, no production campaign touched, no API state mutation used.
