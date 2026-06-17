import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(({ targetName, saveType, saveDc }) => ({
    promptId: `prompt-${targetName}-${saveType}-${saveDc}`,
    promise: Promise.resolve({ success: false }),
  })),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, processStinkingCloudRepeatSave } from './stinkingCloudHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as logPoster from '../../../shared/logPoster.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    level: 10,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Stinking Cloud',
    automation: {
      type: 'spell',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('stinkingCloudHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrompt.buildSaveDc.mockReturnValue(13);
  });

  describe('Combat context checks', () => {
    it('should return popup when no creatures in combat', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when combat context is null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('Target filtering', () => {
    it('should skip the caster in the target list', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestWizard' },
          { name: 'EnemyGoblin' },
        ],
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saved');
    });
  });



  describe('Save - success', () => {
    it('should return popup with saved count when all targets save', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('saved');
    });

    it('should add save_result log entry on success', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-stinking-cloud',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CON',
        success: true,
        description: expect.stringContaining('succeeded on CON save'),
      });
    });
  });

  describe('Save - failure', () => {
    it('should apply poisoned condition on failed save', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Poisoned');
    });

    it('should set tracking key for repeat save', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_stinking_cloud_EnemyGoblin',
        true,
        campaignName,
      );
    });

    it('should add expiration for concentration', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestWizard',
        'EnemyGoblin',
        [{ type: 'poisoned', condition: 'poisoned' }],
        campaignName,
        10,
      );
    });

    it('should store target effect for repeated saves', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      runtimeState.getRuntimeValue
        .mockReturnValueOnce([]) // activeConditions
        .mockReturnValueOnce([]); // targetEffects
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'EnemyGoblin',
            effect: 'stinking_cloud_repeat_save',
            source: 'TestWizard',
            dc: 13,
            saveType: 'CON',
          }),
        ]),
        campaignName,
      );
    });

    it('should post log entry for poisoned condition', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'condition',
        action: 'applied',
        characterName: 'EnemyGoblin',
        condition: 'Poisoned',
        reason: 'Stinking Cloud spell',
        note: expect.stringContaining('can\'t take an Action or Bonus Action'),
        timestamp: expect.any(Number),
      });
    });

    it('should add save_result log entry on failure', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [{ name: 'EnemyGoblin' }],
      });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-stinking-cloud',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CON',
        success: false,
        description: expect.stringContaining('failed CON save'),
      });
    });
  });

  describe('Multiple targets', () => {
    it('should process all non-caster creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'EnemyGoblin' },
          { name: 'EnemyOrc' },
        ],
      });

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: `prompt-${callCount}-CON-13`,
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      runtimeState.getRuntimeValue.mockReturnValue([]);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(callCount).toBe(2);
      expect(result.type).toBe('popup');
    });
  });

  describe('processStinkingCloudRepeatSave', () => {
    it('should return null when no tracking data exists', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);

      const result = await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(result).toBeNull();
    });

    it('should return success popup when save succeeds', async () => {
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(true) // tracking
        .mockReturnValueOnce([]); // activeConditions
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('succeeded on CON save');
      expect(result.payload.description).toContain('Stinking Cloud ends');
    });



    it('should clear tracking on successful repeat save', async () => {
      runtimeState.getRuntimeValue
        .mockReturnValueOnce(true) // tracking
        .mockReturnValueOnce([]); // activeConditions
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: true }),
      });

      await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestWizard',
        '_stinking_cloud_EnemyGoblin',
        null,
        campaignName,
      );
    });

    it('should return failure popup when save fails', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('remains Poisoned');
    });

    it('should add save_result log entry on repeat save failure', async () => {
      runtimeState.getRuntimeValue.mockReturnValueOnce(true);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prompt-EnemyGoblin-CON-13',
        promise: Promise.resolve({ success: false }),
      });

      await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'save_result',
        characterName: 'TestWizard',
        rollType: 'save-stinking-cloud',
        targetName: 'EnemyGoblin',
        saveDc: 13,
        saveType: 'CON',
        success: false,
        description: expect.stringContaining('remains Poisoned'),
      });
    });
  });
});
