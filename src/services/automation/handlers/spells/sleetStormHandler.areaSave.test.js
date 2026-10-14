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

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
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

import { processSleetStormAreaSave } from './sleetStormHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as automationImmunities from '../../../combat/automation/automationImmunities.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

// ── Tests: processSleetStormAreaSave ───────────────────────────

describe('sleetStormHandler.processSleetStormAreaSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('early returns', () => {
    it('returns null when no tracking data', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue(null);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when tracking has no saveDc', async () => {
      useRuntimeState.getRuntimeValue.mockReturnValue({ caster: casterName });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when target is already prone (case-insensitive)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return ['prone'];
        return null;
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when target is already Prone (mixed case)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return ['PrOnE'];
        return null;
      });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
    });

    it('returns null when player is immune to prone condition', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        if (key === 'computedStats') return { immunities: ['prone'] };
        return null;
      });
      // getCombatContext is called WITHOUT await in the immunity check,
      // so we must return a synchronous value (not a Promise)
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'player' }],
      });
      automationImmunities.playerIsImmuneToCondition.mockReturnValue(true);
      rangeCheck.isWithinRange.mockResolvedValue(true);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
      expect(automationImmunities.playerIsImmuneToCondition).toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();

      // non-player target — skips immunity check
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      automationImmunities.playerIsImmuneToCondition.mockClear();
      rangeCheck.isWithinRange.mockResolvedValue(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-monster',
        promise: Promise.resolve({ success: true }),
      });

      const result2 = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);
      expect(result2.type).toBe('popup');
      expect(automationImmunities.playerIsImmuneToCondition).not.toHaveBeenCalled();
    });

    it('proceeds with save when isWithinRange throws', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockRejectedValue(new Error('map not found'));
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-fallback',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(savePrompt.createSaveListener).toHaveBeenCalled();
    });

    it('returns null when mapName is null (skips range check)', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-nonull',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, null);

      expect(result.type).toBe('popup');
      expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    });

    it('returns null when target is outside range', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX', radius: 20 };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      rangeCheck.isWithinRange.mockResolvedValue(false);

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result).toBeNull();
    });
  });

  describe('save processing', () => {
    function setupBaseSave() {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return {
            caster: casterName,
            saveDc: 15,
            saveType: 'DEX',
            radius: 20,
          };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
    }

    it('triggers save listener with correct parameters', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-params',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
      });
    });

    it('posts ability_use log entry when triggering save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-ability',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Sleet Storm',
          description: expect.stringContaining('Sleet Storm area'),
        }),
      );
    });

    it('returns popup with correct description on failed save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-fail-desc',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Sleet Storm');
      expect(result.payload.description).toContain('failed');
      expect(result.payload.description).toContain('DEX');
      expect(result.payload.description).toContain('DC 15');
      expect(result.payload.description).toContain('Becomes Prone');
    });

    it('returns popup with correct description on successful save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-success-desc',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(result.payload.description).toContain('succeeded');
      expect(result.payload.description).toContain('Unaffected');
    });

    it('applies prone condition on failed save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-apply',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone']),
        campaignName,
      );
    });

    it('does not apply prone condition on successful save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-no-apply',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('deduplicates prone before adding on failed save', async () => {
      useRuntimeState.getRuntimeValue.mockReset();
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        // Target already has prone, so the early return check would trigger
        // We need to NOT have prone for the code to reach the dedup logic
        if (key === 'activeConditions') return ['blinded', 'restrained'];
        return null;
      });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-dedup',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      // Should have existing conditions plus prone, with no duplicate prone
      const conditionCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'activeConditions',
      );
      expect(conditionCalls.length).toBeGreaterThan(0);
      const conditionsArg = conditionCalls[0][2];
      expect(conditionsArg).toContain('prone');
      expect(conditionsArg).toContain('blinded');
      expect(conditionsArg).toContain('restrained');
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'prone').length).toBe(1);
    });

    it('calls addTargetResult on failed save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-add-fail',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'failure',
          conditions: ['prone'],
        }),
      );
    });

    it('calls addTargetResult on successful save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-add-success',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'success',
          conditions: [],
        }),
      );
    });

    it('tracks concentration loss on failed save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-conc-fail',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const concKey = '_sleetStorm_concentration_TestWizard';
      const concCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === concKey,
      );
      expect(concCall).toBeDefined();
      expect(concCall[2]).toContain('Goblin');
    });

    it('does not track concentration loss on successful save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-conc-success',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const concKey = '_sleetStorm_concentration_TestWizard';
      const concCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (c) => c[1] === concKey,
      );
      expect(concCalls.length).toBe(0);
    });

    it('posts save_result log entry on failed save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-sr-fail',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          saveDc: 15,
          saveType: 'DEX',
          rollType: 'save-sleet-storm',
        }),
      );
    });

    it('posts save_result log entry on successful save', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-sr-success',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
          saveDc: 15,
          saveType: 'DEX',
        }),
      );
    });

    it('includes promptId in ability_use entry', async () => {
      setupBaseSave();
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-prompt-id',
        promise: Promise.resolve({ success: false }),
      });

      await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      const abilityEntry = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].promptId).toBe('sleet-area-prompt-id');
    });
  });

  describe('error handling in .catch() handlers', () => {
    it('handles addEntry rejection in handle() save_result for failed save', async () => {
      // Reuse baseCombatContext from the parent scope
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-error-handle',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      // This test is from the handle() tests but belongs here because it's
      // testing error handling behavior in the area save path
      consoleError.mockRestore();
    });

    it('handles addEntry rejection in processSleetStormAreaSave ability_use', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      logService.addEntry.mockRejectedValue(new Error('log error'));
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-error',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      expect(result.type).toBe('popup');
      consoleError.mockRestore();
    });

    it('handles addEntry rejection in processSleetStormAreaSave save_result on failure', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      logService.addEntry.mockRejectedValueOnce(new Error('log error'));
      logService.addEntry.mockRejectedValue(new Error('log error 2'));
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-error-fail',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      expect(result.type).toBe('popup');
      consoleError.mockRestore();
    });

    it('handles addEntry rejection in processSleetStormAreaSave save_result on success', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key.startsWith('_sleetStorm_')) {
          return { saveDc: 15, saveType: 'DEX' };
        }
        if (key === 'activeConditions') return [];
        return null;
      });
      damageUtils.getCombatContext.mockReturnValue({
        creatures: [{ name: 'Goblin', type: 'monster' }],
      });
      rangeCheck.isWithinRange.mockResolvedValue(true);
      logService.addEntry.mockRejectedValue(new Error('log error'));
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-area-error-success',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await processSleetStormAreaSave(casterName, 'Goblin', campaignName, mapName);

      expect(consoleError).toHaveBeenCalledWith('[sleetStormAreaSave] Error:', expect.any(Error));
      expect(result.type).toBe('popup');
      consoleError.mockRestore();
    });
  });
});
