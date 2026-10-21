// @maintained-by-ai
// Regression tests for CLA-175: Hurl Through Hell incapacitated duration and
// return-to-space resolution via the expiration queue.
// Owner of the hurl_through_hell_return clear lane: condition + targetEffect
// removal bytes, exact log text, and queue-seam dispatch. The registration
// side (addExpiration rounds:2) lives in HurlThroughHellModal.saveResults.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => 'HexWarlock'),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';
import { processExpirationList } from './expirationQueue.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'HexWarlock';
const TARGET = 'Ogre 1';

const hurlEffect = [{ type: 'hurl_through_hell_return', target: TARGET, source: 'Hurl Through Hell' }];
const hurlTe = {
  target: TARGET,
  source: 'Hurl Through Hell',
  effect: 'incapacitated',
  condition: 'incapacitated',
  duration: 'until_end_of_next_turn',
  teleport: true,
  returnToSpace: true,
};

function setCallsForKey(key) {
  return setRuntimeValue.mock.calls.filter(c => c[1] === key);
}

describe('hurl_through_hell_return expiration (CLA-175)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [hurlTe];
      if (name === TARGET && key === 'activeConditions') return ['incapacitated', 'prone'];
      return null;
    });
    setRuntimeValue.mockImplementation(() => Promise.resolve());
    addEntry.mockImplementation(() => Promise.resolve());
  });

  it('strips incapacitated from every activeConditions write, keeping other conditions', () => {
    clearExpirationEffects(hurlEffect, TARGET, CASTER, CAMPAIGN);

    expect(setRuntimeValue).toHaveBeenCalledWith(TARGET, 'activeConditions', ['prone'], CAMPAIGN);
    for (const [, , value] of setCallsForKey('activeConditions')) {
      expect(value).not.toContain('incapacitated');
    }
  });

  it('removes only the hurl incapacitated targetEffect from the campaign store', () => {
    const unrelated = { target: 'Goblin', source: 'Faerie Fire', effect: 'faerie_fire' };
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [hurlTe, unrelated];
      if (name === TARGET && key === 'activeConditions') return ['incapacitated'];
      return null;
    });

    clearExpirationEffects(hurlEffect, TARGET, CASTER, CAMPAIGN);

    expect(setCallsForKey('targetEffects')).toEqual([['campaign', 'targetEffects', [unrelated], CAMPAIGN]]);
  });

  it('does not rewrite campaign targetEffects when no entry matches', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'campaign' && key === 'targetEffects') return [];
      if (name === TARGET && key === 'activeConditions') return ['incapacitated'];
      return null;
    });

    clearExpirationEffects(hurlEffect, TARGET, CASTER, CAMPAIGN);

    expect(setCallsForKey('targetEffects')).toHaveLength(0);
  });

  it('logs the return-to-space condition end with exact payload', () => {
    clearExpirationEffects(hurlEffect, TARGET, CASTER, CAMPAIGN);

    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'condition',
      action: 'ended',
      characterName: TARGET,
      condition: 'Incapacitated',
      source: 'Hurl Through Hell',
      description: 'Ogre 1 returns to the space it previously occupied — the Hurl Through Hell effect ends.',
      timestamp: expect.any(Number),
    });
  });

  it('expires at the start of round appliedRound+2, not before (until end of caster next turn)', () => {
    const list = [{ target: TARGET, effects: hurlEffect, appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null }];

    const atRound2 = processExpirationList(list, 2, CASTER, CAMPAIGN, CASTER);
    expect(atRound2).toEqual({ processed: list, expiredCount: 0, changed: false });
    expect(setRuntimeValue).not.toHaveBeenCalled();

    const atRound3 = processExpirationList(list, 3, CASTER, CAMPAIGN, CASTER);
    expect(atRound3).toEqual({ processed: [], expiredCount: 1, changed: true });
    expect(setRuntimeValue).toHaveBeenCalledWith(TARGET, 'activeConditions', ['prone'], CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], CAMPAIGN);
  });
});
