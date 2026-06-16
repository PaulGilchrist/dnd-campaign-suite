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

import { handle, processSleepRepeatSave } from './sleepHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
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
    name: 'Sleep',
    automation: { type: 'sleep', saveType: 'WIS', saveDc: 15, ...automation },
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

describe('sleepHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe('target processing', () => {
    it('should skip the caster itself', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
    });

    it('should handle all targets saving successfully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('2 creature(s) saved');
    });

    it('should handle mixed save results', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(14);

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        const success = callCount === 1 ? false : true;
        return {
          promptId: `sleep-prompt-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });
  });

  describe('immunity detection', () => {
    it('should auto-succeed for Magical Sleep immunity', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Undead', type: 'monster', immunities: ['Magical Sleep'] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('immune');
      expect(createSaveListener).not.toHaveBeenCalled();
    });

    it('should auto-succeed for Exhaustion immunity', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Golem', type: 'monster', immunities: ['Exhaustion'] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('immune');
    });

    it('should count immunity creatures in summary', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Undead', type: 'monster', immunities: ['Magical Sleep'] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) immune');
    });
  });

  describe('failed save handling', () => {
    function setupFailedSave() {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_sleep_Goblin') return null;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-fail',
        promise: Promise.resolve({ success: false }),
      });
    }

    it('should apply Incapacitated condition on failed save', async () => {
      setupFailedSave();
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['incapacitated']),
        campaignName,
      );
      expect(result.payload.description).toContain('Incapacitated');
    });

    it('should set tracking for repeat saves', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_sleep_Goblin', true, campaignName);
    });

    it('should add expiration for incapacitated condition', async () => {
      setupFailedSave();
      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'incapacitated', condition: 'incapacitated' }]),
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
            effect: 'sleep_repeat_save',
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
          condition: 'Incapacitated',
        }),
      );
    });


  });

  describe('successful save handling', () => {
    it('should call addEntry with save_result on success', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-save',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-sleep',
      }));
    });
  });

  describe('edge cases', () => {
    it('should handle all targets being the caster', async () => {
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(onlyPlayerCombat);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-only-player',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected');
    });

    it('should handle empty automation object', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-empty-auto',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle({ name: 'Sleep', automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
    });
  });
});

describe('sleepHandler.processSleepRepeatSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);
    const result = await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);
    expect(result).toBeNull();
  });

  it('should create save listener with WIS save type', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_sleep_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'sleep-repeat-listener',
      promise: Promise.resolve({ success: true }),
    });

    await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

    expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
      targetName: 'Goblin',
      saveType: 'WIS',
      saveDc: 15,
      dcSuccess: 'none',
    });
  });

  describe('successful repeat save', () => {
    it('should remove Incapacitated condition', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Incapacitated', 'Frightened'];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['Frightened'], campaignName);
      expect(result.payload.description).toContain('succeeded on WIS save');
    });

    it('should clear tracking', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_sleep_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-track',
        promise: Promise.resolve({ success: true }),
      });

      await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_sleep_Goblin', null, campaignName);
    });

    it('should clean up target effect', async () => {
      getRuntimeValue.mockImplementation((caster, key, prop) => {
        if (key === '_sleep_Goblin') return true;
        if (prop === 'targetEffects') return [{ target: 'Goblin', effect: 'sleep_repeat_save', source: 'TestCaster' }];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-clean',
        promise: Promise.resolve({ success: true }),
      });

      await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        campaignName,
        'targetEffects',
        expect.not.arrayContaining([
          expect.objectContaining({ target: 'Goblin', effect: 'sleep_repeat_save', source: 'TestCaster' }),
        ]),
        campaignName,
      );
    });

    it('should call postLogEntry for condition removal', async () => {
      getRuntimeValue.mockImplementation((target, prop) => {
        if (prop === 'activeConditions') return ['Incapacitated'];
        return true;
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-log',
        promise: Promise.resolve({ success: true }),
      });

      await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          condition: 'Incapacitated',
        }),
      );
    });
  });

  describe('failed repeat save', () => {
    it('should apply Unconscious condition', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_sleep_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-fail',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['unconscious']),
        campaignName,
      );
      expect(result.payload.description).toContain('Unconscious');
    });

    it('should clear tracking on failed repeat save', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_sleep_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-fail-track',
        promise: Promise.resolve({ success: false }),
      });

      await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCaster', '_sleep_Goblin', null, campaignName);
    });

    it('should call postLogEntry for Unconscious application', async () => {
      getRuntimeValue.mockImplementation((caster, key) => {
        if (key === '_sleep_Goblin') return true;
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-fail-log',
        promise: Promise.resolve({ success: false }),
      });

      await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          condition: 'Unconscious',
        }),
      );
    });
  });
});
