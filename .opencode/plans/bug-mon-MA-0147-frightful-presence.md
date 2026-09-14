# Bug MA-0147 — Adult White Dragon "Frightful Presence": failed save applies NO Frightened condition

**Verdict: FAIL** — save fires with correct DC (14) but the failed-save effect (Frightened) is never applied: no `activeConditions` write, no `targetEffects` marker, zero `condition` log entries. Generic control (Rend +11) proves the card pipeline is live, so the break is FP-row-specific.

## Row
- MA-0147 · Adult White Dragon (`adult-white-dragon`) · `legendary_actions[2]` "Frightful Presence" · category: legendary_actions · actionType: save.
- Row claims: DC 14 Wisdom save; on fail Frightened; immunity "for certain types".

## Data (static read, `public/data/monsters.json` `adult-white-dragon.legendary_actions[2]`, 2026-09-14)
```json
{
  "name": "Frightful Presence",
  "description": "The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.",
  "save_dc": 14,
  "save_type": "Charisma"
}
```
- Row keys ONLY `[description,name,save_dc,save_type]` — **no `save_effect`** (contrast: Adult Black Dragon FP authors `save_effect` "…become Frightened…" per MA-0039; Adult Blue Dracolich FP authors `save_effect`+`success_immunity`+`repeat_save` per MA-0048).
- **Save type is Charisma in the data**, not Wisdom: 2024-style FP casts *Fear* using Charisma as the spellcasting ability; app DC 14 = 8 + PB 5 + CHA 1 — internally consistent with `ability_score_modifiers.cha: 1`, `proficiency_bonus: 5`. The manifest row's "Wisdom" is a row-vs-data discrepancy; the app correctly renders the authored Charisma.
- No immunity list authored on the row (no `success_immunity`); "certain types" immunity (fear-immune creatures) unmodellable clause, advisory.

## Live probe (test-campaign, :5173, 2026-09-14)
- Baseline: change-data `{}`, log `[]`. EB Join "Adult White Dragon" → `Adult White Dragon 1` (init 5, hp 200/200, AC 18) on initiative track. Armed target AasimarTest via dragon-card target-select (verified `cs.creatures[0].targetName === "AasimarTest"`).
- Card overlay: FP row renders `button "DC 14 Charisma"` (`.mc-dice-link-save-clickable`) — **DC 14 exact, type Charisma (per data; row's "Wisdom" wrong at the data level)**.
- Fire #1 → prompt "AasimarTest must make a CHARISMA saving throw. DC 14" → Roll Save → **SAVE SUCCESS** (d20 5 + 9 = 14 vs DC 14).
- Fire #2 (same turn, re-click allowed — no gate, corroborates MA-0145 ungated fingerprint) → **SAVE FAILURE** (d20 2 + 9 = 11 vs DC 14), Done applied.
- Post-fail evidence: `saveResult-AasimarTest` = `{success:false, roll:2, total:11, saveBonus:9, rawRolls:[2,2], mode:"normal"}`; log gains `roll|save|AasimarTest|Frightful Presence` + `save_result … failed Charisma save (DC 14, rolled 2 +9 = 11)`.
- **BUT: `AasimarTest.activeConditions` key never created (absent in change-data), `__campaign__.targetEffects` = null, `condition` log entries = 0.** Only "fright" occurrences anywhere: row name in `combat-ui-viewingMonster`, `lastAttack.attackName/actionName`, `_lastRollContext.actionName` — records only, no effect.
- Control-probe Rend "+11": d20 11 +11 = **✓ HIT (22 vs AC 12)**, Done → `hp_change` logged, AasimarTest change-data HP 143 → attack/damage/log seams demonstrably live.

## Root cause / likely location
1. **DATA (primary):** FP row lacks `save_effect` containing "Frightened". Click routes via generic legendary-save path (`MonsterCardModal.jsx:165 resolveLegendaryRowMechanic` → `handleSaveRoll(action, …, extractConditionsFromSaveEffect(action.save_effect))`); `extractConditionsFromSaveEffect(undefined)` → `[]` (`MonsterCardHelpers.js:53`).
2. **Consumer:** `applyDamagelessSaveConditions` (`saveProcessing.js:399-404`) early-returns on `saveConditions.length <= 0` → `applyFailedSaveConditions` never runs, no `activeConditions` write, no `condition` log.
3. **FP service not engaged:** `trackFrightfulPresence` arms only on `context.repeatSave` (`saveProcessing.js:337`), which comes from an authored `repeat_save` field the white dragon row lacks — so no `frightful_presence` te marker, no turn-end repeat save, no 24h immunity grant (contrast MA-0048 dracolich full service).
4. No FP name-based producer exists app-wide (`grep "Frightful Presence"` in components/hooks non-test = zero producers; service is dracolich-data-gated).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult White Dragon" → tick → Join Encounter (lands init 5, hp 200).
2. Arm a PC (AasimarTest) on the dragon card; open card → click FP "DC 14 Charisma".
3. Roll Save; repeat until FAIL (PC saveBonus +9, DC 14 → fail on d20 ≤ 4).
4. Read change-data + log: save_result failure logged; `activeConditions` absent, `targetEffects` null, zero `condition` entries. Control: Rend "+11" → HIT popup Done → hp_change lands.

## Fix suggestion (data-shaped, MA-0039 recipe)
Author `save_effect` on the row, e.g. "The target becomes Frightened. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. This effect deals no damage." — `extractConditionsFromSaveEffect` then extracts `frightened` and the MA-0017 damageless-save seam applies it + logs `condition applied`. Optionally author `repeat_save`/`success_immunity` to engage the MA-0048 full FP service (turn-end repeats + 24h immunity). Note: fix will also make `dc_success:'half'` boilerplate moot (no damage formula present, save stays damageless).

## Notes / residuals
- Ungated repeat fire (FP twice same turn, no "can't take this action again until start of next turn" latch) — same DATA-gated legendary-economy fingerprint as MA-0145/MA-0092/MA-0103/MA-0113/MA-0124/MA-0136; out of scope for this row, tracked under the legendary-uses bug.
- Manifest row's saveType "Wisdom" contradicts monsters.json "Charisma" — orchestrator may wish to correct the row text; app behavior follows the data.
- Registry: no `Adult White Dragon` entry existed in `docs/test-monster-registry.json` before this probe — fresh join here (hp 200/200, init 5); registry re-entry owned by orchestrator.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. No manifest `verified` edits.
