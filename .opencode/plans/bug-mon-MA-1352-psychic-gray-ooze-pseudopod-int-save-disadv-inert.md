# bug-mon-MA-1352 — Psychic Gray Ooze Pseudopod: INT-save-Disadvantage rider inert (FAIL(b)/DATA)

**Row:** `public/data/monsters.json` psychic-gray-ooze actions[0] "Pseudopod" (stableKey `psychic-gray-ooze|actions|0`)
**Verdict:** FAIL(b)/DATA — core attack/damage legs LIVE exact; always-on-hit rider prose-only, zero structured field, zero applicable te/consumer.

## Description (verbatim)
"Melee Attack Roll: +3, reach 5 ft. Hit: 11 (3d6 + 1) Acid damage, and the target has Disadvantage on Intelligence saving throws until the end of the ooze's next turn."

## Disk static
- attack_bonus 3 ✓, damage_dice_primary "3d6 + 1" ✓ byte, damage_type_primary "Acid" ✓, reach "5 ft." ✓ — byte-match.
- Row keys: [attack_bonus, damage_dice_primary, damage_type_primary, description, name, range, reach, recharge, save_dc(0), save_effect(""), save_type("")] — NO `hit_conditions`, NO `hit_target_effect`, NO `hit_condition_roll`, no rider field of any kind.
- `buildHitConditionClause` (`src/components/encounter/MonsterCardHelpers.js:673-681`) reads `hit_conditions`/`hit_target_effect`/`hit_condition_roll` ONLY → null for this row; `maybeApplyHitClause` early-return `src/hooks/combat/handlers/handlePlainDamage.js:628`.
- te registry (`src/services/combat/conditions/targetEffectDefinitions.js`): ZERO "disadvantage on Intelligence saving throws" te. Nearest (all wrong-scope): `dex_save_disadvantage` :387 (fixed DEX), `hex_save_disadvantage` :403 (ability-scoped but PC-Hex producer only — `spellCastService/execution/helpers.js:47-51`; hit-channel `applyHitClauseTargetEffect` handlePlainDamage.js:657 passes no `ability` payload), `disadvantage_on_next_save` :413 (generic next-save, wrong duration/scope).

## Live ledger (test-campaign, localhost:5173, 2026-09-26)
EB Join exact td "Psychic Gray Ooze" → cs idx0 "Psychic Gray Ooze 1" AC9; +NPC Bandit slot15 AC12 (clobber-watch passed), HP 999 via full-store cs POST; armed ooze.targetName="Bandit" read-back OK. Card chip audit: Pseudopod row exactly ONE "+3" chip (§409 clean, no junk twins); save_dc:0 decoy renders ZERO DC chip (§736 confirmed).
- 16 chip presses → 16 attack log entries, press-to-log 1:1, zero absorption.
- Boundary exact flips vs AC12: nat8+3=11✗ / nat18+3=21✓; vs AC15 (rig): nat11+3=14✗ / nat15+3=18✓, nat16+3=19✓. nat20=23✓ crit, nat1=4✗ auto-miss.
- 4 hits: formula "3d6 + 1" Acid byte-exact, totals 14 [5,4,4], 6 [1,3,1], 15 [6,3,5]; CRIT formula "3d6*2+1 (2, 2, 6)" total 21 — dice doubled, flat +1 undoubled (§32).
- Σfd = 21+14+6+15 = 56 == Σ|hpΔ| = 56 exact; 12 misses zero-damage zero-hp_change.
- RIDER: ZERO. Bandit change-data key dict EMPTY (no activeConditions/activeConditionMeta/conditions); top-level `targetEffects` KEY ABSENT; `condition applied` log entries 0; whole-log /[Dd]isadv/ scan [] (no mode:disadvantage, no grant, no mention); lastAttack.saveDc/saveType null (decoy honest §117).

## Precedent framing
Disadvantage-on-INT-save is an always-on-hit effect, NOT movement-gated → §MA-1347 discriminator puts it on the §MA-1344/§MA-0542/§MA-0522 FAIL(b)/DATA side (cf. MA-0733 §215 ungated rider = FAIL, not advisory).

## Fix shape
New ability-scoped registered te (e.g. `ability_save_disadvantage` w/ `ability` field, or `int_save_disadvantage`) in targetEffectDefinitions.js + row field `hit_target_effect`, + `applyHitClauseTargetEffect` (handlePlainDamage.js:657) ability-payload passthrough + save-roll consumers (`handleNpcSaveDamage.js:75`, `useLoggedDiceRollSaves.js:19`, `aoeService.js:50/104` currently key only `disadvantage_on_next_save`) extended to read ability-scoped save-disadv te; duration anchored on ooze (`until_start_of_next_turn` pattern :661-666 already matches "end of the ooze's next turn" modulo start/end advisory §206).

## Cleanup
Admin-clear change-data + log; npc-remove Bandit; registry entry appended for "Psychic Gray Ooze".
