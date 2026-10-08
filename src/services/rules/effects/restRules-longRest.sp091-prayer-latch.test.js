// SP-091: Prayer of Healing once-per-Long-Rest latch re-arm — CLA-288 byte-twin
// (relentlessEnduranceUsed, restRules-longRest.js resetFlags). The affected
// latch (prayerOfHealingAffected, written on the affected creature's own store
// by prayerOfHealingLatch.js) must be cleared ONLY by that creature's Long Rest.
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
    name: 'AasimarTest',
    level: 20,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    automation: {
      actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [],
    },
    ...overrides,
  };
}

describe('SP-091 long rest re-arms the Prayer of Healing affected latch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears prayerOfHealingAffected on the resting creature', async () => {
    await applyLongRest(makePlayerStats(), 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'AasimarTest', 'prayerOfHealingAffected', null, 'test-campaign', true,
    );
  });

  it('clears the latch in the same pass as the CLA-288 relentlessEnduranceUsed twin', async () => {
    await applyLongRest(makePlayerStats(), 'test-campaign');

    const latchKeys = new Set(setRuntimeValue.mock.calls.map((c) => c[1]));
    expect(latchKeys.has('prayerOfHealingAffected')).toBe(true);
    expect(latchKeys.has('relentlessEnduranceUsed')).toBe(true);
  });
});
