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

import { handle } from './hypnoticPatternHandler.js';
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

describe('hypnoticPatternHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('combat context validation', () => {
    it('returns popup when no combat context exists or has no creatures', async () => {
      getCombatContext.mockResolvedValue(null);
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures in combat');

      getCombatContext.mockResolvedValue({ creatures: [] });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target processing', () => {
    it('skips caster, calls createSaveListener for each non-caster target', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-config',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledTimes(2);
      expect(addEntry).toHaveBeenCalledTimes(4);
    });

    it('handles single target, all saves succeed, or mixed results', async () => {
      const singleTargetCombatContext = {
        creatures: [
          { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
          { name: 'TestCaster', gridX: 5, gridY: 10 },
        ],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };

      // Single target
      getCombatContext.mockResolvedValue(singleTargetCombatContext);
      buildSaveDc.mockReturnValue(14);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-single',
        promise: Promise.resolve({ success: false }),
      });
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Hypnotic Pattern affects 1 creature(s)');

      // All save successfully
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(20);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-all-success',
        promise: Promise.resolve({ success: true }),
      });
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('No creatures affected');
      expect(result.payload.description).toContain('2 creature(s) saved');

      // Mixed results
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
      result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.payload.description).toContain('1 creature(s)');
      expect(result.payload.description).toContain('1 creature(s) saved');
    });
  });

  describe('failed save handling', () => {
    it('applies charmed, incapacitated, and speed_zero conditions, logs, and adds expiration', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      getRuntimeValue.mockReturnValue(['Stunned']);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-cond',
        promise: Promise.resolve({ success: false }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Goblin', 'activeConditions',
        ['Stunned', 'charmed', 'incapacitated', 'speed_zero'],
        campaignName,
      );

      // Logging and expiration
      vi.clearAllMocks();
      getRuntimeValue.mockReturnValue([]);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-log',
        promise: Promise.resolve({ success: false }),
      });
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition', action: 'applied',
          characterName: 'Goblin', condition: 'Charmed, Incapacitated, Speed 0',
        }),
      );
      expect(addExpiration).toHaveBeenCalledWith(
        'TestCaster', 'Goblin',
        expect.arrayContaining([
          { type: 'charmed', condition: 'charmed' },
          { type: 'incapacitated', condition: 'incapacitated' },
          { type: 'speed_zero', condition: 'speed_zero' },
        ]),
        campaignName,
      );
    });
  });

  describe('popup payload and edge cases', () => {
    it('returns popup with automation_info payload and correct descriptions', async () => {
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-payload',
        promise: Promise.resolve({ success: false }),
      });

      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Hypnotic Pattern');
      expect(result.payload.description).toContain('Goblin is Charmed');
      expect(result.payload.description).toContain('Incapacitated');
      expect(result.payload.description).toContain('Speed 0');
      expect(result.payload.description).toContain('shake it free');
    });

    it('handles edge cases: all targets are caster, empty automation, no proficiency, custom action name', async () => {
      // All targets are caster
      const onlyPlayerCombat = {
        creatures: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      getCombatContext.mockResolvedValue(onlyPlayerCombat);
      let result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      expect(createSaveListener).not.toHaveBeenCalled();
      expect(result.payload.description).toContain('No creatures affected');

      // Empty automation
      getCombatContext.mockResolvedValue(baseCombatContext);
      buildSaveDc.mockReturnValue(10);
      createSaveListener.mockReturnValue({
        promptId: 'hypno-empty-auto',
        promise: Promise.resolve({ success: false }),
      });
      result = await handle({ name: 'Hypnotic Pattern', automation: {} }, makePlayerStats(), campaignName, null);
      expect(result.payload.name).toBe('Hypnotic Pattern');

      // No proficiency
      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const action = makeAction();
      result = await handle(action, ps, campaignName, null);
      expect(result.type).toBe('popup');
      expect(buildSaveDc).toHaveBeenCalledWith(action.automation, ps);

      // Custom action name
      const customAction = { name: 'My Hypno', automation: { type: 'hypnotic_pattern', saveType: 'WIS', saveDc: 15 } };
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
