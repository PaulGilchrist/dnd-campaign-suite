# Bug — CLA-393 Wrath of the Sea: ungated repeat-fire, no push, no duration enforcement

## Title
CLA-393 Wrath of the Sea — attack leg fires unlimited times per turn with no turn/range gate; push 15 ft and 10-minute emanation duration unimplemented.

## Overview
Circle of the Sea lv3 2024 Druid feature. The manifest half is live-exact (Wild Shape use spend, activation flag, popup, badge, ability_use log) and the damage half computes exact CON-save DC and WIS-mod-d6 cold damage. However, the attack leg has NO once-per-turn gate, NO turn gate, and NO 5-ft range gate — verified live firing two saves + damage rolls seconds apart on the same turn while AasimarTest was the active creature — and the push and duration clauses have zero consumers. Per verdict policy ("unenforced trigger/gates … = FAIL even if math exact") this is a FAIL.

## Expected (canonical quote)
"As a Bonus Action, you can expend a use of your Wild Shape to manifest a 5-foot Emanation … for 10 minutes. It ends early if you dismiss it (no action required), manifest it again, or have the Incapacitated condition. When you manifest the Emanation and as a Bonus Action on your subsequent turns, you can choose another creature you can see in the Emanation. The target must succeed on a Constitution saving throw against your spell save DC or take Cold damage and, if the creature is Large or smaller, be pushed up to 15 feet away from you. To determine this damage, roll a number of d6s equal to your Wisdom modifier (minimum of one die)."

## Actual (live-verified, test-campaign, Wild_Sage_Druid lv20 2024 Circle of the Sea, WIS +3, PB +6)
Working (exact):
- Manifest: row click spends wildShapeUses 4→3, sets `wrathOfTheSeaActive:true`, popup "Wrath of the Sea activated — ocean spray emanation surrounds you", `ability_use` log, sheet badge "Wrath of the Sea" + initiative-card badge.
- Damage: attack click → auto CON save vs DC 17 (8+3+6), failed (nat15+2=17? logged fd:12) → `save-damage` log {formula:"3d6", rolls:[6,4,2], total:12, damageType:"cold", saveResult:"failure", finalDamage:12}; cs Thug 1 currentHp 32→20 (exact −12). Save success → fd:0, HP unchanged ("Passed (17+2=19 vs DC 17)").
- Dismiss: initiative-card badge × ([title="Remove effect"]) sets wrathOfTheSeaActive:false; post-dismiss row click re-manifests spending another use (WS 3→2) — "manifest it again" clause consistent.

Broken / unimplemented:
1. NO once-per-turn gate: two consecutive row clicks in the SAME turn each rolled a fresh CON save + fresh 3d6 damage (two `save-damage` rows ts 1789053037288 / 1789053038813, first fail −12 dmg, second pass). Canonical allows the damage choice only ONCE per turn as a Bonus Action.
2. NO turn gate: attack leg fired while `activeCreatureName` was AasimarTest — handler never checks whose turn it is.
3. NO 5-ft range gate: handler never calls isWithinRange; any armed cs target at any distance is eligible (no Emanation containment model).
4. Push 15 ft UNIMPLEMENTED: data carries `effect:"push", effectValue:"15_ft"`; handler has zero push/position/te writes; popups and logs contain no push text. grep of handler + oceanicGiftHandler + clearExpirationEffects/expireStaleEffects/turnStartEffects for push/consumers = 0 hits.
5. NO duration enforcement: app data duration is `"1_minute"` (canonical 10 minutes — divergence), and NO addExpiration/pendingExpirations entry is registered (change-data `pendingExpirations:[]` post-manifest). The flag persists indefinitely; cleared only by badge ×, `initiative-rolled` event (initiative.jsx:395), or short/long rest (restRules-shortRest.js:308, restRules-longRest.js:348).
6. NO "ends early when Incapacitated" consumer (grep zero).
7. No hp_change log row for the applied cold damage (HP settles in cs; only the combined save-damage row logs — §6 pairing gap).

## Steps (repro)
1. Wild_Sage_Druid lv20 2024, subclass Circle of the Sea (Edit wizard step 7 + ✓Save).
2. Encounters → search Thug → tick → Join Encounter (Thug 1 in cs).
3. Druid sheet → click "Wrath of the Sea:" bonus row → WS 4→3, badge, popup (manifest leg OK).
4. Initiative → Druid card target-select → Thug 1.
5. Sheet → click "Wrath of the Sea:" again → CON save prompt-free auto-roll + cold damage lands (OK).
6. IMMEDIATELY click the same row again → SECOND save + SECOND damage roll fire same turn (BUG 1/2).
7. Check change-data: pendingExpirations [] (BUG 5); no position change (BUG 4); activeCreatureName ≠ Druid (BUG 2).
8. Initiative card badge × → flag false (dismiss OK); row click → re-manifest, WS −1 more.

## Likely Location
- src/services/automation/handlers/class-druid/wrathOfTheSeaHandler.js — attack leg (:61-174): no `_Wrath_of_the_Sea_usedRound` latch (CLA-371/FT-094 pattern), no turn/activeCreature gate, no `isWithinRange(playerStats.name, target, 5)`, no push state/te write, no `addExpiration` rounds clock (10min→rounds:100 per CLA-334 recipe; NOTE data duration `"1_minute"` should be fixed to `10_minutes` in public/data/2024/classes.json).
- Round-wrap latch clear belongs beside `_Slow_Fall_usedRound` in initiative.jsx + navigationHandlers.js.
- Badge/dismiss already exist: CreatureCard.jsx:466-473; CharSummary.jsx:446.

## Notes
- Registry "Wrath of the Sea badge" consumers: CharSummary.jsx:446 (static display badge from wrathOfTheSeaActive) and CreatureCard.jsx:466 (initiative badge WITH working remove ×).
- Save bonus honesty: Thug saveBonus +2 recorded in popup+log (from cs saveBonuses); DC 17 real (SP-109 fallback not seen).
- Stormborn resistances (lv10) are a separate row/CLA-336 bug; not re-adjudicated here.
- Popup/log evidence adjudicated from self-issued curl + change-data deltas only (42r injection discipline).
