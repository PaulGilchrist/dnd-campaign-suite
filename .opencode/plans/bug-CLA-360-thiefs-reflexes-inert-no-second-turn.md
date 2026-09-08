# bug-CLA-360 — Thief's Reflexes (Rogue/Thief 2024) — FAIL inert

**Verdict:** FAIL (zero observable second-turn mechanism; grep + live probe 2026-09-08)

## Expected (app data `public/data/2024/classes.json` [8].majors[3].features[4], level 17 — app diverges from canonical lv13, noted)
Two turns in the first round of combat: first at normal initiative, second at initiative −10.
automation: `{type:'extra_action', uses:1, recharge:'long_rest', oncePerCombat:true, firstRoundOnly:true, casting_time:'passive'}`.

## Host / rig
AasimarTest lv20 Thief (registry PERMANENT), test-campaign, localhost:5173.
Rig: Init spinbuttons (per pitfall 42, `data-testid="initiative-input"` scoped via `.creature-card:has(input[aria-label="NAME current HP"])` — pitfall 42j): AasimarTest=18, EB monster=13 (brackets 18−10=8). Full-r1 + r2 walk of "Next →" tracking TOP-level `activeCreatureName` + `lastAppliedTurnStartCreature` (per pitfall 24/42j).

## What the app produces (recorded exactly)
1. **Sheet:** "Thief's Reflexes:" row renders in `.char-special-actions` with className `B` (NO `clickable`) — display-only text.
2. **Initiative structure:** combatSummary `creatures` holds exactly ONE AasimarTest entry at every observation. No second entry, no init−8 duplicate, no badge, no flag, no marker.
3. **Round walk r1:** AasimarTest → NPC 1 → AberrantSorcerer → DivinationWizard → DraconicDragon → ElderPaladin → EvasiveFighter → LightfootHalfling → War_Cleric → Wild_Sage_Druid → wrap. Host appears ONCE. Round 2 control: host also once (as expected without the feature — no distinction).
4. **Campaign log:** zero thief/reflexes entries (only the EB join + monster init roll rows).

## Root cause (grep)
- Row interactivity gate: `extra_action` is NOT in `INTERACTIVE_HANDLER_TYPES` (`src/services/combat/automation/automationService.js:14-83`) → `isClickable=false` at `CharSpecialActions.jsx:753-758` → row never dispatches.
- `handleExtraAction` (`src/services/automation/handlers/combat/extraActionHandler.js`, mapped `automation/index.js:325`) is uses-spend + popup ONLY: gates `oncePerCombat`/`firstRoundOnly` on round, decrements `thief'sreflexesuses`, returns `automationInfoPopup`. It NEVER touches initiative/creatures array — no second-turn producer anywhere (grep `second.?turn|extra.?turn|init.?minus` across src = zero initiative-insert hits; `initiativeProcessing.js:8-46` sets one initiative value + sorts).
- Consumers exist (`automationRouter.js:43` passive→specialActions; `automationInfoBuilder/diverse.js:14` builds the info w/ resourceKey `thief'sreflexesuses`) but the passive row has no trigger path: nothing dispatches `extra_action` at initiative/turn-start, and the sheet row is non-clickable.

## Fix sketch (not applied)
At initiative roll (initiativeProcessing.js / initiative-rolled seam), when holder has an unspent `extra_action` passive with `firstRoundOnly` in round 1: insert a second combatSummary entry `{name: "<name> (Second Turn)", type:'player', initiative: init−10}` (or re-queue at index), stamp uses, log `ability_use`. Also add `extra_action` to INTERACTIVE_HANDLER_TYPES if a manual row-spend UI is wanted.

## Cleanup
Admin Full Reset done; change-data `{}`, log 0, server left running. Manifest `verified` untouched (orchestrator owns).

## Pitfalls observed (nuggets)
- Initiative "Clear" RENAMED EB monster "Gazer 1" → "NPC 1" (renumbering), and re-seeded round=1 active=AasimarTest.
- `cs.activeCreatureName` is a STALE mirror; top-level `activeCreatureName` + `lastAppliedTurnStartCreature` ("round:name") are turn truth (pitfall 42j confirmed again).
- `getByRole spinbutton 'Init'` nth ordering flips after sort re-render — always scope via `:has(input[aria-label="NAME current HP"])`.
- Multi-click Next-walk loops in one `browser_run_code_unsafe` call exceed MCP timeout; chunk 3-4 clicks/call.
- Admin/Initiative confirms need `page.on('dialog')` inside run_code; `browser_handle_dialog` reports "already handled" if the once-handler accepted first.
