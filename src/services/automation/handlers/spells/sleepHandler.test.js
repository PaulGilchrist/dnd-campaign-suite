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

import { handle, processSleepRepeatSave } from './sleepHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
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

function getSetRuntimeCall(target, prop) {
  return setRuntimeValue.mock.calls.find(
    call => call[0] === target && call[1] === prop,
  );
}

function clearAllMocks() {
  vi.clearAllMocks();
  getRuntimeValue.mockReturnValue(null);
}

describe('sleepHandler.handle', () => {
  beforeEach(clearAllMocks);

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Sleep');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Sleep');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should return popup when combat context creatures list is undefined', async () => {
      getCombatContext.mockResolvedValue({});
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target processing', () => {
    it('should skip the caster itself and only target other creatures', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(createSaveListener).toHaveBeenNthCalledWith(1, campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 14,
        dcSuccess: 'none',
        disadvantage: false,
      });
      expect(createSaveListener).toHaveBeenNthCalledWith(2, campaignName, {
        targetName: 'Orc',
        saveType: 'WIS',
        saveDc: 14,
        dcSuccess: 'none',
        disadvantage: false,
      });
    });

    it('should call buildSaveDc with action automation and playerStats', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(18);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-dc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction({ saveDc: 18 }), makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(makeAction({ saveDc: 18 }).automation, expect.any(Object));
    });

    it('should call addEntry with ability_use type for each target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-ability',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Sleep',
          promptId: 'sleep-ability',
        }),
      );
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

    it('should call addEntry with save_result for successful saves', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-save-result',
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
      expect(createSaveListener).not.toHaveBeenCalled();
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

    it('should log ability_use for immune creatures', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Undead', type: 'monster', immunities: ['Magical Sleep'] },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          description: expect.stringContaining('immune'),
        }),
      );
    });

    it('should handle mixed immunity and non-immunity targets', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Undead', type: 'monster', immunities: ['Magical Sleep'] },
          { name: 'Goblin', type: 'monster' },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      });
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-mixed',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s) immune');
      expect(result.payload.description).toContain('1 creature(s)');
      expect(createSaveListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('failed save handling', () => {
    it('should apply Incapacitated condition on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-fail',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const condCall = getSetRuntimeCall('Goblin', 'activeConditions');
      expect(condCall).toBeDefined();
      expect(condCall[2]).toContain('incapacitated');
    });

    it('should deduplicate Incapacitated if target already has it', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue(['incapacitated', 'blinded']);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const condCall = getSetRuntimeCall('Goblin', 'activeConditions');
      expect(condCall[2]).toEqual(['blinded', 'incapacitated']);
    });

    it('should set tracking for repeat saves', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-track',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const trackCall = getSetRuntimeCall('TestCaster', '_sleep_Goblin');
      expect(trackCall).toBeDefined();
      expect(trackCall[2]).toBe(true);
    });

    it('should add expiration for incapacitated condition', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-exp',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([{ type: 'incapacitated', condition: 'incapacitated' }]),
        campaignName,
      );
    });

    it('should store target effect for repeat saves', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-target-effect',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const effectCall = getSetRuntimeCall(campaignName, 'targetEffects');
      expect(effectCall).toBeDefined();
      expect(effectCall[2]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: 'Goblin',
            effect: 'sleep_repeat_save',
            source: 'TestCaster',
          }),
        ]),
      );
    });

    it('should call addEntry on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-log',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Incapacitated',
        }),
      );
    });

    it('should call addEntry with save_result on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-fail-result',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-sleep',
      }));
    });

    it('should store target effect with all fields including dc and saveType', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(17);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-full-effect',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction({ saveDc: 17 }), makePlayerStats(), campaignName, null);

      const effectCall = getSetRuntimeCall(campaignName, 'targetEffects');
      const effect = effectCall[2][0];
      expect(effect.target).toBe('Goblin');
      expect(effect.effect).toBe('sleep_repeat_save');
      expect(effect.source).toBe('TestCaster');
      expect(effect.condition).toBe('incapacitated');
      expect(effect.dc).toBe(17);
      expect(effect.saveType).toBe('WIS');
    });

    it('should update existing target effect instead of duplicating', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      getRuntimeValue
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          { target: 'Goblin', effect: 'sleep_repeat_save', source: 'TestCaster' },
        ]);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-update-effect',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const effectCall = getSetRuntimeCall(campaignName, 'targetEffects');
      expect(effectCall[2]).toHaveLength(1);
      expect(effectCall[2][0].dc).toBe(15);
    });
  });

  describe('popup payload', () => {
    it('should return popup type with automation_info payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-payload',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Sleep');
    });

    it('should include affected creature descriptions in summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-desc',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Incapacitated');
      expect(result.payload.description).toContain('repeat the save');
    });

    it('should mention shake free in summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-shake',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('5ft');
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

    it('should handle playerStats with no proficiency', async () => {
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-no-prof',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should use action.name in ability_use log entries', async () => {
      const customAction = { name: 'My Sleep', automation: { type: 'sleep', saveType: 'WIS', saveDc: 15 } };

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'sleep-custom-name',
        promise: Promise.resolve({ success: false }),
      });

      await handle(customAction, makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        abilityName: 'My Sleep',
      }));
    });
  });
});

describe('sleepHandler.processSleepRepeatSave', () => {
  beforeEach(clearAllMocks);

  it('should return null when no tracking exists', async () => {
    getRuntimeValue.mockReturnValue(null);
    const result = await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);
    expect(result).toBeNull();
    expect(createSaveListener).not.toHaveBeenCalled();
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
      disadvantage: false,
    });
  });

  it('should call addEntry with ability_use on repeat save', async () => {
    getRuntimeValue.mockImplementation((caster, key) => {
      if (key === '_sleep_Goblin') return true;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'sleep-repeat-ability',
      promise: Promise.resolve({ success: true }),
    });

    await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

    expect(addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Sleep (repeat save)',
      }),
    );
  });

  describe('successful repeat save', () => {
    it('should remove Incapacitated condition, clear tracking, clean up target effect, and log', async () => {
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === '_sleep_Goblin') return true;
        if (key === 'activeConditions') return ['Incapacitated', 'Frightened', 'poisoned'];
        if (key === 'targetEffects') return [{ target: 'Goblin', effect: 'sleep_repeat_save', source: 'TestCaster' }];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-consolidated',
        promise: Promise.resolve({ success: true }),
      });

      const result = await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      const condCall = getSetRuntimeCall('Goblin', 'activeConditions');
      expect(condCall[2]).toEqual(['Frightened', 'poisoned']);
      expect(result.payload.description).toContain('succeeded on WIS save');

      const trackCall = getSetRuntimeCall('TestCaster', '_sleep_Goblin');
      expect(trackCall[2]).toBe(null);

      const effectCall = getSetRuntimeCall(campaignName, 'targetEffects');
      expect(effectCall[2]).toEqual([]);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'removed',
          condition: 'Incapacitated',
        }),
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-sleep',
      }));
    });
  });

  describe('failed repeat save', () => {
    it('should apply Unconscious condition, deduplicate, clear tracking, clean up target effect, and log', async () => {
      getRuntimeValue.mockImplementation((caster, key, _camp) => {
        if (key === '_sleep_Goblin') return true;
        if (key === 'activeConditions') return ['unconscious', 'blinded'];
        if (key === 'targetEffects') return [{ target: 'Goblin', effect: 'sleep_repeat_save', source: 'TestCaster' }];
        return [];
      });
      createSaveListener.mockReturnValue({
        promptId: 'sleep-repeat-fail-consolidated',
        promise: Promise.resolve({ success: false }),
      });

      const result = await processSleepRepeatSave('TestCaster', 'Goblin', 15, campaignName);

      const condCall = getSetRuntimeCall('Goblin', 'activeConditions');
      expect(condCall[2]).toEqual(['blinded', 'unconscious']);
      expect(result.payload.description).toContain('Unconscious');

      const trackCall = getSetRuntimeCall('TestCaster', '_sleep_Goblin');
      expect(trackCall[2]).toBe(null);

      const effectCall = getSetRuntimeCall(campaignName, 'targetEffects');
      expect(effectCall[2]).toEqual([]);

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          condition: 'Unconscious',
        }),
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: false,
        rollType: 'save-sleep',
      }));
    });
  });
});
