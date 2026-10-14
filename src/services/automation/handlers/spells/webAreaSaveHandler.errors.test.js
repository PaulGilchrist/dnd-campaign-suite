import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', type: 'player' },
  ],
};

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle - error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('error handling - addEntry rejection', () => {
    it('handles addEntry rejection in ability_use log gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      logService.addEntry.mockRejectedValueOnce(new Error('Log error'));

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-catch1',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in save_result success log gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-catch2',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      logService.addEntry
        .mockRejectedValueOnce(new Error('First log error'))
        .mockRejectedValueOnce(new Error('Second log error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in condition log gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-catch3',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Condition log error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in save_result failure log gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-catch4',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      logService.addEntry
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Save result failure log error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(consoleSpy).toHaveBeenCalledWith('[web] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
