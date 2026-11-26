// @maintained-by-ai 2026-11-22
/**
 * Copilot + Sound-owner tier law (learnability plan Phases 1/5).
 *
 * `gmCopilot` (useGmCopilot GM_COPILOT_KEY — settled one-time tips) and
 * `soundOwner` (soundOwner.js SOUND_OWNER_KEY — the one-speaker claim) are
 * both written at characterKey='campaign' and read campaign-level by every
 * tab. The live SSE dispatch (App.jsx handleChangeKeyEvent →
 * applyStoreUpdate) decides the destination tier purely from
 * isCampaignKey(storeKey) — unregistered, their OBJECT echoes would fall
 * through to ghost CHARACTER stores (bug-victory-stamp-not-sse-adopted-
 * missing-campaign-key family): a tip dismissed on one GM browser would
 * resurface there while never clearing on another, and a sound claim made
 * on the GM screen would leave every other tab's mute chip and cue gate
 * stale until reload. Live-witnessed 2026-11-22: the sound claim echo
 * reached the visitor tab over SSE but never applied — registration fixed
 * the routing.
 *
 * Server-side recognition of both keys is pinned beside it in
 * server/utils/changeDataKeys.js SPECIAL_TOP_LEVEL_KEYS (Admin census).
 */
import { describe, it, expect } from 'vitest';
import { CAMPAIGN_KEYS, isCampaignKey } from './campaignKeys.js';

describe('campaignKeys — copilot + sound-owner tier', () => {
  it('registers gmCopilot so tip dismissals mirror across tabs live', () => {
    expect(CAMPAIGN_KEYS.has('gmCopilot')).toBe(true);
    expect(isCampaignKey('gmCopilot')).toBe(true);
  });

  it('registers soundOwner so the one-speaker claim mirrors across tabs live', () => {
    expect(CAMPAIGN_KEYS.has('soundOwner')).toBe(true);
    expect(isCampaignKey('soundOwner')).toBe(true);
  });

  it('name-based guard: look-alikes must not pass', () => {
    expect(isCampaignKey('gmCopilotDismissed')).toBe(false);
    expect(isCampaignKey('soundOwners')).toBe(false);
  });
});
