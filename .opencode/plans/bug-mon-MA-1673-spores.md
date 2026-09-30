# BUG MA-1673 — Vrock Spores (vrock|actions|2) — FAIL(a)/DATA — §523/MV-20 half-default leak on success

## Row (disk, public/data/monsters.json vrock actions[2])
- save_dc:15, save_type "Constitution", range "20-foot Emanation", damage_dice_primary:"1d10", save_effect canonical "the Poisoned condition".
- **dc_success ABSENT.** RAW: initial FAIL = Poisoned + turn-start 1d10 DoT (NO immediate damage); SUCCESS = NO effect, zero damage, zero condition.

## Live proof (test-campaign, Bandit 1 ac12/HP999 rig, picker seam)
- FAIL face (full-word saveBonuses.constitution:-19): nat6−19 → saveResult:"failure", DC15 Constitution machine-stamped ✓; Poisoned granted (§52) meta {dc:15, ability:"con", source:"Vrock 1"} ✓; advisory honest in grant log ("NPC turn-end auto-repeat and 1-minute expiry GM-enforced") ✓; formula "1d10" byte ✓; finalDamage 5 == hpΔ−5.
- SUCCESS face (constitution:+19): nat15+19=34 → saveResult:"success" ✓, zero NEW condition grant ✓ (§1116, stale Poisoned persists §96) — **BUT save leg paid half: save-damage dcSuccess:"half", rolls [7]→finalDamage 3, hp_change −3.** Results modal: "Bandit 1: Saved — takes 3 Poison damage (rolled 15, halved)". Picker copy itself fabricates "On a successful save, target takes half damage."

## Root cause
`resolveBlockSaveDcSuccess` / `action.dc_success ?? 'half'` default (playbook §456/:523, §MA-1547 :1120) — §MA-1670: half-default honest iff description byte-says "Success: Half"; vrock description says success ENDS THE EFFECT (zero). Live half-paid on RAW-zero-success = MV-20/MA-0481/0622/0781 family.

## Fix (one field, DATA)
Author `dc_success:"none"` after `save_type` — Ghost Horrific Visage MA-0781 fixed twin keeps damage_dice_primary authored (immediate full-on-fail tolerated as §87 turn-start-DoT model approximation; no plain-poison turn-start tick consumer exists app-wide — grep confirmed: turnStart consumers only infernal_wound/whirlwind/healing/recharge).

## Secondary notes (not defects per ledger)
- Immediate 1d10 full on FAIL = RAW-inverse timing vs turn-start DoT — §87 model approximation, disk-byte formula, tolerated (MA-0622 post-fix shape).
- 20-ft Emanation → "20-ft Radius (GM positions tokens; selection advisory)" picker = MA-0622/MA-0590 block-row seam, accepted radius approximation (§85).
- Repeat-save-at-turn-end + Holy Water clause: zero structured `repeat_save` key, grep-zero consumers → GM-advisory (§70, MA-0463/0491/0586 precedent); advisory honestly recorded in condition-applied log copy.
- Board: Vrock 1 + Bandit 1, log press:log 1:1 (2 picker confirms → 2 ability_use + 2 save-damage + 2 hp_change + 1 condition). Console 0 errors.

## Verdict
FAIL(a)/DATA — success face pays half damage (3) where RAW pays zero; one-field fix `dc_success:"none"`. (Verified 2026-09-30, MA-1673 session.)
