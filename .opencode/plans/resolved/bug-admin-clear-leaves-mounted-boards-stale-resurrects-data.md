# Bug: Admin clear-change-data does not retire mounted Initiative boards — next turn-walk resurrects the cleared data

## Summary
`POST /api/campaigns/:c/admin/clear-change-data` wipes the server store and publishes `change-<c>-combatSummary` with a `null` payload specifically so mounted tabs retire — but the Initiative view's SSE dispatcher drops every null-data event, so mounted boards keep rendering the cleared board verbatim. The stale board's next turn-walk click (Next/Prev) re-POSTs the whole cleared combatSummary back to the server, silently undoing the admin clear.

## Steps to reproduce
1. In `test-campaign`, open the Initiative view in tab A (mount-merge seeds the 13-PC placeholder `combatSummary`; or join a real encounter for the production-shaped board). Open a second tab (B/C) with Initiative mounted too — the effect is per-client.
2. In tab A, arm any target (e.g. `EvasiveFighter` → `FeyRanger`) and set an HP field so the board has visible state.
3. With ALL tabs still mounted on Initiative, run the admin clear: Admin panel → Clear Change Data (or from the same origin `POST /api/campaigns/test-campaign/admin/clear-change-data` → 200 `{"message":"Change data cleared"}`).
4. `GET /api/campaigns/test-campaign/change-data` → `{}` (server is genuinely cleared). Observe tabs A/B/C: all still render 13 creature cards with the pre-clear HP/target values — no empty state, no notice, no reload prompt.
5. Click `Next →` (or `← Prev`) on the stale mounted board.
6. `GET /api/campaigns/test-campaign/change-data` → keys are back: `combatSummary` (full 13-creature board), `activeCreatureName`, `__initiative__` (and `AasimarTest` char bucket on the Prev leg) — the cleared data has been resurrected from the stale client cache.

Reproduced twice live (2026-11-23 explore run, Next leg and Prev leg separately, each starting from a verified `{}` store).

## Expected behavior
A cleared-key broadcast should retire the mounted board (empty state / "No one is on the initiative board yet"), exactly like the companion `spell-overlay` clear publish (`{action:'clear'}`) retires mounted map geometry. At minimum the client must not be able to silently re-persist a board the admin just wiped.

## Actual behavior
The board stays fully rendered and interactive after the clear; one turn-walk click writes the entire stale board back to disk (server keys went `[] → ["__initiative__","activeCreatureName","combatSummary"]`). No console errors, no toast, no visual difference between a live board and a cleared one.

## Likely location
- Server (intends the notification, correct): `server/routes/campaigns-admin.js:327` — `publish(\`change-${campaign}-combatSummary\`, null, campaign)` beside the overlay clear at `:329`.
- Client (drops it): `src/components/initiative/sseHandlers.js:222` — `if (event.key == null || event.data == null) return` swallows the combatSummary null-echo before `dataKeyHandlers` run; `Initiative.jsx:407` keeps a component-local `combatSummary` state that nothing ever nulls.
- Contrast: `src/App.jsx:1073` explicitly lets `change-<campaign>-<key>` null-echoes through to mirror clears into the campaign store, and `src/components/log/Log.jsx:203-198` handles a null `event.data` honestly (census → empty). Initiative is the outlier consumer.

## Suggested fix
In `createSSEHandler` (`sseHandlers.js`), let null-data events through for the `combatSummary` key (mirror the App.jsx discriminator) and have the `combatSummary` dataKeyHandler treat `null` as "board cleared": `setCombatSummary(null)` + reset board-local refs (round gate, active-creature mirrors). Check the sibling local consumers of the same state for the same retirement (e.g. TV overlay / victory banner mounts) while in there. Add a unit pin: a `change-<c>-combatSummary` event with `data: null` empties the mounted board.

## Severity
Data integrity risk — the admin clear is precisely the repair action a GM reaches for after bad state lands; any still-open client tab silently re-materializes the state that was just wiped, and the GM has no visual signal that it did.

## Resolution
FIXED 2026-11-23 (fix subagent). The black-box diagnosis in "Likely location" was confirmed against the code: the server intends the retirement (it publishes `change-<c>-combatSummary` with a `null` payload from BOTH admin lanes — `campaigns-admin.js:327` clear-change-data and `:379` full-reset — and the wildcard key DELETE at `campaigns-changedata.js:660` publishes null the same way), but the Initiative SSE dispatcher's `if (event.key == null || event.data == null) return` guard swallowed the cleared-key echo before `dataKeyHandlers` ever ran, and the component-local `combatSummary` state (Initiative.jsx) had no nulling lane.

**Changes (client only — the server was already correct):**
- `src/components/initiative/sseHandlers.js`
  - Dispatcher: mirrors the root-Subscriber discriminator (`App.jsx:handleRuntimeEvent`) — a null payload passes ONLY on `change-<campaign>-combatSummary`; every other null echo stays dropped exactly as before (the stored `activeCreatureName` null is the legitimate "no active creature" sentinel that must not run the echo seam — `bug-zero-creature-initiative-null-name`; character-bucket nulls are mirrored by the root App subscriber).
  - `handleCombatSummaryChange`: new `data === null` branch retires the board — zeroes `combatSummaryRef`/`activeCreatureNameRef`/both round-gate refs, evicts the module `combatData` cache (`setCombatSummaryCache(null, …)`), and nulls the view state. ZERO writes on this lane — a retirement must not re-create any cleared key. One subtlety found while fixing: the retirement calls BOTH the raw `setCombatSummary(null)` and the guarded `setCombatSummaryG(null)`. The `useSSEEqualityGuard` ref starts `undefined` and `valuesEqual(undefined, null)` is true, so a guarded-only null is swallowed on tabs whose board was adopted via the raw mount-merge setter without any intervening guarded echo (a real visitor-tab face); guarded-only-swallows would leave the stale board rendering, while raw-only would desync the guard ref so a byte-identical re-seed board echo later is skipped, parking the tab on the empty state forever. Raw+guarded together cover both directions.
- `src/components/initiative/sseHandlers-main.test.jsx` — the old pin that `data: null` "writes nothing" pinned the BUG; the leg now asserts nulls stay dropped for `activeCreatureName`/character buckets/foreign campaigns, and the cleared-key retire is pinned in its own files.

Dual-ruleset: this lane (SSE dispatch/board mirror) is ruleset-agnostic — there is no 5e/2024 sibling of `sseHandlers.js`; nothing else to mirror.

Adjacent consumers checked: the empty-state branch (`InitiativeEmptyBranch`) renders as soon as `combatSummary` is null, so the TV layer, victory banner, keydown walk hotkeys, and every toolbar write lane are unreachable post-retire (each has its own `!combatSummary` guard). Residual (pre-existing, cosmetic, unchanged): the App-level `npcs` list (map NPC palette) keeps the last board's NPCs until Initiative remounts, because the null-retire path early-returns from the `onNpcsChange` effect like any other null-board mount moment — the normal Clear button (empty-board echo) still refreshes it.

**Verification:**
- Live repro (pre-fix, :5173, test-campaign): board mounted 13 cards, `EvasiveFighter` armed `FeyRanger` + HP 111 → `POST /admin/clear-change-data` 200 → GET change-data `{}` → tab STILL rendered 13 cards with the pre-clear values → clicked `Next →` → keys resurrected (`__initiative__`, `activeCreatureName`, `combatSummary` 13 creatures). Both bug legs confirmed.
- Live re-verify (post-fix, :5173): same steps → the mounted tab IMMEDIATELY retires to `No one is on the initiative board yet` (0 cards, no Next/Clear toolbar); store stays `{}` while the tab idles mounted (8 s + 4 s rechecks); a second tab mounting Initiative re-seeds via the normal mount-merge and the retired tab ADOPTS the echoed live board (13 cards, no stale-empty lock-in); the Next walk on tab A advances the pointer (AberrantSorcerer → CelestialWarlock); a second admin clear retires the adopted board again; console 0 errors since navigation.
- Adjacent sanity: normal re-seed → walk → both admin clears still behave; final closed-tab baseline `change-data {}` + `log []`.
- Tests: `npx vitest run` on the 3 new/touched files (22 passed), then the whole `src/components/initiative` folder (129 files / 971 tests passed) plus the companion null-echo lanes `src/App.bucket-null-echo.test.jsx` and `src/App.combat-summary-cache.test.jsx` (131 files / 980 tests passed). `npm run lint` — zero warnings.

New files: `src/components/initiative/sseHandlers.cleared-board-retire.test.js` (handler lane: refs/cache/state nulled, zero writes, re-seed adoption, other nulls still dropped) and `src/components/initiative/Initiative.cleared-board-retire.test.jsx` (component lane: dispatching the exact cleared-key broadcast through the real `<Subscriber>` handleEvent empties the mounted board and writes nothing back).
