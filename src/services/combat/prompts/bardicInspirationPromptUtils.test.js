// @maintained-by-ai
// Lane: bardicInspirationPromptUtils — sole owner of the 'biPrompt' payload shape and
// store routing (defense prompt → target's store, offense prompt → attacker's store).
// Prompts family: this is the only test in src/services/combat/prompts/ (no
// restoreBalanceState sibling lives here). Consumer lanes covered elsewhere, NOT duplicated:
// offense issuance (attackRollRiders + attackRollDamageSteps-* mock sendBardicInspirationOffensePrompt),
// modal clear invocation (BardicInspirationReactionModal.test.jsx mocks clearBardicInspirationPrompt),
// SSE prompt events (App.runtime-events.test.jsx).
// Prompts NEVER time out (#app MANDATORY): verified — the source contains no setTimeout/auto-resolve;
// offers wait indefinitely for the player.
// Store boundary mocked faithfully (useRuntimeState.js:21-76): getStore auto-creates per characterKey,
// getRuntimeValue is a keyed read returning null when absent — no scan-all-stores hack, so a
// misrouted prompt fails here instead of being silently found.
// Old->new map: 16 tests folded to 4 — defense/offense exact-payload+routing legs absorb the
// objectContaining/numeric-fields/expected-keys/fullDescription duplicates; fire-and-forget and
// void-return trivia deleted (#923); store-scan get tests replaced by faithful round-trip legs;
// 'ignores campaignName' strengthened into a falsifier (clear works under a different campaign).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- store-boundary mock (faithful: per-character keyed stores, null when absent) ---

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const stores = new Map();
  const getStore = (characterKey) => {
    if (!stores.has(characterKey)) stores.set(characterKey, new Map());
    return stores.get(characterKey);
  };
  return {
    getStore: vi.fn(getStore),
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      const store = stores.get(characterKey);
      return store && store.has(propertyName) ? store.get(propertyName) : null;
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      getStore(characterKey).set(propertyName, value);
    }),
    __resetStores: () => stores.clear(),
  };
});

import { __resetStores, getStore, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

import {
  sendBardicInspirationDefensePrompt,
  sendBardicInspirationOffensePrompt,
  clearBardicInspirationPrompt,
  getBardicInspirationPrompt,
  clearBardicInspirationPromptState,
} from './bardicInspirationPromptUtils.js';

// --- hand-derived exact payloads (#815) ---

const DEFENSE_PAYLOAD = {
  mode: 'defense',
  promptId: 101,
  targetName: 'Ally',
  attackerName: 'Goblin',
  attackRoll: 17,
  bonus: 2,
  effectiveAc: 15,
  dieSize: 6,
  fullDescription: 'When hit by an attack roll, you can use your Reaction to roll the Bardic Inspiration die and add the number rolled to your AC against that attack, potentially causing the attack to miss.',
};

const OFFENSE_PAYLOAD = {
  mode: 'offense',
  promptId: 202,
  targetName: 'Goblin',
  attackerName: 'Bard',
  dieSize: 8,
  fullDescription: "Immediately after you hit a target with an attack roll, you can roll the Bardic Inspiration die and add the number rolled to the attack's damage against the target.",
};

function sendDefense() {
  sendBardicInspirationDefensePrompt({
    campaignName: 'test-campaign',
    targetName: 'Ally',
    attackerName: 'Goblin',
    attackRoll: 17,
    bonus: 2,
    effectiveAc: 15,
    dieSize: 6,
    promptId: 101,
  });
}

function sendOffense() {
  sendBardicInspirationOffensePrompt('test-campaign', 'Bard', 'Goblin', 8, 202);
}

// --- tests ---

describe('bardicInspirationPromptUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetStores();
  });

  it('defense prompt writes the exact payload to the target\'s biPrompt key, campaign pinned', () => {
    sendDefense();

    // routed to the target (the one who reacts), campaign forwarded
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'biPrompt', DEFENSE_PAYLOAD, 'test-campaign');

    // round-trip: the target reads back exactly what was written; nobody else sees it
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toEqual(DEFENSE_PAYLOAD);
    expect(getBardicInspirationPrompt('test-campaign', 'Goblin')).toBeNull();
    expect(getBardicInspirationPrompt('test-campaign', 'Nobody')).toBeNull();
  });

  it('offense prompt writes the exact payload to the attacker\'s biPrompt key, campaign pinned', () => {
    sendOffense();

    // routed to the attacker (the one who hit), not the target
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'biPrompt', OFFENSE_PAYLOAD, 'test-campaign');

    // round-trip: attacker-only visibility; offense carries no attackRoll/bonus/effectiveAc
    expect(getBardicInspirationPrompt('test-campaign', 'Bard')).toEqual(OFFENSE_PAYLOAD);
    expect(getBardicInspirationPrompt('test-campaign', 'Goblin')).toBeNull();
  });

  it('clearBardicInspirationPrompt removes both biPrompt keys and preserves unrelated store data', () => {
    sendDefense();
    const allyStore = getStore('Ally');
    allyStore.set('biPromptCleared', true);
    allyStore.set('unrelatedKey', 'keep');

    clearBardicInspirationPrompt('test-campaign', 'Ally');

    expect(allyStore.has('biPrompt')).toBe(false);
    expect(allyStore.has('biPromptCleared')).toBe(false);
    expect(allyStore.get('unrelatedKey')).toBe('keep');
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toBeNull();
  });

  it('clearBardicInspirationPromptState clears the prompt regardless of campaignName', () => {
    sendDefense();
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).not.toBeNull();

    // different campaignName must still clear — the store is character-keyed (#app delegation contract)
    clearBardicInspirationPromptState('OtherCampaign', 'Ally');

    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toBeNull();
    expect(getStore('Ally').has('biPromptCleared')).toBe(false);
  });
});
