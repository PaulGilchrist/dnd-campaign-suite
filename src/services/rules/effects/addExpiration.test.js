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
  getCurrentCombatRound: vi.fn(() => 5),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
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

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

// ---------------------------------------------------------------------------
// addExpiration
// ---------------------------------------------------------------------------
describe('addExpiration', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('creates correct entry structure', () => {
    it('adds a new expiration entry when no existing list', () => {
      getRuntimeValue.mockReturnValueOnce([]);

      addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'MyCampaign', 3);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Caster',
        KEY,
        [
          {
            target: 'Target',
            effects: [{ type: 'stunned' }],
            appliedRound: 5,
            expiryRounds: 3,
            expireOnCreatureName: null,
          },
        ],
        'MyCampaign',
      );
    });

    it('appends to existing expiration list without mutating the original', () => {
      const existingList = [
        {
          target: 'Orc',
          effects: [{ type: 'advantage_on_target' }],
          appliedRound: 0,
        },
      ];
      const originalLength = existingList.length;
      getRuntimeValue.mockReturnValueOnce(existingList);

      addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'MyCampaign', 2);

      // Original array should be unchanged (spread creates new array)
      expect(existingList.length).toBe(originalLength);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Caster',
        KEY,
        expect.arrayContaining([
          expect.objectContaining({ target: 'Orc' }),
          expect.objectContaining({ target: 'Target' }),
        ]),
        'MyCampaign',
      );
    });

    it('uses getCurrentCombatRound for appliedRound', () => {
      getCurrentCombatRound.mockReturnValue(10);
      getRuntimeValue.mockReturnValueOnce([]);

      addExpiration('Caster', 'Target', [{ type: 'blinded' }], 'MyCampaign', 3);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Caster',
        KEY,
        expect.arrayContaining([
          expect.objectContaining({ appliedRound: 10 }),
        ]),
        'MyCampaign',
      );
    });

    it('uses Infinity when rounds is nullish', () => {
      getRuntimeValue.mockReturnValueOnce([]);

      addExpiration('Caster', 'Target', [{ type: 'stunned' }], 'TestCampaign', null);

      expect(setRuntimeValue).toHaveBeenCalledWith('Caster', expect.any(String), expect.arrayContaining([
        expect.objectContaining({ expiryRounds: Infinity }),
      ]), 'TestCampaign');
    });
  });
});
