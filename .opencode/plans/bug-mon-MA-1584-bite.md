# Bug MA-1584 — Thri-Kreen "Bite": fail-by-5+ paralysis rider inert (no save_margin) + save_effect prose leaks paralyzed on EVERY fail + EOT repeat-save unarmed

**Verdict: FAIL(a)/DATA** — attack face exact LIVE; DC 11 CON adjudication honest LIVE; poisoned-on-fail grant lands LIVE (MA-1549/1567 lane) — but the margin machinery is wholly absent and, worse than "inert", the un-stripped margin prose **over-grants Paralyzed on every failed save regardless of margin** (live-probed at margin 1). EOT repeat-save never armed (MA-1577 lineage).

## Row
```json
{"id":"MA-1584","monster":"Thri-Kreen","monsterIndex":"thri-kreen","category":"actions","actionIndex":1,"actionType":"attack+save","actionName":"Bite","attackBonus":3,"saveDc":11,"saveType":"Constitution","saveEffect":"Failure: poisoned for 1 minute A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. Failure by 5 or more: the target is also paralyzed while poisoned in this way","damageDicePrimary":"1d6 + 1","damageTypePrimary":"piercing","reach":"5 ft.","description":"Melee Weapon Attack: +3 to hit, reach 5 ft., one creature. Hit: 4 (1d6 + 1) piercing damage, and the target must succeed on a DC 1 1 Constitution saving throw or be poisoned for 1 minute. If the saving throw fails by 5 or more, the target is also paralyzed while poisoned in this way. The poisoned target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success."}
```

## Live probe (Playwright, localhost:5173, test-campaign ONLY)
Join: EB exact "Thri-Kreen" + exact "Bandit" (checked: `["Select Bandit","Select Thri-Kreen"]`, only two) → Join → tracker: Thri-Kreen 1 (init 20, AC 15, 33/33), Bandit 1 (init 2, **AC 12**, HP raised 11→999 via real-keyboard fill+Enter — persisted in `combatSummary.currentHp: 999`, MA-1573 commit pattern). Card via avatar (§138). Twin chips render exactly as authored (§986): `+3` + `DC 11 Constitution` under "Bite." — card prose visibly carries the **"DC 1 1"** typo. Target = Bandit 1.

**Save bands (app Bandit CON = 12, authored mod +1; LIVE adjudicated bonus = 0 — see Notes):** margin = DC 11 − saveTotal.

### Face 1 — Attack chip "+3" ✅ PASS
- **HIT:** d20 10 +3 = 13 vs AC 12 → "✓ HIT (13 vs AC 12)". Damage log `formula:"1d6 + 1", rolls:[1], total:2, damageType:"piercing"`; **HP 999 → 997, Δ−2 exact**; popup "2 damage applied to Bandit 1 — HP: 999 → 997".
- **MISS:** d20 2 +3 = 5 vs AC 12 → "✗ MISS (5 vs AC 12)". Zero damage log, zero HP delta (997 held).

### Face 2 — Save chip "DC 11 Constitution" — ❌ FAIL core
Lives saves adjudicated (target Bandit 1, bonus 0, DC 11 plumbed in log):
| roll | total | vs DC 11 | margin | granted |
|---|---|---|---|---|
| 20 | 20 | SUCCESS | — | **zero grants** (`Bandit 1` change-data empty) ✅ RAW |
| 20 | 20 | SUCCESS | — | zero grants ✅ |
| 11 | 11 | SUCCESS | — | zero grants ✅ (boundary honest) |
| 18 | 18 | SUCCESS | — | zero grants ✅ |
| **10** | 10 | FAIL | **1 (<5)** | **"Paralyzed, Poisoned" BOTH** ❌ RAW: poisoned ONLY |
| **6** | 6 | FAIL | **5 (≥5)** | "Paralyzed, Poisoned" BOTH ✅ outcome — but by prose leak, NOT by rider |

`Bandit 1.activeConditions = ["paralyzed","poisoned"]`, meta `{paralyzed:{source:"Thri-Kreen 1"}, poisoned:{source:"Thri-Kreen 1"}}`; two `condition applied "Paralyzed, Poisoned"` logs (margin-1 + margin-5 fails). The paralyzed grant at margin 1 is the decisive proof the margin band is unenforced — the primary's predicted symptom ("rider inert → paralyzed NO") inverts: naive whole-prose extraction grants paralyzed **always**, so the "fails by 5+" clause is inert as *gating* (over-grant, not under-grant).

### Face 3 — EOT repeat-save — ❌ FAIL
Advanced initiative past Bandit 1's turn end (round 1 → 2, Thri-Kreen 20 → Bandit 2 → past). Campaign log scan (`repeat|ends|eot|end of`): **zero** repeat-save entries; zero new save rolls attributable to EOT; `activeConditions` persist byte-identical after Bandit's turn end. No `repeat_save` te / expiration / repeat keys anywhere in change-data. MA-1577 lineage confirmed.

## Static grep citations
- Disk row `public/data/monsters.json` thri-kreen `actions[1]` keys: `[name, description, attack_bonus, reach, save_dc, damage_dice_primary, damage_type_primary, save_type, save_effect]` — **`save_margin` absent, `repeat_save` absent** (grep count on row JSON: 0).
- `parseSaveMarginClause` (`src/components/encounter/MonsterCardHelpers.js:368`) — structured-key-only arm, returns null without `save_margin` → `saveMargin:null` on both transports (`MonsterCardModal.jsx:1159, 1657`) → `applySaveMarginRider` (`src/hooks/combat/saveProcessing.js:679`, armed via `:1054/:1358 if (applied)`) dies at `:681 if (!margin…) return` — NEVER arms.
- `armRepeatSaveClause` (`saveProcessing.js:637`) gated `:638 if (!context?.repeatSave) return`; row has no `repeat_save` → unarmed.
- Poisoned grant route proven live: `applyDamagelessSaveConditions` (`saveProcessing.js:1045`) → `applyFailedSaveConditions` (`:1060`) applies EVERY condition from `extractConditionsFromSaveEffect` (`MonsterCardHelpers.js:378`, whole-string canonical-word scan) — which sees **both** "poisoned" AND "paralyzed" in this row's save_effect and grants both.

## Fix (data, `public/data/monsters.json` thri-kreen Bite)
```json
"save_effect": "Failure: poisoned for 1 minute.",
"save_margin": { "fails_by": 5, "also": "paralyzed" }
```
- **Byte-shape correction:** the row-instruction's proposed `{failsBy:5, also:"paralyzed"}` would parse NULL — `parseSaveMarginClause` reads `margin.fails_by` (snake_case; MA-0639/1351 byte-shape is `{fails_by, also}`).
- **MANDATORY prose strip:** save_effect MUST be reduced to the shallow band (MA-1351 pseudodragon twin shape) — otherwise the word "paralyzed" stays extractable and `applyFailedSaveConditions` over-grants it on every fail even AFTER `save_margin` lands (double + ungated).
- **EOT repeat:** the proposed legacy-FP-shape `{condition:"poisoned",save_type:"Constitution",dc:11,duration_minutes:1}` is **unsafe** — the no-`effect` fork routes to `trackFrightfulPresence` (`frightfulPresenceService.js:32`) which hardcodes frightened te + FP immunity. Live repo has zero authored `repeat_save.effect` rows, but the generic consumer lane exists (`armRepeatSaveClause` → `grantRepeatSaveEffect` + `applyRepeatSaveTurnEnd`, MA-0048). Correct fix: repeat_save **generic shape** `{effect:"<registered poisoned te>", save_type:"Constitution", dc:11, condition:"poisoned"}` + register that te in `targetEffectDefinitions.js`; OR GM-enforce (document residual).

## Notes
- **Description typo (primary-recorded):** "DC 1 1 Constitution" — should be "DC 11" (`save_dc: 11` field is correct; typo renders live on the card prose). Fix prose text.
- **Save-prompt popup cosmetic twin (MA-1578 family):** chip prompt shows **"DC Unknown — no success or failure"** despite DC 11 authored+plumbed (adjudication log carries `saveDc:11`, `saveResult` honest). Copy defect only.
- **Adjacent anomaly:** app-authored Bandit `ability_score_modifiers.con = +1` (CON 12) but all six live save adjudications used **+0** (`bonus:0` in log). Band-shifted by 1 vs authored data; all six totals self-consistent with +0. Flag for save-bonus plumbing triage, outside MA-1584 row scope.
- Phantom second value in attack/save `rolls` ([10,20], [2,18], [20,6]) — known cosmetic logging noise (MA-1569/1573 family); math self-consistent from rolls[0].
- Attack chip did NOT auto-arm the save rider on hit (MA-0551 composite fork — `buildAttackChipSaveOptions` drops save adjudication keys) — correct twin behavior; GM presses the DC chip separately.

## Verdict
FAIL(a)/DATA — PASS-partial evidence: +3 attack exact both faces (13 HIT Δ−2 exact / 5 MISS zero), DC 11 CON honest four-success + zero-grants-on-success, poisoned-on-fail lands, twin chips honest, "1d6 + 1" piercing formula exact live. FAIL: margin-paralysis rider inert AND margin prose over-grants (paralyzed at margin 1 live) — no `save_margin`; EOT repeat-save unarmed — no `repeat_save`. Fix = author `save_margin:{fails_by:5, also:"paralyzed"}` + shallow-band save_effect strip + generic-lane repeat_save (legacy FP shape unsafe).

## Cleanup performed
- Initiative → Clear (confirm accepted; Thri-Kreen/Bandit gone from tracker).
- Admin → Clear Change Data (`change-data keys: []`, Bandit conds gone) + Clear Campaign Log (`LOG_COUNT: 0`).
- Only `test-campaign` mutated; campaign header verified `test-campaign` throughout; console 0 errors (2 pre-existing warnings).

## Evidence
- `ma-1584-card-twinchips.png` (twin chips + "DC 1 1" typo live)
- `ma-1584-bandit-condits-persist-eot.png` (Paralyzed+Poisoned persist past Bandit EOT, no repeat-save)
