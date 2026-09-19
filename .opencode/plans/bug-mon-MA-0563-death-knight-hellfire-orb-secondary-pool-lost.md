# bug-mon-MA-0563-death-knight-hellfire-orb-secondary-pool-lost

**Row:** MA-0563 Death Knight Hellfire Orb (actions[2], aoe-save, DEX DC 18, 10d6 Fire + 10d6 Necrotic, 120 ft 20-ft-radius Sphere, recharge 5-6).
**Verdict:** FAIL — failed save pays ONE damage pool instead of both; RAW halves the intended damage.

## Expected (disk monsters.json, byte-checked 2026-09-19)
`damage_dice_primary:"10d6" Fire` PLUS `damage_dice_secondary:"10d6" Necrotic`; no `dc_success` → half on success (RAW-correct default). Fail = ~70 avg dual-pool; success = half of BOTH pools, each floor-halved independently (MA-0427 recipe).

## Actual (live test-campaign, own-curl log truth)
Picker route rolls ONE 10d6 per target and mislabels it "Fire/Necrotic":

| cast | target | save | formula | total | finalDamage | hpΔ |
|---|---|---|---|---|---|---|
| 1 | Bandit 1 | fail nat12+0 vs 18 | 10d6 | 41 | 41 | -41 |
| 1 | Knight 1 | fail nat16+0 vs 18 | 10d6 | 34 | 34 | -34 |
| 2 | Bandit 1 | fail nat17+0 vs 18 | 10d6 | 36 | 36 | -36 |
| 2 | Knight 1 | fail nat2+0 vs 18 | 10d6 | 36 | 36 | -36 |

Every `|hpΔ|` == a single 10d6 sum. The Necrotic pool is never rolled on any leg. Popup chrome: "Failed — takes 41 Fire/Necrotic damage (rolled 12)" — one roll, two type names.

## Root cause (disk)
- `SaveAttackAoeModal.jsx` (src/components/char-sheet/modals/shared/) has ZERO secondary consumers: single `damage` prop, single roll, single `applyDamageToTarget([damageType])` (:88–150, :1151–1250).
- `MonsterCardModal.jsx:286` `executeBlockSaveRoll` → `setConePicker({ saveDamageFormula /* primary only */, damageType: formatDamageTypes(getDamageTypesForAction(action)) /* joins "Fire/Necrotic" display */ })`.
- MA-0427 secondary transport (`buildSecondaryDamageTransport` → `autoDamageSecondaryFormula`) rides ONLY the block-save/`buildAbilitySaveRollContext` (:1018) + `saveProcessing.applySecondarySaveDamageLeg` (saveProcessing.js:910/1070) prompt seam — the AoE picker never reads it. Picker damage-resolution test (`SaveAttackAoeModal.damage-resolution.test.jsx`) has no secondary coverage.

## Fix sketch
Thread secondary through `setConePicker` → `SaveAttackAoeModal` props (`secondaryDamage`/`secondaryDamageType`), roll separate legs per target, half each leg independently via existing dc_success math, log own `save-damage` entries (primary Fire / secondary Necrotic) like applySecondarySaveDamageLeg, and dual totals in the results row + lastAttack. Single-damage picker rows byte-identical (null triple = inert, MA-0427 pattern).

## Verified-live legs (PASS portion)
- Sphere parse: MA-0084 `sphereRadiusFeet` → picker chrome "20-ft Radius (GM positions tokens; selection advisory)", rangeGateFt:null zone semantics ✓.
- AoE picker auto-resolve Close-only, damage at confirm ✓; both targets selected, per-target adjudication ✓.
- Recharge economy: spend `ability_use` at picker-open ("unavailable until a d6 5+"), spent chip class `mc-dice-link-spell-spent` ✓, 2nd click refused popup "Not Recharged" + `hellfire_orb_refused` zero-spend ✓, recovery d6 LIVE at owner turn-start (`recharge_failed d6:4` held; `monsterRecharge {recharged:false, threshold:5}`) ✓.

## New pitfalls observed
- **AoE-save picker inline NPC saves ignore `warding_bond`**: full-store POST `activeBuffs:[{effect:'warding_bond', saveBonus:17}]` to Bandit 1 logged `saveBonus:0` + raw nat17 FAIL vs DC 18 — MA-0303 raw-d20 picker seam swallows activeBuffs rigs too; success rig does NOT reach this seam. Half-seam proof therefore cited from MA-0520 (Acid Breath nat17→floor-half live), unproven at this DC.
- `/api/campaigns/changes/<Key>` (missing `/:campaign/` segment) returns HTML/200-shaped traps — per-char full-store POST/GET is `/api/campaigns/:campaign/<CharName>` wrapping `{value:{...}}`; read the per-char object from the combined change-data GET first.
- Loaded-tab resurrection beats hand stamps: recharged:false returned within ~6s of an interim wrong-path "200" — the loaded tab's own full-store POST rewrote `Death Knight 1`; correct-path stamp at ~2s poll held.
