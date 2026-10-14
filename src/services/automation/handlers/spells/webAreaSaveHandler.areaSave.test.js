import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
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
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
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
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { processWebAreaSave } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.processWebAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logService.addEntry.mockClear();
  });

  describe('early returns', () => {
    it('returns null when no tracking data', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);
      expect(result).toBeNull();
    });

    it('returns null when target is already restrained', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return ['restrained'];
        return null;
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);
      expect(result).toBeNull();
    });
  });

  describe('save processing', () => {
    it('triggers save listener with STR saveType', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-save',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'STR',
        saveDc: 15,
      });
    });

    it('applies restrained on failed STR save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-cond',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['restrained']),
        campaignName,
      );
    });

    it('returns popup with correct description', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-popup',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Web');
      expect(result.payload.description).toContain('failed');
      expect(result.payload.description).toContain('Restrained');
    });

    it('returns null when mapName provided but isWithinRange returns false', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });
      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(result).toBeNull();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });

    it('returns null when player is immune to restrained condition', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        if (key === 'computedStats') return { immunities: ['restrained'] };
        return null;
      });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'player', gridX: 6, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('does not call isWithinRange when mapName is null', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-no-map',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('skips immunity check for non-player targets', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster', gridX: 6, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-monster',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });
  });

  describe('error handling - addEntry rejection', () => {
    it('handles addEntry rejection in ability_use log gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      logService.addEntry.mockRejectedValueOnce(new Error('Log error'));

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-catch1',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in save_result failure log gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-catch2',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Save result error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in save_result success log gracefully', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-catch3',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      logService.addEntry
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Success log error'));

      const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(consoleSpy).toHaveBeenCalledWith('[webAreaSave] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('filter callback coverage - existing conditions', () => {
    it('filters out existing restrained condition before re-applying on failed save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return ['blinded'];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-filter',
        promise: Promise.resolve({ success: false, roll: 8, total: 8 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded', 'restrained'],
        campaignName,
      );
    });
  });

  describe('mapName with isWithinRange error', () => {
    it('proceeds with save when isWithinRange throws', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });
      rangeCheck.isWithinRange.mockRejectedValueOnce(new Error('Map error'));

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-map-error',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processWebAreaSave('TestCaster', 'Goblin', campaignName, 'test-map');

      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });
  });

  describe('processWebAreaSave return value', () => {
    it('returns popup with success description on successful save', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === '_web_TestCaster') return { saveDc: 15, saveType: 'STR' };
        if (key === 'activeConditions') return [];
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-pws-success-desc',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await processWebAreaSave('TestCaster', 'Goblin', campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Web');
      expect(result.payload.description).toContain('succeeded');
      expect(result.payload.description).toContain('Unaffected');
    });
  });
});
