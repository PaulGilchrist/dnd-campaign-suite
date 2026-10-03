import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyLongRest } from './restRules.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeBatch: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

vi.mock('./expirations.js', () => ({
  clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../combat/conditions/exhaustionRules.js', () => ({
  getLevelAfterLongRest: vi.fn((level) => Math.max(0, level - 1)),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Disciplined_Monk',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    automation: {
      actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [],
    },
    feats: ['Boon Of Recovery'],
    ...overrides,
  };
}

describe('FT-015 long rest recharges Boon of Recovery (Last Stand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets boonOfRecoveryLastStandUsed to false on a long rest', async () => {
    await applyLongRest(makePlayerStats(), 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Disciplined_Monk', 'boonOfRecoveryLastStandUsed', false, 'test-campaign', true,
    );
  });

  it('resets the sibling one-shot boon/race latch keys in the same pass', async () => {
    await applyLongRest(makePlayerStats(), 'test-campaign');

    const latchKeys = new Set(setRuntimeValue.mock.calls.map((c) => c[1]));
    expect(latchKeys.has('boonOfRecoveryLastStandUsed')).toBe(true);
    expect(latchKeys.has('undyingSentinelUsed')).toBe(true);
    expect(latchKeys.has('relentlessEnduranceUsed')).toBe(true);
    expect(latchKeys.has('boonOfFateUsed')).toBe(true);
  });
});
