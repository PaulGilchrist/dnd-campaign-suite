// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

import { handle, processStinkingCloudRepeatSave } from './stinkingCloudHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

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

const singleTargetCombat = {
  creatures: [{ name: 'EnemyGoblin' }],
};

const multiTargetCombat = {
  creatures: [
    { name: 'EnemyGoblin' },
    { name: 'EnemyOrc' },
  ],
};

const casterOnlyCombat = {
  creatures: [{ name: 'TestWizard' }],
};

describe('stinkingCloudHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildSaveDc.mockReturnValue(13);
  });

  describe('handle', () => {
    describe('combat context validation', () => {
      it('should return popup when no creatures in combat', async () => {
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Stinking Cloud');
        expect(result.payload.description).toContain('No creatures in combat');
        expect(result.payload.description).toContain('has no effect');
      });

      it('should return popup when creatures array is empty', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No creatures in combat');
      });
    });

    describe('target filtering', () => {
      it('should skip the caster when filtering targets', async () => {
        getCombatContext.mockResolvedValue(casterOnlyCombat);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(createSaveListener).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('No creatures affected');
      });

      it('should process only non-caster creatures', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [
            { name: 'TestWizard' },
            { name: 'EnemyGoblin' },
          ],
        });
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: true }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(createSaveListener).toHaveBeenCalledTimes(1);
        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
          targetName: 'EnemyGoblin',
          saveType: 'CON',
          saveDc: 13,
          dcSuccess: 'none',
        });
      });
    });

    describe('save success', () => {
      it('should call createSaveListener with CON save config', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: true }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
          targetName: 'EnemyGoblin',
          saveType: 'CON',
          saveDc: 13,
          dcSuccess: 'none',
        });
      });

      it('should log ability_use and save_result for the caster', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: true }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'ability_use',
          characterName: 'TestWizard',
          abilityName: 'Stinking Cloud',
          description: expect.stringContaining('casts Stinking Cloud'),
          promptId: 'goblin-prompt',
        });
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
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

      it('should include saved count in popup description', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: true }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('1 creature(s) saved');
        expect(result.payload.description).toContain('No creatures affected');
      });
    });

    describe('save failure', () => {
      it('should set activeConditions with poisoned on failed save', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'EnemyGoblin',
          'activeConditions',
          ['poisoned'],
          campaignName,
        );
      });

      it('should deduplicate poisoned when target already has it', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        getRuntimeValue.mockReturnValue(['poisoned', 'stunned']);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'EnemyGoblin',
          'activeConditions',
          ['stunned', 'poisoned'],
          campaignName,
        );
      });

      it('should set tracking key and add expiration for concentration', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestWizard',
          '_stinking_cloud_EnemyGoblin',
          true,
          campaignName,
        );
        expect(addExpiration).toHaveBeenCalledWith(
          'TestWizard',
          'EnemyGoblin',
          [{ type: 'poisoned', condition: 'poisoned' }],
          campaignName,
        );
      });

      it('should store target effect for repeated saves', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        getRuntimeValue
          .mockReturnValueOnce([]) // activeConditions
          .mockReturnValueOnce([]); // targetEffects
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          campaignName,
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({
              target: 'EnemyGoblin',
              effect: 'stinking_cloud_repeat_save',
              source: 'TestWizard',
              dc: 13,
              saveType: 'CON',
              condition: 'poisoned',
              duration: 'concentration',
            }),
          ]),
          campaignName,
        );
      });

      it('should update existing target effect instead of duplicating', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        getRuntimeValue
          .mockReturnValueOnce([]) // activeConditions
          .mockReturnValueOnce([
            {
              target: 'EnemyGoblin',
              effect: 'stinking_cloud_repeat_save',
              source: 'TestWizard',
              dc: 10,
              saveType: 'CON',
            },
          ]);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
          campaignName,
          'targetEffects',
          expect.arrayContaining([
            expect.objectContaining({
              dc: 13,
            }),
          ]),
          campaignName,
        );
      });

      it('should include poisoned description and repeat save instructions in popup', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('Poisoned');
        expect(result.payload.description).toContain('1 creature(s)');
        expect(result.payload.description).toContain('end of their current turn');
        expect(result.payload.description).toContain('repeat the save');
      });
    });

    describe('poison immunity', () => {
      it('should skip targets with poison immunity (case-insensitive)', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        const immuneStats = makePlayerStats({
          immunities: ['poison'],
        });

        const result = await handle(makeAction(), immuneStats, campaignName, null);

        expect(createSaveListener).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('No creatures affected');
      });

      it('should not process any targets when caster is immune', async () => {
        getCombatContext.mockResolvedValue(multiTargetCombat);

        const immuneStats = makePlayerStats({
          immunities: ['poison'],
        });

        await handle(makeAction(), immuneStats, campaignName, null);

        expect(createSaveListener).not.toHaveBeenCalled();
      });
    });

    describe('multiple targets', () => {
      it('should process all non-caster creatures', async () => {
        getCombatContext.mockResolvedValue(multiTargetCombat);

        let callCount = 0;
        createSaveListener.mockImplementation(() => {
          callCount++;
          return {
            promptId: `goblin-prompt-${callCount}`,
            promise: Promise.resolve({ success: callCount === 1 }),
          };
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(createSaveListener).toHaveBeenCalledTimes(2);
        expect(result.type).toBe('popup');
      });

      it('should report mixed save results correctly', async () => {
        getCombatContext.mockResolvedValue(multiTargetCombat);

        let callCount = 0;
        createSaveListener.mockImplementation(() => {
          callCount++;
          return {
            promptId: `goblin-prompt-${callCount}`,
            promise: Promise.resolve({ success: callCount === 1 }),
          };
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('1 creature(s)');
        expect(result.payload.description).toContain('1 creature(s) saved');
      });

      it('should report all targets affected when all fail saves', async () => {
        getCombatContext.mockResolvedValue(multiTargetCombat);
        getRuntimeValue.mockReturnValue([]);
        createSaveListener.mockReturnValue({
          promptId: 'multi-prompt',
          promise: Promise.resolve({ success: false }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('2 creature(s)');
        expect(result.payload.description).toContain('Poisoned');
      });

      it('should report all targets saving', async () => {
        getCombatContext.mockResolvedValue(multiTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'multi-prompt',
          promise: Promise.resolve({ success: true }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('2 creature(s) saved');
        expect(result.payload.description).toContain('No creatures affected');
      });
    });

    describe('popup payload structure', () => {
      it('should return popup type with automation_info payload', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Stinking Cloud');
      });

      it('should use action.name in the popup', async () => {
        getCombatContext.mockResolvedValue(singleTargetCombat);
        createSaveListener.mockReturnValue({
          promptId: 'goblin-prompt',
          promise: Promise.resolve({ success: false }),
        });

        const customAction = { name: 'Custom Cloud', automation: { type: 'spell' } };
        const result = await handle(customAction, makePlayerStats(), campaignName, null);

        expect(result.payload.name).toBe('Custom Cloud');
      });
    });
  });

  describe('processStinkingCloudRepeatSave', () => {
    it('should return null when no tracking data exists', async () => {
      getRuntimeValue.mockReturnValue(null);

      const result = await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(result).toBeNull();
    });

    it('should call createSaveListener with CON save config', async () => {
      getRuntimeValue.mockReturnValue(true);
      createSaveListener.mockReturnValue({
        promptId: 'repeat-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'EnemyGoblin',
        saveType: 'CON',
        saveDc: 13,
        dcSuccess: 'none',
      });
    });

    it('should log ability_use for repeat save', async () => {
      getRuntimeValue.mockReturnValue(true);
      createSaveListener.mockReturnValue({
        promptId: 'repeat-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await processStinkingCloudRepeatSave(
        'TestWizard',
        'EnemyGoblin',
        13,
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestWizard',
        abilityName: 'Stinking Cloud (repeat save)',
        description: expect.stringContaining('CON save'),
        promptId: 'repeat-prompt',
      });
    });

    describe('repeat save success', () => {
      it('should return popup with success message', async () => {
        getRuntimeValue
          .mockReturnValueOnce(true) // tracking
          .mockReturnValueOnce([]); // activeConditions
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: true }),
        });

        const result = await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('succeeded on CON save');
        expect(result.payload.description).toContain('Stinking Cloud ends');
      });

      it('should clear activeConditions and tracking key on success', async () => {
        getRuntimeValue
          .mockReturnValueOnce(true) // tracking
          .mockReturnValueOnce(['poisoned', 'stunned']); // activeConditions
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: true }),
        });

        await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'EnemyGoblin',
          'activeConditions',
          ['stunned'],
          campaignName,
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'TestWizard',
          '_stinking_cloud_EnemyGoblin',
          null,
          campaignName,
        );
      });

      it('should call addEntry with condition removed and log save_result', async () => {
        getRuntimeValue
          .mockReturnValueOnce(true) // tracking
          .mockReturnValueOnce([]); // activeConditions
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: true }),
        });

        await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'condition',
          action: 'removed',
          characterName: 'EnemyGoblin',
          condition: 'Poisoned',
          reason: 'Stinking Cloud (successful repeat save)',
          timestamp: expect.any(Number),
        });
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'save_result',
          characterName: 'TestWizard',
          rollType: 'save-stinking-cloud',
          targetName: 'EnemyGoblin',
          saveDc: 13,
          saveType: 'CON',
          success: true,
          description: expect.stringContaining('Stinking Cloud ends'),
        });
      });

      it('should handle falsy or non-array activeConditions gracefully', async () => {
        getRuntimeValue
          .mockReturnValueOnce(true) // tracking
          .mockReturnValueOnce(null); // activeConditions is null
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: true }),
        });

        const result = await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'EnemyGoblin',
          'activeConditions',
          [],
          campaignName,
        );
      });
    });

    describe('repeat save failure', () => {
      it('should return popup with failure message', async () => {
        getRuntimeValue.mockReturnValueOnce(true);
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: false }),
        });

        const result = await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('remains Poisoned');
      });

      it('should not clear tracking or modify conditions on failed save', async () => {
        getRuntimeValue.mockReturnValueOnce(true);
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'TestWizard',
          '_stinking_cloud_EnemyGoblin',
          null,
          campaignName,
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
          'EnemyGoblin',
          'activeConditions',
          expect.any(Array),
          campaignName,
        );
      });

      it('should log save_result on failure and not post condition log', async () => {
        getRuntimeValue.mockReturnValueOnce(true);
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: false }),
        });

        await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
          type: 'save_result',
          characterName: 'TestWizard',
          rollType: 'save-stinking-cloud',
          targetName: 'EnemyGoblin',
          saveDc: 13,
          saveType: 'CON',
          success: false,
          description: expect.stringContaining('remains Poisoned'),
        });
        expect(addEntry).toHaveBeenCalledTimes(2);
        const abilityEntries = addEntry.mock.calls.filter(call => call[1].type === 'ability_use');
        expect(abilityEntries.length).toBe(1);
        const saveEntries = addEntry.mock.calls.filter(call => call[1].type === 'save_result');
        expect(saveEntries.length).toBe(1);
      });

      it('should call cleanupTargetEffect on repeat save success', async () => {
        getRuntimeValue
          .mockReturnValueOnce(true) // tracking
          .mockReturnValueOnce(['poisoned']); // activeConditions
        createSaveListener.mockReturnValue({
          promptId: 'repeat-prompt',
          promise: Promise.resolve({ success: true }),
        });

        await processStinkingCloudRepeatSave(
          'TestWizard',
          'EnemyGoblin',
          13,
          campaignName,
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
          campaignName,
          'targetEffects',
          expect.not.arrayContaining([
            expect.objectContaining({
              target: 'EnemyGoblin',
              effect: 'stinking_cloud_repeat_save',
              source: 'TestWizard',
            }),
          ]),
          campaignName,
        );
      });
    });
  });
});
