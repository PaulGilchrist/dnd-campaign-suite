// @improved-by-ai
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
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
}));

import { expireStaleEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue, getAllStoreKeys } from '../../../hooks/runtime/useRuntimeState.js';
import utils from '../../ui/utils.js';
import {
  getCurrentCombatRound,
  getActiveCreatureName,
  getCombatSummary,
} from '../../encounters/combatData.js';

const KEY = 'pendingExpirations';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

function stubUtilsNameIdentity() {
  utils.getName.mockImplementation((v) => v);
}

// ---------------------------------------------------------------------------
// expireStaleEffects — early exits
// ---------------------------------------------------------------------------
describe('expireStaleEffects — early exits', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it.each([
    { name: 'null', value: null },
    { name: 'empty string', value: '' },
  ])('returns early without side effects when active creature name is $name', ({ value }) => {
    getActiveCreatureName.mockReturnValue(value);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(getCombatSummary).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'null', value: null },
    { name: 'non-object', value: 'not-an-object' },
  ])('returns early when combat summary is $name', ({ value }) => {
    getCombatSummary.mockReturnValue(value);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when creatures array is missing', () => {
    getCombatSummary.mockReturnValue({});

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when creatures is not an array', () => {
    getCombatSummary.mockReturnValue({ creatures: 'not-an-array' });

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — creature matching
// ---------------------------------------------------------------------------
describe('expireStaleEffects — creature matching', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('only processes creatures whose name matches the active creature after getName normalization', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'Goblin' },
      ],
    });
    getRuntimeValue.mockReturnValueOnce([
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1, expiryRounds: 1 },
    ]);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
  });

  it('applies utils.getName normalization to creature names for matching but uses raw name for runtime lookup', () => {
    utils.getName.mockImplementation((v) => (v === 'goblin' ? 'Goblin' : v));
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'goblin' },
      ],
    });
    getRuntimeValue.mockReturnValueOnce([
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 1, expiryRounds: 1 },
    ]);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).toHaveBeenCalledWith('goblin', KEY);
  });

  it('skips all creatures when none match the active name', () => {
    getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'Orc' },
        { name: 'Dragon' },
      ],
    });

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — stale vs fresh entries
// ---------------------------------------------------------------------------
describe('expireStaleEffects — stale vs fresh entries', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('filters mixed stale and fresh entries, keeping only fresh ones', () => {
    const staleEntry = {
      target: 'Human',
      effects: [{ type: 'stunned', condition: 'speed_halved' }],
      appliedRound: 0,
      expiryRounds: 1,
    };
    const freshEntry = {
      target: 'Orc',
      effects: [{ type: 'advantage_on_target' }],
      appliedRound: 2,
      expiryRounds: 1,
    };

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce([staleEntry, freshEntry]);

    expireStaleEffects('MyCampaign');

    const pendingCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && c[1] === KEY,
    );
    expect(pendingCalls.length).toBe(1);
    expect(pendingCalls[0][2]).toEqual([freshEntry]);
  });

  it('clears all entries when every entry is stale', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0, expiryRounds: 1 },
      { target: 'Orc', effects: [{ type: 'blinded' }], appliedRound: 1, expiryRounds: 1 },
    ];

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getCurrentCombatRound.mockReturnValue(5);
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('MyCampaign');

    const pendingCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && c[1] === KEY,
    );
    expect(pendingCalls.length).toBe(1);
    expect(pendingCalls[0][2]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — error recovery
// ---------------------------------------------------------------------------
describe('expireStaleEffects — error recovery', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(5);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('does not throw when getRuntimeValue returns a non-array for pendingExpirations', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce('not-an-array');

    expect(() => expireStaleEffects('MyCampaign')).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // Self-targeted expirations (Phase 2: scan all stores for entries targeting active)

  describe('self-targeted expirations', () => {
    beforeEach(() => {
      resetMocks();
      getCurrentCombatRound.mockReturnValue(4);
      getActiveCreatureName.mockReturnValue('RangerGirl');
      stubUtilsNameIdentity();
    });

    it('expires invisible condition when target matches active creature and round is met', () => {
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'RangerGirl' }] });
      getAllStoreKeys.mockReturnValue(['RangerGirl', 'Goblin']);

      // RangerGirl has a self-targeted entry for invisible
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'RangerGirl' && prop === KEY) return [
          { target: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], appliedRound: 3, expiryRounds: 1 }
        ];
        if (key === 'RangerGirl' && prop === 'activeConditions') return ['invisible'];
        if (key === 'Goblin' && prop === KEY) return [];
        return null;
      });

      expireStaleEffects('test-campaign');

      // Should have removed the invisible condition from activeConditions
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'RangerGirl',
        'activeConditions',
        [],
        'test-campaign'
      );
      // Should have cleared the expired entry
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'RangerGirl',
        KEY,
        [],
        'test-campaign'
      );
    });

    it('keeps self-targeted expiration when round not yet met', () => {
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'RangerGirl' }] });
      getAllStoreKeys.mockReturnValue(['RangerGirl']);

      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'RangerGirl' && prop === KEY) return [
          { target: 'RangerGirl', effects: [{ type: 'condition', condition: 'invisible' }], appliedRound: 3, expiryRounds: 2 }
        ];
        if (key === 'RangerGirl' && prop === 'activeConditions') return ['invisible'];
        return null;
      });

      expireStaleEffects('test-campaign');

      // Should NOT have removed the invisible condition
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'RangerGirl',
        'activeConditions',
        [],
        'test-campaign'
      );
    });

    it('does not expire entries targeting a different creature when round not met', () => {
      getCombatSummary.mockReturnValue({ creatures: [{ name: 'RangerGirl' }] });
      getAllStoreKeys.mockReturnValue(['Goblin']);

      // Goblin has an entry targeting someone else, not yet expired by round
      getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'Goblin' && prop === KEY) return [
          { target: 'Orc', effects: [{ type: 'condition', condition: 'blinded' }], appliedRound: 3, expiryRounds: 2 }
        ];
        return null;
      });

      expireStaleEffects('test-campaign');

      // Should NOT have called activeConditions (no conditions removed)
      const conditionCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
      expect(conditionCalls.length).toBe(0);
      // The KEY call that exists is just from Phase 1 initializing RangerGirl's empty pendingExpirations
      // The Goblin store should NOT have been modified
      const goblinKeyCalls = setRuntimeValue.mock.calls.filter(
        c => c[1] === KEY && c[0] === 'Goblin'
      );
      expect(goblinKeyCalls.length).toBe(0);
    });
  });
});
