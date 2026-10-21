// @maintained-by-ai
// SP-091: Prayer of Healing once-per-Long-Rest latch re-arm — CLA-288 byte-twin
// (relentlessEnduranceUsed, restRules-longRest.js:712 resetFlags). The affected
// creature's own-store latch (prayerOfHealingAffected, stamped by
// prayerOfHealingLatch.js; the consume-side stamp contract is owned by
// prayerOfHealingService.test.js / prayerOfHealingHandler.test.js — no round
// trip duplicated here) must be cleared ONLY by that creature's Long Rest.
// Subsumption check: the key is absent from LONG_REST_RESOURCES and from every
// Short Rest reset list, so this file owns both directions. The relentlessEnduranceUsed
// sibling batch is pinned byte-exact by restRules-longRest.boonOfRecoveryFT015.test.js —
// prayer-only rows here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyLongRest, applyShortRest } from './restRules.js';

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

import { setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const PRAYER_KEY = 'prayerOfHealingAffected';

function makePlayerStats(overrides = {}) {
  return {
    name: 'ClericTest',
    level: 20,
    hitPoints: 100,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 4 }],
    automation: {
      actions: [], bonusActions: [], reactions: [], specialActions: [], passives: [],
    },
    ...overrides,
  };
}

// Arity-safe filter over every store write for the prayer latch key.
const prayerWrites = () =>
  setRuntimeValue.mock.calls.filter(([, key]) => key === PRAYER_KEY);

describe('SP-091 Prayer of Healing affected-latch lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('long rest re-arms the latch: one byte-exact null+skipSync write, never a truthy stamp', async () => {
    await applyLongRest(makePlayerStats(), CAMPAIGN);

    // Full-set equality over all prayer-key writes on the resting creature's
    // store: catches a dropped reset, duplicate re-arm, truthy stamp, or a
    // lost skipSync flag (SSE-echo contract — server already holds the state).
    expect(prayerWrites()).toEqual([
      ['ClericTest', 'prayerOfHealingAffected', null, 'test-campaign', true],
    ]);
  });

  it('short rest does NOT re-arm the latch (CLA-048), while adjacent short-rest latches stay live', async () => {
    await applyShortRest(makePlayerStats(), CAMPAIGN);

    // Non-vacuous bait: the short-rest atomic batch ran and actively resets
    // the adjacent boonOfFateUsed latch — the prayer row is deliberately absent.
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    const [batchName, updates] = setRuntimeBatch.mock.calls[0];
    expect(batchName).toBe('ClericTest');
    expect(updates.boonOfFateUsed).toBe(false);

    expect('prayerOfHealingAffected' in updates).toBe(false);
    expect(prayerWrites()).toEqual([]);
  });
});
