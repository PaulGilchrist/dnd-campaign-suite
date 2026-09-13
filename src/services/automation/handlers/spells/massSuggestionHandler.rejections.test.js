// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './massSuggestionHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 15,
    proficiency: 6,
    abilities: [{ name: 'Charisma', bonus: 5 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Mass Suggestion',
    automation: {
      type: 'mass_suggestion',
      saveType: 'WIS',
      saveDc: 'spell_save_dc',
      range: '60 feet',
      duration: '24 hours',
      maxTargets: 12,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'Bugbear', type: 'monster', currentHp: 12, maxHp: 15 },
    { name: 'Kobold', type: 'monster', currentHp: 4, maxHp: 5 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  placedItems: [],
};

function makeFailedSaveMock() {
  return { promptId: 'ms-prompt', promise: Promise.resolve({ success: false }) };
}

function makeSuccessSaveMock() {
  return { promptId: 'ms-prompt', promise: Promise.resolve({ success: true }) };
}

// ── Tests ──────────────────────────────────────────────────────

describe('massSuggestionHandler — addEntry rejection handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addEntry .catch handlers', () => {
    it('should not throw when addEntry rejects on first ability_use entry (failed save path)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);

      // Make addEntry reject on the first call (ability_use for Goblin)
      addEntry.mockImplementationOnce(() => Promise.reject(new Error('log error')));
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      // Should not throw — the .catch handler absorbs the error
      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();
    });

    it('should not throw when addEntry rejects on save_result entry (success save path)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);

      // First addEntry (ability_use) succeeds, second (save_result) rejects for Goblin
      addEntry.mockImplementationOnce(() => Promise.resolve()); // ability_use for Goblin
      addEntry.mockImplementationOnce(() => Promise.reject(new Error('save result error'))); // save_result for Goblin

      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();
    });

    it('should not throw when addEntry rejects on condition entry (failed save path)', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);

      // First addEntry (ability_use) succeeds, second (condition) rejects for Goblin
      addEntry.mockImplementationOnce(() => Promise.resolve()); // ability_use for Goblin
      addEntry.mockImplementationOnce(() => Promise.reject(new Error('condition log error'))); // condition for Goblin

      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();
    });

    it('should handle multiple addEntry rejections across all targets', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);

      // Make ALL addEntry calls reject
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await expect(handle(action, ps, campaignName, null)).resolves.not.toThrow();
    });

    it('should still apply charmed and addExpiration when addEntry rejects on condition entry', async () => {
      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      getRuntimeValue.mockReturnValue([]);

      // ability_use succeeds, condition entry rejects
      addEntry.mockImplementationOnce(() => Promise.resolve());
      addEntry.mockImplementationOnce(() => Promise.reject(new Error('condition log error')));
      addEntry.mockImplementationOnce(() => Promise.reject(new Error('condition log error')));

      createSaveListener.mockReturnValue(makeFailedSaveMock());

      await handle(action, ps, campaignName, null);

      // Core logic (setRuntimeValue, addExpiration) should still execute despite addEntry rejection
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['charmed'],
        campaignName,
      );
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: [{ type: 'charmed', condition: 'charmed' }], campaignName });
    });

    it('should still apply addTargetResult when addEntry rejects on save_result entry', async () => {
      const { addTargetResult } = await import('../../common/damageRollback.js');

      const ps = makePlayerStats();
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);

      // ability_use succeeds, save_result rejects
      addEntry.mockImplementationOnce(() => Promise.resolve());
      addEntry.mockImplementationOnce(() => Promise.reject(new Error('save result error')));

      createSaveListener.mockReturnValue(makeSuccessSaveMock());

      await handle(action, ps, campaignName, null);

      expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveResult: 'success',
        roll: 0,
        total: 0,
        conditions: [],
        appliedDamage: 0,
      });
    });
  });
});
