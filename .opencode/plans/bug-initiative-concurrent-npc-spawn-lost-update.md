# Initiative board silently loses a creature on concurrent two-tab +NPC spawn

## Summary
Two localhost GM tabs that add an NPC to the initiative board at (near-)the-same-time converge on a board containing only ONE of the two spawned NPCs. The loser's spawn vanishes with zero toast, zero console output, zero log row. The initiative board (`combatSummary`) is a raw full-replace store with no stamp/version guard, so a read-modify-write race silently drops one tab's entire board mutation.

## Steps to reproduce
Starting state: test-campaign, two localhost tabs (A and B) both on the Initiative view, zero-reload markers planted (`window.__noReload`), recording confirm-spy armed TRUE on both tabs (`window.confirm = m => { __confirms.push(m); return true; }`), board = 12 PCs + 1 Goblin (13 creatures), server combatSummary GET-verified at 13.

1. In BOTH tabs, click the `+ NPC` button (`button[title^="Adds a statless NPC"]`) simultaneously (single `Promise.all([A.click, B.click])` in Playwright; each tab fires and accepts its own named confirm `Add NPC with placeholder AC 10 / HP 10? Edit on the card.`).
2. Wait ~2.5 s for echoes to settle.
3. `GET /api/campaigns/test-campaign/combatSummary` and count `creatures` (note: read shape is `{combatSummary:{…}}` — unwrap the `combatSummary` key, NOT `value`).
4. Observe both tabs' card lists.
5. CONTROL: click `+ NPC` in tab A, wait 1.5 s, then click `+ NPC` in tab B, wait 1.5 s, re-read the server board.

## Expected behavior
Two accepted spawns produce two creatures (server board 15: `NPC 1` + `NPC 2`), as the sequential control does — or, if a conflict is detected, the losing tab gets honest feedback (a toast/409-style guard like the `.ct-*` entity lanes have).

## Actual behavior
Server board ends at 14 creatures with exactly ONE non-player NPC (`Goblin` + `NPC 1`). One whole spawn is lost. Both tabs live-converge to the winner's board with zero reload markers tripped. Console is 100% clean on BOTH tabs (0 errors, 0 warnings). No `encounter`/`npc` log row records either spawn or the loss. The illusion is total because BOTH tabs independently name their spawn `NPC 1` (names derive from each tab's local creature count), so the loser's card text is indistinguishable from the survivor's and no disappearance is perceptible.
CONTROL result (sequential): board = 16 with `NPC 1`, `NPC 2`, `NPC 3` — the lane itself works; strict simultaneity is the differentiator.

## Likely location
Confident on the mechanism, guessing on the exact fix site. `+ NPC` → `handleAddNpc` (`src/components/initiative/createCreatureHandlers.js:255`, button wired at `Initiative.jsx:720`) reads the locally-mirrored `combatSummary`, appends the NPC, and `storage.set('combatSummary')` POSTs the FULL board — last write wins, no `updatedAt`/version stamp, no merge. This is the same class the `.ct-*` entity family closed with the `jsonEntityCrud` concurrent-write guard (409 + named banner), and it affects EVERY board mutation on this lane (HP edits, Clear, Prev/Next, target arming), not just +NPC — +NPC is just the cheapest deterministic repro. SSE echo ordering (`server/routes/campaigns-changedata.js` publishes synchronously pre-response) narrows but does not close the window between a tab's store-read and its POST.

## Suggested fix
First investigation step: read `createCreatureHandlers.js:255` + the shared `loadCombatSummary`/`storage.set` pair and confirm no stamp travels with the write. Options, in increasing ambition:
1. Minimal honest feedback: on `storage.set('combatSummary')`, compare the POSTed creature count/names against the echoed server board and toast when the tab's mutation is absent (same "post-ack row" doctrine as the EB join fix 26ffb4aa5).
2. Version-guarded write: carry a monotonic `boardVersion` (or `updatedAt`) inside the combatSummary value; POST includes the base version it was built from; server 409s a stale base; the client re-reads, re-applies its single mutation (append one NPC) onto fresh state, and retries once.
3. Targeted mutations: make +NPC (and Clear/HP) go through a per-mutation server-side patch endpoint instead of full-board replace.
Note: the name collision (`NPC 1` generated twice from local counts) is a secondary symptom — fixing numbering to read the FRESH board before naming is a cheap hardening even if a full guard lands.

## Severity
Data integrity risk — the initiative board is the most game-critical shared state in the app; a GM pair using two windows can silently lose a monster/spawn/HP edit with no observable signal anywhere (no toast, no console, no log row, converged UI hides it).
