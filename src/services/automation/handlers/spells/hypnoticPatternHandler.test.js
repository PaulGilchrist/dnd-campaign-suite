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

import { handle } from './hypnoticPatternHandler.js';
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
    name: 'Hypnotic Pattern',
    automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15, ...automation },
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

const singleTargetCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

describe('hypnoticPatternHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('should return popup when no combat context exists', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Hypnotic Pattern');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Hypnotic Pattern has no effect');
    });

    it('should return popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Hypnotic Pattern');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('should handle undefined campaignName in no-combat case', async () => {
      getCombatContext.mockResolvedValue(null);
      const result = await handle(makeAction(), makePlayerStats(), null, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target processing', () => {
    it('should skip the caster itself and only target other creatures', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-prompt',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(addEntry).toHaveBeenCalledTimes(2);
    });

    it('should call createSaveListener with correct config for each non-caster target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-config',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenNthCalledWith(1, campaignName, {
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
      });
      expect(createSaveListener).toHaveBeenNthCalledWith(2, campaignName, {
        targetName: 'Orc',
        saveType: 'WIS',
        saveDc: 15,
        dcSuccess: 'none',
      });
    });

    it('should call buildSaveDc with action automation and playerStats', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(16);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-dc',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction({ saveDc: 16 }), makePlayerStats(), campaignName, null);

      expect(buildSaveDc).toHaveBeenCalledWith(makeAction({ saveDc: 16 }).automation, expect.any(Object));
    });

    it('should call addEntry with ability_use type for each target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-ability',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'TestCaster',
        abilityName: 'Hypnotic Pattern',
        description: expect.stringContaining('Hypnotic Pattern'),
        promptId: 'hypno-ability',
      });
    });

    it('should handle single target in combat', async () => {
      getCombatContext.mockResolvedValue(singleTargetCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-single',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Hypnotic Pattern affects 1 creature(s)');
    });

    it('should handle all targets saving successfully', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-all-success',
        promise: Promise.resolve({ success: true }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
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
          promptId: `hypno-prompt-${callCount}`,
          promise: Promise.resolve({ success }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });
  });

  describe('failed save handling', () => {
    it('should apply charmed, incapacitated, and speed_zero conditions on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['Stunned']);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-cond',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });

    it('should deduplicate conditions when target already has them', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['charmed', 'Stunned', 'speed_zero']);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-dedup',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );
    });

    it('should call postLogEntry on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-log',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(postLogEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Charmed, Incapacitated, Speed 0',
        }),
      );
    });

    it('should call addExpiration with correct conditions and duration on failed save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-exp',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster',
        'Goblin',
        expect.arrayContaining([
          { type: 'charmed', condition: 'charmed' },
          { type: 'incapacitated', condition: 'incapacitated' },
          { type: 'speed_zero', condition: 'speed_zero' },
        ]),
        campaignName,
        10,
      );
    });

    it('should call addEntry with save_result for each successful save', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-save-result',
        promise: Promise.resolve({ success: true }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'save_result',
        targetName: 'Goblin',
        success: true,
        rollType: 'save-hypnotic-pattern',
      }));
    });
  });

  describe('popup payload', () => {
    it('should return popup type with automation_info payload', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-payload',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Hypnotic Pattern');
    });

    it('should include affected creature descriptions in summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-desc',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('Goblin is Charmed');
      expect(result.payload.description).toContain('Incapacitated');
      expect(result.payload.description).toContain('Speed 0');
    });

    it('should mention shake free in summary', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-shake',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('shake it free');
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
        promptId: 'hypno-empty-auto',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle({ name: 'Hypnotic Pattern', automation: {} }, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Hypnotic Pattern');
    });

    it('should handle playerStats with no proficiency', async () => {
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-no-prof',
        promise: Promise.resolve({ success: false }),
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);
    });

    it('should use action.name in ability_use log entries', async () => {
      const customAction = { name: 'My Hypno', automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15 } };

      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-custom-name',
        promise: Promise.resolve({ success: false }),
      });

      await handle(customAction, makePlayerStats(), campaignName, null);

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        abilityName: 'My Hypno',
      }));
    });
  });
});
