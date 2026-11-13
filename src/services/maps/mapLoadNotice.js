// @maintained-by-ai
/**
 * Single source of truth for the rejected-load fallback notice copy shared by
 * BOTH map loaders (indoor src/components/map/hooks/useMapLoader.js and hex
 * src/components/hex-map/hooks/useMapLoader.js). A named map whose load 404s /
 * aborts / returns corrupt JSON falls through to a blank fresh editor — the
 * no-silent-fallback law (fix#337S #798) demanded loud console lines; this
 * lane makes the same moment visible to the USER (backlog
 * map-fresh-fallback-silent). Lives in its own module (not mapsService) so
 * the many partial `vi.mock('mapsService')` harnesses keep working untouched.
 *
 * Only the REJECTED lane (throw) gets this notice — the falsy-resolve
 * "no document yet" create lane is legitimate and stays silent.
 */
export function buildMapLoadRejectedNotice(mapName) {
    return `Could not load "${mapName}" — opened a fresh copy. Make an edit to save it back.`;
}

/**
 * Notice copy for the mount-time players-reconcile eviction (backlog
 * 2026-11-13 CF): the indoor loader drops doc `players` whose names are not
 * in the campaign roster (hand-seeded/renamed tokens vanish and the
 * reconciled array autosaves). The filter behavior is unchanged — this only
 * makes it visible: a count + reason toast rides the shared map-notice
 * channel, while the hook pairs it with a console.info listing the evicted
 * names for debugging.
 */
export function buildTokenEvictionNotice(count) {
    return `Removed ${count} token${count === 1 ? '' : 's'} with no matching character`;
}
