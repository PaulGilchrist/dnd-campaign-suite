// @maintained-by-ai 2026-11-24
/**
 * lastAttack tier law + campaign-key audit sweep
 * (bug-lastattack-not-a-campaign-key-celebrates-clears-silently).
 *
 * `lastAttack` is written campaign-level by every attack/save/roll lane
 * (attackPostProcessing.js, saveProcessing.js, useLoggedDiceRollAttack.js,
 * handlePlainDamage.js, executeActionManeuvers.js, …) and read campaign-level
 * by 10+ consumers — chief among them the Clear-seam victory bank
 * (createCreatureHandlers.js reads it to compute `attackEvidence`/
 * `celebrated`). Unregistered in CAMPAIGN_KEYS, the `change-<c>-lastAttack`
 * OBJECT echo failed isCampaignKey in applyStoreUpdate (App.jsx) and fell
 * through to a ghost CHARACTER store named "lastAttack", so a mounted
 * non-attacking tab (tracker/TV) cleared with attackEvidence:null and the
 * victory banner was silently suppressed everywhere. Live-witnessed
 * 2026-11-24: celebrated:false + lastAttack present in the SAME change-data
 * doc; the attacking tab's own Clear flipped it to celebrated:true.
 *
 * The same-file guards pin the full audit sweep done alongside the fix:
 * every setRuntimeValue('campaign', …) / useSyncedState('campaign', …)
 * store-lane key found missing is now a member (literals) or covered by a
 * prefix rule (per-instance `_…_` families). Excluded by design: the
 * `*Prompt-*` families (dedicated prefix SSE subscriptions, not store-lane
 * reads) and `combatSummary` (own bucket + module-cache sync lane).
 *
 * The end-to-end routing outcome is pinned in App.runtime-events.test.jsx.
 */
import { describe, it, expect } from 'vitest';
import { CAMPAIGN_KEYS, isCampaignKey } from './campaignKeys.js';

describe('campaignKeys — lastAttack tier (victory-celebration evidence lane)', () => {
  it('registers lastAttack so the SSE echo mirrors into the campaign store', () => {
    expect(CAMPAIGN_KEYS.has('lastAttack')).toBe(true);
    expect(isCampaignKey('lastAttack')).toBe(true);
  });

  it('still treats look-alike names as character stores (guard is name-based)', () => {
    // A future rename of the key must NOT silently pass behind a green pin.
    expect(isCampaignKey('lastAttacks')).toBe(false);
    expect(isCampaignKey('LastAttack')).toBe(false);
  });
});

describe('campaignKeys — audit sweep 2026-11-24 (same misroute family)', () => {
  it('registers the static store-lane keys the grep-diff found missing', () => {
    for (const key of ['tacticalMasterPending', 'leadingEvasionSelections', '_cover_shot']) {
      expect(CAMPAIGN_KEYS.has(key), key).toBe(true);
      expect(isCampaignKey(key), key).toBe(true);
    }
  });

  it('adopts the per-instance underscore families via prefix rules', () => {
    expect(isCampaignKey('_activeGreaterInvisibility_Goblin')).toBe(true);
    expect(isCampaignKey('_fleshToStone_Goblin')).toBe(true);
    expect(isCampaignKey('_prismaticSprayIndigo_Goblin')).toBe(true);
    expect(isCampaignKey('_prismaticSprayViolet_Thug_1')).toBe(true);
    expect(isCampaignKey('_animalFriendship_ElderPaladin_Wolf')).toBe(true);
  });

  it('leaves the prompt families and character buckets unregistered (intentional)', () => {
    // These ride dedicated prefix SSE subscriptions (SavePromptModal et al.)
    // or the character-bucket replace lane — registering them would move
    // their echoes out of the store their real consumers read.
    expect(isCampaignKey('savePrompt-Goblin-abc123')).toBe(false);
    expect(isCampaignKey('deathSavePrompt-Goblin-abc123')).toBe(false);
    expect(isCampaignKey('concentrationPrompt-Goblin-abc123')).toBe(false);
    expect(isCampaignKey('fleshToStonePrompt-Goblin-abc123')).toBe(false);
    expect(isCampaignKey('combatSummary')).toBe(false);
    expect(isCampaignKey('ElderPaladin')).toBe(false);
  });
});
