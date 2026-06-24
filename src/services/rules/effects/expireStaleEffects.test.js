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
// expireStaleEffects — early-exit / guard clauses
// ---------------------------------------------------------------------------
describe('expireStaleEffects — early exits', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('returns early without side effects when active creature name is null', () => {
    getActiveCreatureName.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(getCombatSummary).not.toHaveBeenCalled();
  });

  it('returns early without side effects when active creature name is empty string', () => {
    getActiveCreatureName.mockReturnValue('');

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when combat summary is null', () => {
    getCombatSummary.mockReturnValue(null);

    expireStaleEffects('MyCampaign');

    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns early when combat summary is not an object', () => {
    getCombatSummary.mockReturnValue('not-an-object');

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

    // Only the matching creature (Goblin) should trigger a getRuntimeValue call
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', KEY);
    // The Orc should not have triggered any runtime reads
    const orcCalls = getRuntimeValue.mock.calls.filter((c) => c[0] === 'Orc');
    expect(orcCalls).toHaveLength(0);
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

    // Matching uses normalized name but runtime lookup uses raw attacker.name
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
// expireStaleEffects — stale vs fresh entry classification
// ---------------------------------------------------------------------------
describe('expireStaleEffects — stale vs fresh entries', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(2);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('clears entries where currentRound equals appliedRound + expiryRounds (boundary)', () => {
    const entry = {
      target: 'Human',
      effects: [{ type: 'stunned', condition: 'speed_halved' }],
      appliedRound: 1,
      expiryRounds: 1,
    };

    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce([entry]);

    expireStaleEffects('MyCampaign');

    const pendingCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && c[1] === KEY,
    );
    expect(pendingCalls.length).toBe(1);
    expect(pendingCalls[0][2]).toEqual([]);
  });

  it('keeps entries where currentRound is one below the expiry boundary', () => {
    const entry = {
      target: 'Human',
      effects: [{ type: 'stunned', condition: 'speed_halved' }],
      appliedRound: 1,
      expiryRounds: 2,
    };

    getCurrentCombatRound.mockReturnValue(2);
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce([entry]);

    expireStaleEffects('MyCampaign');

    const pendingCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && c[1] === KEY,
    );
    expect(pendingCalls.length).toBe(1);
    expect(pendingCalls[0][2]).toEqual([entry]);
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

  it('skips processing when the attacker pending list is empty', () => {
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce([]);

    expireStaleEffects('MyCampaign');

    const pendingCalls = setRuntimeValue.mock.calls.filter(
      (c) => c[0] === 'Goblin' && c[1] === KEY,
    );
    expect(pendingCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// expireStaleEffects — campaign name propagation
// ---------------------------------------------------------------------------
describe('expireStaleEffects — campaign name', () => {
  beforeEach(() => {
    resetMocks();
    stubUtilsNameIdentity();
    getCurrentCombatRound.mockReturnValue(5);
    getActiveCreatureName.mockReturnValue('Goblin');
  });

  it('passes campaignName to all setRuntimeValue calls', () => {
    const list = [
      { target: 'Human', effects: [{ type: 'stunned', condition: 'speed_halved' }], appliedRound: 0, expiryRounds: 1 },
    ];
    getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin' }] });
    getRuntimeValue.mockReturnValueOnce(list);

    expireStaleEffects('TestCampaign');

    for (const call of setRuntimeValue.mock.calls) {
      expect(call[3]).toBe('TestCampaign');
    }
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
