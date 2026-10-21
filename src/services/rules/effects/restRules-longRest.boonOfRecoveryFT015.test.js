// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyLongRest } from './restRules.js';
import { checkBoonOfRecoveryLastStand } from '../features/boonOfRecoveryService.js';

// Stateful runtime-store fake: pins the FT-015 key CONTRACT across the write
// side (restRules-longRest resetFlags) and the read side
// (boonOfRecoveryService.checkBoonOfRecoveryLastStand). Unit lanes mock both
// ends, so only this round trip fails if either side renames the latch key.
const { store } = vi.hoisted(() => ({ store: new Map() }));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => store.get(`${name}.${key}`)),
  setRuntimeValue: vi.fn((name, key, value) => {
    store.set(`${name}.${key}`, value);
    return Promise.resolve();
  }),
  setRuntimeBatch: vi.fn((name, data) => {
    for (const [k, v] of Object.entries(data)) store.set(`${name}.${k}`, v);
  }),
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
    store.clear();
  });

  it('re-arms a spent Last Stand: drop-to-0 is blocked, rest, then the consumer intercepts again', async () => {
    const name = 'Disciplined_Monk';
    // Simulate Last Stand already spent in combat (consumer stamps true).
    store.set(`${name}.boonOfRecoveryLastStandUsed`, true);
    store.set(`${name}.hitPoints`, 100);
    const creature = { name, type: 'player', currentHp: 0 };
    const computed = { allFeatures: [{ name: 'Last Stand' }] };

    // RAW: "Once you use this benefit, you can't use it again until you
    // finish a Long Rest" — blocked, with zero side-effect writes.
    expect(checkBoonOfRecoveryLastStand(creature, computed, 'test-campaign')).toEqual({ intercepted: false });
    expect(store.has(`${name}.currentHitPoints`)).toBe(false);

    await applyLongRest(makePlayerStats(), 'test-campaign');
    expect(store.get(`${name}.boonOfRecoveryLastStandUsed`)).toBe(false);

    const result = checkBoonOfRecoveryLastStand(creature, computed, 'test-campaign');
    expect(result.intercepted).toBe(true);
    expect(result.newHp).toBe(51); // 1 + floor(maxHp/2), clamped to max
    expect(store.get(`${name}.currentHitPoints`)).toBe(51);
    // Spent again immediately — only the next long rest re-arms it.
    expect(store.get(`${name}.boonOfRecoveryLastStandUsed`)).toBe(true);
  });

  it('long rest writes byte-exact false+skipSync re-arm for FT-015 and its sibling one-shot latches, once each', async () => {
    await applyLongRest(makePlayerStats(), 'test-campaign');

    const latchKeys = ['undyingSentinelUsed', 'relentlessEnduranceUsed', 'boonOfFateUsed', 'boonOfRecoveryLastStandUsed'];
    const latchWrites = setRuntimeValue.mock.calls.filter(([, key]) => latchKeys.includes(key));
    // Exact bytes in source order (restRules-longRest.js resetFlags batch);
    // zero-write budget: exactly one re-arm per latch, never a truthy stamp.
    expect(latchWrites).toEqual([
      ['Disciplined_Monk', 'undyingSentinelUsed', false, 'test-campaign', true],
      ['Disciplined_Monk', 'relentlessEnduranceUsed', false, 'test-campaign', true],
      ['Disciplined_Monk', 'boonOfFateUsed', false, 'test-campaign', true],
      ['Disciplined_Monk', 'boonOfRecoveryLastStandUsed', false, 'test-campaign', true],
    ]);
  });
});
