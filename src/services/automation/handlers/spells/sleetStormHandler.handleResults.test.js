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
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

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

function successSaveListener() {
  return {
    promptId: 'sleet-prompt',
    promise: Promise.resolve({ success: true, roll: 14, total: 14 }),
  };
}

// ── Tests: handle — storeSpellLastAttack, log entries, summary ─

describe('sleetStormHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('storeSpellLastAttack', () => {
    it('calls storeSpellLastAttack with correct parameters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(damageRollback.storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
        casterName,
        spellName: 'Sleet Storm',
        saveType: 'DEX',
        saveDc: 15,
        attackScope: 'aoe',
      });
    });
  });

  describe('log entries', () => {
    it('posts ability_use entry for each target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      // 3 targets = 3 ability_use entries
      const abilityEntries = logService.addEntry.mock.calls.filter(
        (c) => c[1].type === 'ability_use',
      );
      expect(abilityEntries.length).toBe(3);
      expect(abilityEntries[0][1]).toEqual(
        expect.objectContaining({
          type: 'ability_use',
          characterName: casterName,
          abilityName: 'Sleet Storm',
          description: expect.stringContaining('Sleet Storm'),
        }),
      );
    });

    it('includes promptId in ability_use entry', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue({
        promptId: 'sleet-test-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
      });

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const abilityEntry = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'ability_use',
      );
      expect(abilityEntry[1].promptId).toBe('sleet-test-prompt');
    });
  });

  describe('summary popup', () => {
    it('reports affected creature count when some fail', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('Sleet Storm affects 3 creature(s)');
    });

    it('reports saved creature count in the summary', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);

      let callCount = 0;
      savePrompt.createSaveListener.mockImplementation(() => {
        callCount++;
        return {
          promptId: 'sleet-prompt',
          promise: Promise.resolve({ success: callCount === 1 }),
        };
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('creature(s) saved');
    });

    it('reports no creatures affected when all save', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(result.payload.description).toContain('No creatures affected by Sleet Storm');
    });

    it('uses the action name in the popup payload', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const result = await handle(
        { name: 'Custom Sleet Storm', automation: makeAction().automation },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.name).toBe('Custom Sleet Storm');
    });
  });

  describe('multiple targets mixed results', () => {
    it('processes all targets with mixed save results', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);

      savePrompt.createSaveListener
        .mockReturnValueOnce(failSaveListener())
        .mockReturnValueOnce(successSaveListener());

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin', 'Orc'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(result.payload.description).toContain('1 creature');
      expect(result.payload.description).toContain('creature(s) saved');
    });
  });
});
