# Bug mon-MA-0054 — Adult Blue Dragon Multiattack: Shatter replace-clause has no cast path (generic DC-18 Charisma block save only)

## Title
MA-0054 Adult Blue Dragon "Multiattack" — named replacement cast Shatter is inert text; Spellcasting row exposes only a generic anonymous DC 18 Charisma block save (MV-5 inert family, MA-0033 precedent).

## Expected
Row: "The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast Shatter."
Data (public/data/monsters.json Adult Blue Dragon):
- Multiattack: no attack_bonus/save_dc/dice → display-only (accepted model); description matches row exactly.
- Rend: `attack_bonus: 12`, "Hit: 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage", reach 10 ft.
- Spellcasting: `save_dc: 18`, `save_type: Charisma`; At Will includes Shatter.
Expected: a cast path attributable to Shatter — spell-named log, CON save vs DC 18 with slot-scaled thunder damage (spells.json shatter lv2 3d8/4d8 CON half), or at minimum spell identification in the resolution.

## Actual
- Rend half PASS exact (budget 1/2 used, HIT on roll 1):
  - d20 [14] +12 = 26 vs AC 9 ✓ HIT; damage 2d8+7 = [4,2]+7 = 13 Slashing + 1d10 [6] = 6 Lightning → 19 total; DW HP 82→63 (Δ19).
  - Log triple (`roll` attack + `roll` damage formula "2d8 + 7" + `hp_change` −19 with Slashing/Lightning breakdown); `lastAttack` {attackName:"Rend", bonus:12, hit:true, damageApplied:true}; server change-data dwHp 63 ✓.
  - Cosmetic notes: `damage_dice_secondary: "1d10"` omits RAW +5 (same data-side omission as MA-0033); `lastAttack.secondaryDamageType` mislabeled "Slashing" while log breakdown is correctly Lightning.
- Shatter replace-clause FAIL (MV-5 inert fingerprint):
  - Spellcasting row's ONLY affordance is "DC 18 Charisma" block link → generic popup "Saving Throw Required — CHARISMA — DC 18 — Half damage on successful save". No spell chooser; spell name appears nowhere in popup DOM. (Bonus wrongness: Shatter targets a Constitution save, modal asks Charisma.)
  - Roll Save → save failed (nat 1 vs DC 18): hp_change ZERO (63→63), `lastAttack.attackName` null, `damageFormula` null, `DivinationWizard.targetEffects` ABSENT, log gains only anonymous `roll` CHA entry.
  - Full campaign log grep "shatter" = ZERO; change-data grep = monster-card display descriptions only (viewingMonster actions/legendary_actions text), zero cast/attribution records.
  - Code grep: `shatter` in src = PC Spell Mastery payment test only (spellPreparationService.spellMasteryPayment.test.js); zero monster cast path. spells.json (5e + 2024) both carry `shatter` lv2 CON-half 3d8 thunder — no monster consumer; monsters.json Spellcasting has no per-spell automation.

## Repro
1. :5173 → select **test-campaign** (verify header, MV-18) → Encounters → tick "Adult Blue Dragon" (CR 16, not Dracolich) → Join Encounter (lands HP 212, init 2).
2. Dragon card `target-select` → DivinationWizard (HP 82, non-zero).
3. Avatar click → `.mc-overlay`: Multiattack row zero links; Rend row link "+12"; Spellcasting row link "DC 18 Charisma".
4. Click "+12" → HIT popup Done (`button.dice-roll-reroll-btn`) → flush buttonless second-stage popup via el.click() → exact per above.
5. Click "DC 18 Charisma" → generic sp-modal → "Roll Save" → anonymous save resolves, zero damage/effects/logs tied to Shatter; log grep "shatter" = 0.

## Likely Location
- `src/components/encounter/MonsterAction.jsx` — Spellcasting renders single block `save_dc` link; no per-spell rows/chooser.
- `src/components/encounter/MonsterCardModal.jsx` `handleSaveRoll` — generic roll, no spell identity, no autoDamageFormula.
- Data: monsters.json Spellcasting has no per-spell automation; no Shatter monster consumer app-wide (MV-5 family: MA-0005, MA-0012, MA-0033, MA-0036).

## Verdict
FAIL (Rend exact live; named replacement cast Shatter has zero cast/effect path — MA-0033/MV-8 bar not met).
