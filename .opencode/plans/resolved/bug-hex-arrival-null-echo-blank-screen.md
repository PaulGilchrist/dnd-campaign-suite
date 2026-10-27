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

## Resolution
FIXED 2026-10-27 (this session). Reproduced live first (Vite :5173 dev:locked, `test-campaign`, fresh API-created outdoor map "QA Hex FixM"): 1-hex plan → `Advance One Hex` → arrived → ~1–2 s later the SPA blanked (empty `<body>`, `#root` empty) with the exact filed fingerprint `TypeError: Cannot read properties of null (reading 'length') at useTravelManagement (useTravelManagement.js:580:31) at HexMap (HexMap.jsx:125:21)`.

Root cause confirmed as filed, with one refinement: `advanceOneHex` was already ref-null-guarded (`!currentPath || …`), so the crash was purely the three render-phase reads at file lines 538/542/546 (`path.length` / `path.slice` / `pathIndex` arithmetic) fed `travel-path → null` by the 947b9702c null-mirror (`applyStoreUpdate` stored the raw cleared-key echo; `useSyncedState` documents that a stored null is NOT replaced by the declared default).

Both layers implemented as suggested:
1. **Root fix — `src/App.jsx` `applyStoreUpdate`:** a `null` change-echo for a campaign key is now mirrored as `campaignStore.delete(storeKey)` (key REMOVE + notify) instead of `store.set(key, null)`. `useSyncedState`/`getRuntimeValue` consumers fall back to their declared defaults — `travel-pendingEvent`'s default is null, so the 947b9702c run-K EventDialog-close fix is byte-equivalent for that lane, while typed consumers (`path: []`, `pathIndex: 0`, `destination: null`) never receive raw null. Scalars/objects unchanged; character-scope null/scalar drops unchanged.
2. **Defensive guard — `src/hooks/management/useTravelManagement.js`:** `safePath = Array.isArray(path) ? path : []` / `safePathIndex = typeof pathIndex === 'number' ? pathIndex : 0` used in `currentPosition`/`remainingSteps`/`hexesRemaining`, the same coercions seed `advanceOneHex`'s refs, and the hook now RETURNS the guarded `path`/`pathIndex` so HexMap.jsx's next-hex read (:238–239) and TravelPanel/TravelPathLayer stay off the crash path even if a raw null ever reaches the store through another lane. Same idiom as `useMapLoader.js` `buildTravelInit` (:58–59). No publisher-snapshot tightening was needed: the mount-captured defaults are the idle bytes (loader resolves the document async, per the file-adoption comment), so key-removal falls back to idle, never to a stale file trip.

Files changed:
- `src/App.jsx` (applyStoreUpdate null ⇒ key REMOVE + comments)
- `src/hooks/management/useTravelManagement.js` (safePath/safePathIndex guard layer)
- `src/hooks/management/useTravelManagement.null-echo.test.js` (NEW — 3 regression tests: raw-null echo renders null-proof; key-removal falls back to declared defaults; full 1-hex arrival survives the trailing null-echo beat with the DELETE trio pinned)
- `src/App.runtime-events.test.jsx` (run-K null lane re-locked to remove semantics + new typed-travel-key removal test; header contract updated)

Verification:
- Vitest: new file 3/3; `src/hooks/management` 13 files / 140 tests; `src/App.*.test.jsx` 7 files / 67 tests (incl. run-K EventDialog lane); `src/components/hex-map` 35 files / 430 tests — all green. `npm run lint` exit 0 (zero warnings). `no-timers-guard` OK.
- Live re-run of the original repro post-fix: plan 1-hex → Advance → arrived → waited 4 s → SPA fully alive (body text 457 chars, sidebar + `test-campaign` header present, panel unmounted, toggle auto-released aria-pressed=false), **0 console errors**; server bytes correct (trip keys removed, day keys survive, `travel/arrived` row logged, map-file `travelState` null). Second fresh plan→arrive cycle identical. Run-K lane re-verified live: object echo opened the EventDialog, the `travel-pendingEvent` DELETE null-echo auto-closed it (<2 s), SPA stayed alive.
- Cleanup: Admin clear-change-data + clear-log via API, probe map deleted; final GETs `change-data {}`, `log []`, maps [Battle Arena, Test Map]; no tab left resurrecting.
