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

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../combat/automation/automationImmunities.js', () => ({
  playerIsImmuneToCondition: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
  breakConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
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

import { handle } from './sleetStormHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';

// ── Constants & Helpers ────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'test-map';
const casterName = 'TestWizard';

function makePlayerStats(overrides = {}) {
  return {
    name: casterName,
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    spellAbilities: { saveDc: 15 },
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Sleet Storm',
    automation: {
      type: 'sleet_storm',
      saveType: 'DEX',
      saveDc: 15,
      ...automation,
    },
  };
}

const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: casterName, type: 'player', gridX: 5, gridY: 10 },
  ],
  players: [{ name: casterName, gridX: 5, gridY: 10 }],
  placedItems: [],
};

function failSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
  };
}

// ── Tests: handle ──────────────────────────────────────────────

describe('sleetStormHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('early returns', () => {
    it('returns popup when no combat context', async () => {
      damageUtils.getCombatContext.mockResolvedValue(null);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
      expect(result.payload.description).toContain('Sleet Storm has no effect');
    });

    it('returns popup when combat context has no creatures', async () => {
      damageUtils.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('No creatures in combat');
    });
  });

  describe('target selection', () => {
    it('uses all creatures when no targets specified in metaCtx', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      // Uses all creatures from combat context (including caster)
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(3);
      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toContain('Goblin');
      expect(targetNames).toContain('Orc');
      expect(targetNames).toContain(casterName);
    });

    it('uses only selected targets from metaCtx', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({ targetName: 'Goblin' }),
      );
    });

    it('returns popup when selected targets are empty', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: [] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No creatures selected');
    });
  });

  describe('save prompt creation', () => {
    it('uses DEX save type and computed DC', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.buildSaveDc).toHaveBeenCalledWith(makeAction().automation, expect.any(Object));
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveType: 'DEX',
          saveDc: 15,
          dcSuccess: 'none',
        }),
      );
    });

    it('applies disadvantage when target is heightenTarget', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'], heightenTarget: 'Goblin' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

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
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'], heightenTarget: 'Orc' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          disadvantage: false,
        }),
      );
    });
  });

  describe('prone immunity', () => {
    it('skips save for targets with Prone immunity', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['Prone'] } },
          { name: 'Orc', type: 'monster' },
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      // Orc and caster get save prompts; Goblin is skipped
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).toContain('Orc');
      expect(targetNames).toContain(casterName);
      expect(targetNames).not.toContain('Goblin');
    });

    it('logs immunity entry for prone-immune target', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['prone'] } },
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'ability_use',
          description: expect.stringContaining('immune to Sleet Storm'),
        }),
      );
    });

    it('handles addEntry rejection in prone immunity path', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['Prone'] } },
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      logService.addEntry.mockRejectedValue(new Error('log error'));

      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(consoleError).toHaveBeenCalledWith('[sleetStorm] Error:', expect.any(Error));
      expect(result.type).toBe('popup');
      consoleError.mockRestore();
    });

    it('handles case-insensitive prone immunity check', async () => {
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'monster', weaknessesAndResistivities: { immunities: ['PRONE'] } },
          { name: 'Orc', type: 'monster' },
          { name: casterName, type: 'player', gridX: 5, gridY: 10 },
        ],
      });
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      // Goblin skipped; Orc and caster get saves
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(2);
      const targetNames = savePrompt.createSaveListener.mock.calls.map(c => c[1].targetName);
      expect(targetNames).not.toContain('Goblin');
    });
  });
});
