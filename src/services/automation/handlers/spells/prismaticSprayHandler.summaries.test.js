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
      damage: '12d6',
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

describe('prismaticSprayHandler.handle - summaries and edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('summary popup', () => {
    it('reports affected creature count when some fail', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      // Control random so Dragon doesn't get the fire (Red) ray it's immune to
      const originalRandom = Math.random;
      Math.random = () => 5 / 8; // firstRoll = 6 (Indigo) for all targets
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(result.payload.description).toContain('Prismatic Spray affects 3 creature(s)');
    });

    it('reports saved creature count in the summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(15);

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: 'prismatic-prompt',
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('reports no creatures affected when all save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.payload.description).toContain('No creatures affected by Prismatic Spray');
    });

    it('uses the action name in the popup payload', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(
        { name: 'Custom Prismatic Spray', automation: makeAction().automation },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.name).toBe('Custom Prismatic Spray');
    });

    it('includes immune count in summary when applicable', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      expect(result.payload.description).toContain('1 ray(s) immune');
    });

    it('includes individual ray results in summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red)
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(result.payload.description).toContain('Red ray');
    });
  });

  describe('mixed results across targets', () => {
    it('processes all targets with mixed save results', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      savePrompt.createSaveListener
        .mockReturnValueOnce(failSaveListener())
        .mockReturnValueOnce(successSaveListener())
        .mockReturnValueOnce(failSaveListener());

      const result = await handle(
        { ...makeAction(), metaCtx: { selectedTargets: ['Goblin', 'Orc', 'Dragon'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.payload.description).toContain('creature(s)');
      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('handles mixed immunity and non-immunity with save results', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      // Force Red ray (fire) which Dragon is immune to
      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)

      savePrompt.createSaveListener
        .mockReturnValueOnce(failSaveListener())
        .mockReturnValueOnce(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      Math.random = originalRandom;

      expect(result.payload.description).toContain('1 ray(s) immune');
      expect(result.payload.description).toContain('creature(s)');
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('handles single non-caster target', async () => {
      const singleTargetContext = {
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: [] } },
          { name: casterName, gridX: 5, gridY: 10 },
        ],
        players: [{ name: casterName, gridX: 5, gridY: 10 }],
        placedItems: [],
      };
      damageUtils.getCombatContext.mockResolvedValue(singleTargetContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      // Control random so a single ray is rolled (firstRoll = 6, Indigo — not 8)
      const originalRandom = Math.random;
      Math.random = () => 5 / 8;
      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(result.payload.description).toContain('Prismatic Spray affects 1 creature(s)');
    });

    it('handles empty automation object', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(
        { name: 'Prismatic Spray', automation: {} },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalled();
    });

    it('handles playerStats with no proficiency', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const ps = makePlayerStats({ proficiency: 0, abilities: [] });
      const result = await handle(makeAction(), ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(makeAction().automation, ps);
    });

    it('uses custom damage formula from automation', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 40 });
      applyDamage.computeDamageAfterSave.mockReturnValue(40);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      await handle(
        { ...makeAction(), automation: { damage: '12d6' } },
        makePlayerStats(),
        campaignName,
        null,
      );
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageFormula: '12d6',
        }),
      );
    });

    it('falls back to 12d6 when damage is not in automation', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      diceRoller.rollExpression.mockReturnValue({ total: 30 });
      applyDamage.computeDamageAfterSave.mockReturnValue(30);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const originalRandom = Math.random;
      Math.random = () => 0; // firstRoll = 1 (Red/Fire)
      const action = { name: 'Prismatic Spray', automation: { type: 'prismatic_spray', saveType: 'DEX', saveDc: 15 } };
      await handle(action, makePlayerStats(), campaignName, null);
      Math.random = originalRandom;

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageFormula: '12d6',
        }),
      );
    });
  });
});
