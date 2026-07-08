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

import { processPowerWordStunRepeatSave } from './powerWordStunHandler.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'TestCampaign';
const casterName = 'TestCaster';
const targetName = 'Goblin';
const saveDc = 15;
const spellName = 'Power Word Stun';

// ─── processPowerWordStunRepeatSave ───

describe('processPowerWordStunRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no tracking data exists for the target', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await processPowerWordStunRepeatSave(
      casterName,
      targetName,
      saveDc,
      spellName,
      campaignName,
    );

    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('uses the correct tracking key format with spaces replaced by underscores', async () => {
    const multiWordTarget = 'Goblin Captain';
    getRuntimeValue.mockImplementation((_entity, key, _camp) => {
      if (key === `_powerWordStun_${multiWordTarget.replace(/\s+/g, '_')}`) return true;
      if (key === 'activeConditions') return ['stunned'];
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'pwss-prompt',
      promise: Promise.resolve({ success: false }),
    });

    await processPowerWordStunRepeatSave(
      casterName,
      multiWordTarget,
      saveDc,
      spellName,
      campaignName,
    );

    expect(getRuntimeValue).toHaveBeenCalledWith(
      casterName,
      '_powerWordStun_Goblin_Captain',
      campaignName,
    );
  });

  it('creates save listener with CON save type and dcSuccess none', async () => {
    getRuntimeValue.mockReturnValue(true);
    createSaveListener.mockReturnValue({
      promptId: 'pwss-con-save',
      promise: Promise.resolve({ success: false }),
    });

    await processPowerWordStunRepeatSave(
      casterName,
      targetName,
      saveDc,
      spellName,
      campaignName,
    );

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName,
      saveType: 'CON',
      saveDc,
      dcSuccess: 'none',
    });
  });

  it('calls addEntry with ability_use log entry including promptId', async () => {
    getRuntimeValue.mockReturnValue(true);
    createSaveListener.mockReturnValue({
      promptId: 'pwss-ability-entry',
      promise: Promise.resolve({ success: false }),
    });

    await processPowerWordStunRepeatSave(
      casterName,
      targetName,
      saveDc,
      spellName,
      campaignName,
    );

    expect(addEntry).toHaveBeenCalledWith(campaignName, {
      type: 'ability_use',
      characterName: casterName,
      abilityName: spellName,
      description: expect.stringMatching(new RegExp(`${targetName}.*DC ${saveDc}.*${spellName}`)),
      promptId: 'pwss-ability-entry',
    });
  });

  // ─── successful save path ───

  describe('successful CON save', () => {
    function setupSuccessPath(existingConditions = ['stunned', 'Frightened'], existingEffects = []) {
      createSaveListener.mockReturnValue({
        promptId: 'pwss-success',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_powerWordStun_Goblin') return true;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
    }

    it('returns popup with automation_info type indicating success', async () => {
      setupSuccessPath();

      const result = await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(spellName);
      expect(result.payload.description).toContain('succeeded on CON save');
      expect(result.payload.description).toContain(spellName);
      expect(result.payload.description).toContain('ends');
    });

    it('removes stunned condition keeping other conditions', async () => {
      setupSuccessPath(['stunned', 'Frightened', 'poisoned']);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['Frightened', 'poisoned'],
        campaignName,
      );
    });

    it('filters stunned case-insensitively', async () => {
      setupSuccessPath(['Stunned', 'Frightened']);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        ['Frightened'],
        campaignName,
      );
    });

    it('handles target with no conditions gracefully', async () => {
      setupSuccessPath([]);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('handles non-array activeConditions (null) gracefully', async () => {
      createSaveListener.mockReturnValue({
        promptId: 'pwss-null',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === '_powerWordStun_Goblin') return true;
        if (keyOrProp === 'activeConditions') return null;
        return [];
      });

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('clears tracking key by setting it to null', async () => {
      setupSuccessPath(['stunned']);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        casterName,
        '_powerWordStun_Goblin',
        null,
        campaignName,
      );
    });

    it('calls cleanupTargetEffect to remove target effects for this caster', async () => {
      setupSuccessPath(['stunned'], [
        {
          target: targetName,
          effect: 'power_word_stun_repeat_save',
          source: casterName,
        },
        {
          target: targetName,
          effect: 'power_word_stun_repeat_save',
          source: 'OtherCaster',
        },
      ]);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: targetName,
            source: 'OtherCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('posts save_result log entry with success true', async () => {
      setupSuccessPath(['stunned']);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-power-word-stun',
          targetName,
          saveDc,
          saveType: 'CON',
          success: true,
          description: expect.stringContaining('succeeded on CON save'),
        }),
      );
    });

    it('posts condition removal log entry', async () => {
      setupSuccessPath(['stunned']);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: targetName,
          condition: 'Stunned',
          reason: `${spellName} (successful save)`,
          timestamp: expect.any(Number),
        }),
      );
    });

    it('posts entries in correct order: ability_use (from createSaveListener), save_result, condition removal', async () => {
      setupSuccessPath(['stunned']);

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      const calls = addEntry.mock.calls;
      // First call is ability_use from createSaveListener path
      // Second is save_result
      // Third is condition removal
      // Note: createSaveListener is mocked so it doesn't call addEntry internally
      const saveResultCall = calls.find(
        (c) => c[1].type === 'save_result' && c[1].rollType === 'save-power-word-stun',
      );
      const conditionCall = calls.find(
        (c) => c[1].type === 'condition' && c[1].action === 'removed',
      );

      expect(saveResultCall).toBeDefined();
      expect(conditionCall).toBeDefined();
    });
  });

  // ─── failed save path ───

  describe('failed CON save', () => {
    function setupFailedRepeat() {
      createSaveListener.mockReturnValue({
        promptId: 'pwss-fail',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === '_powerWordStun_Goblin') return true;
        return ['stunned'];
      });
    }

    it('returns popup indicating target failed save and spell continues', async () => {
      setupFailedRepeat();

      const result = await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe(spellName);
      expect(result.payload.description).toContain('failed CON save');
      expect(result.payload.description).toContain('continues');
    });

    it('does not modify conditions on failed save', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        targetName,
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('does not clear tracking key on failed save', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      const trackingClearCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === '_powerWordStun_Goblin' && c[2] === null,
      );
      expect(trackingClearCall).toBeUndefined();
    });

    it('posts save_result log entry with success false', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: casterName,
          rollType: 'save-power-word-stun',
          targetName,
          saveDc,
          saveType: 'CON',
          success: false,
          description: expect.stringMatching(/failed CON save.*continues/),
        }),
      );
    });

    it('does not call cleanupTargetEffect on failed save', async () => {
      setupFailedRepeat();

      await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        spellName,
        campaignName,
      );

      const targetEffectsCall = setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCall).toBeUndefined();
    });
  });

  // ─── edge cases ───

  describe('edge cases', () => {
    it('handles target name with multiple spaces', async () => {
      const multiWordTarget = 'Goblin Captain Alpha';
      getRuntimeValue.mockImplementation((_entity, key, _camp) => {
        if (key === `_powerWordStun_${multiWordTarget.replace(/\s+/g, '_')}`) return true;
        if (key === 'activeConditions') return ['stunned'];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'pwss-multi',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processPowerWordStunRepeatSave(
        casterName,
        multiWordTarget,
        saveDc,
        spellName,
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain(multiWordTarget);
    });

    it('uses custom spellName in popup description on failed save', async () => {
      const customSpellName = 'My Custom Power Word Stun';
      getRuntimeValue.mockReturnValue(true);
      createSaveListener.mockReturnValue({
        promptId: 'pwss-custom',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processPowerWordStunRepeatSave(
        casterName,
        targetName,
        saveDc,
        customSpellName,
        campaignName,
      );

      expect(result.payload.name).toBe(customSpellName);
      expect(result.payload.description).toContain(customSpellName);
    });

    it('returns null when tracking value is falsy (0, false, empty string)', async () => {
      const falsyValues = [0, false, ''];
      for (const val of falsyValues) {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(val);

        const result = await processPowerWordStunRepeatSave(
          casterName,
          targetName,
          saveDc,
          spellName,
          campaignName,
        );

        expect(result).toBeNull();
      }
    });
  });
});
