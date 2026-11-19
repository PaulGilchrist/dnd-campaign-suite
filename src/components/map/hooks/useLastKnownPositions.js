import { useMemo, useRef } from 'react';

// Last-known-position mode (roadmap Phase 3, Item 7). A PLAYER client (never
// the GM — the GM always renders truth) with the toggle ON must not live-watch
// a creature token that sits in UNREVEALED space. This hook is the one derived
// lane deciding that: it tracks, per creature token, the last cell the token
// was visible on THIS client, and returns the set of tokens currently ghosted
// (in fog, remembered position available) as a Map<itemId, {gridX, gridY}>.
//
// Revealed-law (the app's "stays revealed" fog model — see useFogOfWar):
// `fog` holds only cells that are neither revealed nor currently in line of
// sight, so "the token's CURRENT cell is in the revealed set" already renders
// it LIVE for players (revealed area = seen). The ghost case is therefore
// exactly tokens in never-revealed (fogged) cells — the "sneak around behind
// the fog" scenario. One visibility predicate, the same fog set the overlay
// and token culling already use; no second vision model.
//
// Position memory is PER-CLIENT derived state (ref cache): never stored
// server-side, never in the runtime store. When the toggle flips OFF (or on
// the GM lane) the cache is DROPPED and `null` is returned — OFF is a
// byte-identical no-op for rendering, and a later re-arm ghosts only from
// positions the players genuinely see from then on, never from stale
// pre-toggle knowledge.
//
// Creature lanes only: npc/monster placed tokens. Player tokens (mapData
// .players) are the party itself and hidden-item law (`visible: false`) is
// enforced by the caller (PlacedItems) — this hook pre-filters invisible rows
// out of BOTH recording and cleanup: a token the GM hides (or deletes) leaves
// the players' memory entirely.
//
// Timing law (no timers): recording happens DURING the render pass (memo body)
// as idempotent Map writes — a token moves revealed→fogged in a single
// map-data SSE snapshot, so the ghost cell must be readable on that same
// render; the cache already holds the position recorded on the last render the
// token was visible. StrictMode double-invocation re-writes identical bytes.
const CREATURE_TOKEN_TYPES = new Set(['npc', 'monster']);

export default function useLastKnownPositions(placedItems, fog, enabled, isLocalhost) {
    // Per-client display memory of an ALREADY-SENT position (a derived render
    // cache like zoom/pan) — the authoritative position lives only in the
    // server-side map document; nothing here syncs.
    const lastSeenRef = useRef(new Map());

    return useMemo(() => {
        const lastSeen = lastSeenRef.current;
        if (!enabled || isLocalhost) {
            lastSeen.clear();
            return null;
        }
        const ghosts = new Map();
        const remembered = new Set();
        for (const item of placedItems || []) {
            if (!CREATURE_TOKEN_TYPES.has(item.type) || !item.visible) continue;
            remembered.add(item.id);
            if (!fog?.has(`${item.gridX},${item.gridY}`)) {
                lastSeen.set(item.id, { gridX: item.gridX, gridY: item.gridY });
            } else if (lastSeen.has(item.id)) {
                ghosts.set(item.id, lastSeen.get(item.id));
            }
        }
        for (const id of [...lastSeen.keys()]) {
            if (!remembered.has(id)) lastSeen.delete(id);
        }
        return ghosts;
    }, [placedItems, fog, enabled, isLocalhost]);
}
