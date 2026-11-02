// @maintained-by-ai
/**
 * Victory-stamp tier law (bug-victory-stamp-not-sse-adopted-missing-campaign-key).
 *
 * `lastCombatResult` is the victory/TV banner's shared combat-clear stamp.
 * Its ONLY producer (createCreatureHandlers.handleClear) and its ONLY reader
 * (useTvPresentation) both use characterKey='campaign', but the live SSE
 * dispatch (App.jsx handleChangeKeyEvent → applyStoreUpdate) decides the
 * destination tier purely from isCampaignKey(storeKey). Unregistered, the
 * stamp's OBJECT echo fell through to setRuntimeObject('lastCombatResult', …)
 * — a ghost CHARACTER store — so every already-mounted client silently never
 * showed the banner while a reload hydrated it fine (seedCampaignRuntimeData
 * copies all top-level keys unfiltered).
 *
 * This file pins the registration the dispatcher depends on. The end-to-end
 * routing outcome is pinned in App.runtime-events.test.jsx.
 */
import { describe, it, expect } from 'vitest';
import { CAMPAIGN_KEYS, isCampaignKey } from './campaignKeys.js';

describe('campaignKeys — victory banner stamp tier', () => {
  it('registers lastCombatResult so the SSE echo mirrors into the campaign store', () => {
    expect(CAMPAIGN_KEYS.has('lastCombatResult')).toBe(true);
    expect(isCampaignKey('lastCombatResult')).toBe(true);
  });

  it('still treats an unregistered stamp-shaped key as a character store (guard is name-based)', () => {
    // The dispatcher routes by exact registry membership — a look-alike name
    // must NOT pass, so a future rename of the stamp key cannot silently
    // re-introduce the ghost-store misroute behind a passing test.
    expect(isCampaignKey('lastCombatResults')).toBe(false);
  });
});
