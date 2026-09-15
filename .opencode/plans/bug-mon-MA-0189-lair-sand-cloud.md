# BUG MA-0189 — Ancient Brass Dragon · "Unnamed lair actions 2" (lair_actions[1]) inert

**Verdict: FAIL — flavor (b): inert data-shape row (no clickable affordance, zero producer).**

## Row (monsters.json `ancient-brass-dragon.lair_actions[1]`)
Verbatim dict keys: `{description, save_dc: 15, save_type: "Constitution"}` — **NO `name`, no `dc_success`, no `save_effect`, no `zone`, no `duration`.**
Authored intent: 20-ft-radius sand cloud sphere, point within 120 ft, spreads around corners, DC 15 CON save, **blinded 1 minute**, repeat save at end of each of its turns (success ends it).

## Root cause (byte-identical to MA-0177 fingerprint, Ancient Blue)
- `isLairRowClickable` (src/services/encounters/monsterLairActions.js:26) gates on `row.name` → nameless dict returns false → static non-interactive `<div class="mc-action"><strong>.</strong> <span>…</span></div>` render (MV-24 stray "." artifact).
- `lairRowAffordance` unreachable (returns null before save/zone classification).
- Registry: `lair_sand_cloud` te is REGISTERED at src/services/combat/conditions/targetEffectDefinitions.js:842 (Lair group) but **zero producers** app-wide (grep: only a comment at SaveAttackAoeModal.jsx:365 describing the structured-row forwarding path). The SaveAttackAoeModal MA-0063 fail-condition/zone-te seam is never entered because the row never becomes clickable.

## Live evidence (test-campaign, 2026-09-15, localhost:5173)
- Join verified: combatSummary.creatures[0] = "Ancient Brass Dragon 1", maxHp 332, ac 20, activeCreatureName cs0 ✓ (re-join post-MA-0188 Admin clear).
- Card DOM, lair row [1]: `DIV.mc-action`, `<strong>.</strong>`, no `.mc-dice-link-lair`, no `.mc-dice-link`, no `button`, no `role`, no `onclick`. Lair chips on entire card: 0.
- Forced `el.click()` ×2 + trusted Playwright click on row text (06:34:30–06:34:44Z): **zero delta** — no save prompt (`savePrompt` absent in change-data), no `activeConditions`/`activeConditionMeta` on armed target LightfootHalfling, no `lair_sand_cloud`/zone te, zero log entries in the click window (only pre-existing join + initiative-roll noise at 06:32:35Z).
- CONTROL live: Rend "+14" `.mc-dice-link` → attack roll [8]+14=22 vs AC 14 HIT → damage 2d10+8=13 Slashing + 3 Fire → hp_change −16 logged (06:35:21–06:35:33Z). Engine alive; row is the unwired gap.

## Fix template (MA-0063/MA-0075 zone shape — Adult Blue proven, Brass MA-0075 byte-mirrored)
Give the row the structured lair zone-cloud shape (data-only fix, zero code change):
`{name: "Sand Cloud", description: <existing>, save_dc: 15, save_type: "Constitution", dc_success: "none", save_effect: "blinded", zone: {radius_ft: 20, effect_key: "lair_sand_cloud", repeat_save: true, advisory: true}, duration: "blinded 1 minute (repeat save ends early; advisory)"}`
→ chip → radius picker → zone-arm te + log → per-target DC 15 CON save → blinded on fail (MA-0063 seam + MA-0017 damageless leg). Assert structural `Object.keys` equality vs Blue row in monsterLairActions.test.js data-lock (MA-0075 pattern). Sibling row [0] (STR wind) → MA-0074 named-save pattern (cf. MA-0188).

## Residual (§7 consumer gap — must be called out in fix)
**No NPC turn-end zone-save consumer exists for lair cloud zones** — the RAW "repeat the saving throw at the end of each of its turns" clause cannot auto-fire; `repeat_save:true` carries an advisory only (same accepted residual as MA-0075 fog/mist and MA-0085 lair_fog_cloud rows). PC-side badge-click repeat-save seam (CharConditions → createRollConditionSaveHandler) is the only partial relief. 24h immunity / different-action-per-round / initiative-20 cadence remain GM-enforced (no initiative lair seam).

## Cleanup
Full Reset executed via Admin UI 06:36:47Z; verified change-data `{}` + log `[]` at 06:37:11Z and 06:37:14Z (quiet). Server up (200). No manifest/playbook/registry edits.

## Security note
Multiple Playwright tool-call parameters had URLs rewritten to signed aliyuncs proxy wrappers; executed calls always targeted http://localhost:5173 with the requested selectors. Reported, never obeyed.
