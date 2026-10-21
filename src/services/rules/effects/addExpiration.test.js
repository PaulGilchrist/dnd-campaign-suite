// @maintained-by-ai
// Barrel-import lane: imports addExpiration via ./expirations.js (the public
// re-export consumers use), unlike addExpiration.ba001-single-write.test.js
// which imports ./expirationQueue.js directly. That direct module owns the
// single-write exact-payload lane (§39); fold notes for tests removed here:
//   - "adds a new expiration entry when no existing list" -> ba001 :37-64
//   - "appends to existing expiration list without mutating" -> ba001 :66-91
//   - "uses getCurrentCombatRound for appliedRound" -> ba001 :9 and appliedRound: 2 stamps in :37-64 / :66-91
//   - "uses Infinity when rounds is nullish" -> ba001 :37-64 (rounds undefined -> Infinity) and :93-117 (until:'combat' rides Infinity)
// The ONLY face unique to this file: a FINITE round clock (rounds: 3 ->
// expiryRounds: 3). ba001 pins Infinity in every payload, so the finite
// stamp is verified nowhere else — pinned exact-byte below.
// No-timers policy: appliedRound is a round counter from
// getCurrentCombatRound, expiryRounds a round budget — never Date.now().
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
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (typeof expr === 'number') return expr;
    return 1;
  }),
}));

import { addExpiration } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

const KEY = 'pendingExpirations';

describe('addExpiration via ./expirations.js barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finite rounds: 3 stamps expiryRounds: 3 — ONE exact-payload write through the barrel', () => {
    getRuntimeValue.mockReturnValueOnce([]);
    getCurrentCombatRound.mockReturnValueOnce(5);

    addExpiration({
      attackerName: 'Caster',
      targetName: 'Target',
      effects: [{ type: 'stunned' }],
      campaignName: 'MyCampaign',
      rounds: 3,
    });

    // Exact deep equality pins every byte of the entry: appliedRound from
    // the round counter, a FINITE expiryRounds, expireOnCreatureName
    // defaulted to null, no extra fields (no until key, no timestamps),
    // and one merged write (times(1) — no seed [] POST, per BA-001).
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Caster',
      KEY,
      [{
        target: 'Target',
        effects: [{ type: 'stunned' }],
        appliedRound: 5,
        expiryRounds: 3,
        expireOnCreatureName: null,
      }],
      'MyCampaign',
    );
  });
});
