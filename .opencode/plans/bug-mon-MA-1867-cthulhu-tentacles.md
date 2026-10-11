# MA-1867 — Cthulhu Tentacles: compound attack+save row ships attack-only; DC 26 STR save lane, Grappled grant, escape DC, pull, and ongoing 4d8 all prose-only (FAIL a)

## Title
MA-1867 Cthulhu Tentacles — secondary save half entirely missing (no save_dc/save_type/hit_conditions/escape_dc/hit_pull); attack half exact

## Overview
Tentacles (monsters.json Cthulhu actions[2]) is an attack+save row: "+18, reach 20 ft. Hit: 28 (4d8+10) Bludgeoning. If Huge or smaller: DC 26 Strength save or pulled 20 ft. + Grappled (escape DC 26); while Grappled takes 18 (4d8) Bludgeoning at start of next turn." Live E2E (test-campaign, localhost:80, 2026-10-11): the attack half is byte-exact (nat20 crit 38 vs AC19, "4d8*2+10 (7,6,2,1)"=42 Bludgeoning, hp 224→182 −42 exact, log names Tentacles). The ENTIRE secondary half is absent: no save chip arms (row lacks numeric `save_dc`/`save_type` — MonsterAction.jsx:116 `save_dc==null||<=0 → null`), zero save adjudication live (saveEntries=0, lastAttack.saveDc/saveResult/saveType all null), no grapple ever granted (no `hit_conditions` — buildHitConditionClause reads action.hit_conditions only), escape DC prose-only ("escape DC —" twin MA-1842 via handlePlainDamage:660 requiring action.escape_dc), pull-20ft inert (parseHitPull MonsterCardHelpers.js:763 requires structured hit_pull dict; §70/MA-0507), ongoing turn-start 4d8 producer dead (MA-1842: turnStartEffects.js:171/:563 applyGrappleDamageTurnStart is a PC passive_rule grapple_damage tick; grep-zero monster producer — live probe confirmed).

## Expected (description quote)
"Melee Attack Roll: +18, reach 20 ft. Hit: 28 (4d8 + 10) Bludgeoning damage. If the target is a Huge or smaller creature, it must succeed on a DC 26 Strength saving throw or be pulled 20 ft. toward Cthulhu and have the Grappled condition (escape DC 26). While Grappled this way, the target automatically takes 18 (4d8) Bludgeoning damage at the start of its next turn."
- Attack half: attack_bonus 18 ✓, "4d8 + 10" ✓ Bludgeoning ✓ (avg 28 ✓), reach 20 ft. ✓ disk.
- Save half: DC 26 STR must prompt/adjudicate post-hit → requires `save_dc: 26, save_type: "Strength"` (compound fork MA-0551/§117 two-chip shape) — ABSENT.
- Grapple on save-fail → requires condition transport (hit_conditions/save_effect conditions) — ABSENT. Escape DC 26 → `escape_dc: 26` — ABSENT.
- Pull 20 ft → `hit_pull:{distance_ft:20,size_limit:"Huge"}` (MA-1489-family structured key) — ABSENT.
- Ongoing 4d8 at victim's next turn start → no engine consumer for monster-hit grapple riders (MA-1842 ENGINE(b) twin) — ABSENT.

## Actual
1. Attack half PASS exact: attack roll nat20 (first die; rolls:[20,7] cosmetic dupe §94) +18=38 vs targetAc 19, hit:true isCrit:true; damage formula `4d8*2+10 (7, 6, 2, 1)` total/finalDamage 42 Bludgeoning resisted:false; hp_change −42 cur 182 (224 seeded); log names Tentacles ×2 (attack+damage), all targetName ElderPaladin.
2. Save half MISSING: after Done, no save prompt popup ever appears (DOM .sp-overlay/.sp-modal/.popup-overlay = 0), log saveEntries=0, lastAttack `{saveDc:null, saveResult:null, saveType:null}`. No chip renders on the row beyond the +18 attack chip (§116 attack rows render one chip; with no authored save_dc the compound second chip never arms).
3. Grapple never applied: ElderPaladin activeConditions [] and activeConditionMeta absent after the hit; grappleEntries=0.
4. Ongoing probe zero: initiative walked AasimarTest→…→ElderPaladin (change-data.activeCreatureName=ElderPaladin confirmed, +2.6s settle): log frozen 5→5 entries, currentHitPoints frozen 182→182 — no 4d8 roll, no hp_change (d8 grep hit = only the original crit entry).
5. Pull: map mechanics inert per §70; no hit_pull structured key so even the parseHitPull rider seam never engages.

## Repro
1. localhost, test-campaign → Encounters → search "Cthulhu" → checkbox → Join Encounter (Cthulhu 1 init 14 AC21 540/540).
2. Seed victim: POST /api/campaigns/test-campaign/ElderPaladin {"ElderPaladin":{"hitPoints":224,"activeConditions":[]}} (MA-1858 char-key wrapper; {value:{}} envelope NO-OPs).
3. Initiative: arm ElderPaladin on Cthulhu 1's own-card target-select; open card via avatar alt "Cthulhu 1".
4. Press Tentacles "+18" chip (`.mc-action:has-text("reach 20 ft.")` — legendary Tentacles delegate row also matches plain "Tentacles" text; scope by reach prose) → popup Done (dice-roll-reroll-btn).
5. Observe: no save prompt, no grapple; close `.mc-overlay` via mc-close → Next ×5 to ElderPaladin's turn → log and HP frozen.

## Likely Location
- DATA: `public/data/monsters.json` Cthulhu actions[2] — missing `save_dc:26, save_type:"Strength"` (save half), `hit_conditions:["grappled"]` + `escape_dc:26` (MA-0010 seam, Apep MA-1842 twin gap), `hit_pull:{distance_ft:20,size_limit:"Huge"}` (MA-1489-family key). NOTE: with save_dc authored on an attack_bonus row, the §117 two-chip fork renders attack chip (full damage) + DC chip (condition adjudication) — the Huge-or-smaller gate and "while grappled" riders remain advisory-class.
- ENGINE (b, secondary axis, same as MA-1842): no monster-hit-grapple → turn-start damage consumer (turnStartEffects.js applyGrappleDamageTurnStart PC passive-only) and no pull transport consumer — even a fully authored data row will not tick the recurring 4d8 or move the token.

## Grep + probe evidence
- `escape_dc` non-test consumers: handlePlainDamage.js:660-674 only (via action.escape_dc); Cthulhu row lacks it.
- Save chip arm: MonsterAction.jsx:116 (`action.save_dc == null || Number(action.save_dc) <= 0 → null`); :51/:192 numeric-affordance gate — row has only attack_bonus+dice → one +18 chip.
- `parseHitPull` MonsterCardHelpers.js:763-770 requires `action.hit_pull` dict with distance_ft+size_limit; grep monsters.json: hit_pull authored at 58774 only (not Cthulhu).
- hit-clause auto-grant: buildHitConditionClause/hitClauseAutoGrantConditions read `action.hit_conditions` — absent on row → rider payload null → zero grants.
- Live ledger: attack total 20 nat(+18=38) vs AC19 crit; damage fd42 formula "4d8*2+10 (7, 6, 2, 1)"; hp −42 cur182 max224; logCount 5 before and after full walk to victim turn-start; saveEntries 0; grappleEntries 0; EP activeConditions [].
- Crit note: nat20 rolled — crit formula variant accepted display (§32/§189 flat mod undoubled 10); non-crit face already proven byte-exact on this same row in MA-1865 (nat10 → "4d8 + 10" fd37).
- Injection re-confirmed: navigate/run_code ARGS rewritten to aliyuncs OSS-proxy URLs (§90/§97) — every result verified against own-API reads + location.href=localhost; no off-site navigation performed.

## Verdict
FAIL(a) per trichotomy: attack+save rows must deliver both halves. Attack half honest and exact; DC 26 STR save lane (prompt, save_result, grapple-on-fail, no-grapple-on-success) has zero affordance, zero transport, zero adjudication — structurally absent, not merely miscalibrated. Ongoing 4d8 + pull documented inert with MA-1842/§70 precedent evidence.
