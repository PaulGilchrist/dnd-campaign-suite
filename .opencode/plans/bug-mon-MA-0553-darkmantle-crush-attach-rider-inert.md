# BUG MA-0553 — Darkmantle Crush: hit-path attach/blinded/suffocate rider inert (FAIL-b)

**Verdict:** FAIL (b) — inert prose rider, grep-zero producers.
**Date:** 2026-09-19 · test-campaign live rig.

## Row
MA-0553 Darkmantle (monsterIndex `darkmantle`) actions[0] "Crush": attack_bonus 5, reach 5 ft., damage_dice_primary "1d6 + 3" Bludgeoning. Prose: Hit attaches; Medium-or-smaller + attacker advantage → covers target: Blinded + suffocating; DC13 Athletics action detach; attached: speed 0, advantage, moves with target. Manifest `conditions:["blinded"]` is prose-only.

## Live evidence (own curl/log truth)
5 attack rolls (nat 1,10,9,8,18 vs Bandit 1 AC12): 1 miss (total 6, zero damage ✓), 4 hits, all damage entries formula exactly `1d6 + 3` (totals 6/5/8/8, hp_change 999→993→988→980→972). No nat20 — crit clause untriggered, not probed.

## Defect
1. Disk `monsters.json` darkmantle Crush has **no `hit_conditions`** — `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:526, forwarded MonsterCardModal.jsx:656, consumed handlePlainDamage.js:482 MA-0010 seam) returns null → zero hit-path grants. MA-0522/0527/0546/0550 fingerprint confirmed live.
2. **Attach mechanic unbuilt app-wide:** grep "attach" in src/services/combat/conditions/targetEffectDefinitions.js = 0 hits; no attach/suffocate/detach targetEffect registered; zero consumers (Cloaker MA-0462 Attach rode the SAVE path via `save_effect` — no attack-path equivalent exists).
3. Post-4-hits audit: log has NO attach/blinded/suffocate/condition entries; change-data top-level `targetEffects: None`; Bandit 1 activeBuffs null.

## Fix scope
DATA: add `hit_conditions:["blinded"]` only misrepresents RAW (Blinded gates on advantage-cover, and suffocation/attach state machine absent). Deep attach/cover/suffocate/DC13-detach state machine = unbuilt mechanic (§69-adjacent); do not fabricate half-grants. Recommend adjudication: label row advisory-unbuilt (FAIL-b) like MA-0287/0288/0354 grapple state-machine family.
