# MA-1718 — Wight Life Drain: HP-maximum reduction inert (FAIL(a))

## Overview
Wight Life Drain (save row, DC 13 Constitution, one creature within 5 ft) resolves its damage and half-on-save legs exactly, but the described "target's Hit Point maximum decreases by an amount equal to the damage taken" clause is inert on failure: no max-HP reduction lands on the victim (neither cs maxHp nor a te/log). Save damage/half math are correct; only the max-HP drain rider is missing.

## Expected Behavior (row + monsters.json)
- Row MA-1718 / disk `wight.actions[3]` byte-identical: `save_dc: 13`, `save_type: "Constitution"`, `range: "5 feet"`.
- Description: "Constitution Saving Throw: DC 13, one creature within 5 feet. Failure: 6 (1d8 + 2) Necrotic damage, **and the target's Hit Point maximum decreases by an amount equal to the damage taken**. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control... no more than twelve zombies..."
- On a failed save: victim max HP drops by exactly the necrotic damage dealt; on a successful save: half damage, no max reduction.

## Actual Behavior
| nat | vs DC 13 | damage roll | applied | cs maxHp before→after |
|---|---|---|---|---|
| 9 | FAIL | 5+2=7 | 7 full ✓ | 11 → 11 ✗ (RAW → 4) |
| 3 | FAIL | 4+2=6 | 6 full ✓ | 11 → 11 ✗ (RAW → 5) |
| 13 | SUCCESS | 3+2=5 | 2 = floor(5/2) ✓ | 11 → 11 ✓ |

- save-damage log `formula:"1d8 + 2"` Necrotic on all three presses; full on fails, half on success.
- ZERO `hp_max_reduce` logs; victim targetEffect/te null throughout; no change-data maxHp delta.

## Root cause (static)
The save-path max-HP-reduce seam is LIVE (MA-1547/MA-1550 lane): `applyHpMaxReduce` at `src/hooks/combat/saveProcessing.js:22` → `hpMaxReduceService.js`, but it arms ONLY from a structured save-row key parsed by `parseSaveHpMaxReduce` (`src/components/encounter/MonsterCardHelpers.js:836-840`) — prose is never parsed. Disk holders of the structured key: succubus, succubus-incubus, vampire, vampire-spawn. **wight.actions[3] lacks the field → rider byte-inert.** te `hp_max_reduce` is registered (`src/services/combat/conditions/targetEffectDefinitions.js:356`) with no producer armed for this row.

## Steps to Reproduce
1. test-campaign → EB join "Wight" ×1 + Bandit ×1 (GM-fill Bandit high HP).
2. Arm Bandit on Wight's initiative-row target select; open Wight card → click "DC 13 Constitution" Life Drain chip.
3. Roll to a failed save (raw d20 ≤ 12). Observe full 1d8+2 Necrotic damage lands (hp_change), but victim maxHp never decreases; no `hp_max_reduce` log or te.
4. Successful save (≥13) pays correct half damage (no max reduction — correct there).

## Likely Location
`monsters.json` DATA drift (missing structured key) — NOT the resolution files (consumer live, proven live on succubus/vampire twins MA-1547/MA-1550). One-field data fix: author `save_hp_max_reduce: {"equal_to": "damage"}` (exact key per `parseSaveHpMaxReduce`) on `wight.actions[3]`.

## Notes
- Secondary advisory residuals (grep-zero, do-not-chase §70 family): "rises as Zombie 24h later" spawn consumer and "twelve zombies" cap have zero consumers app-wide (`rg "rises.*Zombie|spawnZombie" src/ server/` → 0).
- Damage dice + half-on-success verified exact; this bug is scoped to the max-HP-reduce rider only.
- NPC inline save adjudicator rolls raw d20 bonus:0 (MA-0816 orthogonal quirk).
- Verified 2026-09-30 by MA-1718 subagent run; test-campaign cleared after (change-data {}, log 0).
