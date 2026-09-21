# Bug MA-0664 — Dust Mephit "Variant: Summon Mephits" (actions[2]) — inert usage-only summon

## Verdict
VERIFIED: FAIL — class (b): honest-inert row, zero affordance, zero consumer. DATA fix ticket. MA-0648 usage-only-summon twin.

## Automation under test
- ID: MA-0664, Monster: Dust Mephit (`dust-mephit`, CR 1/2)
- Row: actions[2] "Variant: Summon Mephits", actionType other
- Canonical: 25% chance to summon 1d4 mephits of its kind; unoccupied space within 60 ft, ally, can't summon others; remains 1 min / until summoner-or-self dies / dismissible as action.

## Disk state (public/data/monsters.json dust-mephit.actions[2], :19936-19937)
- `name` + `description` + `usage:{type:"per day",times:1}` ONLY.
- NO `automation` dict, NO numerics (`uses`/`maxUses`), NO chance/count fields.

## Live evidence (test-campaign, :5173, 2026-09-20)
- Re-joined after MA-0663 admin clear (header-verified test-campaign twice; Campaigns nav deselect reload quirk §95 hit once, re-selected). EB joined `Dust Mephit 1` (cs init 13) + `Bandit 1` (init 20, AC12 clean victim §75).
- Card via `img.avatar-image[alt="Dust Mephit 1"]` (§128 suffixed alt): row HTML = `<strong>Variant: Summon Mephits.</strong> <span>…prose…</span><em> (1/Day)</em>` — usage-only fingerprint, cosmetic "(1/Day)" §162.
- Row interactive count: `.mc-dice-link`=0, `button`=0, `[role=button]`=0, `a`=0, `[role=switch]/radiogroup/tablist`=0. VARIANT TOGGLE: none — "Variant:" name prefix renders as plain row-header strong; NO variant filter/toggle on card (variantTextHits = header strong only).
- Card-wide census: 10 mc-dice-link = ability/save/skill chips + Claws "+4" + Blinding Breath "DC 10 Dexterity" (legit rows); no legendary/lair/spell chips, no Expend affordance. §158 fake-chip check NEGATIVE: the strong does not become a chip (generic other-type rows have no chip path; chip path is Spellcasting-markup-only).
- Click-probe ×2 at fresh center rect (858,569): zero popup overlays, log 4→4→4 unchanged (join-noise only: encounter + initiative rolls), zero `ability_use`, zero summon spawn, zero refusal token. combatSummary unchanged — no extra mephits.
- Change-data audit: zero keys matching summon|spawn|variant|mephit (nested walk).
- Cleanup: admin clears + GET verify log=0, change-data keys=0 (own curl, quiet state).

## Grep evidence (self-run)
- `Summon Mephits`, `mephits of its kind` → ONLY monsters.json:19936-37. Zero in `src/`, zero in `server/`.
- `monster_summon` → grep-zero app-wide (§187 twin). Summon seam `summon_spirit` dispatch `src/services/automation/index.js:610` → `handleSummonSpirit`/`handleSummonSpiritConfirm` — PC-cast-only (2024 spells.json authored, CharActionModals path).
- "Variant:" special-case: ZERO in `MonsterAction.jsx`, `MonsterCardModal.jsx`, `MonsterCardHelpers.js`. All "variant" machinery is orthogonal and field-armed: two-handed (`buildTwoHandedVariantOffer` MonsterCardHelpers.js:687), ranged (`buildRangedVariantOffer` :738/747), Animal Spirit chooser (§8, `parseAnimalSpiritVariants`). None keys off a name prefix; no code renders/suppresses variant rows differently — prefix is inert display text.
- Row renderer arms affordances only via attack_bonus/dice/save_dc/Spellcasting-markup/automation.effect/legendaryGate/zone dict (MonsterAction.jsx, §187) — row matches none.

## Variant:-row family scoping
- Python dump monsters.json: exactly **1** "Variant:" row app-wide (dust-mephit actions[2]), 1 monster. No family-wide renderer ticket warranted; single-row DATA fix.

## Likely Location
- Renderer (root): `src/components/encounter/MonsterAction.jsx` — automation-less other-type row, zero affordance.
- Summon machinery to reuse: `src/services/automation/handlers/spells/summonSpiritHandler.js` + `automation/index.js:610` dispatch.
- DATA: `public/data/monsters.json` dust-mephit.actions[2].

## Design option
- Preferred: NEW `automation:{type:"monster_summon", monster:"dust-mephit", chance:0.25, count:"1d4", range_ft:60, duration_rounds:10}` (MA-0648 design + 25% chance adjudication + 1d4 count roll + 1-minute clock rounds:10 §37); chip on row, coin+count logged, spawn into combatSummary via summonSpiritHandler fold, ally tagging, self-summon-block flag ("can't summon other mephits" → summoned copies lack the row), "(1/Day)" gated via authored `uses:1`+`maxUses:1` (§162/§187).
- Alternative: strip "Variant:" naming into canonical Summon Mephits row — cosmetic only, does not fix inertness.

## Notes
- "(1/Day)" cosmetic until numerics authored (§162/§187).
- Duration/dismissal/"can't summon others" residuals §70-class, acceptable only if summon fires (it does not).
- Twins: MA-0648 (Drow Mage), MA-0651 (Priestess yochlol), MA-0655/0658 (Duergar). Screenshot: ma-0664-dust-mephit-card.png.
