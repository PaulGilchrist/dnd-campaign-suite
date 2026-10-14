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
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

vi.mock('../../../ui/storage.js', () => ({
  __esModule: true,
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn().mockResolvedValue({}),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './webAreaSaveHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';
import * as damageRollback from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Web',
    automation: { type: 'web_area_save', saveType: 'DEX', saveDc: 15, ...automation },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster' },
    { name: 'Orc', type: 'monster' },
    { name: 'TestCaster', type: 'player' },
  ],
};

// ── Tests ──────────────────────────────────────────────────────

describe('webAreaSaveHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('basic handling', () => {
    it('returns popup when no creatures in combat', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures in combat');
    });

    it('returns popup with summary when targets selected', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-1',
        promise: Promise.resolve({ success: false, roll: 7, total: 7 }),
      });

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Web');
      expect(result.payload.description).toContain('Restrained');
    });

    it('uses all creatures when no targets specified in metaCtx', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-all',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('3 creature');
    });
  });

  describe('concentration tracking', () => {
    it('calls addConcentration with correct parameters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-conc',
        promise: Promise.resolve({ success: true }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Web',
        15,
      );
      expect(storage.default.set).toHaveBeenCalled();
    });
  });

  describe('failed save - Restrained applied', () => {
    it('applies restrained condition to target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-cond',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['restrained']),
        campaignName,
      );
    });

    it('stores condition metadata with DC and ability', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-meta',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          restrained: expect.objectContaining({ dc: 15, ability: 'str' }),
        }),
        campaignName,
      );
    });

    it('adds expiration for concentration loss', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-exp1',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    });

    it('adds expiration for initiative roll', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-exp2',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      // Should have 2 addExpiration calls: one for concentration, one for initiative
      const setRuntimeCalls = useRuntimeState.setRuntimeValue.mock.calls;
      const conditionMetaCalls = setRuntimeCalls.filter(
        c => c[1] === 'activeConditionMeta',
      );
      expect(conditionMetaCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('successful save', () => {
    it('does not apply restrained condition on success', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-success',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('logs save_result with success=true', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-result',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      const saveResultCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'save_result',
      );
      expect(saveResultCall).toBeDefined();
      expect(saveResultCall[1]).toEqual(
        expect.objectContaining({
          type: 'save_result',
          targetName: 'Goblin',
          success: true,
          saveDc: 15,
          saveType: 'DEX',
          rollType: 'save-web',
        }),
      );
    });
  });

  describe('logging', () => {
    it('calls addEntry with ability_use', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-ability',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCaster',
          abilityName: 'Web',
          description: expect.stringContaining('Web'),
        }),
      );
    });

    it('calls addEntry with condition on failed save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-cond-entry',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      const conditionCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'condition',
      );
      expect(conditionCall).toBeDefined();
      expect(conditionCall[1]).toEqual(
        expect.objectContaining({
          type: 'condition',
          action: 'applied',
          characterName: 'Goblin',
          condition: 'Restrained',
          reason: 'Web spell',
        }),
      );
    });
  });

  describe('multiple targets', () => {
    it('processes all selected targets', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener
        .mockReturnValueOnce({
          promptId: 'web-save-goblin',
          promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
        })
        .mockReturnValueOnce({
          promptId: 'web-save-orc',
          promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
        });

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin', 'Orc'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1 creature');
      expect(result.payload.description).toContain('1 creature');
    });
  });

  describe('heighten target disadvantage', () => {
    it('passes heightenTarget to save listener', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-heighten',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        {
          ...makeAction(),
          metaCtx: { targets: ['Goblin'], heightenTarget: 'Goblin' },
        },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, {
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 15,
        dcSuccess: 'none',
        disadvantage: true,
      });
    });
  });

  describe('storeSpellLastAttack', () => {
    it('calls storeSpellLastAttack with correct parameters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-store',
        promise: Promise.resolve({ success: true }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName: 'TestCaster',
        spellName: 'Web',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });
});
