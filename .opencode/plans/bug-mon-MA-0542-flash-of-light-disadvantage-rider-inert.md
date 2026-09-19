# BUG MA-0542 — Cyclops Oracle Flash of Light: Disadvantage rider inert (save_effect decoy, missing hit_conditions)

**Verdict:** FAIL (b) — MA-0522/0527 twin (data fail; attack/damage mechanics live).
**Date:** 2026-09-19 | **Campaign:** test-campaign (locked, header verified)

## Row
Cyclops Oracle (cyclops-oracle) actions[2] Flash of Light, +10 ranged 120 ft., "2d10 + 6" Radiant, manifest claims target has Disadvantage on attack rolls until end of cyclops's next turn.

## Disk shape (public/data/monsters.json, actions[2])
- `attack_bonus: 10`, `range: "120 ft."`, `damage_dice_primary: "2d10 + 6"`, `damage_type_primary: "Radiant"`
- `save_effect: "The target has Disadvantage on attack rolls until the end of the cyclops's next turn."` — present but UNREACHABLE on the attack chip path.
- **`hit_conditions` ABSENT**, `hit_target_effect` absent, `escape_dc` absent, row `save_dc` ABSENT (only the Spellcasting row carries save_dc 16).

## Code proof (structural inertness)
- Attack chip seam: `MonsterCardModal.jsx:656` `hitClause: buildHitConditionClause(action)` — `MonsterCardHelpers.js:526-536` reads ONLY `action.hit_conditions`/`hit_target_effect` → returns null for Flash of Light.
- `save_effect` consumers ride `buildSaveOptions`/save context which require `action.save_dc` — Flash of Light has none, no save shell renders (§103: save_effect on no-save_dc attack row = decoy, MA-0522/0527 precedent).
- Disadvantage te registry: `disadvantage_next_attack` (one-shot, PC mastery/maneuver/giant-ancestry producers only), `pesky_swarm` (MA-0275 animal-spirit save-chooser producer only), `concentration_disadvantage` etc. — NO `disadvantage_attacks` te key, NO monster-attack-hit producer app-wide for a persistent attack-rolls disadvantage.

## Live proof (EB join Cyclops Oracle 1 + Knight 1 AC18 staged 200, :5173)
- Chip scoped `.mc-action:has-text('Flash of Light') span.mc-dice-link` text "+10" (shares +10 text with Radiant Strike; disambiguated by log `name:"Flash of Light"` formula "2d10 + 6").
- 5 rolls, Knight AC18: nat8+10=18 ✓HIT formula `2d10 + 6` rolls[5,2]=13 hp_change -13 exact; nat8+10=18 ✓HIT rolls[2,5]=13 hp -13 exact; nat20 ✓CRIT formula `2d10*2+6` isCrit:true dice-doubled flat+6-once 46 hp -46 exact; nat17+10=27 ✓HIT hp -15; nat7+10=17 ✗MISS `hit:false` zero damage entry, zero hp delta (miss-gate clean, 4 damage / 4 hits).
- Second nat8 was a REAL fresh roll (log timestamps distinct, second die 18 vs 5) — popup same-total coincidence, not §77 cache replay.
- **Rider:** post-Done across 4 landed hits — change-data top-level `targetEffects` KEY-ABSENT, `Knight 1` change-data key ABSENT, zero `disadvantage` log entries, zero `condition applied` entries, no `.sp-modal` save prompt. Disadvantage NEVER applied.

## Cleanup
Admin clear-change-data + clear-log POST 200 (no dialog fired); own curl re-verify: log `[]`, change-data `{}`, combatSummary creatures `[]`.

## Fix recommendation (DATA, MA-0010 seam)
Add `"hit_conditions": ["disadvantage"]` to Flash of Light actions[2] — or, for the correct RAW duration ("until end of cyclops's next turn"), author a structured hit-target-effect with a registered te + ONE addExpiration clock (e.g. reuse `pesky_swarm`-style clock te or add `disadvantage_attack_rolls_eot` to `targetEffectDefinitions.js`). Note: `applyHitClauseConditions` grants persistent badge-remove-only conditions with NO EOT clock (MA-0434/0291 accepted residual) — plain hit_conditions lands the condition but not the duration; structured te+clock needed for honest end-of-next-turn expiry.

## Registry
`docs/test-monster-registry.json` Cyclops Oracle config merge-appended `verifiedRowMA0542` + `dateMA0542`, JSON.parse-guarded, disk-checked 130 keys.
