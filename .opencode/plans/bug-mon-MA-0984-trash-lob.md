# MA-0984 — Hill Giant "Trash Lob" — VERIFIED: FAIL(a)

Date: 2026-09-23 · Campaign: test-campaign · Rig: :5173 REUSE (curl 200), header byte "test-campaign" verified; Hill Giant 1 (cs hp 105/105) + Bandit 1 AC12 armed own-card (selectOption, val "Bandit 1").

## Expected (row, disk public/data/monsters.json Hill Giant actions[2], quoted)
description: "Ranged Attack Roll: +8, range 60/240 ft. <strong>Hit:</strong> 16 (2d10 + 5) Bludgeoning damage, and the target has the <strong>Poisoned</strong> condition until the end of its next turn."
Row authors `attack_bonus:8`, `damage_dice_primary:"2d10 + 5"`, `range:"60/240 ft."`, and **`save_effect:"The target has the Poisoned condition until the end of its next turn."`** with **NO `save_dc`, NO `save_type`, NO `hit_conditions`, NO `hit_target_effect`**. Poisoned is part of the HIT effect per row prose.

## Actual (live)
Core attack exact; Poisoned rider NEVER granted — decoy `save_effect` on no-save_dc attack row (§118 fingerprint, MA-0522/0527 family).

Presses (budget 4): 1 wasted-target press + 1 Trash lob press.
- Press A (targeting error, NOT counted vs budget): `.mc-action:has-text("Trash Lob")` also matched the Multiattack row (its description names Trash Lob); "+8" click adjudicated Multiattack — nat rolls[0]=1, 1+8=9 < AC12 ✗ MISS, zero popup damage, zero entries beyond log[406] attack-roll name:"Multiattack" (log shows `"name": "Multiattack"..."total": 1, "bonus": 8`).
- Press B (Trash Lob, strict `<strong>` startsWith scope): popup "Trash Lob | 26 | d20 18 +8 (+8 to hit) | ✓ HIT (26 vs AC 12)" → Done → stage-2 popup "Trash Lob | 17 | 2d10 + 5: 3, 9 +5 | 17 damage applied to Bandit 1 — HP: 524 → 507" → click-to-dismiss.
  - Log 406: `rollType:"attack", name:"Trash Lob", rolls:[18,9], mode:"normal", total:18, bonus:8, targetAc:12, effectiveAc:12, hit:true` — nat 18+8=26 ≥ 12 hit iff ≥ ✓; bonus 8 separate ✓; targetAc==effAc==12 ✓; attackRange:null + rangeReason:null = gridless-lenient fingerprint (§115/§118, ranged-only row band never stamped — advisory).
  - Log 408: `rollType:"damage", formula:"2d10 + 5"` exact, rolls [3,9], total 17 == finalDamage 17 == |hp_change| ✓; Bludgeoning, `resisted:false`, flat once ✓; isCrit:false (non-nat20 so crit-flat rule N/A).
  - Log 407: `hp_change delta:-17, currentHp:507, maxHp:999, damageBreakdown:[{Bludgeoning,17,resisted:false}]` ✓.
- **Rider probe: ZERO Poisoned.** Condition/poison log entries since baseline = 0; change-data `Bandit 1`.`activeConditions` = [] and `activeConditionMeta` = {} after the hit.

## Grep evidence (which field arms condition-on-hit; save_effect consumers)
- Attack-hit condition arm is `hit_conditions` ONLY: `buildHitConditionClause` reads `action.hit_conditions` / `hit_target_effect` / `hit_condition_roll` — `src/components/encounter/MonsterCardHelpers.js:622-626`; **never reads `save_effect`**. Live consumer grants via canonical activeConditions write path: `applyHitClauseConditions` — `src/hooks/combat/handlers/handlePlainDamage.js:543-577`.
- `save_effect` has ZERO consumers on the attack hit path: the only affordance that consumes it is `ActionSaveRoll`, which early-returns `if (action.save_dc == null) return null;` — `src/components/encounter/MonsterAction.jsx:92` (`saveConditions = extractConditionsFromSaveEffect(action?.save_effect)` at :98 is unreachable for this row); modal save route gated `else if (action.save_dc != null) handleSaveRoll(...)` — `MonsterCardModal.jsx:567`; attack chip options explicitly null saves (`saveDc: null, saveType: null` — `MonsterCardModal.jsx:960-962`, MA-0551 fork). No chooser rendered (single "+8" chip in row, disk-verified) — gridless §200-consistent.
- Fingerprint cites: §118 "save_effect on no-save_dc attack row = decoy, only hit_conditions arms hit path (MA-0522/0527)"; §116 fix-one-field template (MA-0556, hit_target_effect); §153 (buildHitConditionClause reads hit_conditions only — MA-0291/0361 family). Contrast MA-0937/MA-0983 (Tree Club Prone): prose-only riders there were advisory pass-subset; HERE the row authors a STRUCTURED field in the WRONG slot while its own description makes Poisoned part of the Hit clause — not the MA-0937 escape; inert core-clause transport ⇒ FAIL(a).

## Steps to reproduce
1. :5173 test-campaign; EB-joined initiative (Hill Giant 1 + Bandit 1 AC12, maxHp 999).
2. Open Hill Giant 1 card; arm Bandit 1 on attacker's own initiative card `[data-testid="target-select"]`.
3. Click Trash Lob "+8" chip (scope `.mc-action` via `<strong>` startsWith "Trash Lob" — has-text collides with Multiattack description).
4. Hit popup Done → damage popup + dismiss.
5. Check log + Bandit change-data: damage exact, zero Poisoned ever applied.

## Likely location & fix
`public/data/monsters.json` Hill Giant "Trash Lob" row — structured rider authored in wrong slot. One-field fix per MA-0556/MA-0291 template: add `"hit_conditions": ["poisoned"]` (drop or leave the now-redundant `save_effect`; drop recommended to kill the decoy). `hit_target_effect` is the te-write slot (§116/MA-0556) and unsuitable for a standard condition; `hit_conditions` is the condition slot (Helpers:624 → handlePlainDamage:543).
Duration semantics note: the hit_conditions machine stamps activeConditions + meta{source} with NO expiration clock (§59 grapple lasts until escape; MA-0855 grants selected condition stamp-only, §9 residual "remove_* expiration types may lack cases → effects persist until rest"). So "until the end of its next turn" will NOT be modeled — grant persists until GM removes the badge; consistent with existing hit_conditions precedents, flag as accepted residual in the fix PR.

## Notes
- Range band 60/240 gridless-advisory (rangeReason:null, §115/§149) — note-only, not part of verdict.
- Press A Multiattack stray press: honest nat1 miss, zero side-effects beyond its own attack-roll log entry.
- Console errors: 0 (whole session). Cleanup: Bandit zero conditions (nothing to remove), HP drift 524→507 kept honest, no clears, rig intact.
- Do NOT edit docs/monster-actions-manifest.json (orchestrator owns verified); no git writes performed.
