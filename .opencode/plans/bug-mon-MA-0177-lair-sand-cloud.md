# BUG MA-0177 — Ancient Blue Dragon lair_actions[1] "sand cloud" — INERT (FAIL, flavor b)

**stableKey:** `ancient-blue-dragon|lair_actions|1` · **registry:** docs/monster-actions-manifest.json:2666 (actionName "Unnamed lair actions 2", actionType other, saveDc 15 Constitution, conditions [blinded], verified "not verified")
**Verdict:** FAIL — inert nameless-dict lair row (MA-0118/MA-0092/MA-0176 fingerprint). Zero affordance; DC 15 CON save never enforced; blinded never applied; 20-ft zone never armed.

## Dict fields found (monsters.json lair_actions[1], verbatim)
Keys: `description`, `save_dc: 15`, `save_type: "Constitution"` ONLY.
- NO `name` → fails name-gate `isLairRowClickable` (src/services/encounters/monsterLairActions.js:26) → static branch (src/components/encounter/MonsterCardBody.jsx:340–349).
- NO `zone` → the persisted `lair_sand_cloud` zone te (targetEffectDefinitions.js:842) and the MA-0063/MA-0075 radius-picker route (`zone.radius_ft` → `lairRowAffordance` :40 'zone'/'save') are unreachable.
- NO `save_effect` → extractConditionsFromSaveEffect vocabulary never armed; blinded is manifest-derived from prose only.
- NO `dc_success`, NO `duration`, NO `advisory`.

## Live DOM evidence (Playwright, test-campaign header verified MV-18, EB join "Ancient Blue Dragon 1" hp481 ac22 cs0 — exact registry match; fresh re-join post-MA-0176 admin clear)
- Lair row [1] rendered: `<div class="mc-action"><strong>.</strong> <span>A cloud of sand swirls about in a 20-foot-radius sphere…</span></div>` — MV-24 stray "." fingerprint (empty `<strong>` = nameless dict). Row children: STRONG + SPAN only; `linksInRow:0`; `.mc-dice-link-lair` count whole card = 0 (all 3 lair rows inert — same block fingerprint as MA-0176 minutes prior).
- Forced `el.click()` ×2 + trusted `click()` on row [1] → zero popups (only the open dragon card overlay visible), zero log entries in the click window (log held at 2 join-noise entries 04:49:45; clicks 04:50:13–04:50:27), zero change-data delta: AasimarTest `activeConditions:null`, `targetEffects:null`, `activeBuffs:null`, `pendingExpirations:null`; no `saveResult-*`, no save/prompt/lair keys in change-data (only static join echoes: combatSummary saveBonuses, combat-ui-viewingMonster snapshot incl. the nameless lair_actions dict). DC 15 Constitution never prompted; `lair_sand_cloud` never produced.

## Control (engine alive)
Same session, same card: Rend "+16" `.mc-dice-link` click → live popup "Rend — 22, d20 6 +16 (+16 to hit), click to dismiss" + log `roll/attack` name "Rend" bonus 16 at 04:51:01. Engine live; row itself is the unwired gap.

## TEMPLATE contrast (the sibling proves fixability)
Adult Blue Dragon lair_actions[1] — IDENTICAL sand-cloud description — was FIXED (MA-0063/MA-0064, byte-mirrored MA-0075) into structured zone shape:
`{name:"Sand Cloud", description, save_dc:15, save_type:"Constitution", dc_success:"none", save_effect:"Failure: The target is blinded for 1 minute (repeat the Constitution save at the end of each of its turns; a success ends the effect on itself). Success: unaffected. This effect deals no damage.", zone:{radius_ft:20, effect_key:"lair_sand_cloud", repeat_save:true, advisory:"…NPC turn-end auto-repeat and 1-minute expiry are GM-enforced (no NPC turn-end zone-save consumer)."}, duration:"blinded 1 minute (repeat save ends early; advisory)"}`
→ live `.mc-dice-link-lair` chip → radius picker → zone-arm te + log → per-target save → blinded on fail (MA-0063 live; MA-0075 data-lock `monsterLairActions.test.js:333/546` asserts `lair_sand_cloud`). Blinded vocabulary live (MA-0017 family). Repeat-save-at-turn-end: lair zone rows have no NPC turn-end consumer — advisory only (accepted in MA-0063/0075).

## Likely Location
- `public/data/monsters.json` ancient-blue-dragon `lair_actions[1]`: nameless dict {description, save_dc, save_type} — missing the entire MA-0063 structured shape.
- `src/services/encounters/monsterLairActions.js:26` `isLairRowClickable` name-gate correctly refuses it (~600 nameless-dict monsters render statically by design) — DATA gap, not code gap.

## Fix recipe (byte-mirror MA-0063/MA-0075 zone shape — data-only, zero code change)
Copy Adult Blue lair_actions[1] verbatim onto the Ancient row: `name:"Sand Cloud"` + `dc_success:"none"` + `save_effect` (blinded 1 minute, repeat-save prose) + `zone:{radius_ft:20, effect_key:"lair_sand_cloud", repeat_save:true, advisory}` + `duration:"blinded 1 minute (repeat save ends early; advisory)"` (descriptions already byte-identical). Chip then renders via untouched seam; radius picker arms `lair_sand_cloud` te + log; blinded lands on save fail. Repeat-save NPC auto-repeat stays advisory (no turn-end zone-save consumer). Assert structural Object.keys equality vs Adult row in monsterLairActions.test.js data-lock (MA-0075 pattern).

## Pitfalls recorded this run
- Whole Ancient Blue lair block reconfirmed nameless-inert (rows [0]/[1]/[2] all `<strong>.</strong>`, zero chips) — extends MA-0176 fingerprint; join+init noise logs at 04:49:45 precede click window — attribute deltas by timestamp only (MA-0167 rule).
- EB join post-admin-clear cleanly registered "Ancient Blue Dragon 1" hp481 ac22 cs0 (re-join per §42aa).
