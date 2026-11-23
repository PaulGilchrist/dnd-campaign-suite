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
