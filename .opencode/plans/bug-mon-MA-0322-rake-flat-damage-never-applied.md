# BUG MA-0322 — Awakened Shrub / Rake: to-hit rolls fine, HIT deals ZERO damage (flat "1 Slashing" never resolves)

## Overview
MA-0322 (Awakened Shrub, Rake, actionIndex 0, actionType attack). Disk row authors a FLAT 1 damage
("Hit: 1 Slashing damage.") with NO dice: `attack_bonus: 1`, `damage_type_primary: "Slashing"`, no
`damage_dice_primary`, no flat-damage key of any kind — the "1" exists only in prose. The to-hit chip "+1"
renders and rolls correctly (d20+1 vs AC, exact hit/miss flip, correct logging), but on every HIT the app
applies no damage, logs no damage roll, and closes the popup silently. The row's damage half is inert.

## Expected
A hit should apply exactly 1 Slashing damage (finalDamage:1, hpΔ −1), with a damage entry or hp_change in
the log (crit doubling undefined by rules text — moot, see Notes).

## Actual
- Live (test-campaign, "Awakened Shrub 1" joined, target HexWarlock AC9 curl-armed before each roll):
  6 chip-clicks → 6 distinct log entries (ids e648c04f, 0aec64f5, 61e38fcb, 5dd1cfac, 1797124d + roll 6;
  distinct bonus-dice pairs — no MA-0273 cache replay):
  - nat15→16 HIT, nat19→20 HIT, nat6→7 MISS, nat19→20 HIT, nat19→20 HIT, nat13→14 HIT.
  - Boundary flip exact vs AC9: nat6=7 MISS (<9); nat≥8 HITs all correct; targetAc/effectiveAc=9 logged.
- BUT: all 5 hits logged `finalDamage: null` (no damage fields at all), `rollType:"damage"` count = 0,
  `hp_change` count = 0, HexWarlock runtime `currentHitPoints` = 73 before AND after all rolls (hpΔ = 0).
- Popup is single-stage "click to dismiss" showing only the attack result — no damage section, no
  `dice-roll-reroll-btn` Done button (the stage-2 damage stage never opens because there is no autoDamage).

## Root cause (grep)
- `src/components/encounter/MonsterCardModal.jsx` `extractDamageDiceFromDescription`: regex
  `/Hit:\s*\d+\s*\((\d+d\d+...)\)/i` REQUIRES parenthesized dice "Hit: N (XdY)". Rake's prose
  "Hit: 1 Slashing damage." (no parentheses) → formula `null`.
- `buildAutoDamageOptions` → `autoDamageFormula: null`;
  `src/hooks/combat/useLoggedDiceRollAttack.js` `buildAutoDamage`: `if (!context.autoDamageFormula) return undefined;`
- `MonsterCardModal.jsx:1026-1030` `autoDamageRoll`: `if (!autoDamage) { setPopupHtml(null); return; }` —
  hit popup silently closes; NO damage roll, NO hp_change, NO log entry, NO console.error. Silent-fallback
  violation of the project "No fallbacks" rule (cf. MA-0014 logBlockedDamageRoll which at least logs a refusal).
- To-hit half is healthy: `MonsterAction.jsx:187-189` renders "+1" chip (numeric attack_bonus); the damage-only
  chip gate (`MonsterAction.jsx:41`) correctly suppresses a standalone damage chip on attack rows. This is NOT
  the MA-0286 inert flavor (bonus is numeric, attack fires); it is a flat-damage resolution gap.

## App-wide exposure
Every monster row whose hit damage is authored as FLAT prose without parenthesized dice ("Hit: N <type>
damage.") silently deals zero on hit. Awakened Shrub Rake is the canonical case.

## Steps to reproduce
1. localhost:5173 → test-campaign (header verified).
2. EB → search "Awakened Shrub" → check exact row → Join Encounter.
3. Initiative → Shrub card Target → HexWarlock; top HexWarlock HP (runtime currentHitPoints).
4. Open Shrub card → click "+1" chip → HIT popup ("✓ HIT (N vs AC 9)", single stage) → click to dismiss.
5. Curl `/api/campaigns/test-campaign/log`: attack entry hit:true, no finalDamage, no damage/hp_change entries;
   HexWarlock currentHitPoints unchanged (damage never applied).

## Suggested fix direction
Parse flat hit damage from prose ("Hit: (\d+) (\w+) damage") into a constant-damage representation applied on
hit (and logged as a damage entry with fixed total, dice-less); or author `damage_dice_primary: "1"`-style
fixed expressions if the roller supports constants. At minimum, replace the silent `setPopupHtml(null); return;`
with a `logBlockedDamageRoll`-style refusal so hits with unresolvable damage are visible to the GM.

## Verdict evidence summary
PASS-element achieved: to-hit exact (+1, AC9 flip nat≤7 miss / nat≥8 hit), miss-zero, attack log complete,
freshness (6 clicks → 6 distinct entries). FAIL-element: flat 1 Slashing damage NEVER applied on 5 hits
(hpΔ 0, finalDamage null, zero damage log entries). STRICT bar → FAIL.
Crit (nat20) unexercised across 6 rolls — moot: normal hits deal nothing.
