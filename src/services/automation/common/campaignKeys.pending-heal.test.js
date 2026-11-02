// @maintained-by-ai
/**
 * Starry Chalice heal-handoff tier law (sibling-key audit of
 * bug-victory-stamp-not-sse-adopted-missing-campaign-key).
 *
 * `pendingStarryChaliceHeal` is the post-cast ally-heal handoff stamped by
 * postCastHealService.triggerPostCastAllyHeals (characterKey='campaign') and
 * read campaign-level by applyStarryChaliceHeal and spellCastService's
 * runGenericHealPath modal arm. The live SSE dispatch (App.jsx
 * handleChangeKeyEvent → applyStoreUpdate) decides the destination tier
 * purely from isCampaignKey(storeKey). Unregistered, the handoff's OBJECT
 * echo fell through to a ghost CHARACTER store named
 * "pendingStarryChaliceHeal" on every mounted client and its null-clear echo
 * was dropped (stale nulls lingering) — the exact victory-stamp misroute
 * family. Today's lane runs producer+consumer on the SAME client, so this
 * registration fixes the ghost-store/echo routing rather than enabling a
 * new cross-device flow.
 *
 * This file pins the registration the dispatcher depends on.
 */
import { describe, it, expect } from 'vitest';
import { CAMPAIGN_KEYS, isCampaignKey } from './campaignKeys.js';

describe('campaignKeys — Starry Chalice heal handoff tier', () => {
  it('registers pendingStarryChaliceHeal so the SSE echo mirrors into the campaign store', () => {
    expect(CAMPAIGN_KEYS.has('pendingStarryChaliceHeal')).toBe(true);
    expect(isCampaignKey('pendingStarryChaliceHeal')).toBe(true);
  });

  it('still treats an unregistered handoff-shaped key as a character store (guard is name-based)', () => {
    // The dispatcher routes by exact registry membership — a look-alike name
    // must NOT pass, so a future rename of the handoff key cannot silently
    // re-introduce the ghost-store misroute behind a passing test.
    expect(isCampaignKey('pendingStarryChaliceHeals')).toBe(false);
  });
});
