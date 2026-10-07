# Bug SP-080 — Maze (2024) automation: slot/concentration leaks

Campaign: test-campaign. Verdict: FAIL. Verified via Playwright MCP on http://localhost:5173 + GET change-data reads.

## Canonical (public/data/2024/spells.json, index "maze")
- level 8, casting_time "Action", range "60 feet", components V/S, no material, not ritual
- duration "Concentration, up to 10 minutes", concentration true, school Conjuration, classes [Wizard]
- status_effects: ["Incapacitated"]
- automation: { "type": "maze", "saveType": "WIS", "range": "60 feet" }
- Escape text: "The target can take a Study action to try to escape. When it does so, it makes a DC 20 Intelligence (Investigation) check. If it succeeds, it escapes, and the spell ends." "When the spell ends, the target reappears in the space it left or, if that space is occupied, in the nearest unoccupied space."

## Automation keys (code)
- automation.type 'maze' → automationRouter.js:189 → src/services/automation/handlers/spells/mazeHandler.js handle()
- Registry automation/index.js:540 `maze: handleMaze`, :541 `maze_escape: handleMazeEscape`
- Banish stamp: campaign `targetEffects` {effect:'maze', target, source, dc:20, concentration:true}; target `<T>.mazeData` {casterName, dc:20}; target `activeConditions += 'incapacitated'`
- Escape badge: ConditionEffectBadges.jsx buildMazeBadge onClick → onRollConditionSave({key:'incapacitated', dc:20, ability:'int'}) → createRollConditionSaveHandler.handleMazeSuccess (removeMazeEffect, clear mazeData, filter incapacitated, log save-maze-escape)
- Target resolution: no modal chooser; resolveTarget (targetResolver.js) reads combatSummary attacker `targetName` (initiative Target combobox)

## What works (positive path)
- lv8 spell row, prepared checkbox, modal "Slots Remaining: 1 slot", "Cast Spell".
- With a target present: post-confirm lv8 1→0; targetEffects maze stamp created; Bandit activeConditions ['incapacitated']; mazeData {casterName:'DivinationWizard', dc:20}; logs "DivinationWizard casts Maze on Bandit! …banished", "Incapacitated by Maze", save-maze.
- Escape via Mazed badge (DC 20 INT Investigation span, §CLA-205): fail "SAVE FAILED (DC 20)" keeps Bandit Mazed; success log "Bandit succeeded on INT (Investigation) check (20 + 0 = 20 vs DC 20) and escaped the Maze" clears maze te, clears incapacitated, mazeData null.

## Defect 1 — pay-no-effect leak on no-target cast (§CLA-208 / SP-079 family)
Repro (pure UI clicks):
1. Initiative: ensure DivinationWizard Target combobox = "— No Target —".
2. Character sheet → Maze → "Cast Spell".
Observed:
- Popup "No target selected. Maze has no effect." (mazeHandler.js:196 early-return)
- BUT server change-data: `DivinationWizard.spell_slots_level_8` 1→0, and caster gains `concentration:{spell:'Maze', dc:19}` badge.
- targetEffects: no maze entry (no effect applied).
A level-8 slot and a concentration are spent for zero effect, no refund. Slot/concentration are consumed by the cast pipeline before the handler resolves a target.

## Defect 2 — caster concentration not broken on escape / spell end
After Bandit succeeds escape (spell canonically ends), server `combatSummary` wizard still holds
`concentration:{spell:'Maze', dc:19, target:null}` while targetEffects maze is empty. Caster keeps an
active Maze concentration (subject to ongoing CON concentration saves) for an ended spell.

## Slot ledger
baseline lv8=1 → (no-target cast) 0 [LEAK] → restored to 1 → (targeted cast) 0 [legit] → post-escape lv8=0, no lv8 recovered.

## Suggested fixes
- Do not expend slot / add concentration unless a valid target is resolved; refund or block earlier (§CLA-208 pay-at-open family).
- On successful escape (and concentration/duration end), break the caster's Maze concentration (remove caster concentration whose spell ends with escape).

## Notes / test deviations
- Test-campaign lockdown honored; host caster DivinationWizard lv20 Diviner (Maze prepared; no step-14 add needed).
- Initiative Target combobox was hard to drive reliably via Playwright refs; two out-of-band runtime POSTs (restore lv8, set wizard targetName) were used to force a clean targeted cast. Those two writes are the only out-of-band mutations; the cast, banish stamp, escape rolls, and clears all executed through genuine Playwright UI clicks and the app automation.
