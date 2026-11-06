# Bug: Divine Spark with no armed target silently self-targets; Harm branch damages the caster

## Summary
When the caster's `targetName` is unarmed (null) on the combat board, clicking Divine Spark does not ask for/pick a real target — `divineSparkHandler.js` falls back to `playerStats.name`, so the modal opens with "Channel divine energy at **War_Cleric**" (self) and spending a Channel Divinity charge. Clicking Harm then makes the caster force a CON save against his own spell DC and take the damage. The disk feature (public/data/2024/classes.json, Cleric lv2 "Divine Spark") explicitly requires "another creature you can see within 30 feet **of yourself**" — self is not a legal target for either branch.

## Steps to reproduce
1. In `test-campaign`, with a combat board containing War_Cleric, clear his armed target: scoped PATCH `/api/campaigns/test-campaign/combatSummary` `{"value":{"creatures":[{"name":"War_Cleric","targetName":null}]}}` (or set target-select to empty on his Initiative card).
2. Ensure runtime `channelDivinityCharges` > 0 on War_Cleric.
3. Open the War_Cleric sheet → click the **Divine Spark** row (`b.clickable`).
4. Observe the modal header line and the charge counter.
5. Select Radiant and click **Harm**; Roll Save + Done on the queued prompt.

## Expected behavior
With no target selected the feature should refuse (popup like "No target selected") and NOT spend a Channel Divinity charge, or at minimum require choosing a creature other than self. Self is never a legal target per the authored rules text.

## Actual behavior
- Modal opens with "Divine Spark — Channel divine energy at **War_Cleric**." (self). No popup asking for a target, no warning.
- A Channel Divinity charge is spent at row-click regardless (runtime `channelDivinityCharges` decremented, `ability_use` log "Divine Spark activated — targeting War_Cleric.").
- Harm proceeds: prompt "War_Cleric must make a CON saving throw. DC 15 … Source: Divine Spark"; failed save dealt **7 Radiant damage to the caster** (verified live via the modal result view + hp_change).
- (Corona interaction is self-consistent — `getCoronaSaveDisadvantage` skips `player.name === targetName` — which incidentally proves the self-target value flows through the whole harm lane.)

## Likely location
Confident: `src/services/automation/handlers/class-cleric-paladin/divineSparkHandler.js:44` — `const targetName = targetInfo?.target?.name || playerStats.name;` (self-target fallback when `resolveTarget` finds nothing). Same pattern exists at `src/services/automation/handlers/combat/saveOnlyHandler.js:29` (grep census: only these two handlers use `|| playerStats.name` after `resolveTarget`) — worth auditing whether that feature's rules text also requires another creature. Compare other Channel Divinity handlers: Sacred Weapon legitimately targets self; Divine Spark is the "other creature" feature. The handler returns `type:'modal'` before any target validity check, and the modal has no target picker — it just trusts `payload.targetName`.

## Suggested fix
In `divineSparkHandler.handle`, when `resolveTarget` yields no target, return an `automation_info` popup refusal ("No target selected — Divine Spark requires another creature within 30 feet.") **before** the `setRuntimeValue` charge spend (move the spend below the target resolution, or refund on refusal). If a self-target ever should remain possible as a GM convenience, at minimum the modal must label it clearly and Harm should refuse self ("You can't target yourself with Divine Spark"). Check sibling Channel Divinity handlers for the same `|| playerStats.name` fallback pattern (grep `playerStats.name;` in class-cleric-paladin handlers).

## Severity
Minor UX issue with a data-integrity edge: a mis-click silently spends a scarce resource and can damage your own character with no confirmation. Not a crash; rules-wrong outcome is reproducible but easily noticed at the table.

## Resolution
FIXED 2026-11-05. Root cause confirmed exactly as suspected: `divineSparkHandler.handle` spent the Channel Divinity charge at row-click and then fell back to `|| playerStats.name` when `resolveTarget` found nothing, so an unarmed click silently self-targeted (modal "Channel divine energy at War_Cleric") and Harm forced the caster's own CON save vs their DC. Rules ground truth re-verified on disk: `public/data/2024/classes.json` Cleric lv2 — "another creature you can see within 30 feet of yourself" (self is never legal for either branch). Both rulesets dispatch the SAME handler (`src/services/automation/index.js` HANDLER_MAP `divine_spark`), so one fix covers 5e + 2024.

**Reproduced live first** (test-campaign, placeholder 13-PC board, War_Cleric `targetName:null`): row-click spent charges 3→2 with modal self-labeling; Harm queued "War_Cleric must make a CON saving throw. DC 15 … Source: Divine Spark"; failed save (9 vs 15) dealt 5 Radiant to the caster (`hp_change` −5, "War_Cleric takes 5 Radiant damage"). Repeatable (second click spent 2→1).

**Fix (pattern copied, not invented):**
- `src/services/automation/handlers/class-cleric-paladin/divineSparkHandler.js` — target resolution moved BEFORE the charge spend (resolve-then-spend mirrors `handOfUltimateMercyHandler`); unarmed → refusal popup "No target selected — Divine Spark requires another creature within 30 feet."; self-armed → "You can't target yourself with Divine Spark — it requires another creature." Both return the `automation_info` popup shape and log an `automation`/`divine_spark_refused` row with reason tokens `no_target` / `cannot_target_self` (helper mirrors `bewitchingMagicHandler.bewitchingRefusal`), with ZERO `setRuntimeValue` write.
- `src/services/automation/handlers/combat/saveOnlyHandler.js` (audit requested by the ticket): grep census of every `save_only` consumer on disk — Stunning Strike (5e "when you hit another creature", 2024 "when you hit a creature"), Color Spray, Entangle, Grease, Arms of Hadar, Dominate Monster — NONE may target self, so the same `|| playerStats.name` fallback was the same defect class. Fixed identically: refuse (popup + `<action-slug>_refused` row, e.g. `stunning_strike_refused`, reason token) BEFORE `createSaveListener` queues a self save-prompt; no prompt is created on refusal. (Stunning Strike's Focus Point is spent upstream in `useCharActionsAutomation` before the handler runs — that pay-early edge belongs to the known §9 leak family; the handler row-gate requires a landed melee hit first so the unarmed-self face is practically unreachable for SS. Documented, not expanded.)

**Tests:** `divineSparkHandler.test.js` — updated the two describes whose fixtures pinned the old self-fallback (`resolveTarget:null` → armed 'Ally'), added regression describe "no-legal-target refusal (zero charge spend)" pinning: unarmed refusal popup shape + zero spend + `divine_spark_refused/no_target` row + no `ability_use`; self-armed refusal + zero spend + `cannot_target_self`; and resolve-BEFORE-spend happy path. `saveOnlyHandler.test.js` — flipped the "uses player name as target when resolveTarget returns null" test (it pinned the defect) to expect refusal + no `createSaveListener`, and added the self-armed refusal test.

**Results:** `npx vitest run` on both touched test files 33/33; touched folders (`class-cleric-paladin`, `handlers/combat`, `modals/divine`, `automation/index.test.js`) 107 files / 1365 tests green; Stunning-Srike lane + resource-modals tests 38 green; `npm run lint` zero warnings.

**Live re-verification (test-campaign, exact repro steps re-run):**
1. Unarmed click → NO modal, popup "No target selected — Divine Spark requires another creature within 30 feet.", `channelDivinityCharges` unchanged (3→3), ONE `automation/divine_spark_refused` `no_target` row, zero `ability_use`. ✓
2. Self-armed via scoped cs PATCH `targetName:"War_Cleric"` → popup "You can't target yourself…", zero spend (3→3), `cannot_target_self` row. ✓
3. Happy path: armed EvasiveFighter → modal "Channel divine energy at EvasiveFighter", charge spends 3→2 at row-click as before, Harm → victim CON prompt → Roll Save → Done resolves honestly (success face: 0 damage, `save-damage` + `save_result` rows). ✓
4. Failed-save damage face on a legal target: Harm at HexWarlock, save failed (2 +5 = 7 vs DC 15) → "HexWarlock takes 7 Radiant damage", `hp_change` −7, charge spent. Caster's own HP untouched all verification (30→30). ✓
5. Recent save-dismissed refusal path intact: Harm → Dismiss un-rolled prompt → modal result view "save was dismissed — no damage dealt" + working Done + `divine_spark_refused` row. ✓
6. Zero-charge economy face intact: charges 0 → "No Channel Divinity charges remaining." popup, no modal, no spend. ✓

Cleanup: tab closed first, then Admin clear-change-data + clear-log via scripted POSTs (200/200); change-data `{}`, log `[]`, `git status --porcelain public/campaigns/` empty (character files byte-untouched).
