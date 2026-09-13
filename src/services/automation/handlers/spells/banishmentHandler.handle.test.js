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

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

import { handle } from './banishmentHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { rollSaveForCreature } from '../../../rules/combat/applyDamage.js';
import { campaignName, makePlayerStats } from './banishmentHandler.test-utils.js';

describe('banishmentHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('target resolution', () => {
    it('returns popup when action has no targets and no targetName', async () => {
      buildSaveDc.mockReturnValue(15);
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'TestCaster', type: 'player' },
          { name: 'Goblin', type: 'npc' },
        ],
      });
      getTargetFromAttacker.mockReturnValue(null);

      const action = {
        name: 'Banishment',
        automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No target selected');
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const action = {
        name: 'Banishment',
        automation: { type: 'banishment', saveType: 'CHA', saveDc: 15, targetName: 'Goblin' },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('single-target', () => {
    it('handles save success', async () => {
      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'player', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
        ],
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: true, roll: 12, total: 14, bonus: 2 }),
      });

      const action = {
        name: 'Banishment',
        automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
        targetName: 'Goblin',
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 creature(s) saved: Goblin');
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'save_result',
          rollType: 'save-banishment',
          targetName: 'Goblin',
          success: true,
        }),
      );
    });

    it('handles save failure and applies banishment', async () => {
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

      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'player', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
        ],
      });
      buildSaveDc.mockReturnValue(15);
      createSaveListener.mockReturnValue({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false, roll: 5, total: 7, bonus: 2 }),
      });

      const action = {
        name: 'Banishment',
        automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
        targetName: 'Goblin',
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 creature(s) banished: Goblin');

      // Verify incapacitated condition was applied
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', expect.arrayContaining(['incapacitated']), campaignName);

      // Verify banishment targetEffect was added
      expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), campaignName);

      // Verify expiration registered with condition, remove_target_effect, and break_concentration
      expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'condition', condition: 'incapacitated' }),
          expect.objectContaining({ type: 'remove_target_effect', effectKey: 'banishment' }),
          expect.objectContaining({ type: 'break_concentration' }),
        ]), campaignName });

      // Verify save_result logged with save-banishment rollType
      const saveResultCalls = vi.mocked(addEntry).mock.calls.filter(
        call => call[1]?.rollType === 'save-banishment',
      );
      expect(saveResultCalls.length).toBeGreaterThan(0);
    });
  });

  describe('multi-target', () => {
    it('handles multi-target with metaCtx.banishmentTargets', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === 'Goblin') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        if (key === 'Orc') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        return undefined;
      });

      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
          { name: 'Orc', type: 'npc', saveBonuses: { CHA: 1 }, currentHp: 25, maxHp: 40 },
        ],
      });

      buildSaveDc.mockReturnValue(15);

      rollSaveForCreature
        .mockReturnValueOnce({ success: false, roll: 3, total: 5, bonus: 2, rawRolls: [3] })
        .mockReturnValueOnce({ success: true, roll: 15, total: 16, bonus: 1, rawRolls: [15] });

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { promptId: 'prompt-1', promise: Promise.resolve({ success: false, roll: 3, total: 5, bonus: 2 }) };
        }
        return { promptId: 'prompt-2', promise: Promise.resolve({ success: true, roll: 15, total: 16, bonus: 1 }) };
      });

      const action = {
        name: 'Banishment',
        automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
        metaCtx: { banishmentTargets: ['Goblin', 'Orc'] },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('1 creature(s) banished: Goblin');
      expect(result.payload.description).toContain('1 creature(s) saved: Orc');

      // Verify NPC auto-roll was triggered for both targets
      expect(rollSaveForCreature).toHaveBeenCalledTimes(2);
      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin' }),
        'CHA',
        15,
        false,
        false,
      );
      expect(rollSaveForCreature).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Orc' }),
        'CHA',
        15,
        false,
        false,
      );

      // Verify two save prompts were created
      expect(createSaveListener).toHaveBeenCalledTimes(2);

      // Verify two addEntry ability_use calls
      const abilityUseCalls = vi.mocked(addEntry).mock.calls.filter(
        call => call[1]?.type === 'ability_use',
      );
      expect(abilityUseCalls.length).toBe(2);
    });

    it('handles all targets failing save', async () => {
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (key === 'campaign' && subKey === 'targetEffects') return [];
        if (key === 'Goblin') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        if (key === 'Orc') {
          if (subKey === 'activeConditions') return [];
          if (subKey === 'activeConditionMeta') return {};
        }
        return undefined;
      });

      getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', saveBonuses: { CHA: 2 }, currentHp: 15, maxHp: 30 },
          { name: 'Orc', type: 'npc', saveBonuses: { CHA: 1 }, currentHp: 25, maxHp: 40 },
        ],
      });

      buildSaveDc.mockReturnValue(15);

      rollSaveForCreature
        .mockReturnValueOnce({ success: false, roll: 2, total: 4, bonus: 2, rawRolls: [2] })
        .mockReturnValueOnce({ success: false, roll: 2, total: 4, bonus: 2, rawRolls: [2] });

      let callCount = 0;
      createSaveListener.mockImplementation(() => {
        callCount++;
        return { promptId: `prompt-${callCount}`, promise: Promise.resolve({ success: false, roll: 2, total: 4, bonus: 2 }) };
      });

      const action = {
        name: 'Banishment',
        automation: { type: 'banishment', saveType: 'CHA', saveDc: 15 },
        metaCtx: { banishmentTargets: ['Goblin', 'Orc'] },
      };

      const result = await handle(action, makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('2 creature(s) banished');
      expect(addExpiration).toHaveBeenCalledTimes(2);
      expect(addExpiration).toHaveBeenNthCalledWith(1, { attackerName: 'TestCaster', targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'condition', condition: 'incapacitated' }),
          expect.objectContaining({ type: 'remove_target_effect', effectKey: 'banishment' }),
          expect.objectContaining({ type: 'break_concentration' }),
        ]), campaignName });
      expect(addExpiration).toHaveBeenNthCalledWith(2, { attackerName: 'TestCaster', targetName: 'Orc', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'condition', condition: 'incapacitated' }),
          expect.objectContaining({ type: 'remove_target_effect', effectKey: 'banishment' }),
          expect.objectContaining({ type: 'break_concentration' }),
        ]), campaignName });
    });
  });

});
