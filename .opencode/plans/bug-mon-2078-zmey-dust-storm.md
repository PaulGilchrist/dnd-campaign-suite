# MA-2078 — Zmey Gorynych: Dust Storm (legendary) — Blinded condition never lands on failed save

## Overview
Legendary save row "Dust Storm" adjudicates its save and damage exactly, but the
promised **Blinded** condition is inert: no condition grant log, no `activeConditions`
/`targetEffects` entry on the victim, no badge. The row authors only
`conditions:["blinded"]` and NO `save_effect` — the save lane word-scans `save_effect`
ONLY (MA-1982: extractConditionsFromSaveEffect, MonsterCardHelpers:383 → zero
description fallback; applyDamagelessSaveConditions early-return saveProcessing.js:1232).
Twin family: MA-1997 (Smaug Frightful Presence), MA-2013 (Wukong Locking Word),
MA-2045 (Typhon Earthquake). Manifest `conditions` is generator-derived metadata with
zero runtime consumers on this lane.

## Expected (row verbatim)
> "Strength Saving Throw: DC 23, each creature within 40 ft. Failure: Blinded until the
> end of its next turn; takes 7 (2d6) Bludgeoning damage."

monsters.json `legendary_actions[2]`: save_dc 23, save_type Strength,
damage_dice_primary "2d6", damage_type_primary Bludgeoning, conditions:["blinded"],
NO save_effect, dc_success unset (engine half-default).
Failure face must: roll 2d6 Bludgeoning full AND grant **Blinded** (log + activeConditions + badge).

## Actual (live, test-campaign round 6, post-own-turn-regain fresh boundary)
- Census: row renders `2d6` + `DC 23 Strength` chips; Expend self-suppressed (§507) ✓.
- Press #1: FALSE own-turn refusal (frozen cs.activeCreatureName mirror; honest zero-spend).
  MA-1852 full-store /combatSummary unstick → immediate re-press.
- Press #2 LIVE inline (picker correctly NOT opened — "within 40 ft" no shape noun, MA-2041 pin):
  expend 1 (monsterLegendaryUses used 0→1, honest log); Bandit 1 save roll
  **d20 17 + 0 vs DC 23 = failure** (raw Str mod 0, DC≥22 deterministic fail face ✓);
  damage **2d6: 4,2 → Σ=6, finalDamage 6, Bludgeoning, hp_change −6 (320→314)** —
  len-2, fd==Σ==|hpΔ| ✓.
- Blinded axis: **ZERO** — Bandit cd has no activeConditions/targetEffects keys,
  zero "blinded" entries in entire campaign log, no DOM badge.

## Steps to Reproduce
1. test-campaign :5173, Initiative board with Zmey Gorynych 1 + Bandit 1 (EB join).
2. Walk to a post-Zmey-turn boundary (legendary regain, used→0); unstick
   activeCreatureName mirror if frozen (POST /combatSummary {value:{...cs}}).
3. Arm Zmey own-card `[data-testid="target-select"]` = Bandit 1; open `.mc-overlay`;
   tap `DC 23 Strength` chip in Dust Storm row.
4. Observe save-failure + 2d6 Bludgeoning applied — but no Blinded grant anywhere.

## Likely Location
**monsters.json data drift** (one-field fix), NOT engine:
`public/data/monsters.json` → zmey-gorynych → legendary_actions[2] add
`save_effect: "The target has the Blinded condition."` (+ optional escape/duration note
— row prose "until the end of its next turn"; canonical-condition grants are
GM-enforced residual per MA-1584/§37). Keep `dc_success` unset (half default ✓).
Consumers live and correct: saveProcessing.js:1232 lane, MonsterCardHelpers:383 extractor.

## Notes
- Inline lane ignores stamped saveBonuses (§211/MA-2041) — half-face live-unreachable
  there; orthogonal, does not widen bug scope.
- Refusal popup on press #1 said "(own-turn)" from frozen mirror; spend ledger honest
  (zero roll). Judge boundaries by log + lastAppliedTurnStartCreature, never mirror.
