import { useCallback } from 'react';
import useSSEEqualityGuard from '../../../hooks/runtime/useSSEEqualityGuard';

// map-data-* payloads are FULL map-document snapshots published verbatim by the
// server (server/routes/maps.js:170 PUT /maps/:mapname body, :303 description
// re-read from disk), consumed with the house patch-tolerant law shared by every
// map SSE sibling (useHexMapSSESync.js:45 per-field `!== undefined`):
//  - a key PRESENT in the snapshot LANDS, including honest clears (null / []);
//    null is coerced to the field's empty domain ([] / new Set()) so consumers
//    only ever see arrays/Sets — the same normalization useMapLoader.js:46 and
//    useFogOfWar.js:14 rely on;
//  - a key ABSENT preserves prev, because snapshots legitimately omit fields
//    (outdoor maps carry no walls/players/revealed — maps.js:67-77).
// One predicate for all three merged fields — kills the #915 split where
// players `||` swallowed an honest null clear into stale prev while revealed
// `!== undefined` landed revealed:null as a non-array.
const mergedField = (value, prevValue) => (value !== undefined ? value : prevValue) ?? [];

/**
 * WARNING: SSE re-render loop risk
 * All setters called in this handler are wrapped with useSSEEqualityGuard so
 * that echoed-back updates identical to current state are ignored.  This prevents
 * re-render loops when the local client's own changes come back through publish().
 */
function useSSESync({ campaignName, mapName, setGridSize, setMapData, setPlacedItems }) {
    const setGridSizeGuarded = useSSEEqualityGuard(setGridSize);
    const setMapDataGuarded = useSSEEqualityGuard(setMapData);
    const setPlacedItemsGuarded = useSSEEqualityGuard(setPlacedItems);

    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.data) return;
        const expectedKey = `map-data-${campaignName}-${mapName}`;
        if (event.key !== expectedKey) return;

        const data = event.data;
        if (data.gridSize !== undefined) {
            setGridSizeGuarded(data.gridSize);
          }
        setMapDataGuarded((prev) => ({
             ...prev,
            players: mergedField(data.players, prev?.players).map(({ ...rest }) => rest),
            walls: new Set(mergedField(data.walls, prev?.walls)),
            revealed: mergedField(data.revealed, prev?.revealed),
            // items (creature-token lane) and pois are full-array document
            // lanes the dress/add/remove flows author: an AI Dress applied
            // while this editor is open arrives as a snapshot, and leaving
            // these out let the debounced autosave re-PUT the stale rows
            // back to disk (dress-remove resurrected live 2026-11-01).
            // Conditional present-lands (a PRESENT key lands, null coerced
            // to the honest [] domain; an ABSENT key preserves prev via the
            // spread) — unlike the legacy three, they are only emitted when
            // carried, so documents without those lanes keep their shape.
            ...(data.items !== undefined ? { items: data.items ?? [] } : {}),
            ...(data.pois !== undefined ? { pois: data.pois ?? [] } : {}),
          }));
        if (data.placedItems !== undefined) {
            setPlacedItemsGuarded(data.placedItems);
          }
      }, [campaignName, mapName, setGridSizeGuarded, setMapDataGuarded, setPlacedItemsGuarded]);

    return { handleSSEEvent };
}

export default useSSESync;
