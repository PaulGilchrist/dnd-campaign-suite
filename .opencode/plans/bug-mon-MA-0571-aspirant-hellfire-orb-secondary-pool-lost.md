# bug-mon-MA-0571-aspirant-hellfire-orb-secondary-pool-lost

**Row:** MA-0571 Death Knight Aspirant Hellfire Orb (actions[2], aoe-save, DEX DC 15, 6d6 Fire + 6d6 Necrotic, 120 ft 20-ft-radius Sphere, recharge 5-6).
**Verdict:** FAIL(a) — MA-0563 TWIN CONFIRMED. Failed save pays ONE damage pool instead of both; RAW halves the intended damage.

## Expected (disk monsters.json, byte-checked 2026-09-19)
`damage_dice_primary:"6d6" Fire` PLUS `damage_dice_secondary:"6d6" Necrotic`; no `dc_success` → half on success (RAW default). Fail = two independent 6d6 pools; success = each pool floor-halved independently (MA-0427 recipe).

## Actual (live test-campaign 2026-09-19, own-curl log truth)
Picker route rolls ONE 6d6 per target, mislabels it "Fire/Necrotic":

| cast | target | save | rolls | total | finalDamage | hpΔ |
|---|---|---|---|---|---|---|
| 1 | Knight 1 | success nat16 | [2,2,1,2,3,3] | 13 | 6 | -6 |
| 1 | Bandit 1 | success nat19 | [5,4,1,5,4,6] | 25 | 12 | -12 |
| 2 | Knight 1 | fail nat6 | [1,5,2,4,1,1] | 14 | 14 | -14 |
| 2 | Bandit 1 | fail nat7 | [5,3,6,4,2,4] | 24 | 24 | -24 |

Every save-damage entry carries SIX dice (single 6d6), `damageType:"Fire/Necrotic"` concatenated. The Necrotic pool is never rolled on any leg. Popup chrome: "Failed — takes 14 Fire/Necrotic damage (rolled 6)" — one roll, two type names. `lastAttack` mislabels the same single-pool value into BOTH `primaryDamage` and `secondaryDamage` fields ("Fire/Necrotic" each).

## Root cause (disk — identical to MA-0563, zero transport difference)
- `SaveAttackAoeModal.jsx` (src/components/char-sheet/modals/shared/): ZERO secondary consumers (grep-zero for `secondary|secondaryDamage|buildSecondaryDamageTransport`); single `damage` prop, single roll, single `applyDamageToTarget([damageType])`.
- `MonsterCardModal.jsx:286` `setConePicker` passes `saveDamageFormula` (primary only); `damageType: formatDamageTypes(getDamageTypesForAction(action))` joins "Fire/Necrotic" for display only.
- MA-0427 secondary transport (`buildSecondaryDamageTransport`, :660-673) rides ONLY the `buildAbilitySaveRollContext`/saveProcessing prompt seam (:1015); the AoE picker never reads it.

## Fix sketch
Same as MA-0563: thread `secondaryDamage`/`secondaryDamageType` through `setConePicker` → `SaveAttackAoeModal`, roll separate legs per target, half each leg independently via existing dc_success math, own `save-damage` log entries per leg, dual totals in results + lastAttack. Null triple = byte-inert for single-damage rows. One fix repairs both rows (MA-0563 + MA-0571).

## Verified-live legs (PASS portion)
- Sphere parse MA-0084, picker chrome "20-ft Radius (GM positions tokens; selection advisory)" ✓; picker auto-resolve Close-only, damage at confirm ✓; per-target adjudication ✓.
- Half-on-success math vs single pool: floor(13/2)=6, floor(25/2)=12 ✓ (half-leg works; would apply correctly per-leg post-fix).
- Recharge economy live: `ability_use` spend at picker-open, spent chip class `mc-dice-link-spell-spent` on the SAVE chip, refused popup "Not Recharged" + `hellfire_orb_refused` zero-spend ✓, `recharge_failed (d6: 4)` logged at owner turn-start rounds 2 AND 3 with threshold-5 semantics ✓ (natural d6 5+ recovery not observed within 2 attempts; GM stamp `{value:{monsterRecharge:{'Hellfire Orb':{recharged:true,threshold:5}}}}` to `/api/campaigns/test-campaign/Death Knight Aspirant 1` re-armed held and cast #2 fired).

## New pitfalls observed (this session)
- cs.activeCreatureName mirror frozen at AasimarTest for 13 consecutive Next-clicks; `__initiative__.lastAppliedTurnStartCreature` ("<round>:<Name>") is the reliable walk tracker — its round prefix reveals the round wrap even while `__initiative__.activeCreatureName` reads undefined mid-walk.
- Turn-start recharge d6 can replay an identical value across rounds (d6:4 twice) — count attempts by round token, not dice variety.
- Three 2d20 `roll` entries precede the first `ability_use` = join/initiative noise; exclude from adjudication.
- EB search anchor: `input[placeholder="Search by name, type, or subtype..."]` — `input[placeholder]` .first() grabs the hidden file input.
- Success-row popup "rolled N" prints the SAVE d20, not damage; damage truth only in log `rolls`/`total`.
- Refusal fired on FIRST click of the spent chip (no absorbed-click this session).
- Cleanup: npc-remove ×3 confirm-override + admin clear → cd 0 log 0, hard-reload clean re-select.
