import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

/**
 * Per-tab identity for shared-state provenance
 * (bug-hex-trip-clobbered-by-second-client). A TRIP is shared campaign state,
 * but WHICH TAB started it is not — sessionStorage scopes the token to this
 * browser tab and survives a reload/reopen (the exact case the reopen +
 * toggle-off cancel used to destroy), while a second tab mints its own token
 * and can therefore never be mistaken for the owner. sessionStorage holds a
 * random UI-identity ONLY (like an SSE connection id) — zero game state, so
 * the server-first rule is untouched; the SHARED half of the stamp
 * (`travel-started-by`) rides the campaign change-data store like every
 * other travel byte.
 */
const TOKEN_KEY = 'dnd-session-token';
export const TRIP_OWNER_KEY = 'travel-started-by';

export function getSessionId() {
    let id = window.sessionStorage.getItem(TOKEN_KEY);
    if (!id) {
        id = (window.crypto?.randomUUID?.() ?? `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
        window.sessionStorage.setItem(TOKEN_KEY, id);
    }
    return id;
}

/** The tab that owns the live trip, per the shared stamp ('' = unclaimed). */
export function getTripOwner(campaignName) {
    if (!campaignName) return '';
    const owner = getRuntimeValue('campaign', TRIP_OWNER_KEY);
    return typeof owner === 'string' ? owner : '';
}

/** Publish this tab's ownership stamp over the shared trip. */
export function claimTripOwner(campaignName) {
    if (!campaignName) return;
    setRuntimeValue('campaign', TRIP_OWNER_KEY, getSessionId(), campaignName);
}

/** Shared stamp cleared ⇒ no session owns the trip anymore. */
export function releaseTripOwner(campaignName) {
    if (!campaignName) return;
    setRuntimeValue('campaign', TRIP_OWNER_KEY, null, campaignName);
}
