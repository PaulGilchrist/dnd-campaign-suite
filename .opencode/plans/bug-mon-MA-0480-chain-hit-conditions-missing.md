# bug-mon-MA-0480 — Chain Devil "Chain" attack: hit-clause Grappled+Restrained never lands (FAIL b DATA)

## Verdict
FAIL(b) — DATA. Damage leg exact; grapple/restrain clause prose-only, zero producers fired.

## Disk evidence (public/data/monsters.json, chain-devil actions[1], verbatim keys)
- `name`: "Chain"
- `attack_bonus`: 7
- `reach`: "10 ft."
- `damage_dice_primary`: "2d6 + 4"
- `damage_type_primary`: "Slashing"
- `save_effect`: "If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two chains, and it has the Restrained condition until the grapple ends."
- `description`: full prose incl. the same clause
- MISSING: `hit_conditions`, `escape_dc`, `hit_target_effect` — none authored anywhere on the row.

## Code evidence
- `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:526) reads ONLY `action.hit_conditions` / `action.hit_target_effect` / `action.escape_dc`; returns null for this row.
- Attack chip forwards `hitClause: buildHitConditionClause(action)` (src/components/encounter/MonsterCardModal.jsx:656) → null.
- Consumer is LIVE and correct (MA-0010 seam): `applyHitClauseConditions` / `maybeApplyHitClause` (src/hooks/combat/handlers/handlePlainDamage.js) apply conditions + `activeConditionMeta {source, dc, ability:'str'}` + `condition applied` log, Large-or-smaller gate included — never reached because clause is null.
- `save_effect` on this row is inert: save-shell consumers (`extractConditionsFromSaveEffect` etc.) require `save_dc`/`save_type`; an attack row's save_effect string has no consumer (contrast MA-0479 Conjure Infernal Chain, a structured save row: DC 15/Dexterity — its Restrained DID land live).

## Live evidence (test-campaign, EB join, round 1, no turn-advance, target armed Bandit 1 via Chain Devil own-card target-select; Bandit 1 AC12, Medium-or-Small, HP-staged 999)
- Roll 1: nat 2 (+7=9 vs AC12) hit:false — miss, zero damage ✓
- Roll 2: nat 10 (+7=17) HIT — damage entry formula "2d6 + 4" rolls [5,6] total 15, finalDamage 15, hp_change 999→984, Slashing ✓
- Roll 3: nat 1 auto-miss hit:false — zero damage ✓
- Roll 4: nat 9 (+7=16) HIT — rolls [3,6] total 13, finalDamage 13, hp_change 984→971, Slashing ✓
- On BOTH hits: ZERO `type:condition` log entries; Bandit 1 change-data empty; cs `conditions`/`activeConditions` None. No escape_dc recorded anywhere.

## Precedents / fingerprint
- §59 + §120 playbook: attack-HIT grapple prose lands ONLY via authored `hit_conditions:[...]` + `escape_dc` (MA-0010 seam); plain prose/`save_effect`/manifest `conditions` never consumed.
- DATA twins: MA-0434, MA-0477 (same attack-hit-conditions-missing class); MA-0291/0361 family.
- MA-0479 (same monster, prior session) confirmed damage rows + save-shell rows of Chain Devil work; only the attack-hit condition clause is dead.

## Fix (MA-0302 template)
Add to chain-devil actions[1]:
- `hit_conditions`: ["grappled", "restrained"]
- `escape_dc`: 14
Consumer already live (handlePlainDamage MA-0010 + MA-019 provenance stamp + badge escape-save seam); row remains byte-unchanged otherwise. Single-target rows inert for unauthored rows by construction.

## Accepted residuals (do not chase)
- Sustained grapple state-machine: zero producers app-wide (§59/§287/§288/§354) — condition persists via standard condition expiry/badge removal only.
- "Escape via the condition badge save" note text mentions tentacle for all rows (generic MA-0010 copy) — cosmetic.

## Cleanup
Admin cleared test-campaign change-data + log — API-empty verified (log len 0, change-data keys []). Registry `docs/test-monster-registry.json` merged MA-0480 record under existing "Chain Devil" key; JSON.parse disk-checked.
