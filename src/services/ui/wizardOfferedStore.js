// @maintained-by-ai
// Per-client "character-creation wizard already offered" display preference,
// keyed per campaign (localStorage `character-wizard-offered:<campaign>`).
//
// Selecting a zero-character campaign auto-opens the creation wizard, and it
// re-armed on EVERY re-select — Cancel → back → re-enter immediately blocked
// the next click again (e2e backlog KA 2026-11-18). The pref stamps the
// campaign the moment the auto-open fires, so the offer happens once per
// campaign per browser. Purely a display pref: never written to change-data,
// the runtime store, or the server — same localStorage tier as the TV pref
// (`initiative-tv`, tvModeStore.js) and the theme. The manual "Add Character"
// sidebar button and the starter checklist's Build-heroes lane call
// handleAddCharacter directly and are never gated by this flag.
//
// A pure facade over localStorage (no cached memory copy), mirroring
// tvModeStore's persisted-pref slot: a raw test seed and an in-app stamp
// resolve identically.

const OFFERED_PREFIX = 'character-wizard-offered:'

function offeredKey(campaignName) {
    return OFFERED_PREFIX + campaignName
}

/** True once the auto-wizard has been offered for this campaign on THIS
 *  client. A missing campaign name reads as "never offered". */
export function isWizardOffered(campaignName) {
    if (!campaignName) return false
    try { return localStorage.getItem(offeredKey(campaignName)) === '1' } catch { return false }
}

/** Stamp the per-campaign offered pref after the auto-open fires. */
export function markWizardOffered(campaignName) {
    if (!campaignName) return
    try { localStorage.setItem(offeredKey(campaignName), '1') } catch { /* ignore */ }
}
