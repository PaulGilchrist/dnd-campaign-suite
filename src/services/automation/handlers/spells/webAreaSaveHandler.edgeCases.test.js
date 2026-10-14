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
// logService is mocked but not directly asserted in edge cases
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

describe('webAreaSaveHandler.handle - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('filter callback coverage - existing conditions', () => {
    it('filters out existing restrained condition before re-applying', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditions') return ['restrained', 'blinded'];
        if (key === 'activeConditionMeta') return { restrained: { dc: 10 } };
        return null;
      });

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-filter',
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
        ['blinded', 'restrained'],
        campaignName,
      );
    });
  });

  describe('edge cases', () => {
    it('returns popup with no targets when selectedTargetNames yields no matches', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['NonExistent'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures selected');
    });

    it('returns popup when combatSummary is null (no concentration tracking)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue(null);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-nconc',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(result.type).toBe('popup');
      expect(concentrationService.addConcentration).not.toHaveBeenCalled();
      expect(storage.default.set).not.toHaveBeenCalled();
    });

    it('uses fallback DC when spellAbilities is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      const casterStats = {
        name: 'TestCaster',
        level: 10,
        proficiency: 4,
        abilities: [{ name: 'Charisma', bonus: 3 }],
      };

      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-fallback',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        casterStats,
        campaignName,
        null,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Web',
        12,
      );
    });

    it('uses fallback proficiency when both spellAbilities and proficiency are missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      const casterStats = {
        name: 'TestCaster',
        level: 10,
        abilities: [{ name: 'Charisma', bonus: 3 }],
      };

      savePrompt.buildSaveDc.mockReturnValue(15);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-fallback2',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        casterStats,
        campaignName,
        null,
      );

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'TestCaster',
        'Web',
        10,
      );
    });

    it('handles action without automation property', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-no-automation',
        promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
      });

      await handle(
        { name: 'Web' },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith({}, makePlayerStats());
    });

    it('handles saveResult without roll/total properties', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue({});

      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'web-save-no-roll',
        promise: Promise.resolve({ success: false }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        null,
      );

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          roll: 0,
          total: 0,
        }),
      );
    });
  });
});
