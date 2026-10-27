# Travel arrival (per-key DELETE null echo) blanks the entire SPA — crash in useTravelManagement

## Summary
When a hex-map trip ARRIVES, `clearCompletedTripKeys` removes `travel-destination`/`travel-path`/`travel-pathIndex` via per-key DELETE. The server broadcasts each removal as an SSE change-echo with `data: null`. Commit 947b9702c (fix for the run-K stale-dialog bug) now correctly mirrors null/scalar campaign-key echoes into the client store — but `useTravelManagement` reads `path.length` unguarded during render, so `travel-path → null` throws `TypeError: Cannot read properties of null (reading 'length')` in the hook body and React blanks the ENTIRE app (no error boundary). Reproduced twice: through the real UI arrival, and via a direct per-key DELETE probe.

## Steps to reproduce
Starting state: in `test-campaign`, an outdoor hex map with the party at a planned route.
1. Maps → Open a hex map → press the Travel toggle → click a hex ~60–80px west to plan a **1-hex** route (path length 2).
2. Click `Advance One Hex` → the party arrives (toast/panel unmount as usual).
3. Within ~1–2s the whole page goes BLANK (empty `<body>` innerText, sidebar gone). Console shows:
   `TypeError: Cannot read properties of null (reading 'length') at useTravelManagement (…/useTravelManagement.js:580:31) at HexMap (…/HexMap.jsx:125:21)` (dev line 580 with vite preamble offset; render-phase `.length` reads on path are file lines 538/542/546).
   Only a page reload recovers.
4. Alternate deterministic probe (same crash, no gameplay needed): with the map editor mounted on a live trip (mode planning, path non-empty), `DELETE /api/campaigns/test-campaign/travel-path` from another client → client blanks within one render tick.

## Expected behavior
Arrival unmounts the travel panel and leaves the map (and the rest of the SPA) fully usable; cleared-key echoes must not feed `null` into render paths that assume array/number types.

## Actual behavior
Whole-app React crash (blank page, one console TypeError, zero UI feedback). Server state is actually correct (mode `inactive`, keys removed, `arrived` log row, file `travelState` null) — it is purely the client mirror × render crash. Any mounted second client receives the same null echoes and crashes identically (echo lane proven; two-tab leg assumed from the same mechanism).

## Likely location
- Trigger lane: `src/hooks/management/useTravelManagement.js` → `clearCompletedTripKeys` (:369–382) per-key DELETEs (+ `server/routes/campaigns-changedata.js` publishing null per key).
- Delivery: `src/App.jsx` `handleChangeKeyEvent`/`applyStoreUpdate` — the 947b9702c null-mirror is what newly exposes these echoes to mounted consumers (pre-fix the object-guard dropped them, which is why runs D–K never saw this crash while a14e6db98 existed).
- Crash site: render-phase `path.length` (and `pathIndex` arithmetic) in `useTravelManagement.js` :538/:542/:546 with `path === null` in the store. Confident (stack + byte reads); exact browser-line mapping (580 vs 538) is vite-offset guessing.

## Suggested fix
Two complementary layers:
1. Make the hook null-proof: at the top, `const safePath = Array.isArray(path) ? path : [];` and `const safeIndex = typeof pathIndex === 'number' ? pathIndex : 0;`, use them in :538/:542/:546 + `advanceOneHex` ref fallbacks.
2. Root-fixer: in `applyStoreUpdate`, treat a `null` change-echo for a campaign key as a key REMOVE (store.delete) rather than storing `null`, so `useSyncedState`/`getRuntimeValue` fall back to declared defaults — this keeps the 947b9702c dialog-close fix working (removed pendingEvent ⇒ dialog unmounts) while never handing typed consumers raw null. Verify the EventDialog + travel-mode lanes still mirror with that semantics change (the run-K regression test `App.runtime-events.test.jsx` is the place to lock it).

## Severity
Broken feature — the core travel flow (arrival) reliably crashes any client left on the map, and an Admin clear-change-data while a hex editor is mounted hits the same lane. High-priority regression from the 947b9702c × a14e6db98 composition.
