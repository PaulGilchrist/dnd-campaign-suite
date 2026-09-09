// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getRuntimeKeysByPrefix: vi.fn(() => []),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  isUnbreakableMajestyActive,
  getUnbreakableMajestySaveDc,
  clearUnbreakableMajesty,
  hasAttackerTriggeredMajesty,
  markAttackerTriggeredMajesty,
  clearPerRoundMajestyTrackers,
  buildMajestyPromptData,
} from './unbreakableMajesty.js';

import { getRuntimeValue, setRuntimeValue, getRuntimeKeysByPrefix } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

// ── Tests ───────────────────────────────────────────────────────

describe('isUnbreakableMajestyActive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true only when runtime value is strictly true', () => {
    getRuntimeValue.mockReturnValue(true);
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(true);

    getRuntimeValue.mockReturnValue(false);
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false);

    getRuntimeValue.mockReturnValue(null);
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false);

    getRuntimeValue.mockReturnValue(undefined);
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false);

    // Truthy strings and numbers should not be treated as true
    getRuntimeValue.mockReturnValue('true');
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false);

    getRuntimeValue.mockReturnValue(1);
    expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(false);
  });
});

describe('getUnbreakableMajestySaveDc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the numeric DC from runtime or coerces numeric strings', () => {
    getRuntimeValue.mockReturnValue(15);
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(15);

    getRuntimeValue.mockReturnValue('18');
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(18);
  });

  it('returns 0 when runtime value is null, undefined, or empty string', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0);

    getRuntimeValue.mockReturnValue(undefined);
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0);

    getRuntimeValue.mockReturnValue('');
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(0);
  });

  it('returns NaN for a non-numeric string via Number coercion', () => {
    getRuntimeValue.mockReturnValue('abc');
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBeNaN();
  });
});

describe('clearUnbreakableMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears both the active flag and the save DC with correct arguments', () => {
    clearUnbreakableMajesty('Paladin', 'Campaign');

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'Paladin', 'unbreakableMajestyActive', null, 'Campaign');
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'Paladin', 'unbreakableMajestySaveDc', null, 'Campaign');

    vi.clearAllMocks();
    clearUnbreakableMajesty('MyPaladin', 'MyCampaign');

    expect(setRuntimeValue).toHaveBeenNthCalledWith(1, 'MyPaladin', 'unbreakableMajestyActive', null, 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenNthCalledWith(2, 'MyPaladin', 'unbreakableMajestySaveDc', null, 'MyCampaign');
  });
});

describe('hasAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when attacker triggered in the current round', () => {
    getCurrentCombatRound.mockReturnValue(3);
    getRuntimeValue.mockReturnValue({ round: 3 });
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true);
  });

  it('returns false when attacker triggered in a different round or has not triggered yet', () => {
    getCurrentCombatRound.mockReturnValue(4);
    getRuntimeValue.mockReturnValue({ round: 3 });
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false);

    getCurrentCombatRound.mockReturnValue(3);
    getRuntimeValue.mockReturnValue(null);
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false);

    getRuntimeValue.mockReturnValue(undefined);
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false);

    getRuntimeValue.mockReturnValue({ other: 'data' });
    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(false);
  });

  it('tracks attackers independently by name', () => {
    getCurrentCombatRound.mockReturnValue(3);
    getRuntimeValue.mockImplementation((_, key) =>
      key === 'unbreakableMajestyBlocked_Goblin' ? { round: 3 } : null,
    );

    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true);
    expect(hasAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')).toBe(false);
  });
});

describe('markAttackerTriggeredMajesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the attacker with the current round using the correct storage key', () => {
    getCurrentCombatRound.mockReturnValue(5);
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      { round: 5 },
      'Campaign',
    );

    vi.clearAllMocks();
    getCurrentCombatRound.mockReturnValue(3);
    markAttackerTriggeredMajesty('MyPaladin', 'Drake', 'MyCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'MyPaladin',
      'unbreakableMajestyBlocked_Drake',
      { round: 3 },
      'MyCampaign',
    );
  });

  it('uses the current round at call time, not a cached value', () => {
    getCurrentCombatRound.mockReturnValue(1);
    markAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign');
    getCurrentCombatRound.mockReturnValue(99);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      { round: 1 },
      'Campaign',
    );
  });
});

describe('clearPerRoundMajestyTrackers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeKeysByPrefix.mockReturnValue([]);
  });

  it('clears outdated trackers and keeps current ones', () => {
    getCurrentCombatRound.mockReturnValue(3);
    getRuntimeKeysByPrefix.mockReturnValue([
      'unbreakableMajestyBlocked_Goblin',
      'unbreakableMajestyBlocked_Orc',
    ]);

    getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'unbreakableMajestyBlocked_Goblin') return { round: 1 };
      if (key === 'unbreakableMajestyBlocked_Orc') return { round: 3 };
      return null;
    });

    clearPerRoundMajestyTrackers('Paladin', 'Campaign');

    expect(getRuntimeKeysByPrefix).toHaveBeenCalledWith('Paladin', 'unbreakableMajestyBlocked_');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Goblin',
      null,
      'Campaign',
    );
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_Orc',
      null,
      'Campaign',
    );
  });

  it('does not touch keys without the majesty-block prefix', () => {
    getCurrentCombatRound.mockReturnValue(1);
    getRuntimeKeysByPrefix.mockReturnValue([]);

    clearPerRoundMajestyTrackers('Paladin', 'Campaign');

    expect(getRuntimeKeysByPrefix).toHaveBeenCalledWith('Paladin', 'unbreakableMajestyBlocked_');
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles no tracked keys without error', () => {
    getCurrentCombatRound.mockReturnValue(1);
    getRuntimeKeysByPrefix.mockReturnValue([]);

    expect(() => clearPerRoundMajestyTrackers('Paladin', 'Campaign')).not.toThrow();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('skips keys whose stored value is null', () => {
    getCurrentCombatRound.mockReturnValue(2);
    getRuntimeKeysByPrefix.mockReturnValue(['unbreakableMajestyBlocked_Goblin']);
    getRuntimeValue.mockReturnValue(null);

    clearPerRoundMajestyTrackers('Paladin', 'Campaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('clears only outdated trackers among many', () => {
    getCurrentCombatRound.mockReturnValue(4);
    getRuntimeKeysByPrefix.mockReturnValue([
      'unbreakableMajestyBlocked_A',
      'unbreakableMajestyBlocked_B',
      'unbreakableMajestyBlocked_C',
    ]);

    getRuntimeValue.mockImplementation((_, key) => {
      if (key === 'unbreakableMajestyBlocked_A') return { round: 3 };
      if (key === 'unbreakableMajestyBlocked_B') return { round: 4 };
      if (key === 'unbreakableMajestyBlocked_C') return { round: 2 };
      return null;
    });

    clearPerRoundMajestyTrackers('Paladin', 'Campaign');

    expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_A',
      null,
      'Campaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Paladin',
      'unbreakableMajestyBlocked_C',
      null,
      'Campaign',
    );
  });
});

describe('CLA-370 campaign round threading and re-arm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeKeysByPrefix.mockReturnValue([]);
  });

  it('reads the current round with the campaign name in mark and has', () => {
    getCurrentCombatRound.mockReturnValue(7);
    getRuntimeValue.mockReturnValue(null);
    expect(hasAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign')).toBe(false);
    expect(getCurrentCombatRound).toHaveBeenCalledWith('Campaign');

    markAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign');
    expect(getCurrentCombatRound).toHaveBeenLastCalledWith('Campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Bard',
      'unbreakableMajestyBlocked_Knight 1',
      { round: 7 },
      'Campaign',
    );
  });

  it('re-arms the prompt at round wrap: round-1 stamp clears and round-2 first hit is fresh', () => {
    const store = {};
    getRuntimeValue.mockImplementation((_, key) => store[key]);
    setRuntimeValue.mockImplementation((_, key, value) => { store[key] = value; });
    getRuntimeKeysByPrefix.mockReturnValue(['unbreakableMajestyBlocked_Knight 1']);

    // Round 1: first hit stamps the tracker; a re-hit in the same round stays gated.
    getCurrentCombatRound.mockReturnValue(1);
    markAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign');
    expect(hasAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign')).toBe(true);

    // Round-wrap: cache still lags at round 1 during the wrap loop — the caller
    // passes roundToSet=2 so the stale stamp must be cleared.
    clearPerRoundMajestyTrackers('Bard', 'Campaign', 2);
    expect(store['unbreakableMajestyBlocked_Knight 1']).toBeNull();

    // Round 2 first hit: gate re-armed, prompt can fire again.
    getCurrentCombatRound.mockReturnValue(2);
    expect(hasAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign')).toBe(false);

    // Stamp in round 2 uses the real round, not 1.
    markAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign');
    expect(store['unbreakableMajestyBlocked_Knight 1']).toEqual({ round: 2 });
  });

  it('falls back to the campaign-keyed round read when no explicit round is passed', () => {
    getRuntimeKeysByPrefix.mockReturnValue(['unbreakableMajestyBlocked_Orc']);
    getCurrentCombatRound.mockReturnValue(4);
    getRuntimeValue.mockReturnValue({ round: 3 });

    clearPerRoundMajestyTrackers('Bard', 'Campaign');

    expect(getCurrentCombatRound).toHaveBeenCalledWith('Campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Bard', 'unbreakableMajestyBlocked_Orc', null, 'Campaign');
  });
});

describe('buildMajestyPromptData', () => {
  it('returns correct prompt data structure with attacker as target and defender as source', () => {
    const result = buildMajestyPromptData('Paladin', 'Goblin', 15);
    expect(result).toEqual({
      targetName: 'Goblin',
      saveType: 'CHA',
      saveDc: 15,
      sourceName: 'Paladin',
    });

    // Verify name swapping
    const result2 = buildMajestyPromptData('My Paladin', 'Dragon', 20);
    expect(result2.sourceName).toBe('My Paladin');
    expect(result2.targetName).toBe('Dragon');

    // Verify saveType is always CHA
    const result3 = buildMajestyPromptData('Paladin', 'Goblin', 10);
    expect(result3.saveType).toBe('CHA');

    // Verify saveDc passes through unchanged
    const result4 = buildMajestyPromptData('Paladin', 'Goblin', 25);
    expect(result4.saveDc).toBe(25);
  });
});
