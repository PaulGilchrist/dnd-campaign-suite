# CLA-016 Assassinate — first-round Sneak extra damage (= Rogue level) never applied

## Title
Assassinate `damage_bonus` (first_round_sneak_attack_hit, rogue_level) is inert: extra damage equal to Rogue level is never added to sneak hits.

## Overview
Rogue lv20 Assassin (test-campaign AasimarTest, 2024 rules). Two of three Assassinate clauses verified live (initiative advantage; first-round advantage on attacks vs creatures that haven't taken a turn). The third clause — "If Sneak Attack hits any target during that round, target takes extra damage equal to your Rogue level" — silently never adds anything. Sneak hit totals were 20 short of expected with zero feedback (no console error, no popup term).

## Expected (canonical, app 2024 data `public/data/2024/classes.json` Assassin lv3 row)
- Initiative: Advantage on Initiative rolls. ✔ verified
- Surprising Strikes: first round, advantage on attacks vs creature that hasn't taken a turn. ✔ verified
- Sneak hit in round 1 → extra damage equal to Rogue level (+20 at lv20), damageType "Sneak Attack", per automation entry `{type:"damage_bonus", trigger:"first_round_sneak_attack_hit", damageExpression:"rogue_level"}`.

## Actual
Round-1 sneak hit vs Bandit 1 (initiative 6, hadn't acted; Rogue init 19):
- attack: `rolls:[10,14] mode:advantage → HIT 22 vs AC 12`
- damage formula: `1d6+2 [piercing] + 10d6 [Sneak Attack]` total **45** — no `+ 20 [Sneak Attack]` term.
Round-1 vs Ogre 1 (idx 1, init 12): second sneak hit same turn was latched off (once/turn, correct), later round-2 sneak hit formula again `1d6+2 [piercing] + 10d6 [Sneak Attack]` (41) — bonus term never present in any roll.
- 0 console errors — failure is silent.
- Live in-page probe: `import('/src/services/dice/diceRoller.js').rollExpression('rogue_level')` → **null** (while `'2d6+5'` rolls fine).

## Steps
1. test-campaign, lv20 Rogue Assassin 2024 rules (e.g. AasimarTest via wizard step-7 subclass swap).
2. EB-join a low-initiative monster (Bandit/Ogre), arm target via own initiative-card target-select.
3. Roll initiative from sheet (advantage confirmed); attack in round 1, forgo Cunning Strike (Cancel).
4. Inspect damage formula/log: sneak dice present, rogue-level bonus absent.

## Likely Location
- `src/services/combat/steps/features/assassinate.js:19` — `rollExpression(a.damageExpression)` receives the **raw token `'rogue_level'`** which `diceRoller.parseExpression` cannot parse → returns null → handler returns null → featureRiders silently skips. Compare `attackRollBonuses.js:83` which correctly pre-resolves via `resolveDiceExpression(...)` (`automationExpressions.js` token table maps `/rogue_level/gi → level`).
- Secondary (would surface once fixed): the step's handler never checks that Sneak Attack actually applied to this attack (only `round===1` + `!hasActed`), and there is no once-per-round latch — sneak attacks vs multiple targets could each stack +level.

## Notes
- Routing is fine: `damage_bonus` (trigger `first_round_sneak_attack_hit`) lands in `automation.actions` (`automationRouter.js:187 routeSaveStyle`), and the `featureRiders` step (subscribed `celestial:applied`) does execute — the fix is a one-line token resolution: `rollExpression(resolveDiceExpression(a.damageExpression, ctx.playerStats))`.
- Death Strike (lv17) did surface its CON DC16 prompt after the round-1 sneak hit (out of scope here; note the prompt was Dismissed, Bandit died to sneak anyway).
- App models "hasn't taken a turn" as initiative-ARRAY index order (`conditionEffectsInternal.js:93 targetActsAfterAttacker`), not `hasActed`; round≠1 gate works (round-2 attacks rolled `d20 12` normal, no Adv chip).
- No edition misattribution: expected text matches the app's 2024 Assassin row verbatim (the 5e `/data/classes.json` row carries 2014 prose with the same 2024-style automation array — informational only).
