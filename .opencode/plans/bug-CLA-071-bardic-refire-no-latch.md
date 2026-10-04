# CLA-071 Defect — Cutting Words re-fires unlimited on one resolved attack (no Reaction latch)

**Verdict:** PASS-subset — first spend math exact; defect is duplicate spend on re-click.
**Date:** 2026-10-04 · **Host:** HeroesFeastBard (College of Lore, lv20, 2024) · **Campaign:** test-campaign

## Canonical (public/data/2024/classes.json, Bard → majors → College of Lore, level 3)

> "When a creature that you can see within 60 feet of yourself makes a damage roll or succeeds on an ability check or attack roll, you can take a Reaction to expend one use of your Bardic Inspiration; roll your Bardic Inspiration die, and subtract the number rolled from the creature's roll."

RAW gates violated by re-fire: (a) it is **a Reaction** — once per round; (b) one trigger roll can only be subtracted from **once**.

## Observed (live E2E, 2026-10-04)

Bandit 1 → HeroesFeastBard, Scimitar d20 19+3=22 vs AC 13 HIT, damage 1d6+1 = 7 (HP 163→156).

1. Cutting Words click #1: BI 5→4, log `ability_use` "Bardic Inspiration die: 1d12 = 6 … Original damage: 7 … Reduced damage: 1 … Healed … 6 HP" (HP→162). CORRECT.
2. Cutting Words click #2 (same resolved attack, same window, popup dismissed via Done): **accepted** — BI 4→3, rolled 1d12 = 6 again, healed 6 again (HP→163 capped). Cumulative subtraction 12 > single d12 max 6, cumulative heal 12 vs damage 7 → net −5 damage. No refusal.
3. Repeat clicks keep accepting until uses hit 0; refusal only then ("Cutting Words has no uses remaining. Recharges on a Long Rest." — correct, zero spend).

## Root cause

`src/services/automation/handlers/reactions/reactionDebuffHandler.js` — `handleBardicRoll` (:560) is the `DEFAULT_EFFECT_ROUTE` (:659). Unlike the CLA-383 `handleWardingFlare` (:483) which latches `_<Feature>_usedRound` (:514-517) and produces a te consumed by the *next* roll, and unlike CLA-041 `handleTeleportAndSlow` (:265-268), the bardic post-roll-rollback route has **no once-per-round latch and no "attack already debuffed" marker**. `findLastAttack` keeps returning the same resolved attack (log totalDamage unchanged by the rollback heal), so each click re-spends a use and re-heals the full die amount.

## Fix suggestion

Adopt the CLA-383 latch shape in `handleBardicRoll`: stamp `_<Feature>_usedRound` (awaited before response) against `combatSummary.round`, refuse with zero-spend when already latched this round; additionally/alternatively mark the debuffed attack (e.g. `lastAttack.cuttingWordsApplied = true` or a per-attack marker) so the same attack event cannot be subtracted twice. Re-arm via existing `PLAYER_ROUND_LATCH_KEYS` / Initiative clear.

## Secondary observation (same session)

Each rollback heal also logs `[setRuntimeValue] called with undefined campaignName` (characterKey HeroesFeastBard, currentHitPoints) → `POST /api/campaigns/undefined/HeroesFeastBard` → 400. Root cause: `applyHealingToTarget(combatSummary, targetName, healAmount, campaignName)` (applyHealing.js:8) is called with only **3 args** by reactionDebuffHandler (:104 damage path, :27 reverseHitDamage), so `campaignName` is undefined. HP still lands via the primary write path (hp_change + SSE), so benign, but the 4th arg should be passed.

## Unaffected (verified correct)

- First-instance damage-path math: reducedDamage = max(0, orig − die), heal rollback exact (`handleDamageDebuff` :98-106).
- BI spend −1 (`spendUse` :411) and `ability_use` log tail (:699).
- Zero-uses refusal (:675-677), Long Rest re-arm (key nulled → `currentUsesFor` :407-409 fallback to `_trackedResources.bardicInspirationUses.max`; sheet shows 5/5; spend then re-tracks 5→4).
- 60 ft range gate inert without positioned map tokens (`bardicRangeRefusal` :550 — gap, GM-enforced; also called with 2 args vs 3-arg signature `resolveMapPositions(campaignName, mapName, attackerName)`).
