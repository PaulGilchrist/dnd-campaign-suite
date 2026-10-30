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
