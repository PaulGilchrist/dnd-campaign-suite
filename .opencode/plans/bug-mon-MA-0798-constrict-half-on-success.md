# MA-0798 FAIL(a)/DATA — Giant Constrictor Snake · Constrict: default-half leak on save success

**Row:** monsters.json `giant-constrictor-snake.actions[2]` "Constrict" — save_dc 14, save_type Strength, range "10 feet" (shapeless → inline auto-save, §208), damage_dice_primary "2d8 + 4" Bludgeoning, save_effect "The target has the Grappled condition (escape DC 14)." avg 13 = 2d8(9)+4 ✓.

**Defect:** `dc_success` ABSENT on disk. RAW description authors NO "Success:" clause → success pays ZERO damage and takes nothing. Consumer `resolveBlockSaveDcSuccess` (src/components/encounter/MonsterCardModal.jsx:214, `action.save_dc != null ? (action.dc_success ?? 'half') : null`) defaults absent → **'half'**, so every success leg pays half damage. §63 / MA-0481 / MA-0622 / MA-0768 / MA-0781 family.

## Live proof (test-campaign, 2026-09-21, Bandit 1 AC12 maxHp999, inline seam)
Saving_throws rig (§209 nested-abbrev full-store cs POST):
| leg | nat | bonus | total | vs DC14 | rolled | **fd paid** | RAW should |
|---|---|---|---|---|---|---|---|
| 1 | 20 | −5 | 15 ✓ | success | [3,2]+4=9 | **4 = floor(9/2)** | 0 |
| 2 | 19 | −5 | 14 ✓ | success (tie) | [6,5]+4=15 | **7 = floor(15/2)** | 0 |
| 3 | 3 | +19 | 22 ✓ | success (deterministic) | [1,7]+4=12 | **6 = floor(12/2)** | 0 |
| 4 | 11 | −5 | 6 ✗ | failure | [7,6]+4=17 | **17 full ✓** | 17 ✓ |

- Every victim `roll save` entry stamps `dcSuccess:"half"` (machine truth). hp_change deltas match fd exactly (−4/−7/−17/−6).
- Grappled: granted ONLY on fail leg (one `condition` log entry, §59/§211 canonical word works live); zero NEW grants across 3 success legs ✓.
- DC 14 / Strength enforced on all legs ✓. Prior MA-0796 fail-leg proof (nat5✗ fd15 full + Grappled) re-confirmed axis intact.
- App console clean (sole error = harness wrong-route 404, §112).

## Fix (one field, DATA)
`giant-constrictor-snake.actions[2]` add `"dc_success": "none"`. Byte-twins: MA-0481/MA-0622 (Terrifying Presence)/MA-0768/MA-0781 (Horrific Visage). Consumer already honors it (`computeDamageAfterSave(raw,true,'none')`→0); half default lives upstream in `resolveBlockSaveDcSuccess` — key tests 'half' explicitly (MA-0622). Post-fix: success legs zero-damage; fail leg byte-identical full+Grappled. Escape-DC sustained grapple = §70/MA-0287 accepted advisory.
