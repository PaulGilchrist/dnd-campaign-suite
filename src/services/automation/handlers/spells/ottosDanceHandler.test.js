// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  handle,
  processOttoDanceRepeatSave,
  processOttoDanceSuccessSave,
} from './ottosDanceHandler.js';

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

import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { resolveTarget } from '../../common/targetResolver.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

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
    name: "Otto's Irresistible Dance",
    automation: { type: 'ottos_dance', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

/**
 * Shared beforeEach for all tests: clear all mocked module state.
 */
beforeEach(() => {
  vi.clearAllMocks();
});

describe('ottosDanceHandler.handle', () => {
  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when creatures property is missing', async () => {
      getCombatContext.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should not create save listener when combat context is null', async () => {
      getCombatContext.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('should not create save listener when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('should not create save listener when no target selected', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
    });
  });

  describe('target resolution', () => {
    it('should return popup when no target selected', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });

    it('should call resolveTarget with campaignName and casterName', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'otto-prompt',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(resolveTarget).toHaveBeenCalledWith(campaignName, 'TestCaster');
    });

    it('should return popup when target has no name', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({});

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No target selected');
    });
  });

  describe('repeat save detection', () => {
    it('should delegate to processOttoDanceRepeatSave when tracking exists', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_ottosDance_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Goblin failed WIS save');
    });
  });

  describe('initial cast - successful save', () => {
    function setupSuccessfulSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_ottosDance_Goblin') return null;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-success-save',
        promise: Promise.resolve({ success: true }),
      });
    }

    it('should return popup describing target dancing when save succeeds', async () => {
      setupSuccessfulSave();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('dances comically');
    });

    it('should call postLogEntry with condition applied on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          condition: 'Speed 0',
        }),
      );
    });

    it('should set tracking key on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCaster',
        '_ottosDance_Goblin',
        true,
        campaignName,
      );
    });

    it('should add expiration for speed_zero on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'speed_zero', condition: 'speed_zero' }]),
        campaignName,
        1,
      );
    });

    it('should not store target effects on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBe(0);
    });

    it('should call addEntry with ability_use on initial cast', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: "Otto's Irresistible Dance",
        }),
      );
    });

    it('should not call addEntry with save_result on successful save', async () => {
      setupSuccessfulSave();

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const saveResultCalls = addEntry.mock.calls.filter(
        (c) => c[1] && c[1].type === 'save_result',
      );
      expect(saveResultCalls.length).toBe(0);
    });
  });

  describe('initial cast - failed save', () => {
    function setupFailedSave(existingConditions = [], existingEffects = []) {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key, _camp) => {
        if (key === '_ottosDance_Goblin') return null;
        if (key === 'activeConditions') return existingConditions;
        if (key === 'targetEffects') return existingEffects;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should apply charmed and speed_zero conditions on failed save', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Charmed');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should set tracking for repeat saves on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_ottosDance_Goblin',
        true,
        campaignName,
      );
    });

    it('should add expiration for charmed and speed_zero conditions', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.any(Array),
        campaignName,
        10,
      );
    });

    it('should store target effect for repeat saves', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'ottos_dance_repeat_save',
            source: 'TestCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('should call postLogEntry on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Charmed, Speed 0',
        }),
      );
    });

    it('should call addEntry with save_result on failed save', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: 'TestCaster',
          targetName: 'Goblin',
          saveDc: 15,
          saveType: 'WIS',
          success: false,
        }),
      );
    });

    it('should update existing dance effect instead of duplicating', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });

      let readCount = 0;
      getRuntimeValue.mockImplementation((_caster, key, prop) => {
        if (key === '_ottosDance_Goblin') return null;
        if (prop === 'activeConditions') return [];
        if (prop === 'targetEffects') {
          readCount++;
          if (readCount === 1) {
            return [{ target: 'Goblin', effect: 'ottos_dance_repeat_save', source: 'OldCaster' }];
          }
          return [
            { target: 'Goblin', effect: 'ottos_dance_repeat_save', source: 'TestCaster' },
          ];
        }
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-update',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
        (c) => c[1] === 'targetEffects',
      );
      expect(targetEffectsCalls.length).toBe(1);
      const effects = targetEffectsCalls[0][2];
      expect(effects.length).toBe(1);
      expect(effects[0].source).toBe('TestCaster');
    });

    it('should handle non-array existing conditions gracefully on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key, _camp) => {
        if (key === '_ottosDance_Goblin') return null;
        if (key === 'activeConditions') return null;
        if (key === 'targetEffects') return [];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-null-conds',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should append to existing conditions on failed save', async () => {
      setupFailedSave(['frightened']);
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['frightened', 'charmed', 'speed_zero']),
        campaignName,
      );
    });

    it('should call addEntry with ability_use on initial cast', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: "Otto's Irresistible Dance",
        }),
      );
    });
  });
});

describe('ottosDanceHandler.processOttoDanceRepeatSave', () => {
  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await processOttoDanceRepeatSave(
      'TestCaster',
      'Goblin',
      15,
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
  });

  it('should create save listener with WIS save type', async () => {
    getRuntimeValue.mockImplementation((_caster, key) => {
      if (key === '_ottosDance_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'otto-repeat-listener',
      promise: Promise.resolve({ success: true }),
    });

    await processOttoDanceRepeatSave(
      'TestCaster',
      'Goblin',
      15,
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  describe('successful repeat save', () => {
    function setupSuccessPath(existingConditions = ['charmed', 'speed_zero', 'frightened'], existingEffects = []) {
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-success',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp, _camp) => {
        if (keyOrProp === '_ottosDance_Goblin') return true;
        if (keyOrProp === 'activeConditions') return existingConditions;
        if (keyOrProp === 'targetEffects') return existingEffects;
        return [];
      });
    }

    it('should remove charmed and speed_zero conditions, preserving others', async () => {
      setupSuccessPath();

      const result = await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['frightened'],
        campaignName,
      );
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('should handle target with no conditions gracefully', async () => {
      setupSuccessPath([]);

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        [],
        campaignName,
      );
    });

    it('should clear tracking', async () => {
      setupSuccessPath(['charmed', 'speed_zero']);

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCaster',
        '_ottosDance_Goblin',
        null,
        campaignName,
      );
    });

    it('should clean up target effect', async () => {
      setupSuccessPath(['charmed'], [
        { target: 'Goblin', effect: 'ottos_dance_repeat_save', source: 'TestCaster' },
      ]);

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'ottos_dance_repeat_save',
            source: 'TestCaster',
          }),
        ]),
        campaignName,
      );
    });

    it('should post condition removal log entry', async () => {
      setupSuccessPath(['charmed', 'speed_zero']);

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          characterName: 'Goblin',
          condition: 'Charmed, Speed 0',
        }),
      );
    });

    it('should call addEntry with save_result on success', async () => {
      setupSuccessPath(['charmed', 'speed_zero']);

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: 'TestCaster',
          targetName: 'Goblin',
          saveDc: 15,
          saveType: 'WIS',
          success: true,
        }),
      );
    });

    it('should call addEntry with ability_use on repeat save', async () => {
      setupSuccessPath(['charmed', 'speed_zero']);

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
        }),
      );
    });

    it('should handle non-array activeConditions gracefully', async () => {
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-nonarray',
        promise: Promise.resolve({ success: true }),
      });
      getRuntimeValue.mockImplementation((_target, prop) => {
        if (prop === 'activeConditions') return null;
        if (prop === '_ottosDance_Goblin') return true;
        return [];
      });

      const result = await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        [],
        campaignName,
      );
    });
  });

  describe('failed repeat save', () => {
    function setupFailedRepeat() {
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });
      getRuntimeValue.mockImplementation((_entity, keyOrProp) => {
        if (keyOrProp === '_ottosDance_Goblin') return true;
        return [];
      });
    }

    it('should return popup indicating spell continues', async () => {
      setupFailedRepeat();

      const result = await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('failed WIS save');
      expect(result.payload.description).toContain('continues');
    });

    it('should call addEntry with save_result on failed repeat', async () => {
      setupFailedRepeat();

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          characterName: 'TestCaster',
          targetName: 'Goblin',
          saveDc: 15,
          saveType: 'WIS',
          success: false,
        }),
      );
    });

    it('should not modify conditions on failed save', async () => {
      setupFailedRepeat();

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('should not clear tracking on failed save', async () => {
      setupFailedRepeat();

      await processOttoDanceRepeatSave(
        'TestCaster',
        'Goblin',
        15,
        "Otto's Irresistible Dance",
        campaignName,
      );

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCaster',
        '_ottosDance_Goblin',
        null,
        campaignName,
      );
    });
  });
});

describe('ottosDanceHandler.processOttoDanceSuccessSave', () => {
  it('should apply speed_zero condition', async () => {
    getRuntimeValue.mockReturnValue([]);

    const result = await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['speed_zero'],
      campaignName,
    );
    expect(result.payload.description).toContain('dances comically');
  });

  it('should add expiration for speed_zero', async () => {
    getRuntimeValue.mockReturnValue([]);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(addExpiration).toHaveBeenCalledWith(
      'TestCaster',
      'Goblin',
      expect.arrayContaining([{ type: 'speed_zero', condition: 'speed_zero' }]),
      campaignName,
      1,
    );
  });

  it('should call postLogEntry', async () => {
    getRuntimeValue.mockReturnValue([]);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(postLogEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'condition',
        action: 'applied',
        characterName: 'Goblin',
        condition: 'Speed 0',
      }),
    );
  });

  it('should deduplicate speed_zero when already present', async () => {
    getRuntimeValue.mockReturnValue(['speed_zero', 'frightened']);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['frightened', 'speed_zero'],
      campaignName,
    );
  });

  it('should handle non-array storedConds gracefully', async () => {
    getRuntimeValue.mockReturnValue(null);

    await processOttoDanceSuccessSave(
      'TestCaster',
      'Goblin',
      "Otto's Irresistible Dance",
      campaignName,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'activeConditions',
      ['speed_zero'],
      campaignName,
    );
  });
});
