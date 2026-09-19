# bug-mon-MA-0550-dao-earthen-maul-prone-rider-inert

**Row:** MA-0550 Dao / Earthen Maul (attack, +10 melee 5 ft., 4d6+6 Bludgeoning, conditions:["prone"])
**Verdict:** FAIL(b) — inert-data fingerprint (MA-0546 club-prone twin)
**Date:** 2026-09-19 · campaign test-campaign · localhost :5173

## Live evidence (disk-checked)
- MISS rig: nat4 +10 = 14 vs Knight AC18 → log `hit:false`, zero damage entries.
- HIT: nat15 +10 = 25 vs AC18 → `roll damage` formula byte-exact `4d6 + 6`, rolls [6,1,1,6], total 20, finalDamage 20, `hp_change` −20 (Knight 999→979).
- HIT 2: nat19 → 23 exact via `4d6 + 6`. No crit rolled (crit seam 4d6*2+6=30 already proven MA-0549, byte-identical).
- Prone rider audit post-hit: **ZERO** — Knight 1 change-data key empty (no `activeConditions`), top-level `targetEffects` empty, zero `condition`/prone log entries across full log.

## Root cause (code + disk)
- `public/data/monsters.json` Dao/Earthen Maul: has `save_effect` decoy ("If the target is a Large or smaller creature, it has the Prone condition") but **no `hit_conditions`** — save_effect on a no-save_dc attack row never arms (MA-0522/0527).
- `MonsterCardHelpers.buildHitConditionClause` (:526) reads `action.hit_conditions`/`hit_target_effect` ONLY → returns null for this row.
- `handlePlainDamage.js` grants hit conditions exclusively via `hitClause` (:488/:526); `applyRamProneCondition` (:200) is Ram-specific. Zero prose/description prone parser on the maul hit path.

## Fix (DATA, per MA-0291/0361 family)
Author on the Earthen Maul row: `"hit_conditions": ["Prone"]` (+ retain prose). Large-or-smaller gate is live in the MA-0010 seam consumer. Optionally drop the decoy `save_effect`.

## Residuals
- MA-0010 escape_dc absent = Prone is a plain condition (no escape DC needed, RAW: stand = movement half).
- Registry: Dao entry merge-appended `config.MA-0550`, JSON.parse disk-checked.
