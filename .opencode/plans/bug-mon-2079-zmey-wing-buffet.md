# MA-2079 — Zmey Gorynych: Wing Buffet (Costs 2 Actions) resolves with MASTER's 11d8 Fire instead of RAW 2d8 (delegates_to hijack)

## Title
MA-2079 Zmey Gorynych — Wing Buffet (legendary, Costs 2 Actions): zero-numeric `delegates_to` child resolves the MASTER Triple Fire Breath's numerics (11d8, 90-ft Cone) instead of its own RAW values (2d8, 60-ft Cone).

## Overview
The manifest row's description specifies a **DC 23 Dexterity** save for **11 (2d8) Fire damage** in a **60-foot Cone**. On disk the child has ZERO own numeric fields (no `save_dc` / `save_type` / `damage_dice_primary`) and only `delegates_to: "Triple Fire Breath (Recharge 5-6)"`. Per the MA-2045 refinement, a zero-numeric legendary child delegates and the MASTER's numbers resolve — the MA-2022 Storm Call twin. Live press confirms the master's dice and shape land: the ledger records `formula:"11d8"` (len-11) in a "90-ft Cone", ≈5.5× the RAW 2d8. The save DC/type and cost enforcement are coincidentally correct (master shares DC 23 Dex; Costs-2 is name-parsed honestly), but damage dice and AoE shape are wrong.

## Expected (row + monsters.json)
Row (verbatim): "Zmey Gorynych beats his wings in a wide arc, exhaling fire in a 60-foot Cone. Each creature in the area must succeed on a DC 23 Dexterity saving throw or take 11 (2d8) Fire damage."
- RAW: DC 23 **Dexterity**, **2d8** (avg 11) **Fire**, **60-ft Cone**, half on success.
- Disk child (`public/data/monsters.json` → Zmey Gorynych → legendary_actions[3]): `{name:"Wing Buffet (Costs 2 Actions)", delegates_to:"Triple Fire Breath (Recharge 5-6)", description:<as row above>}` — NO save_dc / save_type / damage_dice_primary / damage_type_primary / range fields.
- Master (`actions`): `{save_dc:23, save_type:"Dexterity", damage_dice_primary:"11d8", damage_type_primary:"Fire"}` prose "90-foot Cone".

## Actual (live, test-campaign, round 7, fresh foreign boundary)
- Census: Wing Buffet chip renders generic "Expend Legendary" cosmetic (`mc-dice-link mc-dice-link-legendary`); NO save/dice chip on row (vs Dust Storm "2d6 + DC 23 Strength" and master "11d8 + DC 23 Dexterity" rows).
- Legal press at pool 3 (own-turn regain {max:3,used:0} verified): SPENDS 2 → counter "(1 left)", `monsterLegendaryUses {max:3,used:2}` ✓.
- Picker (`sp-overlay`) opens with MASTER prose: **"90-ft Cone (GM positions tokens; selection advisory)… Dexterity saving throw (DC 23)… On a failed save, target takes 11d8 Fire damage."** — shape hijacked too (90 vs RAW 60; child prose says 60-ft but picker shape comes from master).
- Roll: Bandit 1 (dex +1, max total 21 < DC 23) `saveResult:"failure"`; save-damage `formula:"11d8"`, rolls [2,7,8,7,7,6,4,8,6,8,3] (len 11), total **66**; `hp_change delta:-66` (314→248). fd == Σ == |hpΔ| = 66 ✓ internally, but dice = master 11d8, NOT RAW **2d8** (max 16).
- Refusals honest, nothing spent: own-turn "(after ANOTHER creature's turn)", same-boundary + next-boundary latch "Only one legendary action… Nothing spent, no roll" (`legendary_use_refused (turn)` in log). (insufficient-cost face unreachable while latch+own-turn-restore shadow it — not a defect.)

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (Zmey 486/486, Bandit AC12 victim; EB-joined).
2. Walk Next to Zmey's own turn (round 7) — cd `monsterLegendaryUses` regains to {used:0} (pool 3).
3. Next to next foreign boundary (AasimarTest). Open Zmey card, arm Bandit via `[data-testid="target-select"]`.
4. Fresh-rect click Wing Buffet "Expend Legendary" chip → spends 2 ("1 left"), sp-overlay picker opens showing **"90-ft Cone … 11d8 Fire … DC 23"** (should be 60-ft Cone, 2d8).
5. GM-select Bandit 1 → `.sp-roll-btn` (text "Triple Fire Breath (Recharge 5-6) (1)") → save-damage roll `formula:"11d8"`, fail @DC23, −66 hp on Bandit. RAW should be 2d8 (≤16, half on success).

## Likely Location
**monsters.json data drift** (`public/data/monsters.json` → Zmey Gorynych → legendary_actions[3]): `delegates_to:"Triple Fire Breath (Recharge 5-6)"` + zero own numeric fields → `legendaryRowHasNumericMechanic` (MonsterCardModal.jsx ~:895) sees no own mechanic and resolves master numerics via the delegate path. No engine-layer defect — the delegate engine behaves exactly as MA-2045 defined; the DATA is wrong.

## Fix
Drop `delegates_to` from legendary_actions[3] and author the child's RAW numerics:
`save_dc:23, save_type:"Dexterity", damage_dice_primary:"2d8", damage_type_primary:"Fire"` (and shape note: range 60ft exists in prose only; post-fix picker shape parses from the CHILD prose "60-foot Cone" per MA-2033 picker-lane — verify 60 not 90 after fix). `dc_success` leave unset — half-on-success matches row. Row's "Costs 2 Actions" name-parse and generic Expend cosmetic are correct and unchanged.

## Notes
- Twin of MA-2022 (Thunderbird Storm Call): zero-own-field prose-delegate child inherits master numerics = FAIL(a)/DATA, one-data fix.
- Shape hijack is a second independent fingerprint here: picker text "90-ft Cone" while child description says 60-foot — delegate resolution replaces prose shape too; fix must re-verify picker reads child prose after `delegates_to` removal.
- Master's recharge gate on this child: child press did NOT touch `monsterRecharge` (null) — costs were pure legendary pool (MA-2081 coupling note: fine, child pays pool only).
- Ledger oracle per MA-2035: no `saveResult-Bandit 1` stamp on picker lane; save-damage roll entry (saveDc/saveType/saveResult) is the oracle.
- Verified live 2026-10-12 on :5173, round 7; board carried Zmey 486/486, Bandit 248/999 pre-cleanup; full-manifest admin-clear executed at closeout.
