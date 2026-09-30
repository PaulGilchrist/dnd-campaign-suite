# BUG MA-1674 — Vrock Stunning Scream (vrock|actions|3) — FAIL(a)/DATA — §523 half-default leak on success + uses:"1/Day" STRING NaN gate (unenforced mechanical double-dip)

## Row (disk, public/data/monsters.json vrock actions[3])
- save_dc:15, save_type "Constitution", range "20-foot Emanation", damage_dice_primary:"3d6", uses:"1/Day" STRING, save_effect canonical "the Stunned condition until the end of the vrock's next turn". All keys byte-match manifest.
- **dc_success ABSENT and description has NO "Success:" clause.** RAW: fail = 3d6 Thunder + Stunned; success = NOTHING.
- §MA-1670/:1190: half-default honest iff description byte-says "Success: Half" → NOT honest here. `action.dc_success ?? 'half'` default (MonsterCardModal.jsx:268 resolveBlockSaveDcSuccess, :1145, :2150).

## Live proof (test-campaign, Bandit 1 ac12/HP999 rig, picker seam, console 0)
- FAIL face (full-word saveBonuses.constitution:-19): nat16−19 → saveResult:"failure", DC 15 Constitution machine-stamped ✓; formula "3d6" byte ✓; damageType "Thunder" ✓; finalDamage 11 FULL == |hpΔ| (999→988); Stunned granted §52 cd activeConditions:["stunned"] + meta {dc:15, ability:"con", source:"Vrock 1"} ✓; durationNote "until the end of the vrock's next turn (GM-enforced)" honest §38.
- SUCCESS face (constitution:+19, victim cd pre-cleared empty §867): nat16+19=35 → saveResult:"success" ✓, zero NEW grant — victim cd keys STAY EMPTY {activeConditions:[], activeConditionMeta:{}} §1116 ✓ — **BUT save leg paid half: rolls [2,4,1]→finalDamage 3, hp_change −3 (988→985). Results modal: "Bandit 1: Saved — takes 3 Thunder damage (rolled 3, halved)". Picker copy fabricates "On a successful save, target takes half damage."** Mechanic + prose = one fingerprint (§MA-1673 twin verbatim).

## Defect 2 — uses:"1/Day" STRING → NaN silent null gate (playbook :172 MA-0633-neighbor EXPLICITLY names this row)
- abilitySaveMaxUses (monsterAbilityUses.js:20-27) = Number(maxUses ?? uses) = Number("1/Day") = NaN → monsterAbilityUsesGate null → resolveAbilityUsesGate (Modal:1506) never refuses; picker-open spend (:455) skipped (usesGate null).
- LIVE: same-day press 2 fired FULL (save rolled, half damage paid, hp −3) — zero refusal. Whole-log census: refus=0, blocked=0, exhaust=0, 1/day=0, "zero spend"=0. monsterSpellUses NEVER written. Row chip renders no counter (has1Day false, no spent class) — §240/MA-0681 uses-STRING formatActionUsage gap.
- NOT "unenforced-but-recorded": unenforced AND unrecorded mechanical double-dip on a damage+condition dealer → not tolerable per MA-1268 contrast (ungated cosmetic acceptable only for advisory rows; MA-0633 mechanical gate precedent).

## Root cause
`resolveBlockSaveDcSuccess` / `action.dc_success ?? 'half'` half-default (§456/:523/:809) + non-numeric `uses` string disarming MA-0020 gate.

## Fix (DATA, this row only)
1. Author `dc_success:"none"` after `save_type` (MA-0781/MA-1673 twin one-field shape; keeps damage_dice_primary:"3d6" full-on-fail ✓ live-proven fd FULL).
2. Numerics per MA-0633/MA-1016 fetid-cloud/fog-cloud template: `usage:"1/Day"` + `uses:1` + `maxUses:1` (string drops §240/§169; numerics arm gate :1506 + picker-open spend :455 + chip "(N left)" counter).

## Advisories (not defects)
- "(demons succeed automatically)": grep-zero consumer app-wide (eye-ray auto-success lane only) → §70 GM-advisory.
- Stunned expiry "until end of vrock's next turn": no clock consumer, durationNote stamped GM-enforced (§38/§70).
- 20-ft Emanation → "20-ft Radius (GM positions tokens; selection advisory)" picker = sanctioned MA-0622/0590 block-row approximation.

## Ledger
Press:log 1:1 — press 1: ability_use + roll(save-damage) + condition + hp_change; press 2: ability_use + roll(save-damage) + hp_change (no condition). Console 0 errors. Cleanup: tab closed first (§15), admin/clear-change-data + admin/clear-log verified server-side (log [], change-data {}).

## Verdict
FAIL(a)/DATA — success face pays half damage (3) where RAW pays zero (dc_success:"none" fix) AND uses:"1/Day" STRING gate disarmed allows unlimited same-day fires (numerics fix). (Verified 2026-09-30, MA-1674 session.)
