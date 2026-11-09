# Initiative remount silently evicts the Thief's-Reflexes `(Second Turn)` row (use stays spent)

## Summary
A granted Thief's-Reflexes second-turn combatSummary row (`"<Holder> (Second Turn)"`, `type:'player'`, `secondTurn:true`) is silently dropped from the initiative board whenever the Initiative view (re)mounts, while the feature's once-per-combat use (`thief'sreflexesUses`) remains consumed with no refund and no audit row for the loss. Any EB "Join Encounter" reproduces it because the join auto-navigates to Initiative.

## Steps to reproduce
Lane A — real grant (needs a Rogue/Thief holder; sanctioned temporary fixture swap per explore pitfall 10):

1. In `test-campaign`, edit `public/campaigns/test-campaign/EvasiveFighter.json` on disk: `class.name -> "Rogue"`, `class.subclass -> {"name":"Thief","subtitle":"Roguish Archetype"}`, top-level `level -> 20` (rules stay `2024`). Back up the original bytes first.
2. Reload, re-select test-campaign, open Initiative (13-PC board seeds).
3. TRUSTED-fill `20` into EvasiveFighter's initiative input (`input[data-testid="initiative-input"]` on card `:has(input[aria-label="EvasiveFighter current HP"])`), press Tab.
4. GET `/api/campaigns/test-campaign/change-data` → board contains `EvasiveFighter (Second Turn)` at initiative `10`, `secondTurn:true`, `holderName:'EvasiveFighter'`; log has the honest `ability_use` row; `EvasiveFighter."thief'sreflexesUses" = 0`. **Grant works.**
5. Switch to any other view (e.g. Log). GET again → the row is STILL present (Initiative unmount is innocent).
6. Re-open Initiative. GET → the `(Second Turn)` row is GONE (board 13 PCs + joined monsters only). `thief'sreflexesUses` still 0. No log row mentions the removal.

Lane B — no surgery (same eviction, seed the row directly):

1. GET change-data, push into `combatSummary.creatures` the row `{name:"EvasiveFighter (Second Turn)", type:"player", initiative:"6", targetName:null, concentration:null, secondTurn:true, holderName:"EvasiveFighter"}`, full-store POST it back to `/api/campaigns/test-campaign/combatSummary` (`{value: cs}`) → 200, GET confirms present.
2. Navigate to Log, then back to Initiative.
3. GET → row evicted (verified 2026-11-09 run ER).

Lane C — user-visible path: join via Encounter Builder (Goblin) right after lane-A step 4; the join's `onJoinEncounter -> setActiveView('initiative')` auto-navigation is what kills the row, so it looks like "EB Join dropped it" mid-combat.

## Expected behavior
The `(Second Turn)` row is an authored, intentional transport (thiefsReflexesService.js header: names are suffixed because the walk/card-keys look creatures up by name). Once granted it must survive view navigation like every other board row — the walk is the only legitimate consumer that retires it. If the app insists on evicting it, it must at least refund the use / log the removal; silence + spent use is dishonest either way.

## Actual behavior
Row silently removed; resource stays spent (`uses:0`); zero log/audit rows; the holder loses an earned turn mid-combat with no feedback. Reproduced 4x in run ER (two grants + join, one pure Log→Initiative remount, one curl-seeded row). Initiative-unmount alone never evicts (survives 14s including the debounce window).

## Likely location
Confident: `src/services/encounters/initiativeService.js` → `mergeCombatSummaryWithCharacters` line 233:

```js
.filter(c => c.type !== 'player' || characters.some(ch => getName(ch.name) === c.name))
```

The Initiative mount path (`src/components/initiative/Initiative.jsx:706`) runs this merge against the campaign characters and writes the result back — any `type:'player'` row whose name is not a character file name is treated as a ghost and dropped. `(Second Turn)` rows are `type:'player'` by design, so they always fail the name match. (The grant lane itself — `thiefsReflexesService.maybeGrantThiefsReflexesSecondTurn` via `createCreatureHandlers.handleInitiativeChange` — behaves correctly, including idempotent re-sync on re-stamp.)

## Suggested fix
In `mergeCombatSummaryWithCharacters`, exempt synthetic second-turn rows from the ghost filter, e.g.:

```js
.filter(c => c.type !== 'player' || c.secondTurn || characters.some(ch => getName(ch.name) === c.name))
```

plus (optional hygiene) drop a second-turn row whose `holderName` is no longer on the board / not a campaign character, and mirror the exemption in any sibling mount-normalizer that re-seeds the board. Note the `characters.some(...)` fan-out that APPENDS missing PCs (§73) stays as-is — it's the DELETE leg that's wrong.

## Severity
Data integrity risk — a spent once-per-combat resource is destroyed silently mid-combat; players lose a granted turn and GM never sees why. (Repro'd with a lv20 Thief rig, but every real Thief lv17+ holder is affected.)
