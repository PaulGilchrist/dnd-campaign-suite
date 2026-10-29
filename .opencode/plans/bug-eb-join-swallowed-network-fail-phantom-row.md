# EB Join Encounter silently logs a phantom `joined` row when the board write fails (network-failure path of 4d81b8495)

## Summary
Run-AB's bug (`bug-eb-join-empty-combatsummary-silent-fail`, fixed by 4d81b8495) closed only the `{}`-corrupt-board path. The phantom-join class is still live on the **network-failure** path: when the `combatSummary` read/write requests fail, `addMonstersToInitiative` still RESOLVES (both its load and its board write swallow rejections), so the new try/catch never fires, the `encounter/joined` log row persists, the client navigates to Initiative, and the joined monster lands on **no board anywhere** — server or client. Additionally, a GET-only failure treats a live board as "new combat" (`loadCombatSummary` → `null` → `{round:1,creatures:[]}` normalization), so a successful write after a read blip would silently REPLACE the live initiative board with just the joining monsters.

## Steps to reproduce
1. In test-campaign, open the app on localhost (dev:locked).
2. Encounters view → search `Goblin` → check the Goblin row (CR 0.25) → `Join Encounter` → success (board = 12 PCs + Goblin; one `joined` row in log). Baseline established.
3. Back to Encounters → re-check Goblin.
4. Arm a request-blocking route for `**/combatSummary*` (Playwright: `page.route('**/combatSummary*', r => r.abort())`) to simulate a transient network failure, then click `Join Encounter`.
5. Observe client: navigates to Initiative, NO failure toast, board still 13 creatures with exactly ONE Goblin (no `Goblin 2` added anywhere).
6. `GET /api/campaigns/test-campaign/log` → TWO `encounter/joined` rows (`monsters:["1x Goblin"]`); `GET /api/campaigns/test-campaign/combatSummary` → 13 creatures, one Goblin — the second join exists ONLY in the log.

Live-proven 2026-10-29 run AC: joinedRows 2 / server board 13 / client board 13, console = 2× `net::ERR_FAILED` (combatSummary) + 2× `[storage:error] TypeError: Failed to fetch (storage.js:44)`; zero toast.

## Expected behavior
If the board write never reaches the server, the join must be reported as failed: honest failure toast + `console.error` and **no** `joined` log row (the fix's own contract: "Board accepted the creatures — only now is the join true"). And a failed READ must not be silently conflated with "no combat exists" — at minimum the join should surface an error rather than overwrite/normalize away a possibly-live board.

## Actual behavior
- Second `joined` row persisted to the durable campaign log; monster never appeared on any board (client or server).
- No toast, no navigation block — UI showed the pre-join 13-card board after auto-navigating to Initiative.
- Console has only raw fetch errors (`storage.js:44` swallows the write rejection; `combatData.js:43` warns on the read failure) — the dedicated `Failed to join encounter:` catch never executes.
- Flipside risk (code-certain, not live-attempted since it would destroy state): read-fail → `null` → normalize to fresh `{round:1,creatures:[]}`; if the subsequent POST SUCCEEDS, the live 13-creature board is replaced by just the new monsters for every player.

## Likely location
Confident (read the code at HEAD 626ea974d):
- `src/services/ui/storage.js` `set()` — the combatSummary queue branch `.catch(e => console.error("[storage:error]", e))` converts POST failure into a RESOLVED promise.
- `src/services/encounters/encounterToInitiative.js:252` — `storage.set('combatSummary', …)` is **not awaited** (nor is the follow-up `storage.set('activeCreatureName', …)`), so even an un-swallowed rejection would escape `addMonstersToInitiative`.
- `src/services/encounters/combatData.js:35-45` — `loadCombatSummary` catches the GET failure and returns `null`, indistinguishable from "no combat".

## Suggested fix
Make the join's board write authoritative: have `storage.set` for `combatSummary` reject (or return a status) instead of swallowing, `await` the write inside `addMonstersToInitiative` (or return its promise), so `handleJoinEncounter`'s existing try/catch + `Failed to join encounter` toast actually fires and the `joined` row stays suppressed. For the read side, distinguish "fetch failed" from "key absent" in `loadCombatSummary` (e.g. rethrow on network error) so a blip cannot reset a live board; keep the `{}`/creature-less normalization for genuine corrupt/missing data.

## Severity
Data integrity risk — durable campaign log accrues join rows describing combats that never happened, and a transient network blip can silently wipe/replace a live initiative board; exactly the log/board divergence class 4d81b8495 set out to close.
