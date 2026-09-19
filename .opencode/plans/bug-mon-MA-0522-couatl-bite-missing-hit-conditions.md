# BUG MA-0522 — Couatl Bite: Poisoned rider inert (missing hit_conditions)

**Verdict:** FAIL (b) — MA-0434 twin (data fail; attack/damage mechanics live).
**Date:** 2026-09-19 | **Campaign:** test-campaign (locked, verified header)

## Row
Couatl (couatl) actions[0] Bite, +7 melee 5 ft., "1d12 + 5" Piercing, manifest claims Poisoned until end of couatl's next turn.

## Disk shape (public/data/monsters.json, actions[0])
- `attack_bonus: 7`, `reach: "5 ft."`, `damage_dice_primary: "1d12 + 5"`, `damage_type_primary: "Piercing"`
- `save_effect: "The target has the Poisoned condition until the end of the couatl's next turn."` — present but UNREACHABLE on the attack chip path.
- **`hit_conditions` ABSENT**, `hit_target_effect` absent, `escape_dc` absent, `save_dc` absent.

## Code proof (structural inertness)
- Attack chip seam: `MonsterCardModal.jsx:656` `hitClause: buildHitConditionClause(action)` — `MonsterCardHelpers.js:526` reads ONLY `action.hit_conditions`/`hit_target_effect` → returns null for Bite.
- `handlePlainDamage.js:526-536` consumes `context.hitClause` only → zero condition grants.
- `save_effect` consumers (`extractConditionsFromSaveEffect`, `parseSlowedClauses`, all parse*Clause) ride `buildSaveOptions`/save context which require `action.save_dc` (`MonsterCardModal.jsx:399`) — Bite has none, no save shell renders.
- No `parsePoison`/poisoned-clause parser exists app-wide (grep-zero); couatl-specific grep-zero. `attackRollPostDamage.js` Poisoned consumers = PC Poisoned Weapons feature only.

## Live proof (EB join Couatl 1 + Bandit 1 AC12, :5173)
- Attacks: nat4+7=11 vs AC12 ✗MISS; nat1 ✗CRIT MISS; nat14+7=21 ✓HIT; nat9+7=16 ✓HIT (misses both ≤4 ✓).
- Damage: formula `1d12 + 5` exact==finalDamage==|hpΔ| (d12 7→12, d12 11→16; hp_change −12, −16).
- Rider: post-Done on revived live victim — change-data `Bandit 1` keys EMPTY, no top-level `targetEffects`, no `condition applied` log entry, no save prompt. Poisoned NEVER applied on 2 landed hits.

## Cleanup
Admin clear-change-data + clear-log POST 200; own curl re-verify: `{}` / `[]` / cs creatures `[]`.

## Fix recommendation (DATA, MA-0010 seam)
Add `"hit_conditions": ["poisoned"]` to Couatl Bite. Note: hit-clause seam grants persistent condition with badge-remove only (no EOT clock — `applyHitClauseConditions` has no expiry; MA-0434/0291 family accepted residual). Prose "until end of couatl's next turn" duration remains advisory-unbuilt unless clock extension added.

## Registry
`docs/test-monster-registry.json` Couatl newly placed, JSON.parse-guarded merge, disk-checked 121 keys.
