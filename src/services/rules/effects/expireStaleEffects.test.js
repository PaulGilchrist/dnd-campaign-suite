// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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
});
