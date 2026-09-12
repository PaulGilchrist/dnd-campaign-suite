// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

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

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => Promise.resolve()),
  computeDamageAfterSave: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './prismaticSprayHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const casterName = 'TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Prismatic Spray',
    automation: {
      type: 'prismatic_spray',
      saveType: 'DEX',
      saveDc: 15,
      damage: '10d6',
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: 'Orc', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
    { name: 'Dragon', type: 'monster', weaknessesAndResistivities: { immunities: ['fire'] } },
    { name: casterName, gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function failSaveListener() {
  return {
    promptId: 'prismatic-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

function successSaveListener() {
  return {
    promptId: 'prismatic-prompt',
    promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('prismaticSprayHandler.handle - save results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('immunity handling for damage rays', () => {
    it('skips save for targets immune to the damage type', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);

      // Force Red ray (fire) which Dragon is immune to
      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      // Dragon should be skipped, only Goblin and Orc get save listeners
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toContain('Goblin');
      expect(targetNames).toContain('Orc');
      expect(targetNames).not.toContain('Dragon');
    });

    it('includes immunity message in results summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      expect(result.payload.description).toContain('immune');
      expect(result.payload.description).toContain('Fire immunity');
    });

    it('handles case-insensitive immunity check', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['FIRE'] } },
          { name: casterName, gridX: 5, gridY: 10 },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      // Goblin should be skipped
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    });

    it('counts immune targets in summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      expect(result.payload.description).toContain('1 ray(s) immune');
    });
  });

  describe('disadvantage handling', () => {
    it('applies disadvantage when target is heightenTarget', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin'], heightenTarget: 'Goblin' } },
        makePlayerStats(),
        campaignName,
        null,
      );
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          disadvantage: true,
        }),
      );
    });

    it('does not apply disadvantage when target is not heightenTarget', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin'], heightenTarget: 'Orc' } },
        makePlayerStats(),
        campaignName,
        null,
      );
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          disadvantage: false,
        }),
      );
    });
  });

  describe('on successful save', () => {
    it('posts save_result entry with success=true', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const saveResultCall = logService.addEntry.mock.calls.find(
        c => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
          saveDc: 15,
          saveType: 'DEX',
          rollType: 'save-prismatic-spray',
        }),
      );
    });

    it('calls addTargetResult with success', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'success',
          roll: 14,
          total: 14,
          conditions: [],
          appliedDamage: 0,
        }),
      );
    });

    it('applies half damage for damage rays on successful save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(15); // half of 30
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 15, ['fire'], campaignName, expect.any(Array), { ignoreResistance: false, attackerName: casterName },);
    });

    it('does not apply half damage when rollExpression returns null', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue(null);
      applyDamage.computeDamageAfterSave.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('does not apply damage when half damage is 0', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 1 });
      applyDamage.computeDamageAfterSave.mockReturnValue(0); // floor(1/2) = 0
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('does not apply conditions on successful save for damage rays', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });
  });

  describe('on failed save for damage rays', () => {
    it('posts save_result entry with success=false', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const saveResultCall = logService.addEntry.mock.calls.find(
        c => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: false,
          saveDc: 15,
          saveType: 'DEX',
          rollType: 'save-prismatic-spray',
        }),
      );
    });

    it('applies full damage for damage rays on failed save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 30, ['fire'], campaignName, expect.any(Array), { ignoreResistance: false, attackerName: casterName },);
    });

    it('does not apply damage when full damage is 0', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 0 });
      applyDamage.computeDamageAfterSave.mockReturnValue(0);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('calls addTargetResult with failure', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'failure',
          roll: 5,
          total: 5,
        }),
      );
    });
  });

  describe('ability_use log entries', () => {
    it('posts ability_use entry for each target on each ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0.3; // firstRoll = 3 (Yellow/lightning) for all targets - damage rays
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const abilityEntries = logService.addEntry.mock.calls.filter(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntries.length).toBe(3);
      abilityEntries.forEach(entry => {
        expect(entry[1]).toEqual(
          expect.objectContaining({
            type: 'ability_use',
            characterName: casterName,
            abilityName: 'Prismatic Spray',
          }),
        );
      });
    });

    it('includes promptId in ability_use entry', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'prismatic-test-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(makeAction(), makePlayerStats(), campaignName, null);

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].promptId).toBe('prismatic-test-prompt');
    });

    it('includes roll description in log for damage rays', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].description).toContain('Red ray');
      expect(abilityEntry[1].description).toContain('rolled 1');
    });

    it('includes roll description in log for indigo ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].description).toContain('Indigo ray');
      expect(abilityEntry[1].description).toContain('rolled 6');
    });

    it('includes roll description in log for violet ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet)
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const abilityEntry = logService.addEntry.mock.calls.find(
        c => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].description).toContain('Violet ray');
      expect(abilityEntry[1].description).toContain('rolled 7');
    });
  });
});
