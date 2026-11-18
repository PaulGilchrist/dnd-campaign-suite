// @maintained-by-ai
// Lane: bardicInspirationPromptUtils — sole owner of the 'biPrompt' payload shape and
// store routing (OFFENSE prompts ride the `<attacker>-biPrompt` wildcard key through
// the CAMPAIGN store — `name` is the attacking creature — mirroring the sibling
// save/concentration/death-save prompt lanes in savePromptService.js).
// SINGLE-SHAPE LAW (bug-bi-defense-prompt-producer-orphaned, owner decision
// 2026-11-17): this module has NO defense producer. `sendBardicInspirationDefensePrompt`
// had zero production call sites and was deleted; the defense adjudication's single
// source of truth is the popup-inline `Bardic Inspiration - Defense (dN)` button fed
// by hitResolution.js applyBardicInspirationDefense. The export lock below keeps the
// dead shared-key lane from being revived.
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

import * as promptUtils from './bardicInspirationPromptUtils.js';

import {
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

function sendOffense(attackerName = 'Bard', targetName = 'Goblin', dieSize = 8, promptId = 202) {
  sendBardicInspirationOffensePrompt('test-campaign', attackerName, targetName, dieSize, promptId);
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

  it('exports no defense-prompt producer — the defense lane is popup-inline only (single-shape lock)', () => {
    // bug-bi-defense-prompt-producer-orphaned: the orphaned sendBardicInspirationDefensePrompt
    // (zero production call sites, reachable only via manual seed) was DELETED by owner
    // decision. Re-adding it would resurrect a phantom shared-key lane that the modal
    // now refuses to mount.
    expect(promptUtils.sendBardicInspirationDefensePrompt).toBeUndefined();
    expect(Object.keys(promptUtils).sort()).toEqual([
      'clearBardicInspirationPrompt',
      'getBardicInspirationPrompt',
      'sendBardicInspirationOffensePrompt',
    ]);
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
    expect(getStore('Bard').has('biPrompt')).toBe(false);
  });

  it('clearing a prompt EVICTS the server key with a wildcard DELETE (resurrection regression)', () => {
    sendOffense();
    clearBardicInspirationPrompt('test-campaign', 'Bard');

    // exactly the write POST + the evict DELETE — a local-only clear (the filed
    // bug: zero server writes on Skip) leaves no DELETE and fails here.
    expect(fetchCalls()).toEqual([
      { url: '/api/campaigns/test-campaign/Bard-biPrompt', method: 'POST' },
      { url: '/api/campaigns/test-campaign/Bard-biPrompt', method: 'DELETE' },
    ]);
    // DELETE carries no body — it is the campaigns-changedata.js wildcard
    // eviction lane (200 + null echo), not a write-empty.
    expect(global.fetch.mock.calls[1][1]?.body).toBeUndefined();

    // local mirror evicted in the same breath (drain-to-evict notify), so an
    // immediate re-clear cannot re-POST/DELETE anything
    expect(getBardicInspirationPrompt('test-campaign', 'Bard')).toBeNull();
  });

  it('clearing a prompt never touches biPromptCleared or the character bucket', () => {
    sendOffense();
    getStore('Bard').set('hitPoints', 30);
    clearBardicInspirationPrompt('test-campaign', 'Bard');

    for (const [url] of global.fetch.mock.calls) {
      expect(url).not.toContain('biPromptCleared');
      expect(url).not.toBe('/api/campaigns/test-campaign/Bard');
    }
    // unrelated character state survives the eviction untouched
    expect(getStore('Bard').get('hitPoints')).toBe(30);
  });

  it('clearing evicts only the named attacker key and is idempotent', () => {
    sendOffense();
    sendOffense('SisterBard', 'Orc', 10, 303);
    global.fetch.mockClear();

    clearBardicInspirationPrompt('test-campaign', 'Bard');

    expect(fetchCalls()).toEqual([
      { url: '/api/campaigns/test-campaign/Bard-biPrompt', method: 'DELETE' },
    ]);
    expect(getBardicInspirationPrompt('test-campaign', 'Bard')).toBeNull();
    // another attacker's pending prompt lives on a separate key and survives
    expect(getBardicInspirationPrompt('test-campaign', 'SisterBard')).toEqual({
      mode: 'offense',
      promptId: 303,
      targetName: 'Orc',
      attackerName: 'SisterBard',
      dieSize: 10,
      fullDescription: OFFENSE_PAYLOAD.fullDescription,
    });

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
