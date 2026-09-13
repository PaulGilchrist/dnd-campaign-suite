# Bug mon-MA-0033 — Adult Black Dragon Multiattack: Melf's Acid Arrow replace-clause has no cast path (generic DC-17 block save only)

## Title
MA-0033 Adult Black Dragon "Multiattack" — named replacement cast Melf's Acid Arrow (level 3) is inert text; Spellcasting row exposes only a generic anonymous DC 17 Charisma block save (MV-5 inert family, MV-3 Gust precedent).

## Overview
Row MA-0033 expects three Rend attacks AND the option to replace one with a cast of Melf's Acid Arrow (level 3). Live E2E on test-campaign: the Rend half is fully exact ×3 (to-hit +11, 2d6+6 Slashing + 1d8 Acid, exact hp_change/logs/lastAttack). The replace half fails: Spellcasting collapses to ONE `mc-dice-link` "DC 17 Charisma" (MonsterAction.jsx ActionSaveRoll) — no spell chooser, no Melf's Acid Arrow selection, no spell-named log, no damage on save-fail, wrong boilerplate ("Half damage on successful save" — Melf's Acid Arrow is a ranged spell attack, not a save spell). Per MV-8: named mechanic with zero cast/effect path = FAIL (MA-0003 Gust precedent; contrast MA-0009 where the named replacement was castable).

## Expected
Row: "The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast Melf's Acid Arrow (level 3 version)."
Data (public/data/monsters.json adult-black-dragon):
- Multiattack: no attack_bonus/save_dc/dice → display-only (accepted model).
- Rend: `attack_bonus: 11`, "Hit: 13 (2d6 + 6) Slashing plus 4 (1d8) Acid", reach 10 ft.
- Spellcasting: `save_dc: 17`, `save_type: Charisma`; At Will includes **Melf's Acid Arrow (level 3 version)**.
Expected: a cast path attributable to Melf's Acid Arrow — spell-named log, attack roll (+9) or lv3 damage record (5d4+2d4 acid), or at minimum spell identification in the resolution.

## Actual
- Rend half PASS exact (all HIT, no misses needed; budget 3/3):
  - Roll 1: d20 [3] +11 = 14 vs AC 9 ✓ HIT; damage 2d6+6 = [5,2]+6 = 13 Slashing + 1d8 [1] = 1 Acid → 14 total; DW HP 82→68 (Δ14).
  - Roll 2: d20 [7] +11 = 18 vs AC 9 ✓ HIT; damage [1,6]+6 = 13 + [7] = 7 → 20; DW HP 68→48 (Δ20).
  - Roll 3: d20 [5] +11 = 16 vs AC 9 ✓ HIT; damage [1,1]+6 = 8 + [8] = 8 → 16; DW HP 48→32 (Δ16).
  - Log triple per roll (`roll` attack + `roll` damage formula "2d6 + 6" + `hp_change`); `lastAttack` {attackName:"Rend", bonus:11, hit:true, damageApplied:true}; server dwHp 32 = 82−50 ✓.
  - Half-note: secondary Acid dice resolve as flat `1d8` — no bonus to secondary (RAW Adult Black Dragon 1d8+4) is a data-side omission in monsters.json (`damage_dice_secondary: "1d8"`), cosmetic vs this row's text arithmetic ("4 (1d8)" in data description ≠ rolled die); core dice exact.
- Melf's Acid Arrow replace-clause FAIL (MV-5 inert fingerprint):
  - Spellcasting row's ONLY affordance is "DC 17 Charisma" block link; click opens generic "Saving Throw Required — CHARISMA — DC 17 — Half damage on successful save" popup. No per-spell chooser; spell name appears nowhere in popup DOM.
  - Roll Save → save failed (5 vs DC 17): hp_change ZERO (32→32), change-data `damage` empty, `DivinationWizard.targetEffects` key absent/null, `lastAttack.attackName` null, log gains only anonymous `roll`/`save_result` entries.
  - `JSON.stringify(change-data)` and full campaign log grep for "melf"/"acid arrow" = ZERO.
  - Code grep: `melf` in src = PC-only elfish-lineage tests/handler + modal tests; zero monster cast path. 5e spells.json has only `acid-arrow`; 2024 spells.json `melfs-acid-arrow` lv2 exists but no monster consumer keys it; monsters.json Spellcasting carries no per-spell automation.

## Repro
1. :5173 → select **test-campaign** (verify nav header, MV-18) → Encounters → search "Adult Black Dragon" → tick exact row → Join Encounter (lands cs idx 0, HP 195, init 17).
2. Dragon card `[data-testid="target-select"]` → DivinationWizard (HP 82, non-zero).
3. Avatar click → `.mc-overlay`: Multiattack row has zero `.mc-dice-link`; Rend row link "+11"; Spellcasting row link "DC 17 Charisma".
4. Click "+11" ×3, HIT popup Done (`button.dice-roll-reroll-btn`), flush buttonless second-stage via overlay `el.click()` → all three exact per above.
5. Click "DC 17 Charisma" → "Roll Save" → anonymous save resolves, zero damage/te/logs tied to any spell; log+change-data grep "melf" = 0.

## Likely Location
- `src/components/encounter/MonsterAction.jsx` — Spellcasting renders single block `save_dc` link; no per-spell rows/chooser.
- `src/components/encounter/MonsterCardModal.jsx` `handleSaveRoll` — generic roll, `autoDamageFormula:null`, no spell identity.
- Data: monsters.json Spellcasting has no per-spell automation; no Melf's Acid Arrow consumer app-wide (MV-5 family: MA-0005, MA-0012).

## Verdict
FAIL (Rend ×3 half fully exact live; named replacement cast Melf's Acid Arrow has zero cast/effect path — MV-3 Gust precedent, MV-8 bar not met).
