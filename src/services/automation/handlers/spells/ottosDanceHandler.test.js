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
    it('should return popup describing target dancing when save succeeds', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'otto-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('dances comically');
    });

    it('should call postLogEntry with condition applied on successful save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockReturnValue(null);
      createSaveListener.mockReturnValue({
        promptId: 'otto-save',
        promise: Promise.resolve({ success: true }),
      });

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
  });

  describe('initial cast - failed save', () => {
    function setupFailedSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_ottosDance_Goblin') return null;
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
    it('should remove charmed and speed_zero conditions, preserving others', async () => {
      getRuntimeValue.mockImplementation((_target, prop) => {
        if (prop === 'activeConditions')
          return ['charmed', 'speed_zero', 'frightened'];
        if (prop === '_ottosDance_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-success',
        promise: Promise.resolve({ success: true }),
      });

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

    it('should clear tracking', async () => {
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_ottosDance_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-track',
        promise: Promise.resolve({ success: true }),
      });

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
      getRuntimeValue.mockImplementation((_caster, key, prop) => {
        if (key === '_ottosDance_Goblin') return true;
        if (prop === 'targetEffects')
          return [
            { target: 'Goblin', effect: 'ottos_dance_repeat_save', source: 'TestCaster' },
          ];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-clean',
        promise: Promise.resolve({ success: true }),
      });

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
  });

  describe('failed repeat save', () => {
    it('should return popup indicating spell continues', async () => {
      getRuntimeValue.mockImplementation((_caster, key) => {
        if (key === '_ottosDance_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'otto-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });

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
});
