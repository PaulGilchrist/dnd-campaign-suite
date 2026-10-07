# Bug: CLA-225 Martial Arts — armor/shield gate missing; Martial Arts die not applied to Monk weapons

**Verdict: FAIL** (gate unenforced, monk-weapon die wrong). Verified 2026-10-07 live at localhost:5173, test-campaign, Disciplined_Monk lv20 Warrior of Mercy (2024).

## Canonical (public/data/2024/classes.json)
- lv1 feature text: "You can roll 1d6 in place of the normal damage of your Unarmed Strike or **Monk weapons**. This die changes as you gain Monk levels." — row's lv1 "1d6" claim QUOTED ✓.
- Gate text: "Benefits while unarmed or wielding only Monk weapons and **not wearing armor or wielding a Shield**".
- `martial_arts_die` ladder: lv1–4=6, lv5–10=8, lv11–16=10, lv17–20=**12**. (Manifest inline d4/d6/d8/d10 & lv20=1d10 contradicts the app canonical file; lv17+ fold is 1d12, not 1d10.)

## Defect 1 — armor/shield gate not enforced (leg 3 FAIL)
- BEFORE strip (equipped `Quarterstaff, Leather, Shield`): Bonus Actions row "Unarmed Strike +11 / 1d12+5" PRESENT and clickable. Click rolled "d20 1 +11 (+11 to hit)" → Boon reroute → damage ledger "1d12+5 [bludgeoning]: 3 +5" = 8. Row was live while armor+shield worn.
- AFTER strip (wizard step 16 → equipped `Quarterstaff`): row remains live ("+11 / 1d12+5"; rolled "d20 11 +11").
- Expected: row absent/refused while armor or shield equipped. Code: `attackCalc2024.js:534-540` pushes `buildMonkAttacks` for any `class.name==='Monk'` with no equipped armor/shield check; `classRules2024.js:231-237 getMartialArtsDie` never returns falsy (default 4). No `no_armor_no_shield` gate on this lane (only speedUtils/charSummaryCalc use it).

## Defect 2 — Martial Arts die not applied to Monk weapons (leg 2 FAIL)
- Quarterstaff row: damage `1d6+5`; popup `1d6+5: 1 +5` = 6 — normal staff die, NOT the Martial Arts die (canonical: MA die replaces normal damage of Monk weapons → expect `1d12+5` at lv20).
- DEX is correct: STR 18 (+4) unused; DEX 21 (+5) used for attack (+11 = 5+6) and damage (+5) — `attackCalc2024.js:241` `Math.max(STR,DEX)`.

## Working
- lv20 die live = **1d12** (badge "Martial Arts Die: d12"; ledger "+1d12" in `1d12+5`), matching app canonical ladder (manifest lv20=1d10 claim overridden by canonical file).
- Grapple DEX lane (leg 4, advisory): grapple refused out of combat ("No target selected. Select a combat target first"); consumer `useCharActionsBaseActions.js:156-159` routes Monk grapple to Dexterity (Acrobatics); sheet shows Acrobatics (+11) = DEX 5 + PB 6; feature text quotes "For Grapple or Shove, use Dexterity modifier for save DC". Focus Save DC displayed 21.
- Latch: second same-turn sheet click re-rolled ("d20 6 +11") — once/turn latch not enforced outside combat context (advisory).

## Fix guidance
Gate the `buildMonkAttacks` block (and any MA-die substitution) behind "no armor AND no shield equipped" (reuse `hasEquippedShield` attackCalc.js:372 + armor-category check from speedUtils.js); apply `martialArtsDie` to monk-weapon damage rows when the gate passes.

## Cleanup state
Equipment restored to `[Quarterstaff, Leather, Shield]` (FT-048); Admin Clear Change Data → GET change-data `{}`; Clear Campaign Log → GET /api/campaigns/test-campaign/log `[]`.
