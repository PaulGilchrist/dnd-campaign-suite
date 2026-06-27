// @improved-by-ai
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

vi.mock('../../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { processPowerWordStunRepeatSave, handle } from './powerWordStunHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { postLogEntry } from '../../../shared/logPoster.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Power Word Stun',
    automation: { type: 'power_word_stun', saveDc: 15, ...automation },
  };
}

// ─── processPowerWordStunRepeatSave ───

describe('processPowerWordStunRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when no tracking exists', () => {
    it('should return null', async () => {
      getRuntimeValue.mockReturnValue(null);
      const result = await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );
      expect(result).toBeNull();
      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('when tracking exists and save succeeds', () => {
    function setupSuccessPath(existingConditions = ['Stunned', 'Frightened'], existingEffects = []) {
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === '_powerWordStun_Goblin') return true;
        if (key === 'activeConditions') return existingConditions;
        if (key === 'targetEffects') return existingEffects;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('should remove the Stunned condition keeping others', async () => {
      setupSuccessPath(['Stunned', 'Frightened']);

      const result = await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['Frightened'],
        campaignName,
      );
      expect(result.payload.description).toContain('succeeded on CON save');
    });

    it('should clear tracking for the caster', async () => {
      setupSuccessPath(['Stunned']);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_powerWordStun_Goblin',
        null,
        campaignName,
      );
    });

    it('should clean up the target effect for this caster', async () => {
      setupSuccessPath(['Stunned'], [
        { target: targetName, effect: 'power_word_stun_repeat_save', source: casterName },
        { target: 'Other', effect: 'power_word_stun_repeat_save', source: 'OtherCaster' },
      ]);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({ target: 'Other', source: 'OtherCaster' }),
        ]),
        campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ source: casterName }),
        ]),
        campaignName,
      );
    });

    it('should log the condition removal', async () => {
      setupSuccessPath(['Stunned']);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: targetName,
          condition: 'Stunned',
          reason: 'Power Word Stun (successful save)',
        }),
      );
    });

    it('should return a popup indicating the spell ends', async () => {
      setupSuccessPath(['Stunned']);

      const result = await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('Power Word Stun ends');
    });

    it('should call addEntry with save_result on success', async () => {
      setupSuccessPath(['Stunned']);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-power-word-stun',
          targetName,
          saveDc: 15,
          saveType: 'CON',
          success: true,
        }),
      );
    });

    it('should call addEntry with ability_use for the repeat save prompt', async () => {
      setupSuccessPath(['Stunned']);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Power Word Stun',
          description: expect.stringContaining('makes a CON save'),
          promptId: 'pws-repeat-success',
        }),
      );
    });

    it('should handle non-array activeConditions gracefully', async () => {
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === '_powerWordStun_Goblin') return true;
        if (key === 'activeConditions') return null;
        if (key === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-non-array',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('should not remove unrelated conditions', async () => {
      setupSuccessPath(['Stunned', 'Frightened', 'poisoned']);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      const condCall = setRuntimeValue.mock.calls.find(
        call => call[0] === targetName && call[1] === 'activeConditions'
      );
      expect(condCall[2]).toContain('Frightened');
      expect(condCall[2]).toContain('poisoned');
    });

    it('should use correct spell name in log entries', async () => {
      setupSuccessPath(['Stunned']);

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'My Custom Spell', campaignName,
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          reason: 'My Custom Spell (successful save)',
        }),
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          description: expect.stringContaining('My Custom Spell ends'),
        }),
      );
    });
  });

  describe('when tracking exists and save fails', () => {
    function setupFailedRepeat() {
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should return a popup indicating the spell continues', async () => {
      setupFailedRepeat();

      const result = await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('failed CON save');
      expect(result.payload.description).toContain('continues');
    });

    it('should call addEntry with save_result on failed save', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-power-word-stun',
          targetName,
          saveDc: 15,
          saveType: 'CON',
          success: false,
        }),
      );
    });

    it('should not modify conditions on failed save', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('should not clear tracking on failed save', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        casterName,
        '_powerWordStun_Goblin',
        null,
        campaignName,
      );
    });

    it('should not clean up target effect on failed save', async () => {
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === '_powerWordStun_Goblin') return true;
        if (key === 'targetEffects') return [
          { target: targetName, effect: 'power_word_stun_repeat_save', source: casterName },
        ];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-no-clean',
        promise: Promise.resolve({ success: false }),
      });

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      const effectsCalls = setRuntimeValue.mock.calls.filter(call => call[1] === 'targetEffects');
      expect(effectsCalls.length).toBe(0);
    });

    it('should call addEntry with ability_use for the repeat save prompt', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          description: expect.stringContaining('makes a CON save'),
          promptId: 'pws-repeat-fail',
        }),
      );
    });
  });

  describe('save listener configuration', () => {
    it('should create a save listener with CON save type', async () => {
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-listener-config',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave(
        casterName, targetName, 15, 'Power Word Stun', campaignName,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });

    it('should use the provided DC in the save listener', async () => {
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === '_powerWordStun_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pws-dc-config',
        promise: Promise.resolve({ success: true }),
      });

      await processPowerWordStunRepeatSave(
        casterName, targetName, 18, 'Power Word Stun', campaignName,
      );

      expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 18,
        dcSuccess: 'none',
      });
    });
  });
});

// ─── handle - repeat save delegation ───

describe('powerWordStunHandler.handle - repeat save delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate to processPowerWordStunRepeatSave when tracking exists', async () => {
    const combatContext = {
      creatures: [
        { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(combatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'pws-delegate',
      promise: Promise.resolve({ success: false }),
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('failed CON save');
    expect(result.payload.description).toContain('continues');
  });

  it('should not apply conditions when tracking exists (delegates to repeat save)', async () => {
    const combatContext = {
      creatures: [
        { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(combatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'pws-no-apply',
      promise: Promise.resolve({ success: false }),
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    // Should NOT apply stunned condition via the initial cast path
    const stunCall = setRuntimeValue.mock.calls.find(
      call => call[0] === targetName && call[1] === 'activeConditions'
    );
    expect(stunCall).toBeUndefined();
  });

  it('should use the DC from buildSaveDc when delegating to repeat save', async () => {
    const combatContext = {
      creatures: [
        { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(combatContext);
    buildSaveDc.mockReturnValue(20);
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'pws-dc-delegate',
      promise: Promise.resolve({ success: true }),
    });

    await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 20,
      dcSuccess: 'none',
    });
  });

  it('should pass the action name to processPowerWordStunRepeatSave', async () => {
    const combatContext = {
      creatures: [
        { name: targetName, type: 'monster', currentHp: 5, maxHp: 7 },
        { name: casterName, gridX: 5, gridY: 10 },
      ],
      players: [{ name: casterName, gridX: 5, gridY: 10 }],
      placedItems: [],
    };
    getCombatContext.mockResolvedValue(combatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: targetName } });
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === '_powerWordStun_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'pws-name',
      promise: Promise.resolve({ success: true }),
    });

    const customAction = { name: 'My Power Word Stun', automation: { type: 'power_word_stun', saveDc: 15 } };
    await handle(customAction, makePlayerStats(), campaignName, null);

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        abilityName: 'My Power Word Stun',
      }),
    );
  });
});
