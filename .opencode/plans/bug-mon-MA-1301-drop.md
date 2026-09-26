# MA-1301 Piercer Drop — FAIL(a)/DATA (success-leg half-leak, MA-0781 family)

Date: 2026-09-26 | Campaign: test-campaign | Rig: Piercer 1 → Bandit 1 AC12 HP999, ±19 dex rig via full cs {value:} POST (§160 full-word saveBonuses + §212 nested saving_throws, targetName re-armed same POST §491).

## Disk (docs/monster-actions-manifest.json MA-1301 + public/data/monsters.json piercer.actions[1])
- attack_bonus:0 (junk "+0" chip, §490 family), save_dc:11, save_type:"Dexterity", damage_dice_primary:"3d6", damage_type_primary:"Piercing"
- `dc_success` ABSENT on a damage-bearing save row → engine stamps `dcSuccess:"half"` (observed on fail-leg save entry) and INLINE seam honors half-default (MA-1245 twin proof) → RAW-success-zero prose is structurally unauthorable without the field.

## Live ledger
Chip census (Drop row, only DC chip pressed, 2 presses, both first-click live):
- "+0" junk (unpressed §490) | "3d6" junk (unpressed §440/§490) | "DC 11 Dexterity" REAL (mc-dice-link-save-clickable)

FAIL leg (dex −19): save rolls[5] bonus−19 total−14 vs DC 11 → saveResult:"failure"; save-damage formula:"3d6" verbatim rolls[3,2,1] total 6 finalDamage 6 Piercing; hp_change −6 HP 999→993. |hpΔ|==fd full ✓ popup "✗ SAVE FAILURE (-14 vs DC 11) 6 damage applied".

SUCCESS leg (dex +19): save rolls[9] bonus+19 total 28 vs DC 11 → SAVE SUCCESS popup ✓ — BUT save-damage saveSuccess:true STILL WRITTEN: rolls[3,2,5] rolled 10, total=5=floor(10/2) HALF stamp; hp_change −5 HP 999→994. |hpΔ|==5 ≠ 0. NEW damage entry on success → success-damages.

Popup chrome "(d20 9 + 0)" cosmetic bonus-vs-log asymmetry (§189 log canonical), excluded.

## Defect
RAW (prose + save_effect): "Failure: 10 (3d6) Piercing damage" — success = ZERO (no half wording; half-default N/A per task brief §63). App pays half on success → MA-0781 default-half leak family.

## Fix (data-only, zero code)
`dc_success:"none"` on MA-1301 / piercer.actions[1] (MA-0481/0622/0768/0781 family fix). Manifest NOT edited per instruction.

## Advisory note (not scored)
"reduces any damage it takes from the fall by 20": grep disk — no structured automation/advisory field on row; no self-fall-damage consumer (src/services/combat/steps/features/piercer.js is unrelated PC Enhanced-Critical piercing passive). Advisory-unbuilt expected (§70) — note only.

## Cleanup verified
Popups/overlays 0; Admin Clear Change Data + Clear Campaign Log via single snippet + dialog listener (MCP auto-accept race §111/§485 twin; listener removed); server-side truth: cs creatures 0, log 0; header test-campaign throughout.
