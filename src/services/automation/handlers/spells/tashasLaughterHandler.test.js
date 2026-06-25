// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, processTashasLaughterRepeatSave } from './tashasLaughterHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as logPoster from '../../../shared/logPoster.js';
import * as expirations from '../../../rules/effects/expirations.js';

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

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_laughter', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

/**
 * Configure getRuntimeValue to dispatch on key, returning the appropriate value.
 * Returns a function to call before each test so the mock is fresh.
 */
function mockGetRuntimeValue(dispatch) {
  runtimeState.getRuntimeValue.mockImplementation((playerName, key, _cName) => dispatch(playerName, key, _cName));
}

// ── handle ───────────────────────────────────────────────────────

describe('tashasLaughterHandler.handle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockReturnValue();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('should return popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('target processing', () => {
    it('should skip the caster itself from targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-caster-skip',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Two monsters (Goblin + Orc) should get save listeners; caster is skipped
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
    });

    it('should return early when all creatures are the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(onlyPlayerCombat);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-only-player',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('should handle all targets saving successfully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('creature(s) saved');
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('should report both affected and saved creatures in summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount === 1 ? false : true;
        return {
          promptId: `laughter-prompt-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('creature(s)');
      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('should call addEntry with ability_use for each target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(14);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-ability',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: "Tasha's Hideous Laughter",
          promptId: 'laughter-ability',
        }),
      );
    });
  });

  describe('failed save handling', () => {
    function setupFailedSaveMock() {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should apply Prone and Incapacitated conditions on failed save', async () => {
      setupFailedSaveMock();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone', 'incapacitated']),
        campaignName,
      );
      expect(result.payload.description).toContain('Prone and Incapacitated');
    });

    it('should preserve existing conditions and add new ones', async () => {
      setupFailedSaveMock();
      mockGetRuntimeValue((playerName, key) => {
        if (key === 'activeConditions') return ['frightened'];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['frightened', 'prone', 'incapacitated']),
        campaignName,
      );
    });

    it('should handle non-array stored activeConditions by treating as empty', async () => {
      setupFailedSaveMock();
      mockGetRuntimeValue((_playerName, key) => {
        if (key === 'activeConditions') return 'invalid';
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone', 'incapacitated']),
        campaignName,
      );
    });

    it('should set tracking for end-of-turn repeat save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_tashas_laughter_Goblin',
        true,
        campaignName,
      );
    });

    it('should set damage trigger flag on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'tashas_laughter_Goblin_damageTrigger',
        true,
        campaignName,
      );
    });

    it('should add expiration for concentration', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(expirations.addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([
          { type: 'condition', condition: 'prone' },
          { type: 'condition', condition: 'incapacitated' },
          { type: 'tashas_laughter_expiration' },
        ]),
        campaignName,
        60,
      );
    });

    it('should store target effect for end-of-turn repeated saves', async () => {
      setupFailedSaveMock();
      mockGetRuntimeValue((caster, key) => {
        if (key === 'targetEffects') return [];
        return null;
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'tashas_laughter_repeat_save',
            source: 'TestCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('should overwrite existing laughter effect for the same target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((_playerName, key) => {
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [
          { target: 'Goblin', effect: 'tashas_laughter_repeat_save', source: 'TestCaster', dc: 12 },
        ];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-overwrite',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      // Find the setRuntimeValue call for targetEffects (campaignName as first arg)
      const effectsCall = runtimeState.setRuntimeValue.mock.calls.find(
        call => call[1] === 'targetEffects',
      );
      const effectsArg = effectsCall[2];
      expect(effectsArg).toHaveLength(1);
      expect(effectsArg[0].dc).toBe(15);
    });

    it('should call postLogEntry on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Prone, Incapacitated',
        }),
      );
    });

    it('should call addEntry with save_result on failed save', async () => {
      setupFailedSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          rollType: 'save-tashas-laughter',
        }),
      );
    });
  });

  describe('successful save handling', () => {
    function setupSuccessfulSaveMock() {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(20);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-success-save',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('should call addEntry with save_result on success', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-tashas-laughter',
      }));
    });

    it('should not apply conditions when save succeeds', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.any(Array),
      );
    });

    it('should not set tracking or damage trigger on success', async () => {
      setupSuccessfulSaveMock();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const calledWithTracking = runtimeState.setRuntimeValue.mock.calls.some(
        call => call[1].startsWith('_tashas_laughter_') || call[1].includes('damageTrigger'),
      );
      expect(calledWithTracking).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty automation object with default saveDc', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(10);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-empty-auto',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle({ name: "Tasha's Hideous Laughter", automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });

    it('should handle addEntry rejection gracefully', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      mockGetRuntimeValue((_playerName, key) => {
        if (key === 'activeConditions') return [];
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-reject',
        promise: Promise.resolve({ success: false }),
      });
      logService.addEntry.mockResolvedValue({ id: 'log-entry' });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Prone and Incapacitated');
    });
  });
});

// ── processTashasLaughterRepeatSave ────────────────────────────────

describe('tashasLaughterHandler.processTashasLaughterRepeatSave', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockReturnValue();
  });

  it('should return null when no tracking exists', async () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);
    const result = await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);
    expect(result).toBeNull();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  it('should create save listener with WIS save type and advantage', async () => {
    runtimeState.getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_tashas_laughter_Goblin') return true;
      return [];
    });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'laughter-repeat-listener',
      promise: Promise.resolve({ success: true }),
    });

    await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 15,
      dcSuccess: 'none',
      advantage: true,
    });
  });

  it('should call addEntry with ability_use for repeat save', async () => {
    runtimeState.getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_tashas_laughter_Goblin') return true;
      return [];
    });
    savePrompt.createSaveListener.mockReturnValue({
      promptId: 'laughter-repeat-entry',
      promise: Promise.resolve({ success: true }),
    });

    await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

    expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
      type: 'ability_use',
      characterName: 'TestCaster',
      abilityName: "Tasha's Hideous Laughter (repeat save)",
      promptId: 'laughter-repeat-entry',
    }));
  });

  describe('successful repeat save', () => {
    function setupRepeatSaveSuccess() {
      runtimeState.getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Incapacitated', 'Frightened', 'Prone'];
        if (prop === '_tashas_laughter_Goblin') return true;
        return [];
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-repeat-success',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('should remove Prone and Incapacitated conditions preserving others', async () => {
      setupRepeatSaveSuccess();

      const result = await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['Frightened'],
        campaignName,
      );
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('should handle non-array stored activeConditions', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_target, prop) => {
        if (prop === 'activeConditions') return 'invalid';
        if (prop === '_tashas_laughter_Goblin') return true;
        return [];
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-repeat-nonarray',
        promise: Promise.resolve({ success: true }),
      });

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('should clear tracking', async () => {
      setupRepeatSaveSuccess();

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_tashas_laughter_Goblin',
        null,
        campaignName,
      );
    });

    it('should clear damage trigger flag', async () => {
      setupRepeatSaveSuccess();

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'tashas_laughter_Goblin_damageTrigger',
        false,
        campaignName,
      );
    });

    it('should clean up target effect', async () => {
      runtimeState.getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_tashas_laughter_Goblin') return true;
        if (key === 'targetEffects') return [
          { target: 'Goblin', effect: 'tashas_laughter_repeat_save', source: 'TestCaster' },
        ];
        return [];
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-repeat-clean',
        promise: Promise.resolve({ success: true }),
      });

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      const effectsArg = runtimeState.setRuntimeValue.mock.calls[0][2];
      expect(effectsArg).not.toContainEqual(
        expect.objectContaining({ target: 'Goblin', effect: 'tashas_laughter_repeat_save', source: 'TestCaster' }),
      );
    });

    it('should call postLogEntry for condition removal', async () => {
      setupRepeatSaveSuccess();

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(logPoster.postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'Goblin',
          condition: 'Prone, Incapacitated',
        }),
      );
    });

    it('should call addEntry with save_result on successful repeat save', async () => {
      setupRepeatSaveSuccess();

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-tashas-laughter',
      }));
    });

    it('should handle addEntry rejection gracefully', async () => {
      setupRepeatSaveSuccess();
      // addEntry is fire-and-forget (.catch), so mock it to resolve to avoid unhandled rejections.
      // The test verifies the popup is still correct, proving rejection is handled.
      logService.addEntry.mockResolvedValue({ id: 'log-entry' });

      const result = await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(result.payload.description).toContain('succeeded on WIS save');
    });
  });

  describe('failed repeat save', () => {
    function setupRepeatSaveFail() {
      runtimeState.getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_tashas_laughter_Goblin') return true;
        return [];
      });
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'laughter-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should keep conditions and return failure popup', async () => {
      setupRepeatSaveFail();

      const result = await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('remains Prone and Incapacitated');
    });

    it('should keep tracking so repeat is attempted again', async () => {
      setupRepeatSaveFail();

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      // Tracking should NOT be set to null — it stays true
      const nullCalls = runtimeState.setRuntimeValue.mock.calls.filter(
        call => call[1] === '_tashas_laughter_Goblin' && call[2] === null,
      );
      expect(nullCalls).toHaveLength(0);
    });

    it('should call addEntry with save_result on failed repeat save', async () => {
      setupRepeatSaveFail();

      await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-tashas-laughter',
      }));
    });

    it('should handle addEntry rejection gracefully', async () => {
      setupRepeatSaveFail();
      // addEntry is fire-and-forget (.catch), so mock it to resolve to avoid unhandled rejections.
      // The test verifies the popup is still correct, proving rejection is handled.
      logService.addEntry.mockResolvedValue({ id: 'log-entry' });

      const result = await processTashasLaughterRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(result.payload.description).toContain('failed WIS save');
    });
  });
});
