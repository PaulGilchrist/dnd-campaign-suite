# Travel event dialog stays open (and stays actionable) on a second client after the event is resolved elsewhere

## Summary
When a hex-travel event (e.g. "Ancient Waystone") is pending, every client with the map open renders the EventDialog. If one client resolves it (Skip/Accept), the server clears `travel-pendingEvent` and broadcasts the clear via SSE — but other clients never apply it: their dialog stays open, blocks the whole map editor (overlay intercepts all pointer events, even "Back to maps"), and its buttons still perform writes — a second client's Skip logged a **duplicate `event_skip` row at a stale hex**.

## Steps to reproduce
Start state: `test-campaign`, two localhost tabs (A and B) on an outdoor hex map, header verified `test-campaign`.

1. Tab A: open Maps → an outdoor map → press the Travel tool (`button[aria-label*="Travel mode"]`), plan a multi-hex route, and Advance until an event fires (12% per hex at Normal; deterministically force with `Math.random=()=>0.0` stub before one Advance click, per playbook event-rig). `travel-mode` goes `paused` and `travel-pendingEvent` is set; the EventDialog opens in A.
2. Tab B (map editor already open, travel panel mirroring): the same event dialog appears (the event OBJECT broadcasts fine).
3. Tab A: click **Skip** in the dialog. Server truth afterwards (GET `/api/campaigns/test-campaign/change-data`): `travel-pendingEvent` null, mode resumed — and A's own dialog closes.
4. Observe Tab B: `.event-dialog-overlay` is **still rendered** with the resolved event.
5. Click **Skip** in B's stale dialog (dialog accepts the click).
6. GET `/api/campaigns/test-campaign/log`: there are now **two** `travel/event_skip` rows for the one event — A's at the event hex (18,10) and B's stale one at **19,10** (B's out-of-date local party position).

Live-proven 2026-10-27 (run after improve-J): rows observed exactly `advance@19,10 / advance_with_event@18,10 / event_skip@18,10 / event_skip@19,10` with server `travel-pendingEvent: null` while B's dialog was still open.

## Expected behavior
When the pending event is cleared by another client (SSE `change-<campaign>-travel-pendingEvent` with null, or key DELETE — both publish null from `server/routes/campaigns-changedata.js:230/:243`), every client should close its EventDialog; a resolved prompt must not remain actionable or produce further writes/log rows.

## Actual behavior
The second client's dialog never closes; it is a full-screen overlay (blocks navigation — Playwright click on `button[aria-label="Back to maps"]` timed out with "event-dialog-overlay intercepts pointer events"), and pressing Skip/Accept/Reroll there still executes (duplicate `event_skip` log row, stale party-hex recorded).

## Likely location
Confident (code-read + live delta): `src/App.jsx` → `handleChangeKeyEvent` first line:

```js
if (!event.data || typeof event.data !== 'object') return;
```

SSE echoes whose payload is `null` (key cleared) or a scalar (e.g. `travel-mode: "inactive"`, `travel-lastMessage` strings) are **dropped before `applyStoreUpdate`**, so the campaign store keeps the stale `travel-pendingEvent` object and `EventDialog` (gated on `travelMgmt.pendingEvent` in `src/components/hex-map/HexMap.jsx:689`) stays mounted. (Arrays/objects pass, which is why path/destination object clears DO mirror and partially mask the problem.) Side note: the same guard silently drops scalar echoes for every key — the travel panel re-derives from the surviving array payloads, but any UI gated on a string/scalar runtime key will be cross-tab stale too.

## Suggested fix
In `handleChangeKeyEvent`, don't reject non-object payloads wholesale. Route scalars/nulls to `applyStoreUpdate(storeKey, event.data, campaignName)` (the object-only branches below — `saveResult-`, `biPrompt`, promptId checks — can keep their own `typeof event.data === 'object'` gates). Add/extend a unit test firing `change-<c>-travel-pendingEvent` with `data: null` and asserting the campaign store value becomes null. Investigate whether prompt lanes (`savePromptCleared-*`, etc.) already rely on object payloads so the relaxation doesn't double-apply there.

## Severity
Data integrity risk — a resolved adjudication prompt remains actionable on other clients and writes duplicate, mis-hexed log rows; the stale overlay also soft-locks the other client's map editor until the resolved prompt is clicked away.

## Resolution
FIXED 2026-10-27.

**What was actually wrong** — the guess was right about `handleChangeKeyEvent`'s object-only guard, but there was a **second, outer guard that dropped nulls even earlier**: `handleRuntimeEvent` began with `if (event.key == null || event.data == null) return;`, so cleared-key echoes (null) never reached `handleChangeKeyEvent` at all. Both layers had to be relaxed:

1. `handleRuntimeEvent` (src/App.jsx): now only drops `data == null` for keys that are **not** `change-<campaign>-` echoes (character/pipeline/map-activate lanes need object payloads and keep dropping nulls unchanged).
2. `handleChangeKeyEvent` (src/App.jsx): moved the prefix/key parsing above the payload check; a `null`/scalar payload now routes to `applyStoreUpdate(storeKey, event.data, campaignName)` **only when `isCampaignKey(storeKey)`**. Character-scoped keys stay dropped for non-object payloads — the char store is a full-snapshot replace, so a scalar there is corrupt noise (and this keeps the pre-existing malformed-events test contract green). All object-payload branches (`saveResult-` redispatch, `biPrompt`/`biPromptCleared` ref gating) are untouched and unreachable by null/scalar echoes, so no double-apply; SavePromptModal and BardicInspirationReactionModal have their own Subscriber lanes with independent object guards, unaffected.

**Files changed**
- `src/App.jsx` — both guard relaxations (non-object echoes mirror for campaign keys only).
- `src/App.runtime-events.test.jsx` — 3 new regression tests: `change-test-campaign-travel-pendingEvent` with `data: null` clears the seeded campaign-store event to null + wakes `notify('campaign')`; scalar-string echo (`travel-lastMessage`) mirrors into the campaign store; null/scalar on a character-scoped key stays dropped (zero campaign-store writes).

**Verified**
- Repro re-run live BEFORE the fix (test-campaign, :5173, two tabs, QA outdoor map, `Math.random=()=>0.0` forced "Wolves on the Hunt"): after A's Skip, server `travel-pendingEvent: null` while B's `.event-dialog-overlay` stayed open, intercepted `Back to maps`, and B's Skip logged a duplicate `event_skip` at B's stale hex (20,10 vs 19,10). Confirmed exactly.
- Re-verified live AFTER the fix, same steps: A's Skip → B's dialog auto-closed (B never clicked), Back button clickable, log holds **exactly one** `event_skip` row. Adjacent sanity: object mirror (path → B shows REMAINING 2) and scalar mirror (accrued/budget/mode → B shows "2.5 left / 1.5 / 4", Advance enabled, mode planning) both correct.
- `npx vitest run src/App.runtime-events.test.jsx` → 20/20 pass; all sibling `src/App.*.test.jsx` → 46/46 pass; `npm run lint` → zero warnings; `node .opencode/plans/no-timers-guard.mjs` → OK.
- Cleanup: change-data `{}` + log `[]` verified from quiet state (tabs at about:blank/closed), QA BugDialog map deleted, maps back to [Battle Arena, Test Map]; zero campaign-lock denials in server log.
