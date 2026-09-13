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
import * as expirations from '../../../rules/effects/expirations.js';
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

// ── Tests ──────────────────────────────────────────────────────

describe('prismaticSprayHandler ray effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('damage ray handling (rays 1-5)', () => {
    it('creates DEX save listener for fire ray (Red)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      // Force Red ray (roll 1)
      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveType: 'DEX',
          saveDc: 15,
          dcSuccess: 'half',
          damageFormula: '10d6',
          damageType: 'fire',
        }),
      );
    });

    it('creates DEX save listener for acid ray (Orange)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 1 / 8; // firstRoll = 2
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageType: 'acid',
          dcSuccess: 'half',
        }),
      );
    });

    it('creates DEX save listener for lightning ray (Yellow)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 2 / 8; // firstRoll = 3
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageType: 'lightning',
          dcSuccess: 'half',
        }),
      );
    });

    it('creates DEX save listener for poison ray (Green)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 3 / 8; // firstRoll = 4
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageType: 'poison',
          dcSuccess: 'half',
        }),
      );
    });

    it('creates DEX save listener for cold ray (Blue)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 4 / 8; // firstRoll = 5
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageType: 'cold',
          dcSuccess: 'half',
        }),
      );
    });
  });

  describe('indigo ray handling (ray 6)', () => {
    it('creates DEX save listener with dcSuccess none for indigo ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          saveType: 'DEX',
          saveDc: 15,
          dcSuccess: 'none',
        }),
      );
    });

    it('applies Restrained condition on failed save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['restrained']),
        campaignName,
      );
    });

    it('deduplicates Restrained if already present', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue(['restrained', 'blinded']);
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const conditionsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1] === 'activeConditions' && c[0] === 'Goblin',
      )[2];
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'restrained').length).toBe(1);
    });

    it('stores condition metadata with DC and ability con', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditionMeta') return {};
        return null;
      });
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          restrained: expect.objectContaining({
            dc: 15,
            ability: 'con',
          }),
        }),
        campaignName,
      );
    });

    it('registers prismatic_spray_indigo targetEffect', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount === 1) return 5 / 8; // firstRoll = 6 (Indigo) for Goblin
        return 0.3; // firstRoll = 3 for other targets
      };
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const effectCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        c => c[1] === 'targetEffects',
      );
      expect(effectCalls.length).toBeGreaterThan(0);
      const effects = effectCalls[effectCalls.length - 1][2];
      const indigoEffect = effects.find(e => e.effect === 'prismatic_spray_indigo');
      expect(indigoEffect).toBeDefined();
      expect(indigoEffect.target).toBe('Goblin');
      expect(indigoEffect.source).toBe(casterName);
      expect(indigoEffect.dc).toBe(15);
    });

    it('updates existing prismatic_spray_indigo effect entry', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      // Set up getRuntimeValue to return existing effects for targetEffects key
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce([
          { target: 'Goblin', effect: 'prismatic_spray_indigo', source: 'OldCaster', dc: 12 },
        ])
        .mockReturnValue(null);
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount === 1) return 5 / 8; // firstRoll = 6 (Indigo) for Goblin
        return 0.3; // firstRoll = 3 for other targets
      };
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const effectCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        c => c[1] === 'targetEffects',
      );
      const effects = effectCalls[effectCalls.length - 1][2];
      const indigoEffect = effects.find(e => e.target === 'Goblin' && e.effect === 'prismatic_spray_indigo');
      expect(indigoEffect.source).toBe(casterName);
      expect(indigoEffect.dc).toBe(15);
    });

    it('sets up recurring save tracking with successes/failures counters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const trackingCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        c => c[1]?.startsWith('_prismaticSprayIndigo_'),
      );
      expect(trackingCalls.length).toBeGreaterThan(0);
      const trackingData = trackingCalls[trackingCalls.length - 1][2];
      expect(trackingData.successes).toBe(0);
      expect(trackingData.failures).toBe(0);
      expect(trackingData.dc).toBe(15);
      expect(trackingData.casterName).toBe(casterName);
    });

    it('adds expirations for condition and targetEffect removal', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'condition', condition: 'restrained' }),
          expect.objectContaining({
            type: 'remove_target_effect',
            effectKey: 'prismatic_spray_indigo',
            target: 'Goblin',
            source: casterName,
          }),
        ]), campaignName });
    });

    it('posts condition log entry for Restrained', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Restrained',
          reason: 'Prismatic Spray (Indigo ray)',
        }),
      );
    });
  });

  describe('violet ray handling (ray 7)', () => {
    it('creates DEX save listener with dcSuccess none for violet ray', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          saveType: 'DEX',
          saveDc: 15,
          dcSuccess: 'none',
        }),
      );
    });

    it('applies Blinded condition on failed save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['blinded']),
        campaignName,
      );
    });

    it('deduplicates Blinded if already present', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue(['blinded', 'restrained']);
      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const conditionsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        c => c[1] === 'activeConditions' && c[0] === 'Goblin',
      )[2];
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'blinded').length).toBe(1);
    });

    it('registers prismatic_spray_violet targetEffect', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount === 1) return 6 / 8; // firstRoll = 7 (Violet) for Goblin
        return 0.3; // firstRoll = 3 for other targets
      };
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const effectCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        c => c[1] === 'targetEffects',
      );
      const effects = effectCalls[effectCalls.length - 1][2];
      const violetEffect = effects.find(e => e.effect === 'prismatic_spray_violet');
      expect(violetEffect).toBeDefined();
      expect(violetEffect.target).toBe('Goblin');
      expect(violetEffect.source).toBe(casterName);
    });

    it('sets up violet tracking with blindedAt timestamp', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      const trackingCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        c => c[1]?.startsWith('_prismaticSprayViolet_'),
      );
      expect(trackingCalls.length).toBeGreaterThan(0);
      const trackingData = trackingCalls[trackingCalls.length - 1][2];
      expect(trackingData.casterName).toBe(casterName);
      expect(trackingData.dc).toBe(15);
      expect(trackingData.blindedAt).toBeDefined();
      expect(typeof trackingData.blindedAt).toBe('number');
    });

    it('adds expirations for condition and targetEffect removal', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Goblin', effects: expect.arrayContaining([
          expect.objectContaining({ type: 'condition', condition: 'blinded' }),
          expect.objectContaining({
            type: 'remove_target_effect',
            effectKey: 'prismatic_spray_violet',
            target: 'Goblin',
            source: casterName,
          }),
        ]), campaignName });
    });

    it('posts condition log entry for Blinded', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      const originalRandom = Math.random;
      Math.random = () => 6 / 8; // firstRoll = 7 (Violet)
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Blinded',
          reason: 'Prismatic Spray (Violet ray)',
        }),
      );
    });
  });
});
