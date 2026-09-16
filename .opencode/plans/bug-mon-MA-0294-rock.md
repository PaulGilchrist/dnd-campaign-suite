# BUG MA-0294 — Ape · Rock (Recharge 6): recharge gate DEAD on attack rows

**VERDICT: FAIL** (2026-09-16, test-campaign, :5173, header verified)

## Symptom
Rock (Recharge 6) is an ATTACK row (actionType attack, attack_bonus 5, no save_dc, recharge "6").
Two consecutive chip clicks in the same turn BOTH resolved full attacks. No refusal popup,
no `rock_refused` log, and runtime `monsterRecharge` was never created (top-level change-data
`monsterRecharge: null`; `Ape 1` store has zero recharge keys) — before OR after spend attempt.
Recovery d6 at ape turn-start: zero `recharge`/`recharge_failed` logs (nothing ever spent,
subsystem never engaged).

## Live evidence (curl GET log + change-data)
- Hit 1: attack roll d20 [14] +5 = 19 vs AC 9 HIT; damage 2d6+3 rolls [1,3]+3=7, finalDamage 7, hpΔ −7 (140→133) ts-paired ✓ (math correct)
- Hit 2 (immediate 2nd click): attack d20 [10]+5=15 vs AC 9 HIT; damage 2d6+3 [1,6]+3=10, finalDamage 10, hpΔ −10 (133→123) — should have been REFUSED
- `refused` entries in log since run start: 0
- Ape 1 turn-start reached via 3× "Next →" (activeCreatureName=Ape 1 polled): no recharge recovery log
- Control: Fist chip stayed live (d20 9→14 HIT, 6 dmg, 123→117) — non-interference moot since Rock was never gated

## Root cause (code)
- Recharge gate + spend exist ONLY in the block-save path: `executeBlockSaveRoll` calls
  `rechargeRefusalOnSpent` (MonsterCardModal.jsx:199) and `spendMonsterRecharge` (:238).
- Attack chip click routes `onAttack` → `handleAttack` (MonsterCardModal.jsx:1065) with NO
  recharge gate/spend call anywhere in the chain.
- `MonsterAction.jsx` attack chip (:178) renders ungated: `rechargeOut` is computed (:167)
  but consumed only by `ActionSaveRoll` (:78) and `RechargeNote` — never the attack span.
- Fix template: gate+spend at top of handleAttack for `action.attack_bonus != null &&
  monsterRechargeGate(action, ...)` rows (refusal popup/log reuse buildRechargeRefusalPopup/Log),
  plus spent styling on the attack chip.

## Scope
All monsters with `recharge` on ATTACK-roll rows (Ape Rock; check manifest family).
Save-row recharge remains enforced (MA-0100/0225/0289 family unaffected).

## Revive seam note (priority-zero)
Wild_Sage_Druid revived 0→140: `fill('140\n')` on initiative-card HP spinbutton did NOT persist
(reproduces MA-0293 pitfall — value landed in DOM, server stayed 0). Working seam: flush
`.dsp-overlay` death-save modal via background `el.click()` (handleNext dismiss), flush stale
`.mc-overlay` via `.mc-close`, click Druid card, `fill('140')`, then explicit Enter keypress →
curl verified currentHitPoints=140. NEW pitfall: explicit trusted Enter AFTER fill required;
embedded "\n" in fill string submits nothing here.
