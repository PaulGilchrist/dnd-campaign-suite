# MA-0909 — Graveyard Revenant · Suffocate (actions[1]) — FAIL(a)

## Verdict
**FAIL(a)** — unconditional on-hit Grappled rider never applies. Rider damage half PASSES exact (2/2).

## Expected (from disk description, monsters.json graveyard-revenant actions[1])
> "Melee Attack Roll: +8, reach 10 ft. Hit: 10 (1d10 + 5) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a Large or smaller creature, it has the **Grappled** condition (escape DC 15). Until the grapple ends, the target is **suffocating**. The revenant can have up to two targets Grappled in this way at a time."

Size-gate distinguishes this from §MA-0903 (charge-gated Prone, never satisfiable in a static rig): Suffocate's Grappled is an **unconditional on-hit effect** (size-gated only). The size gate is machine-expressible — Bandit 1 rides size "Medium or Small", and `isLargeOrSmallerTarget` (handlePlainDamage.js:488, MA-0553 fix) splits on /or/ and gates on the largest token → Medium ≤ Large → gate PASSES. Disk lacks `hit_conditions` ⇒ the condition NEVER applies ⇒ description mismatch = FAIL(a), §MA-0877 shape exactly (that row FAILED for missing poisoned on-hit).

## Actual (live, test-campaign, 2026-09-23, Bandit 1 AC12 four-key maxHp999, fresh EB join)
### Half A — combined rider damage: ✓ EXACT (2/2 hits, 2 presses ≤ budget)
| Press | d20+8 | vs | result | fd ("1d10 + 5") | sfd ("3d6") | hp_change | Σ§140 |
|---|---|---|---|---|---|---|---|
| 1 | 11+8=19 | AC12 | ✓ HIT | [1]+5=6 Bludgeoning | [3,2,6]=11 Necrotic | −17 (999→982) | 6+11=17 ✓ |
| 2 | 18+8=26 | AC12 | ✓ HIT | [5]+5=10 Bludgeoning | [4,5,5]=14 Necrotic | −24 (982→958) | 10+14=24 ✓ |

Every damage entry: `note:"combined_damage_roll"`, `formula:"1d10 + 5"` + `secondaryFormula:"3d6"`, hp_change breakdown sum==|Δ| exact (§140). Rolls distinct press-to-press (§77). lastAttack canonical (§MA-0890 axis = log): d20:11, bonus:8, total:19, targetAc:12, hit:true, damageFormula/damageType + secondaryFormula stamped, damageApplied:true. Cosmetic non-axis: lastAttack.secondaryDamageType stamped "Bludgeoning" and weaponType:"ranged" on this melee-reach attack (log + breakdown carry Necrotic/bludgeoning legs correctly) — same cosmetic family as MA-0877 lastAttack mislabel.

### Half B — Grappled on hit: ✗ NEVER APPLIED (0/2 hits)
Post-hit probes every press:
- Bandit 1 change-data: **no "Bandit 1" store key at all**; combatSummary creature entry keys = name/type/monsterType/size/initiative/targetName/ac/resistances/immunities/vulnerabilities/concentration/maxHp/currentHp/saveBonuses/monsterIndex/currentHitPoints/maxHitPoints — **no activeConditions / activeConditionMeta / targetEffects**.
- Top-level `targetEffects`: **null**.
- Whole log (9 entries pre-clean): **ZERO** `type:"condition"` entries (§274 grant fingerprint absent); whole-log /grapple/i mentions **0**; /suffocat/i mentions (non-description) **0**.
- No escape-DC-15 metadata, no grapple badge, no suffocating tick, no two-target cap state — the rider is structurally inert.

## Grapple-te audit (§te rule, targetEffectDefinitions.js)
- **ZERO grapple-family te** in registry (grep `effect:'` ∩ grapple|hold|restrain|chomp|constrict → none). Nearest = `attached` (Darkmantle MA-0553, state-stamp only; §69 grapple-family attach/detach/suffocation state machine unbuilt). Grapple rides the **hit_conditions → activeConditions** route, NOT te — so a te-based arm was never available; the authored route is the one-field data patch below.

## Likely Location
- **DATA**: `public/data/monsters.json` graveyard-revenant Suffocate row keys = name, description, attack_bonus, reach, damage_dice_primary, damage_type_primary, damage_dice_secondary, damage_type_secondary — **hit_conditions ABSENT, escape_dc ABSENT** (disk-dumped this session). Manifest MA-0909 `conditions:["grappled"]` is annotation only — consumer never reads manifest/description (§153 lineage MA-0291/0361/0763/0795/0877).
- **Consumer machinery LIVE** (not unarmed — precedent authored rows prove it arms grapple live): `buildHitConditionClause` (MonsterCardHelpers.js:598, reads hit_conditions/escape_dc ONLY → null when absent) → MonsterCardModal hitClause thread → `applyHitClauseConditions` (handlePlainDamage.js:513: canonical activeConditions write + meta{source, dc, ability:'str'} + type:condition log; escape via condition badge) gated by `maybeApplyHitClause` size check :584. Working precedents: MA-0801 Giant Crocodile Bite (hit_conditions:["grappled","restrained"] + escape_dc:15), MA-0812 Giant Octopus Tentacles (+escape_dc:13), MA-0834 Giant Vulture Gouge (poisoned shape).

## Fix
Two-field DATA (MA-0801/MA-0812 byte-shape): add `"hit_conditions": ["grappled"], "escape_dc": 15` after `damage_type_secondary` on graveyard-revenant Suffocate. Consumer live, size gate honest ("Medium or Small" passes; Huge+ victims correctly skipped). No code change. Fix-lineage corroboration: HEAD commit 811c31e44 "fix(MA-0863): Glabrezu / Pincer: grapple rider never granted" — same grapple-rider-not-granted family previously resolved by this exact authored-field route.

## Notes (unexpressible axes — §69 grapple-family advisory, GM-enforced)
- **Suffocating tick**: no per-round suffocation consumer anywhere (all suffocation refs = darkmantle `attached` advisory). Rides description.
- **Two-target cap**: zero consumer (no max-grappled state tracked); rides description.
- **Escape resolution**: badge STR save vs authored escape_dc:15 is machine-native (meta{dc,ability}) once the field lands; grapple release on grappler death etc. GM-enforced.
- Manifest untouched. Cleanup: admin-clear cd+log direct-fetch 200/200 (§255), quiet-recheck 14s cd-keys[]/log0, single tab, dev :5173+:80 up, console 0 errors.

## Session ledger
EB join fresh (Revenant init20 AC14 / Bandit 1 AC12 init4, size "Medium or Small"); Bandit four-key 999 full-store cs POST + reload + re-select (§MA-0874/§MA-0884); ARM via sanctioned full-store cs POST targetName='Bandit 1' read-back OK (§MA-0903); card via portrait img.avatar-image (§MA-0906); 2 presses, 2 hits, 0 misses (AC-rig not needed — computed nat≥4 hits vs AC12, both dice above); Done real-pointer both hits (§MA-0869); overlay flushed post-log-confirm every press (§MA-0873); damageBreakdown legs Bludgeoning+Necrotic exact both presses; grapple probe ×2 all-null.
