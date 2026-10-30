# bug: entering a linked indoor map from a hex POI makes the hex editor fire a mis-targeted whole-map PUT at the INDOOR map's URL (rejected 400 by the players guard; guaranteed console error on every entry)

## Summary

When the GM enters a POI's linked indoor map, the outdoor hex editor's save lane races the view switch and issues a full-document `PUT /maps/<indoor>` built by the hex envelope builder — which contains no `players` array. The server's `erasesStoredPlayers` guard (b73f3abad) correctly refuses with 400 (`Map save rejected: a whole-map save must include the players array…`), so player tokens are safe — but every POI-entry emits 2 console errors + a browser 400 resource line, and the ONLY thing preventing an indoor-map clobber with outdoor hex bytes is the server-side guard.

## Steps to reproduce

1. In `test-campaign`, create/use an outdoor map with a POI `linkedMap:'Battle Arena'` adjacent to the party (see bug-hex-poi-enter-chip-dead-real-clicks rig; use a synthetic `click` dispatch on the enterable hit-rect since the real-click lane is separately dead).
2. Open the hex editor; make one real edit (e.g. right-click a POI → Hide) so the hex document is dirty.
3. Enter the linked POI (dispatch click on the transparent hit-rect) — the Battle Arena indoor editor mounts.
4. Watch the network.

## Expected behavior

No PUT is ever addressed to a map whose bytes the saving component does not hold. The switch should flush the outdoor doc to its own URL only (which happens: `PUT qa-hex-runah → 200`), and any in-flight hex save must be cancelled/dropped when the view switches to a different map.

## Actual behavior

Network order captured live (clean reproduction, 2/2 entries):

```
GET battle-arena -> 200      (indoor read)
PUT qa-hex-runah -> 200      (the real Hide-edit flush — correct)
GET battle-arena -> 200
GET battle-arena -> 200
PUT battle-arena -> 400      ← hex flush addressed to the INDOOR URL
```

Console (per entry, 2 lines + resource line): `Error saving map data: Error: Map save rejected: a whole-map save must include the players array — without it every player token would be erased from the map.` (mapsService.js:128) and `Failed to save hex map data:` (useMapLoader hex chokepoint :373). Battle Arena disk verified byte-intact after (players 3, walls 0, revealed 400).

## Likely location

Confident on the component, guessing on the exact seam. `src/components/hex-map/hooks/useMapLoader.js`: the persistence guard `mapName !== hexMapNameRef.current` skips on A→B switches, but the POI-entry path changes the LIVE `mapName` prop while the HexMap component is still mounted (the indoor editor mounts alongside/before the hex unmount), so the load effect re-arms for battle-arena (`applyExistingMap` re-claims `hexMapNameRef` to battle-arena) and the persistence effect then fires with the still-stale hex-shaped state — building and queuing a players-less envelope under the battle-arena name. The debounce (1s) + unmount flush means the bytes captured at queue time are the outdoor ones while the name is the indoor one — the queue-time guard's assumption (name at queue == name of held bytes) is violated mid-transition.

## Suggested fix

First investigation step: log/trace `pendingSaveRef` queue events during `onPoiEntered` to confirm the transition-window queue. Likely fixes: (a) in the POI-enter handler, invoke the existing map-switch flush for the OLD map (flush under the old captured name) and hard-cancel any pending/queued save before the switch (`clearSaveTimer(); pendingSaveRef.current = null`); (b) make `buildHexEnvelope` refuse to build under a name whose loaded doc is not outdoor-shaped (type guard: don't let the hex component persist anything when the loaded document is `type:'indoor'`); (c) unmount path should drop, not flush, saves queued after the switch started.

## Severity

Data integrity risk (contained) — the client repeatedly attempts to write outdoor bytes onto an indoor map; today the server guard blocks every attempt and the cost is guaranteed 400+console noise per entry, but the client-side discipline that the guard exists to backstop is broken.

## Resolution

**FIXED 2026-10-30 (fix run).** Live-reproduced exactly as filed: entered the linked Battle Arena POI on a fresh `qa-hex-fix` outdoor rig (dirty `Show`/`Hide` edit inside the 1s debounce window) → `PUT maps/battle-arena → 400` plus the exact 3-line console trio, with the mis-targeted payload captured as the players-less `type:'outdoor'` envelope (`displayName:'Battle Arena'`, `panX:617.04` — view-normalized bytes).

**Actual root cause (refines the "Likely location" guess).** The transition is not a stale-bytes race on one mounted instance: `Map.jsx:456` keys HexMap with `key={mapName}`, so entering an indoor-linked POI (App `handleEnterMap` swaps `mapsView.mapName`) REMOUNTS a fresh HexMap instance bound to the indoor name. That fresh instance's load effect happily loads the INDOOR document; `applyExistingMap` defaults/adopts it (battle-arena carries `panX:0, panY:0` → `isOldDefault` → `needsResetViewRef`), legitimately re-claims `hexMapNameRef` to `battle-arena` (the name guard passes), and then HexMap's view-normalize `useLayoutEffect` (`HexMap.jsx:321` — `needsResetViewRef` → `centerView(2)`) rewrites zoom/pan AFTER the load batch, deep-UNEQUAL to the just-seeded `lastSavedRef` baseline. The persistence effect therefore queues a fresh `buildHexEnvelope` document — outdoor-shaped, players-less — under the indoor name, and the debounce (or the unmount chokepoint when Map.jsx's own loader resolves and drops the HexMap branch) flushes it to `PUT /maps/battle-arena`. The name-vs-held-bytes guard cannot catch this: at queue time the name and the ref genuinely agree — the violated invariant is the held document's **shape**, not its name.

**Fix** (bug-file option (b), the invariant actually violated — the queue-time chokepoint covers all three flush lanes): `src/components/hex-map/hooks/useMapLoader.js` now tracks `heldMapTypeRef` — the type of the document whose bytes this instance holds — claimed ONLY by the two load paths (alongside `hexMapNameRef`, mirroring its established pattern: set before the `setLoading(false)` batch so the #800 loading-flip re-run sees it). The persistence effect gained `if (heldMapTypeRef.current !== 'outdoor') return;` after the name guard: while an indoor document is held, nothing queues, so no flush — debounce, switch, or unmount — can address the indoor URL. Keyed on the load-path ref rather than `mapData` state because `mapData` is a display slot that SSE merges into (existing `useMapLoader.api.test.js` contract). An outdoor document queued BEFORE the switch keeps its queue and still flushes to its OWN URL — the expected behavior, not dropped.

**Files changed:**
- `src/components/hex-map/hooks/useMapLoader.js` — `heldMapTypeRef` + cross-shape persistence guard + ctx threading + comment updates.
- `src/components/hex-map/hooks/useMapLoader.indoor-switch.test.js` — NEW regression suite (4 tests): pre-switch dirty outdoor doc flushes to its own URL with zero indoor-URL traffic; zero-edit indoor entry writes NOTHING even after the post-adoption normalize churn; unmount flush lands the pre-switch edit under the old captured name; normal same-map autosave unaffected. Mutation-probed: with the guard defeated 3/4 fail (4th proves unaffected persistence); guard restored green.
- `docs/test-setup-playbook.md` — HEX POI/ROAD/ENTER RIG "every enter prints the trio — don't chase" note RETIRED (live-enter is now silent).
- Dual-ruleset check: the indoor sibling `src/components/map/hooks/useMapLoader.js` needs no twin — its save spreads the loaded `mapData`, so its payload always carries the held document's own `type`/`players` and the dirty gate skips zero-edit switches.

**Verification.**
- Live re-run of the original repro in `test-campaign` (real `page.mouse.click` on the enterable hit-rect — the sibling fix's canonical lane): Enter with a dirty outdoor doc → network shows only indoor `GET battle-arena ×n` + `PUT qa-hex-fix → 200`; **zero PUTs addressed to battle-arena, ZERO console errors** (trio gone). Adjacent lanes proven: normal autosave (`PUT qa-hex-fix → 200` at debounce) and plain-Back unmount-flush inside the debounce window (`PUT qa-hex-fix → 200`); disk ground truth: outdoor edits persisted (landmark `visible:true`), Battle Arena byte-intact (players 3, pan 0/0, revealed 400).
- `npx vitest run src/components/hex-map/hooks/` → 16 files green (incl. pre-existing `useMapLoader.api.test.js`, untouched and passing); full `src/components/hex-map/` → 40 files / 457 tests passed; indoor loader siblings (`map/hooks/useMapLoader*.test.js`) green.
- `npm run lint` → zero warnings/errors.
- Cleanup: `qa-hex-fix` map deleted (roster back to [battle-arena, test-map]), change-data `{}` + log `[]` GET-verified, no QA-named residue.
