# bug-mon-MA-0056 — Adult Blue Dragon · Lightning Breath (Recharge 5-6) — FAIL

Row MA-0056 · aoe-save · DC 19 Dexterity · 11d10 Lightning · 90-ft line 5-ft wide, half on success · recharge 5-6.
Verdict: **FAIL** — MV-21/22 fingerprint: line shape absent (degrades to single-target save) + recharge ungated. Per-target save math EXACT.

## Environment / integrity
- :5173=200; nav header `test-campaign` (MV-18) ✓.
- Static monsters.json Adult Blue Dragon row matches MA-0056 exactly: save_dc 19, save_type Dexterity, recharge "5-6", damage_dice_primary "11d10" Lightning; description "each creature in a 90-foot-long, 5-foot-wide Line … Failure: 60 (11d10) … Success: Half damage."
- Dragon hp 212 / ac 19 / immunities [Lightning]. Encounter joined → initiative card "Adult Blue Dragon 1" init 3, HP 212/212.
- Target armed: ElderPaladin (lvl20 Goliath Paladin, CON 20, DEX 15 → +8 save w/ aura, resistances/immunities [] in character JSON — not lightning-resistant). Armed via change-data POST (MV-22) `hitPoints:220`; runtime confirmed `currentHitPoints` path + initiative maxHp 220 persisted pre-click.

## Defect 1 — Line shape gap: row degrades to single-target save (MV-21)
- PRE-click DOM inside `.mc-overlay .mc-action` (breath row): `.mc-dice-link` "11d10" present; `[class*="area-picker"]`=0, `[class*="line-picker"]`=0, `[class*="aoe"]`=0, `.secondary-target-row`=0, `.sp-overlay`=0.
- Only target mechanism = initiative-card Target combobox (set to ElderPaladin). "Each creature in that 90-foot line" never modeled — no line/area picker; coverage provable one target at a time only.
- Post-click `.sp-overlay` single save prompt for ElderPaladin only — confirms single-target resolution, not AoE multi-target.

## Defect 2 — Recharge "5-6" ungated (display-only)
- 2nd click of breath `.mc-dice-link` same fight/turn: identical "DEXTERITY … DC 19 … Half damage" prompt re-fired **immediately** — no recharge d6 roll, no refusal, no disabled/greyed state.
- `rechargeUI` DOM count = 0 pre/post; "Recharge 5-6" renders as static text only. Recharge not consumed as a gate (MA-0049 precedent re-confirmed).

## Save math — EXACT (per-target)
- Prompt: "ElderPaladin must make a DEXTERITY saving throw. DC 19. Half damage on successful save" ✓.
- Save #1: d20 **11** + bonus **8** ("+5 aura") = **19** vs DC 19 → **SAVE SUCCESS** (log save_result success:true, total 19, dcSuccess "half").
- Damage: `save-damage` roll 11d10 rolls [8,6,8,9,5,10,1,4,6,7,9] raw **73**; success half → floor(73/2)=**36** = `finalDamage` 36.
- `hp_change`: delta **−36**, currentHp 220→**188**, maxHp 220, Lightning — half-on-success applied correctly ✓.
- Cosmetic note (not blocking): `save-damage.total` records halved **36** not raw **73**; `projectedWardDamage.rawDamage` stores applied 36 (halved) not raw 73. Final applied math correct; raw-vs-total labeling inconsistent.

## Fingerprint match
MV-21/22 confirmed: (1) AoE/line picker absent → row degrades to single-target save; (2) recharge "5-6" ungated. Save-math per-target PASS (half branch exact on success).

## Cleanup
- POST /api/campaigns/test-campaign/admin/clear-change-data + clear-log (Host: localhost). Browser closed. No manifest/playbook edits.
