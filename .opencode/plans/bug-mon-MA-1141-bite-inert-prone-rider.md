# BUG MA-1141 — Mastiff Bite: INERT PRONE RIDER (FAIL(a)/DATA)

**Date:** 2026-09-24 · **Campaign:** test-campaign · **Row:** mastiff actions[0] "Bite"
**Manifest:** MA-1141 (`conditions:["prone"]`, actionType "attack+save") — verified NOT verified → recommend **FAIL(a)**.

## Defect
RAW: "Hit: 4 (1d6 + 1) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition."
Prone-on-hit NEVER lands: the disk row authors NO structured grant field.

## Disk truth (`public/data/monsters.json` mastiff.actions[0])
`attack_bonus:3 ✓ · damage_dice_primary:"1d6 + 1" ✓ · damage_type_primary:"Piercing" ✓ · reach:"5 ft." ✓ · save_dc:0 · save_type:"" · save_effect:""` (empty — NOT a §410 wrong-slot decoy) · **`hit_conditions` ABSENT · `conditions` ABSENT** (manifest `conditions:["prone"]` is prose-derived only).

## Consumer grep (missing consumer confirmed)
- Grant transport = `buildHitConditionClause` (MonsterCardHelpers.js:648) reads **`action.hit_conditions`** (+`hit_target_effect`/`hit_condition_roll`) ONLY → `hitClause` (MonsterCardModal.jsx:873) → `maybeApplyHitClause`/`applyHitClauseConditions` (handlePlainDamage.js:614/:543). **Consumer LIVE but UNARMED** (clause null for this row).
- Attack-path consumers of raw `action.conditions`: **grep-ZERO** (Modal:517 = save-ray `ray.conditions`; Modal:1104/:2231 = creature conditions; summonSpiritHandler conditions grep-ZERO; monsterLegendaryUses = `target_prerequisite` only). No summon/`resolveMonsterActions` fold grants conditions-on-hit.
- §153 codified: "manifest prose `conditions` alone never lands … missing = DATA FAIL MA-0291/0361 family." Same-day precedents: MA-0791 Talons, MA-1116 Earthen Maul — identical one-field shape.

## Live E2E (Playwright, test-campaign, 2026-09-24)
Rig: EB join Mastiff 1 + Bandit 1 (cs: AC12, size "Medium or Small"); Bandit currentHp 999 fill+Enter BEFORE card open (§446); target armed on Mastiff's OWN initiative-card select (`target-select` value+change, cs.targetName="Bandit 1" server-verified pre-roll §28/§447); Done pressed while attacker modal live (§448); no defender overlay mid-popup.
- Chip: Bite row = ONE `span.mc-dice-link` "+3"; `.mc-dice-link-save` count 0 → no DC chip ✓ (save_dc:0, no §444 junk "+0").
- Attack 1: log rolls[13,18] total 13 +3 = 16 vs AC12 `hit:true` → damage `formula:"1d6 + 1"` rolls[5] `finalDamage:6` Piercing; hp_change −6 (999→993) |Δ|==fd ✓
- Attack 2: rolls[19,6] total 19 +3 = 22 HIT → "1d6 + 1" rolls[2] fd3; Δ−3 (993→990) ✓
- Attack 3 honest MISS: rolls[2,12] total 2 +3 = 5 ✗AC12 → zero damage, zero hp_change ✓
- **Prone axis: ZERO grant** — whole-log "prone" mentions 0, `type:"condition"` entries []; **Bandit 1 ABSENT from change-data entirely** (§1116 absent-key discriminator = strictest zero-grant proof); cs activeConditions absent; tracker badge row shows only "Add".
- MA-0687 contrast: elephant Stomp was prose-only UNAUTHORED prone (fixed via `target_prerequisite` eligibility field + attack-gate seam). HERE the manifest carries `conditions:["prone"]` yet disk has no `hit_conditions` and no consumer reads `conditions` → inert rider, same §153 class as MA-0791/MA-1116.

## Size gate (honest note)
Gridless advisory: no movement/position subsystem; Bandit is Medium (unquestionably in "Medium or smaller") so the clause is RAW-TRUE on both hits and still nothing applied — size-gate unenforceability does not excuse the gap. Consumer gate `isLargeOrSmallerTarget` (:518/:614) is Large-or-smaller, wider than RAW (MA-1116 caveat) — would over-apply on Large if naively authored; irrelevant while clause null.

## Fix (one field, MA-0791/MA-0763/MA-1116 byte-shape)
`public/data/monsters.json` mastiff.actions[0]: add `"hit_conditions": ["prone"]`. No escape_dc (RAW prone ends per standing rules, badge-only). Consumer already live; grants stamp activeConditions + meta{source:"Mastiff 1"} + `condition applied` log via applyHitClauseConditions.

## Verdict
**FAIL(a)** — numeric axis byte-exact (chip +3, "1d6 + 1" Piercing x2, |hpΔ|==finalDamage, honest miss clean) but core prone behavior of the row never applies: data field unauthored + manifest field unconsumed. Not PASS-subset: prone is the row's core second clause, not a size-advisory residual.
