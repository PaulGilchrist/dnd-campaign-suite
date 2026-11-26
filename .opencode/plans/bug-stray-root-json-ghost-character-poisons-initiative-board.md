# Bug: a non-character JSON file at campaign root bakes a name-less ghost row into combatSummary and every monster join / playtest start then crashes

## Summary

`GET /api/campaigns/:campaign` (server/routes/campaigns-basic.js:27-35) lists **every** root `*.json` as a character file, with no shape guard. Any stray non-character JSON at the campaign root (any file not named `*.json` inside `data/`, `maps/`, `images/`) becomes a roster entry whose parse succeeds but has no `name` — producing a React key warning, a `name: null` player row baked into the persisted `combatSummary`, and a hard `TypeError` crash when any lane joins monsters to the board (Encounter Builder **Join Encounter** and Encounter Playtest share `addMonstersToInitiative`). The failing write also leaves the playtest half-started (snapshot zip + staged activated map) with **no End-Playtest affordance** (the `playtest` stamp is written after the join step) and **zero user-visible error** — a pure console.error.

Trigger note (honest): the trigger this run was a stray `public/campaigns/test-campaign/campaign-meta.json` created by the harness writing to the wrong path (the app itself stores campaign meta at `data/campaign-meta.json`; no in-app code writes it to root). But the app-observable defects are real regardless of trigger: roster enumeration blindly trusts any root JSON, the poison PERSISTS on disk inside `combatSummary` after the stray file is gone, and the crash is silent.

## Steps to reproduce

1. In `test-campaign`, create a stray file `public/campaigns/test-campaign/campaign-meta.json` containing any valid JSON object (e.g. `{"type":"standard","toolbelt":{"hiddenViews":["notes"]}}`). (This mimics an editor drop / Finder artifact / hand-edited file; the app has no root-level writer for it.)
2. Reload the app tab on http://localhost:5173 and select `test-campaign`. Console shows `Each child in a list should have a unique "key" prop … Check the render method of LevelUpCelebration` (the ghost roster entry has `character.name === undefined` ⇒ `key={undefined}`).
3. Wait for the campaign select to bake the board (`GET /api/campaigns/test-campaign/combatSummary` now lists 16 player rows, the last one `{"name": null, "type":"player", "currentHp":1,"maxHp":1}`) even after the stray file is deleted — the row is persisted in change-data.
4. Go to Encounters → toolbar `Load` → `Test Encounter` → press `Playtest` → `Start Playtest`.
5. Observe: console error `Failed to start encounter playtest: TypeError: Cannot read properties of undefined (reading 'match') at getNextUniqueMonsterName (encounterToInitiative.js)`; the UI shows NO error, the confirm dialog just closes; a snapshot zip + staged `travel-encounter-stage` map (activated) exist, but no `playtest` change-data stamp, no End-Playtest affordance, no log row. The Playtest button stays enabled — a second press would stack another snapshot.

Same crash will fire on a normal Encounter Builder `Join Encounter` while the poisoned board is live (identical `addMonstersToInitiative` lane).

## Expected behavior

The roster loader only treats files that parse as character-shaped documents (or at minimum skips known non-character names) — a stray root JSON must never mint a character. The board bake must never persist a name-less creature row. If a playtest start fails midway, the GM gets visible failure feedback and the already-taken snapshot / staged map are not orphaned in a state with no End/rollback affordance.

## Actual behavior

- Roster = 16 "characters" (15 real + the meta document); React key error on every select.
- `combatSummary` gains a permanent `name: null` player row (survives deleting the stray file; only an admin clear / key DELETE sweeps it).
- Playtest start throws at `creature.name.match(numberedPattern)` (`src/services/encounters/encounterToInitiative.js:223`) AFTER the snapshot + staged map + activation; silent except console.

## Likely location

- `server/routes/campaigns-basic.js:27-35` — root `readdirSync(...).filter(isFile && endsWith('.json'))` with no shape/name validation (root cause).
- Client roster load (the consumer of `GET /api/campaigns/:campaign` that parses each file into `characters`) passes the parsed doc through unchecked — App `characters` fed `LevelUpCelebration` (crash-visible warning) and the select-bake that writes `combatSummary` rows keyed by `name`.
- `src/services/encounters/encounterToInitiative.js:223` (`getNextUniqueMonsterName`) and `:249/:255` (`normalizeMonsterSeries`) assume every row carries a string `name` (per no-fallback policy they are right — the bake upstream is what must be fixed).
- `src/services/encounters/playtestService.js` `startEncounterPlaytest` order: snapshot → stage+activate map → `addMonstersToInitiative` (line ~117, threw) → stamp — a mid-chain throw escapes silently (EncounterPlaytestButton `handleStart` catch = console only).

## Suggested fix

First check the roster lane: make `GET /api/campaigns/:campaign` accept only character-shaped files — e.g. parse the head of each file and require a non-empty `name` (character files always carry one), or skip an explicit denylist that includes `campaign-meta.json`. Fixing it server-side also fixes the bake and the LevelUpCelebration key warning in one seam. Second, in `startEncounterPlaytest`, wrap the join step so a mid-start failure surfaces to the GM (visible error + honest cleanup or at least an honest message naming the orphaned snapshot/staged map). Add a board-shape assertion? No — keep one canonical row shape; the fix belongs where the ghost row is minted.

## Severity

Data integrity risk — the ghost row PERSISTS in the campaign's change-data after the trigger file is gone and hard-breaks every monster join / playtest start on that board until an admin clear; the failure it presents is silent, and the half-started playtest orphans a snapshot + activated staged map with no rollback affordance.
