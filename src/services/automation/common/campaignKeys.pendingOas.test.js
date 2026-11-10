// @maintained-by-ai
/**
 * Pending-OA trigger-marker tier law (bug-pending-oas-key-not-registered-echo-misroutes).
 *
 * `pendingOAs` holds the Opportunity-Attack trigger markers — one row per
 * DEFENDER ({defender, mover, promptId}). Its producer seam
 * (services/combat/pendingOpportunityAttacks.js, PENDING_OA_KEY) writes and
 * drain-evicts at characterKey='campaign', and both readers (CharReactions.jsx
 * sheet lane, useMonsterPendingOa.js monster-card lane) subscribe
 * campaign-level. But the live SSE dispatch (App.jsx handleChangeKeyEvent →
 * applyStoreUpdate) decides the destination tier purely from
 * isCampaignKey(storeKey). Unregistered, the marker OBJECT echo fell through
 * to replaceRuntimeObject('pendingOAs', …) — a ghost CHARACTER store no
 * consumer reads — so cross-client/curl marker writes never live-updated an
 * already-mounted tab (the sheet press silently fell to the legacy free-press
 * lane and the monster-card affordance never appeared until a reload
 * hydrated via the unfiltered seed pass), and the drain-to-evict null DELETE
 * echo was dropped as corrupt, so consumed/evicted markers lingered
 * per-client. The exact victory-stamp / Starry-Chalice misroute family
 * (bug-victory-stamp-not-sse-adopted-missing-campaign-key).
 *
 * This file pins the registration the dispatcher depends on. The end-to-end
 * routing outcomes (object adopt + null evict) are pinned in
 * App.runtime-events.test.jsx.
 */
import { describe, it, expect } from 'vitest';
import { CAMPAIGN_KEYS, isCampaignKey } from './campaignKeys.js';

describe('campaignKeys — pending OA trigger-marker tier', () => {
  it('registers pendingOAs so the SSE echo mirrors into the campaign store', () => {
    expect(CAMPAIGN_KEYS.has('pendingOAs')).toBe(true);
    expect(isCampaignKey('pendingOAs')).toBe(true);
  });

  it('still treats an unregistered marker-shaped key as a character store (guard is name-based)', () => {
    // The dispatcher routes by exact registry membership — a look-alike name
    // must NOT pass, so a future rename of the marker key cannot silently
    // re-introduce the ghost-store misroute behind a passing test.
    expect(isCampaignKey('pendingOA')).toBe(false);
    expect(isCampaignKey('pendingOAses')).toBe(false);
  });
});
