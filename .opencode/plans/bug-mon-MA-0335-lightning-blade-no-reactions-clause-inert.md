# Bug MA-0335 — Balor / Lightning Blade: "can't take Reactions" hit clause INERT

**Verdict: FAIL** (MA-0334 prose-clause class; MV-7/MA-0320 bar)
**Date:** 2026-09-17 | **Campaign:** test-campaign ONLY (header verified throughout)

## Row
MA-0335 | balor | actions[2] | Lightning Blade | attack | +14, reach 10 ft |
3d8+8 Force + 4d10 Lightning | clause: "…and the target can't take Reactions until the start of the balor's next turn."

## What the RAW row advertises vs what the app does
The hit clause names a recurring rules concept (reaction suppression until attacker's next turn) — the same class as MA-0284/0285/0286 inert reactions and MA-0334 Flame Whip prose Prone+pull. Per MV-7/MA-0320 bar: named clause advertised with zero affordance/state = FAIL.

## Evidence

### 1. Disk — no key (monsters.json balor actions[2])
Keys dump: `attack_bonus, damage_dice_primary, damage_dice_secondary, damage_type_primary, damage_type_secondary, description, name, reach`.
- NO reaction-suppression key, NO `hit_conditions`, NO `hit_target_effect`, NO `escape_dc`, NO `extra_effects`, NO `save_effect`.
- Clause is PROSE-ONLY inside `description`.

### 2. Grep — no producer, no consumer for this seam
The `no_reactions` te EXISTS (`targetEffectDefinitions.js:188`, label "No Reactions", live consumers: `conditionEffects.js:346` riderNoReactions; `CharReactions.jsx` SP-109). BUT its producers are exclusively:
- `parseSlowedClauses` (`MonsterCardHelpers.js:130-137`) — fed ONLY by `action.save_effect` (MonsterCardModal.jsx:185, 888). Balor Lightning Blade has no `save_effect` key → parse never runs.
- `slowHandler.js:92` (PC spell slow), `OpenHandTechniqueModal.jsx:67` (PC monk).
- The attack-hit clause seam `buildHitConditionClause` (`MonsterCardHelpers.js:382-392`) consumes ONLY structured `hit_conditions` / `hit_target_effect` / `escape_dc` — absent here → returns null.
- `buildResultMessage.js:14` renders `option.effect === 'no_reactions'` only for authored choice-options; Lightning Blade is a plain attack row, no options.
- No keyword/prose parser for "can't take Reactions" on any monster ATTACK-hit seam anywhere in src/ (only save-effect seams + spell/PC paths).

### 3. Live — clause lands nothing on a 2×-hit victim
Rig: EB exact Balor → Join → Balor 1 cs 287/287 AC19; EP armed target, top HP 224 (cs targetName curl-verified).
- Hit 1: d20 11 (reroll 7→21) HIT vs AC19; 3d8+8=5,1,2+8=16 Force + 4d10=4,5,3,5=17 Lightning = 33; EP 224→191 exact.
- Miss: nat3→17, zero ✓.
- Hit 2: nat16→30 HIT; 7,2,5+8=22 Force + 5,7,10,6=28 Lightning = 50; EP 191→141 exact.
- Σ83 == |224−141| exact. Damage core EXACT (MA-0333 ×4 cite + 2 fresh).
- Post-hit null-proofs (curl cs EP): `targetEffects` null, `activeConditions` null, NO reaction-related keys, `pendingExpirations` []. No badge, no flag, no meta, no state.
- Log audit (9 entries): attack+damage+hp_change per event, breakdown Force+Lightning exact; clause grep: "reaction" ×0, "can't take" ×0, "no_reactions" ×0, "cannot take" ×0. No expiration scheduled for a clause that says "until the start of the balor's next turn."
- A GM manually adding the te via EffectAdder would work (registry exists), but the attack itself grants nothing — zero automation for the advertised clause.

### 4. Notes / minor observations (not counted vs verdict)
- Damage dice exact every roll; distinct d20s per reroll (MA-0273 clean).
- Quirk: hit-1 attack log `total:11` while popup final showed 7→21 vs AC19 (post-reroll log total not refreshed); hit outcome (HIT vs 19) unaffected.
- Hit-2 attack log `rolls:[16,16]` (reroll produced same value); MA-0273 cached-dice watch noted, outcome (30 vs 19 HIT) unaffected.

## Fix seam suggestion (for authoring/backlog only — no edits made)
Either author a structured key (e.g. `hit_target_effect: 'no_reactions'` riding the MA-0016 `buildHitConditionClause` te-write seam, which already supports hit te grants), or add an attack-hit prose parser mirroring `parseSlowedClauses` scoped to attack descriptions. Consumers (`riderNoReactions`, CharReactions SP-109, `no_reactions` te definition) already exist and would light up unchanged.

## Cleanup
Admin Clear Change Data + Clear Campaign Log, native confirms named "test-campaign" → curl `{}` / `[]` ✓.

VERIFIED: FAIL
