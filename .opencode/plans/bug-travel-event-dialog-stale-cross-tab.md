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
