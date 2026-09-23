# Bug MA-0875 — Gnoll Demoniac "Hunger of Yeenoghu" (FAIL(b) partial-machinery)

Row: gnoll-demoniac actions[2] — aoe-save, DC 14 Dex, 8d6 Necrotic, range "60 feet", recharge "5-6",
save_effect: "The gnoll or a creature of its choice it can see gains 10 Temporary Hit Points."
Description authors: 30-foot **Cube** of magical **Darkness**, 1 minute **Concentration**, **Difficult Terrain**,
save trigger = starts turn in area or enters for first time; Success: Half damage only.
No `dc_success` authored → app default half = RAW-correct here (NOT an MV-20 leak).

## VERDICT: FAIL(b) — core adjudication + recharge economy LIVE; THP, area/Cube/Darkness, terrain, duration/concentration, repeat-trigger all INERT.

## Per-layer table
| Layer | RAW requirement | App behavior | Status |
|---|---|---|---|
| Core save/damage | DC14 Dex save, fail=8d6 full, success=half | DC chip "DC 14 Dexterity" + "8d6" two-chip row (§117); inline single-stage click-to-dismiss both legs (§129); fail nat9−19=−10: 8d6 [1,3,3,2,5,4,5,3]=26 → fd 26 FULL, Necrotic, hpΔ −26 exact; success nat14: 26→fd13, nat15: 28→fd14, halves exact 2/2; lastAttack {saveDc:14, saveType:"Dexterity", saveResult:"failure", target:"Bandit 1"} | ✓ LIVE |
| THP on fail | gnoll (or choice) gains 10 THP | ZERO producers. Live: post-fail gnoll cs has NO tempHp/tempHitPoints key; gnoll change-data keys = [monsterRecharge,lastSaveRoll,_lastRollContext,pendingExpirations]; targetEffects null; zero THP log. Grep: SaveAttackAoeModal resolveSaveFailGrant:619 has no THP arm (file-wide tempHp grep zero); saveProcessing THP only applyAnimalSpiritVariantGrant :826-840 (MA-0275 chooser-armed, byte-inert); "Temporary Hit Points" not in CONDITIONS list → extractConditionsFromSaveEffect=[] | ✗ INERT |
| Area / Cube / Darkness | 30-ft Cube conjuration at point in 60 ft | Cube NOT parsed: breathAoeShape tests cone|line only (MonsterCardModal.jsx:100); sphereRadiusFeet needs "-radius"; picker NEVER opens → inline single-target degradation (§62/§159/§228). Live: __map__ = {activeMapName} only, zero zone objects, zero darkness/zone/cube log | ✗ INERT |
| Difficult Terrain | area costs double move | No grid movement-cost consumer app-wide (§70); terrain consumers PC-spell-handler-side only | ✗ INERT |
| Duration / Concentration | 1 min, concentration, ends early | No concentration/concentration key produced live; no zone dict authored → no persistence clock | ✗ INERT |
| Repeat trigger | save at turn-start-in-area / first entry | repeat_save arms only via authored zone.repeat_save (§162/§70 recurring zero-consumer); row authors none — save was fired ONCE per click by GM chip, no recurring adjudication | ✗ INERT |
| Recharge 5-6 | spend; refuse until d6≥5 at owner turn-start | FULL CYCLE LIVE: ability_use spend stamp "Recharge 5-6; unavailable until a d6 5+..."; both chips get mc-dice-link-spell-spent; same-combat refire → popup "Not Recharged … No save rolled, nothing spent" + automation `hunger_of_yeenoghu_refused` (zero spend, zero roll, hp held); recovery d6 at owner turn-start: d6:2 fail, d6:3 fail, d6:5 → `recharged:true` (`recharge_failed`/recharged logs), spent class cleared, chip refires | ✓ LIVE |

## Live ledger (test-campaign, Bandit 1 four-key HP 999 §MA-0874, armed via own-card selectOption)
1. R1 fire #1 (organic): nat14 vs DC14 SUCCESS, 8d6=26 → fd 13 half exact, hp 999→986, recharge spent.
2. Refire same combat: REFUSED popup + `hunger_of_yeenoghu_refused`, zero spend/zero save, hp held.
3. Walk r2/r4/r5: recovery d6 2✗, 3✗, 5✓ recharged:true; spent class cleared.
4. R5 fire #2 (organic): nat15 SUCCESS, 28 → fd 14 half exact, hp 986→972, spent again.
5. Rig `saving_throws:{dex:{modifier:-19}}` (§212 nested-abbrev full-store cs POST) + four HP keys + reload + re-select + re-arm; walk to own turn r6 → recovery success.
6. Fire #3 (fail leg): nat9, total −10 ✗ FAILURE, 8d6=26 → fd 26 FULL no halving, hp 999→973, dtype Necrotic, machine lastAttack sr:"failure" — popup modifier text "(d20 9 + 0)" cosmetic, verdict folds rig (−10) (§MA-0711 nuance).
7. THP/area/concentration audits post-fail: all zero (see table).
Console 0 errors entire session; single tab; admin-clear cd+log 200 → quiet-recheck 13s clean.
Note: half-floor branch not exercised (organic totals 26/28 even); floor behavior pinned on shared seam by MA-0788 (floor(19/2)=9).

## Grep cites
- MonsterCardModal.jsx:100 breathAoeShape cone|line only; :89-92 zone rides authored zone.radius_ft only (none on this row).
- SaveAttackAoeModal.jsx:619 resolveSaveFailGrant — no THP arm; saveProcessing.js:826-840 THP = animal-spirit Fortify only.
- MonsterCardHelpers.js:50 CONDITIONS list excludes "temporary hit points"; thpMatch :273 = Fortify parser only.
- monsterRecharge.js:35 flat `recharge:"5-6"` parses threshold 5; gate/refuse/recovery consumers live (MA-0488/0782 twins); vitest monsterRecharge 17/17 green (prior session).
- Difficult terrain/zone/`repeat_save` consumers: zero from monster save rows (§70/§87/§162).

## Likely Location
- `SaveAttackAoeModal.resolveSaveFailGrant` / `saveProcessing` — absent THP grant arm for save_effect "gains N Temporary Hit Points".
- `MonsterCardModal` breathAoeShape :100 — Cube shape unparsed → picker never opens (single-target inline degradation).
- Recharge: NOT the defect — channel live on this row end-to-end.

## Notes / fix shape
- Zone authoring: convert row to MA-0043/0595 zone-dict shape ({zone:{radius_ft,effect_key,noun,…},duration}) + register darkness/difficult-terrain te; cube→radius approximation accepted (§85/§228 precedent).
- Cube shape: parser gap §62/§159/§228 — needs "Cube" token in breathAoeShape or advisory note.
- THP grant: parse "gains N Temporary Hit Points" from save_effect → grant to gnoll-self (or chooser, MA-0275 lineage) via tempHpService replace-if-larger in resolveSaveFailGrant + grant log.
- Repeat trigger (turn-start-in-area/entry): §70 zero-consumer residual; recurring tick needs explicit te + consumer (§87 MA-0367 template).
- Concentration break: no consumer (§70 residual).
- Recharge live-probe result: FULL CYCLE WORKS (spend→refuse→d6 recovery→refire); no recharge fix needed.
