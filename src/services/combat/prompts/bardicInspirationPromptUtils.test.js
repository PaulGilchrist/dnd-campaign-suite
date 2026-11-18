// @maintained-by-ai
// Lane: bardicInspirationPromptUtils — sole owner of the 'biPrompt' payload shape and
// store routing (prompts ride the `<name>-biPrompt` wildcard key through the CAMPAIGN
// store: defense → target's key, offense → attacker's key, mirroring the sibling
// save/concentration/death-save prompt lanes in savePromptService.js).
// REGRESSION LOCK (bug-bi-prompt-skip-never-evicts-server-key): the old clear lane was a
// local-only Map.delete with ZERO fetches — the persisted key replayed on every SSE
// connect and resurrected the already-answered modal until an Admin change-data clear.
// The real useRuntimeState module runs here with fetch stubbed at the network boundary,
// so the exact wire requests (per-prompt-key POST write + wildcard DELETE evict) are
// pinned — a local-only clear fails these tests.
// Consumer lanes covered elsewhere, NOT duplicated:
// offense issuance (attackRollRiders + attackRollDamageSteps-* mock sendBardicInspirationOffensePrompt),
// modal clear invocation (BardicInspirationReactionModal.test.jsx mocks clearBardicInspirationPrompt),
// SSE echo mirroring (App.runtime-events.test.jsx), deleteRuntimeKey wire contract
// (useRuntimeState.core.test.js).
// Prompts NEVER time out (#app MANDATORY): verified — the source contains no setTimeout/auto-resolve;
// offers wait indefinitely for the player.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  sendBardicInspirationDefensePrompt,
  sendBardicInspirationOffensePrompt,
  clearBardicInspirationPrompt,
  getBardicInspirationPrompt,
} from './bardicInspirationPromptUtils.js';

import {
  clearRuntimeState,
  getAllStoreKeys,
  getStore,
  listeners,
} from '../../../hooks/runtime/useRuntimeState.js';

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

function clearAllStores() {
  for (const key of getAllStoreKeys()) {
    clearRuntimeState(key);
  }
  listeners.clear();
}

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

function fetchCalls() {
  return global.fetch.mock.calls.map(([url, init]) => ({ url, method: init?.method }));
}

// --- tests ---

describe('bardicInspirationPromptUtils', () => {
  beforeEach(() => {
    clearAllStores();
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200 });
    global.fetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defense prompt POSTs the exact payload to the target\'s <target>-biPrompt key, campaign pinned', () => {
    sendDefense();

    // routed to the target (the one who reacts), on the dedicated prompt key —
    // NOT a character-bucket POST (the bucket lane is what made the key
    // undeletable by the wildcard DELETE eviction lane)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/campaigns/test-campaign/Ally-biPrompt');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ value: DEFENSE_PAYLOAD });

    // round-trip: the prompt reads back exactly what was written; nobody else sees it
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toEqual(DEFENSE_PAYLOAD);
    expect(getBardicInspirationPrompt('test-campaign', 'Goblin')).toBeNull();
    expect(getBardicInspirationPrompt('test-campaign', 'Nobody')).toBeNull();
    expect(getStore('Ally').has('biPrompt')).toBe(false);
  });

  it('offense prompt POSTs the exact payload to the attacker\'s <attacker>-biPrompt key, campaign pinned', () => {
    sendOffense();

    // routed to the attacker (the one who hit), not the target
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/campaigns/test-campaign/Bard-biPrompt');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ value: OFFENSE_PAYLOAD });

    // round-trip: attacker-only visibility; offense carries no attackRoll/bonus/effectiveAc
    expect(getBardicInspirationPrompt('test-campaign', 'Bard')).toEqual(OFFENSE_PAYLOAD);
    expect(getBardicInspirationPrompt('test-campaign', 'Goblin')).toBeNull();
  });

  it('clearing a defense prompt EVICTS the server key with a wildcard DELETE (resurrection regression)', () => {
    sendDefense();
    clearBardicInspirationPrompt('test-campaign', 'Ally');

    // exactly the write POST + the evict DELETE — a local-only clear (the filed
    // bug: zero server writes on Skip) leaves no DELETE and fails here.
    expect(fetchCalls()).toEqual([
      { url: '/api/campaigns/test-campaign/Ally-biPrompt', method: 'POST' },
      { url: '/api/campaigns/test-campaign/Ally-biPrompt', method: 'DELETE' },
    ]);
    // DELETE carries no body — it is the campaigns-changedata.js wildcard
    // eviction lane (200 + null echo), not a write-empty.
    expect(global.fetch.mock.calls[1][1]?.body).toBeUndefined();

    // local mirror evicted in the same breath (drain-to-evict notify), so an
    // immediate re-clear cannot re-POST/DELETE anything
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toBeNull();
  });

  it('clearing a prompt never touches biPromptCleared or the character bucket', () => {
    sendDefense();
    getStore('Ally').set('hitPoints', 30);
    clearBardicInspirationPrompt('test-campaign', 'Ally');

    for (const [url] of global.fetch.mock.calls) {
      expect(url).not.toContain('biPromptCleared');
      expect(url).not.toBe('/api/campaigns/test-campaign/Ally');
    }
    // unrelated character state survives the eviction untouched
    expect(getStore('Ally').get('hitPoints')).toBe(30);
  });

  it('clearing offense-evicts the attacker key only and is idempotent', () => {
    sendDefense();
    sendOffense();
    global.fetch.mockClear();

    clearBardicInspirationPrompt('test-campaign', 'Bard');

    expect(fetchCalls()).toEqual([
      { url: '/api/campaigns/test-campaign/Bard-biPrompt', method: 'DELETE' },
    ]);
    expect(getBardicInspirationPrompt('test-campaign', 'Bard')).toBeNull();
    // the defender's pending prompt is a separate key and survives
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toEqual(DEFENSE_PAYLOAD);

    // second clear of the same prompt writes nothing (deleteRuntimeKey has()
    // guard — no honest-404 churn)
    clearBardicInspirationPrompt('test-campaign', 'Bard');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('clearing a prompt that was never issued sends zero requests', () => {
    clearBardicInspirationPrompt('test-campaign', 'Ally');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getBardicInspirationPrompt('test-campaign', 'Ally')).toBeNull();
  });
});
