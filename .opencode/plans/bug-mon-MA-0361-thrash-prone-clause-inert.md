# Bug — MA-0361: Barlgura "Thrash" Prone clause inert (prose-only, never lands)

Verdict: **FAIL** (MA-0288/0320/0354 class — advertised, keys absent, never lands)
Date: 2026-09-17 | Campaign: test-campaign (header verified throughout; native confirms echoed `test-campaign`)

## Row
- MA-0361 | Barlgura (monsterIndex `barlgura`) | actions[2] `Thrash` | attack
- +7 to hit | 1d10 + 4 Bludgeoning | reach 5 ft | advertised condition: `prone` + prose "If the target is a Large or smaller creature, it has the Prone condition."

## Evidence (runtime, localhost:5173, target ElderPaladin AC 19, Medium, HP 224 top)
Target armed via initiative Target combobox; `combatSummary` Barlgura 1 `targetName: "ElderPaladin"` confirmed by curl.

Fired Thrash "+7" own chip ×3 (popup cycles full, §290-292):
1. d20 16 (+7) = 23 vs AC 19 → **HIT** → damage popup `1d10 + 4: 6 +4` = **10** exact → HP 224 → 214 (log `hp_change -10`)
2. d20 15 (+7) = 22 vs AC 19 → **HIT** → damage popup `1d10 + 4: 8 +4` = **12** exact → HP 214 → 202 (log `hp_change -12`)
3. d20 7 (+7) = 14 vs AC 19 → **MISS** (nat ≤11 window, cited MA-0359; hit nat ≥12 — both hits consistent)

Attack totals distinct: 16 / 15 / 7 (nat dice).

## Post-hit probe (curl /api/campaigns/test-campaign/change-data — truth)
After 2 confirmed hits on ElderPaladin (Medium, Large-or-smaller satisfied):
- `ElderPaladin.activeConditions`: **null**
- `ElderPaladin.activeConditionMeta`: **null**
- `ElderPaladin.escape_dc` / `escapeDc`: **null**
- No prone-related keys anywhere on ElderPaladin payload.
- Only occurrence of "prone" in entire change-data: `/combat-ui-viewingMonster/actions[2]/description` — prose cache, zero state.
- `lastAttack` (miss) carries `attackName: "Thrash"`, `damageFormula: "1d10 + 4"`, `targetAc: 19` — attack pipeline correct; condition clause absent.

## Disk keys dump — monsters.json actions[2] (READ only, not edited)
Keys: `name`, `description`, `attack_bonus`, `reach`, `damage_dice_primary`, `damage_type_primary`.
**Absent:** `hit_conditions`, `escape_dc`, `conditions` (structured). Prone exists solely as `<strong>Prone</strong>` prose in `description`.

## Grep — prone consumers on attack-hit path
- `src/components/encounter/MonsterCardHelpers.js:382` `buildHitConditionClause` — returns clause ONLY if `action.hit_conditions` non-empty array (or `hit_target_effect`); line 385 `if (conditions.length === 0 && !targetEffect) return null;`. Barlgura Thrash → **null clause**. (MA-0302 seam rule re-confirmed verbatim.)
- `src/hooks/combat/handlers/handlePlainDamage.js:475` `maybeApplyRamProne` / `:201` `applyRamProneCondition` — ram-specific only; Thrash is not a ram.
- `handlePlainDamage.js:482` MA-0010 hit_conditions seam — gated on the null clause from above → never invoked.

## Log audit (pre-cleanup, 9 entries)
encounter joined → initiative → attack Thrash [16]+7 HIT → damage `1d10 + 4` [6]=10 → hp_change −10 → attack Thrash [15]+7 HIT → damage [8]=12 → hp_change −12 → attack Thrash [7]+7 MISS. All combat events logged; **zero condition/prone entries**.

## Conclusion
Damage pipeline exact and fully logged; hit/miss math matches +7 vs AC 19 window. Prone is advertised in action text but monsters.json lacks `hit_conditions`+`escape_dc`, so `buildHitConditionClause` (MonsterCardHelpers.js:382) yields null and no runtime consumer can ever apply Prone on a Thrash hit. Same inert class as MV-9/MA-0354, MA-0288/0320, and MA-0359 (same monster/action, same day).

## Fix surface (not applied — no edits to monsters.json/manifest/docs per task rules)
Add structured `hit_conditions: ["prone"]` to Barlgura Thrash in monsters.json (no escape_dc needed for auto-prone; needs raw-prone support in the MA-0010 clause path — confirm clause builder handles empty escapeDc).

## Cleanup verified
Admin native confirms (test-campaign) for Clear Change Data + Clear Campaign Log; curl read-back: change-data `{}`, log `[]`.
