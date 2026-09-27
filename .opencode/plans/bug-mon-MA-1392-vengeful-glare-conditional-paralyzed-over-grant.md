# BUG MA-1392 — Revenant "Vengeful Glare": conditional Paralyzed (+ Cursed) over-granted on EVERY failed save

- **Row:** revenant|actions|2 — Vengeful Glare, Wisdom save DC 15, one creature within 30 ft (prose), zero damage (pure save).
- **Verdict:** FAIL(a) — OVER-GRANT (§MA-1351 deep-clause word-scan family, aggravated to a triple-spray).
- **Date/session:** 2026-09-27, localhost:5173, test-campaign, board Revenant 1 (idx0, mIdx revenant, AC13) + Bandit 1 (idx1, mIdx bandit, AC12, HP999 full-store cs POST all four keys).

## RAW
Save_effect: "The target has the Frightened condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. **If the Frightened target is cursed by the revenant (see Vow of Revenge), the target also has the Paralyzed condition for the duration.**"
Paralyzed is a CONDITIONAL rider gated on a precondition: cursed BY THIS REVENANT (Vow of Revenge). A plain failed save against an uncursed target grants Frightened ONLY.

## Defect
`extractConditionsFromSaveEffect` (src/components/encounter/MonsterCardHelpers.js:341) is a naive `\bword\b` scan over the WHOLE save_effect string; CONDITIONS (:52) includes `cursed`, `frightened`, AND `paralyzed`. The row feeds it directly: MonsterCardModal.jsx:581 (inline save lane) / :1013 / :2220 / MonsterAction.jsx:122 → `saveConditions = ['cursed','frightened','paralyzed']`. `applyFailedSaveConditions` (saveProcessing.js:1043; handleNpcSaveDamage.js:223) grants ALL saveConditions unconditionally on fail. NO consumer anywhere gates on the "if cursed by the revenant" precondition (grep `if cursed|cursed.*paral|precondition` in the save lane = ZERO; `vow` hits = PC barbarian vow_of_enmity only — Revenant's Vow of Revenge has ZERO consumer AND is not even in this file's actions[] [Multiattack/Slam/Vengeful Glare], so the cursed precondition is unproducible in-game). No te registered for cursed/paralyzed-if-cursed (only paralyzing_staged :440). No `save_margin` on the row (that machinery gates by margin, not by cursed-precondition anyway).

## Live evidence
- FAIL leg 1 (§212 rig `saving_throws.wis:{modifier:-5}` full cs POST): victim `roll save "Vengeful Glare"` cn Bandit 1 dc:15 st:Wisdom sr:failure total:3 (nat8−5) ✗DC15 → `condition applied` **"Cursed, Frightened, Paralyzed"** src Revenant 1 ab Vengeful Glare; victim change-data `activeConditions:["cursed","frightened","paralyzed"]`, meta `{cursed,frightened,paralyzed}` each `{source:'Revenant 1'}`. Target was NOT cursed — RAW-correct grant set = `["frightened"]` only.
- SUCCESS leg (+19 flip): nat1+19=20 ✓ dc:15 Wisdom stamped → ZERO condition entries, victim keys stay empty (§565/§1116) — success lane honest.
- FAIL leg 2 (cleared victim, −5 refire): identical spray reproduced 2/2 — deterministic, not incidental.
- Purity axes honest: 0 damage entries / 0 hp_change whole session (pure save, zero-damage-on-success ✓); DC 15 + Wisdom stamped on every victim save entry ✓; lastAttack {saveDc:15, saveType:'Wisdom', saveResult:'failure'} ✓; zero save-margin entries (no rider mechanism misfire); junk "+0" chip (attack_bonus:0 §445) never pressed; console 0 errors.
- Advisory axes (§70/§866 MA-1370 twin): repeat-save-at-turn-end, 1-min auto-success, and cursed→paralyzed conditional = zero parser/consumer, GM-enforced — BUT the conditional clause is NOT honestly inert: the word-scan actively over-grants its tail conditions. Advisory is only acceptable when zero grants land (§206 rule); here grants DO land and are wrong → FAIL(a), not advisory.

## Fix
1. **DATA (immediate):** truncate save_effect at the conditional clause: "The target has the Frightened condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically." (description keeps full prose; §52 word-scan reads save_effect only). Frightened-only fail grant becomes exact; repeat-save/1-min clock = §70 advisory per MA-1370.
2. **Mechanism ticket (separate):** cursed-precondition riders need structured transport (e.g. `conditional_conditions:{if:{condition:"cursed",by_attacker:true},also:["paralyzed"]}`) + gated consumer + a revenant Vow-of-Revenge `cursed` producer (absent from this file's actions[] entirely). Do NOT leave the raw "cursed…Paralyzed" prose in save_effect — it sprays.

## Regression pin
`extractConditionsFromSaveEffect(save_effect)` must return `['frightened']` for the fixed row; fail-leg victim activeConditions == ['frightened']; zero cursed/paralyzed grants on uncursed victim.
