# bug-mon-MA-0546 — Cyclops Sentry Stone Club prone rider inert (FAIL class b)

**Row:** MA-0546 | cyclops-sentry | actions[1] | Stone Club | +9 melee reach 10 ft. | 3d6 + 6 Bludgeoning | prose: 'If the target is a Huge or smaller creature, it has the Prone condition.'
**Verdict:** FAIL(b) — inert rider (data-decoy). Weapon dice/hit adjudication PASSes; the hit-path Prone clause never lands.

## Disk (public/data/monsters.json, cyclops-sentry actions[1])
- Authored: attack_bonus:9, reach:'10 ft.', damage_dice_primary:'3d6 + 6', damage_type_primary:'Bludgeoning', save_effect:'If the target is a Huge or smaller creature, it has the Prone condition.'
- MISSING: hit_conditions (no authored hit_conditions:[...]) — row carries the save_effect-no-hit_conditions decoy (§103 MA-0522/0527 fingerprint; MA-0545 pre-note twin).

## Code evidence
- src/hooks/combat/handlers/handlePlainDamage.js consumes ONLY action.hit_conditions via buildHitConditionClause (:482, MA-0010 seam); grep of the file: zero save_effect/saveEffect references.
- App-wide grep (src/, non-test): zero 'huge or smaller' / hugeOrSmaller parser. No prone-clause parser on the hit-path exists (MA-0087 slowed-trio parser unrelated).
- Fingerprint confirmed: inert rider FAIL(b) per §10 verdict policy.

## Live proof (test-campaign, :5173, 2026-09-19)
- EB joins: Cyclops Sentry 1 + Knight 1 (AC18) + Bandit 1 (AC12); staged 200/200 via full-store /combatSummary POST (200-verified).
- First join attempt mis-joined Death Knight (EB filter hasText collision) — removed, exact re-join verified via cs dump.
- Chip '+9' row-scoped .mc-action:has-text('Stone Club'), target Knight 1 armed on attacker card select:
  - MISS nat 5 → 14 vs AC18, hit:false, zero damage entry, zero hp_change ✓
  - MISS nat 7 → 16 vs AC18, hit:false, zero damage ✓
  - HIT nat 9 → 18 vs AC18, Done applied; roll damage formula exactly '3d6 + 6', Bludgeoning, finalDamage 11, hp_change 200→189 ✓
  - HIT nat 13 → 22 vs AC18, Done applied; finalDamage 14, hp_change 189→175 ✓
  - No nat20 in session — crit seam not exercised (byte-identical family MA-0433/0393).
- Prone rider post-hit audit: Knight 1 change-data {} (no activeConditions/activeBuffs); top-level targetEffects null; lastAttack {hit:true, saveType:null, saveDc:null, statusEffects:null, saveConditions:null}; log tail holds only roll attack/roll damage/hp_change — ZERO condition applied entries.

## Fix options (orchestrator decides)
1. DATA: author hit_conditions:['prone'] on Stone Club row (MA-0291/0361 prone data-lock precedent; Huge-or-smaller gate native to buildHitConditionClause size gate — verify Huge self-exclusion semantics vs RAW 'Huge or smaller').
2. CODE: none needed — consumer live; missing key is the defect.

## Cleanup
npc-remove-btn x3 (alt-anchored), admin clear-change-data + clear-log POST 200/200, hard reload; change-data {} and log [] own-verified.
