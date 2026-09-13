// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  rollSaveForCreature: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 10),
}));

import { handle } from './imprisonmentHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
  };
}

function setupBaseMocks(saveResult = { success: true }, isNpc = false) {
  const targetName = 'Goblin';
  getCombatContext.mockResolvedValue({
    creatures: [
      { name: targetName, type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 },
    ],
  });
  getTargetFromAttacker.mockReturnValue({ name: targetName, type: isNpc ? 'npc' : 'player', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 });
  buildSaveDc.mockReturnValue(15);
  createSaveListener.mockReturnValue({
    promptId: 'test-prompt-id',
    promise: Promise.resolve(saveResult),
  });
}

describe('imprisonmentHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when action has no target from resolveTarget', async () => {
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster', type: 'player' },
          { name: 'Goblin', type: 'npc' },
        ],
      });
      getTargetFromAttacker.mockReturnValue(null);

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, targetName: 'Goblin' },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup when target not found in combat creatures', async () => {
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster', type: 'player' },
          { name: 'Goblin', type: 'npc' },
        ],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'NonExistent', type: 'npc' });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('not found in combat');
    });
  });

  describe('single-target', () => {
    it('handles save success', async () => {
      setupBaseMocks({ success: true, roll: 12, total: 14, bonus: 2 });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('succeeded on WIS save');
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          rollType: 'save-imprisonment',
          targetName: 'Goblin',
          success: true,
        }),
      );
    });

    it('handles save failure and applies imprisonment', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === 'Goblin') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        return undefined;
      });

      // NPC auto-roll returns a failure
      rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 7, bonus: 2, rawRolls: [5] });

      setupBaseMocks({ success: false, roll: 5, total: 7, bonus: 2 });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, options: ['Burial'] },
        targetName: 'Goblin',
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('is imprisoned (Burial)');

      // Verify imprisonment targetEffect was added
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), campaignName);

      // Verify expiration registered with remove_target_effect for imprisonment
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'remove_target_effect', effectKey: 'imprisonment' }),
        ]), campaignName });

      // Verify save_result logged with save-imprisonment rollType
      const saveResultCalls = vi.mocked(addEntry).mock.calls.filter(
        call => call[1]?.rollType === 'save-imprisonment',
      );
      expect(saveResultCalls.length).toBeGreaterThan(0);

      // Verify ability_use was logged
      const abilityUseCalls = vi.mocked(addEntry).mock.calls.filter(
        call => call[1]?.type === 'ability_use',
      );
      expect(abilityUseCalls.length).toBe(1);
      expect(abilityUseCalls[0][1].description).toContain('WIS save');
      expect(abilityUseCalls[0][1].description).toContain('imprisoned');

      // Verify condition log
      const conditionCalls = vi.mocked(addEntry).mock.calls.filter(
        call => call[1]?.type === 'condition',
      );
      expect(conditionCalls.length).toBe(1);
      expect(conditionCalls[0][1].condition).toBe('Imprisoned');
      expect(conditionCalls[0][1].note).toContain('Burial');
    });
  });

  describe('NPC auto-roll', () => {
    it('calls rollSaveForCreature for NPC targets', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      rollSaveForCreature.mockReturnValue({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] });

      setupBaseMocks({ success: false, roll: 3, total: 5, bonus: 2 }, true);

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'WIS',
        15,
        false,
        false,
      );
    });
  });

  describe('save DC and options', () => {
    it('defaults to Slumber when no options provided', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      setupBaseMocks({ success: false, roll: 3, total: 5, bonus: 2 });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('is imprisoned (Slumber)');
    });

    it('uses first option when provided', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        return undefined;
      });

      setupBaseMocks({ success: false, roll: 3, total: 5, bonus: 2 });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15, options: ['Chaining', 'Hedged Prison'] },
        targetName: 'Goblin',
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('is imprisoned (Chaining)');
    });
  });

  describe('disadvantage from metamagic', () => {
    it('passes metamagicHeighten to createSaveListener', async () => {
      setupBaseMocks({ success: false, roll: 3, total: 5, bonus: 2 });

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        metaCtx: { metamagicHeighten: true },
        targetName: 'Goblin',
      };

      await handle(action, makePlayerStats(), campaignName, null);

      expect(createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          saveType: 'WIS',
          disadvantage: true,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('handles addEntry rejection in ability_use log (catch callback)', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === 'Goblin') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        return undefined;
      });

      rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 7, bonus: 2, rawRolls: [5] });
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 },
        ],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 });
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false, roll: 5, total: 7, bonus: 2 }),
      });
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await handle(action, makePlayerStats(), campaignName, null);
      expect(consoleSpy).toHaveBeenCalledWith('[imprisonment] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in save success path (catch callback)', async () => {
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 },
        ],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 });
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true, roll: 12, total: 14, bonus: 2 }),
      });
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await handle(action, makePlayerStats(), campaignName, null);
      expect(consoleSpy).toHaveBeenCalledWith('[imprisonment] Error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles addEntry rejection in failed save path (catch callbacks)', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === 'Goblin') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        return undefined;
      });

      rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 7, bonus: 2, rawRolls: [5] });
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 },
        ],
      });
      getTargetFromAttacker.mockReturnValue({ name: 'Goblin', type: 'npc', saveBonuses: { WIS: 2 }, currentHp: 15, maxHp: 30 });
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false, roll: 5, total: 7, bonus: 2 }),
      });
      addEntry.mockImplementation(() => Promise.reject(new Error('log error')));

      const action = {
        name: 'Imprisonment',
        automation: { type: 'imprisonment', saveType: 'WIS', saveDc: 15 },
        targetName: 'Goblin',
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await handle(action, makePlayerStats(), campaignName, null);
      const errorCalls = consoleSpy.mock.calls;
      expect(errorCalls.length).toBeGreaterThan(0);
      errorCalls.forEach(call => {
        expect(call[0]).toBe('[imprisonment] Error:');
      });
      consoleSpy.mockRestore();
    });
  });
});
