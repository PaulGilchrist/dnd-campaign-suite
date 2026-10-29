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

## Resolution
**FIXED** (2026-10-29 fix run). Root cause confirmed exactly as diagnosed — reproduced live in test-campaign before touching code: baseline EB Join Goblin → 13-creature board + one `joined` row; then `page.route('**/combatSummary*', r=>r.abort())` + re-Join → ZERO toast, client still on 13-card board, yet `joined` rows went to 2 AND initiative-roll rows went to 2 for a `Goblin 1` that landed on NO board. The catch at `handleJoinEncounter` never fired because `storage.set` swallowed the POST rejection into a RESOLVED promise AND the call wasn't awaited.

One addition beyond the filed diagnosis: on a failed write the shared `cachedCombatSummaries` object was also mutated in place by `addMonstersToInitiative`, leaving a phantom joined row in every `getCombatSummary` sync reader client-side.

### Changes
- `src/services/ui/storage.js` — `combatSummary` queue branch now resolves **TRUE** (server acked, `response.ok`) / **FALSE** (network reject or HTTP error, still logging `[storage:error]`). Queue chain still swallows rejections internally so fire-and-forget writers are byte-unchanged and one failed write cannot poison later queue entries. (Chose status-return over reject: dozens of un-awaited callers would become unhandled rejections otherwise.)
- `src/services/rules/combat/damageUtils.js` — `getCombatContext(campaignName, { strict = false })`: strict THROWS on transport failure (network reject or not-ok HTTP) instead of reading as null("no combat"); default lenient bytes unchanged for ~100 consumers (including the `[getCombatContext]` console pins in `revivifyService.test.js`).
- `src/services/encounters/combatData.js` — `loadCombatSummary` passes `strict` through and rethrows on transport failure; `{}`/absent-key normalization untouched.
- `src/services/encounters/encounterToInitiative.js` — `addMonstersToInitiative`: (1) strict read — a GET blip aborts the join loudly instead of normalizing a live board away; (2) joins onto a `cloneDeep` copy — a failed write leaves the shared cache phantom-free, success refreshes it via `setCombatSummaryCache`; (3) **awaited** board write — resolves `false` → THROW `combatSummary board write failed …` BEFORE the initiative-roll log rows, `activeCreatureName` write, and `initiative-rolled` dispatch, so `handleJoinEncounter`'s existing try/catch fires: honest toast, no navigation, draft survives, zero `joined`/roll rows.
- Mock factories in the two sibling tests gained `setCombatSummaryCache: vi.fn()` (new import).

No dual-ruleset twin needed: this lane is ruleset-agnostic shared service code (no 2024 sibling exists for `encounterToInitiative`/`storage`/`damageUtils.getCombatContext`).

### Verification
- **Live re-run (test-campaign, dev:locked)** — write-abort leg (`**/combatSummary*` abort + Join Goblin): toast `Failed to join encounter`, stays on Encounters, checkbox draft survives, server board stays 13/one Goblin, `joined` rows stay 2, roll rows stay 2, console carries the previously-dead `Failed to join encounter: Error: combatSummary board write failed…` line. Read-blip leg (`**/change-data*` abort + Join): same honest toast, board NOT replaced (14 creatures survived a would-have-been wipe), no new rows. Immediate un-abort success join: board → 14 (`Goblin` + `Goblin 1` numbered correctly), one new `joined` row, one new roll row, navigates to Initiative, zero toast. Cleanup: Admin clear-change-data (native confirm accepted) + clear-log; `{}` + `[]` GET-verified two-pass from closed-tab quiet.
- **Tests**: new `encounterToInitiative.join-write-failure.test.js` (3), `storage.combat-summary-status.test.js` (4), `combatData.strict-load.test.js` (5) — 12/12 pass; touched folders `src/services/encounters` + `src/services/ui` + `damageUtils` 104 files/1294 pass; adjacent `src/components/encounter` + `src/encounters` + revivify 387 files/1910 pass. `npm run lint` zero warnings; `no-timers-guard` OK.

## Summary
EB Join Encounter logged a phantom `encounter/joined` row (plus phantom initiative-roll rows) whenever the `combatSummary` POST failed: `storage.set` swallowed the rejection into a resolved promise and the write was never awaited, so the join's try/catch never fired and the UI navigated to a board that never received the monsters; a GET blip additionally normalized a live board to "new combat", risking a silent board wipe for all players. Fix: `storage.set('combatSummary')` now resolves an honest TRUE/FALSE ack status, `addMonstersToInitiative` awaits it and throws before any log row/event, and the read side gained an opt-in `strict` mode (transport failure throws, key absence still means "new combat"). Live re-verified all three lanes (write-abort fail, read-blip fail, success join) in test-campaign; 12 new regression tests + folders green, lint clean.
