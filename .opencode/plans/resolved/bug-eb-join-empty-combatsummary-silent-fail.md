# Join Encounter on an empty-object combatSummary silently fails AND logs a phantom "joined" row

### Summary
When the campaign `combatSummary` change-data key holds an empty object `{}` (truthy but creature-less), clicking **Join Encounter** in the Encounter Builder writes the `encounter/joined` log row, then dies on an **unhandled promise rejection** (`TypeError: Cannot read properties of undefined (reading 'some')`). No monsters join, no navigation happens, and the GM receives zero feedback — while the campaign log now claims an encounter joined that never did.

### Steps to reproduce
Starting state: in `test-campaign` on localhost, Encounter Builder otherwise idle (recipe proven 2026-10-29 run AB against a board that had just been Admin-cleared; works with any healthy board too).
1. Poison the store from the console or curl: `POST /api/campaigns/test-campaign/combatSummary` with body `{"value":{}}` → 200. (Leave the Encounters view mounted — do NOT visit Initiative, whose mount self-heals `{}` to a 12-PC skeleton.)
2. Encounters view → search `Goblin` → check the plain `Goblin 0.25` row (`input.monster-checkbox`; verify `.checked === true` and the toolbar strip reads `Selected Monsters (1)`).
3. Click the enabled `Join Encounter` button (`button[title="Add monsters to initiative and navigate to combat"]`).
4. `GET /api/campaigns/test-campaign/log` and `GET /api/campaigns/test-campaign/combatSummary`.

### Expected behavior
Either the join succeeds (creatures enter initiative, board navigates) or the GM sees honest failure feedback (toast/popup) — and on failure NO `joined` log row is persisted.

### Actual behavior
- `combatSummary` stays `{}` on the server; no creature rows, no initiative-`roll` row, no navigation.
- The log gains one `encounter/joined` row anyway (with the monster list) — a phantom join the board never received (machine-verified: log 52→53 rows, `lastRow: encounter/joined`, cs unchanged).
- No toast, no popup, no inline error. The only trace is a window-level `unhandledrejection` (`Cannot read properties of undefined (reading 'some')`) which the MCP console surfaced as a pageerror — in a normal browser session this is invisible outside DevTools.
- Recovery exists but is undiscoverable in-app: `POST {value:{round:1,creatures:[]}}` (playbook recipe), or mounting the Initiative view which NOW self-heals `{}` to a fresh 12-PC skeleton (new run-AB observation — the view's `setupCreatures` rebuild branch fires on `{}` too, since `!initialSummary.creatures` covers it).

### Likely location
Confident (code read + live rejection message):
- `src/services/encounters/encounterToInitiative.js` — `addMonstersToInitiative()` guards only `if (!combatSummary)` before re-seeding `{round:1,creatures:[]}`; `{}` is truthy so it falls through to `hasMonsterVariant(baseName, combatSummary.creatures)` → `creatures.some(...)` on `undefined` → TypeError. Runtime stack (session console, Vite-transformed frames): `hasMonsterVariant (encounterToInitiative.js:166) ← addMonstersToInitiative (:203/:221) ← handleJoinEncounter (EncounterBuilder.jsx:301)`.
- `src/components/encounter/EncounterBuilder.jsx` — `handleJoinEncounter()`: awaits `addMonstersToInitiative` with NO try/catch, and pre-writes the `joined` row via fire-and-forget `logEntry(...)` BEFORE the await, so the row survives the abort.
- Playbook §105's older fingerprint for this corruption (a `creatures-not-iterable` throw at `encounterToInitiative.js:154`) is superseded — current head fails later, after the log write, and silently at UI level.

### Suggested fix
1. `addMonstersToInitiative`: normalize the store first — `if (!combatSummary || !Array.isArray(combatSummary.creatures)) combatSummary = { round: 1, creatures: [] }` (keeps the existing new-combat sweep semantics; the `{}` case is exactly a new combat).
2. `handleJoinEncounter`: wrap the await in try/catch; on failure show `showToast('Failed to join encounter', true)` + one `console.error` (single-layer canon) and do NOT leave the `joined` row standing — move the `logEntry` call AFTER a successful join (or log a failure row), so the campaign log never claims a join that didn't persist.
3. Same guard audit: `loadEncounterToInitiative` callers that read `existing.creatures` after a truthiness check.

### Severity
Data integrity risk — the durable campaign log records an encounter join that never happened (log/board divergence), and the failure is fully silent for the GM. Precondition (an empty-object combatSummary) is rare in pure-UI flows (Admin clear writes key-absence, Initiative mount self-heals), which caps blast radius, but the corruption lane is documented in the test playbook and any stale full-store POST can produce it.

## Resolution

**FIXED 2026-10-29.** The original diagnosis was correct on both counts (verified against live code + a live repro before touching anything):

1. `addMonstersToInitiative` guarded only `if (!combatSummary)`, so a truthy creature-less `{}` fell through to `hasMonsterVariant(baseName, combatSummary.creatures)` → `creatures.some(...)` on `undefined` → unhandled `TypeError: Cannot read properties of undefined (reading 'some')` (server-side Vite log captured the exact frame chain `hasMonsterVariant:156 ← addMonstersToInitiative:193 ← handleJoinEncounter:345`).
2. `handleJoinEncounter` pre-wrote the `encounter/joined` row fire-and-forget BEFORE the await and had no try/catch, so the phantom row survived the abort with zero GM feedback.

### Changes

- `src/services/encounters/encounterToInitiative.js` — `addMonstersToInitiative` now normalizes the store with `if (!combatSummary || !Array.isArray(combatSummary.creatures))` → re-seed `{round:1,creatures:[]}` + the existing new-combat clock sweep. Mirrors the Initiative-mount self-heal seam (`Initiative.jsx` `initialSummary && initialSummary.creatures`): a `{}` store IS a new combat.
- `src/components/encounter/EncounterBuilder.jsx` — `handleJoinEncounter`: awaits `addMonstersToInitiative` in try/catch FIRST; on failure one `console.error('Failed to join encounter:', error)` + `showToast('Failed to join encounter', true)` (same single-layer copy family as the save lanes) + early return (draft survives for retry). The `encounter/joined` `logEntry` moved AFTER the successful join, so the campaign log can never claim a join the board didn't receive.
- Guard audit (suggested item 3): `loadEncounterToInitiative` builds its own `{round:1,creatures}` and never reads an existing summary; its only caller (`autoEncounterService.js`) reads `.creatures.length` off that fresh object — no analogous hole. Module is ruleset-shared (no 2024 twin).
- Tests: new `src/services/encounters/encounterToInitiative.empty-summary.test.js` (`{}` and `{round:3}` self-heal + byte-persist join), new `src/components/encounter/EncounterBuilder.join-failure.test.jsx` (rejection ⇒ toast + console line + NO log row + no navigation + draft kept; success ⇒ row lands, navigate), updated `EncounterBuilder.additional-interactions.test.jsx` join pin (row now lands post-await → `waitFor`).

### Verification

- **Live repro (pre-fix, test-campaign on :5173, campaign-lock dev):** poisoned `POST /combatSummary {value:{}}` → checked `Goblin 0.25` (`checked:true`, strip `Selected Monsters (1)`) → Join → log 0→1 `encounter/joined` while cs stayed `{}`, zero navigation/toast, window `unhandledrejection` captured — exact filed behavior.
- **Live re-verification (post-fix, same poisoned `{}` board):** Join now self-heals: cs becomes `{round:1,creatures:[Goblin,…]}`, exactly one `roll/initiative` + one `encounter/joined` row pair, auto-navigates to Initiative with the Goblin card visible, zero unhandled rejections, zero console errors/warnings. Adjacent sanity: populated-board join unaffected (existing suite + live board re-seed flow).
- **Tests:** new files 4/4 green; touched folders `src/services/encounters` + `src/components/encounter` full run 477 files / 3044 tests passed (vitest resolved the folder filter to the whole suite — all green, no pre-existing failures). `npm run lint` clean (zero warnings); `node .opencode/plans/no-timers-guard.mjs` OK (35 benign sites, no new timers).
- Cleanup: change-data `{}` + log `[]` GET-verified after closing the browser context (API clears, no dialogs).

## Summary
Join Encounter on a `{}`-poisoned combatSummary silently failed (unhandled `creatures.some` TypeError in `addMonstersToInitiative`) while a pre-written phantom `encounter/joined` log row persisted. Fixed by normalizing creature-less summaries to a fresh `{round:1,creatures:[]}` board (matching the Initiative-mount self-heal seam) and moving the joined log row after a successful join behind a try/catch with an honest failure toast. Verified live (repro + re-verify in test-campaign) + 4 new regression tests; touched-folder suite and lint green.
