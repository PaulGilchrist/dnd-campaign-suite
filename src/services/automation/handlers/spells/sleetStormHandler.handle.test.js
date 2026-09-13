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
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';
import * as damageRollback from '../../common/damageRollback.js';

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

// ── Tests: handle — save results ───────────────────────────────

describe('sleetStormHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
  });

  describe('on successful save', () => {
    it('does not apply prone condition', async () => {
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

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.anything(),
        campaignName,
      );
    });

    it('posts save_result entry with success=true', async () => {
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
          rollType: 'save-sleet-storm',
        }),
      );
    });

    it('calls addTargetResult with success', async () => {
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

    it('handles addEntry rejection in successful save path', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      logService.addEntry.mockRejectedValue(new Error('log error'));
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const consoleError = vi.spyOn(console, 'error').mockReturnValue();

      const result = await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(consoleError).toHaveBeenCalledWith('[sleetStorm] Error:', expect.any(Error));
      expect(result.type).toBe('popup');
      consoleError.mockRestore();
    });
  });

  describe('on failed save', () => {
    it('applies prone condition to the target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        expect.arrayContaining(['prone']),
        campaignName,
      );
    });

    it('deduplicates prone if already present', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue(['prone', 'blinded']);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const conditionsArg = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'activeConditions',
      )[2];
      expect(conditionsArg.filter(c => String(c).toLowerCase() === 'prone').length).toBe(1);
    });

    it('stores condition metadata with DC and source', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeConditionMeta') return {};
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditionMeta',
        expect.objectContaining({
          prone: expect.objectContaining({
            dc: 15,
            ability: 'dex',
            source: 'sleet_storm',
          }),
        }),
        campaignName,
      );
    });

    it('calls addTargetResult with failure and prone condition', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(damageRollback.addTargetResult).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          targetName: 'Goblin',
          saveResult: 'failure',
          conditions: ['prone'],
        }),
      );
    });

    it('calls addExpiration to remove prone on concentration break', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: 'Goblin', effects: expect.arrayContaining([expect.objectContaining({ type: 'condition', condition: 'prone' })]), campaignName });
    });

    it('calls breakConcentration for the target', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(concentrationService.breakConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        'Goblin',
      );
    });

    it('posts concentration_lost log entry when brokenSpell is returned', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());
      concentrationService.breakConcentration.mockReturnValue('Fireball');

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const concLostCall = logService.addEntry.mock.calls.find(
        (c) => c[1].type === 'concentration_lost',
      );
      expect(concLostCall).toBeDefined();
      expect(concLostCall[1]).toEqual(
        expect.objectContaining({
          type: 'concentration_lost',
          characterName: 'Goblin',
          spellName: 'Fireball',
          reason: 'Sleet Storm spell',
        }),
      );
    });

    it('posts condition log entry for prone application', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
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
          condition: 'Prone',
          reason: 'Sleet Storm spell',
        }),
      );
    });

    it('tracks concentration loss for this creature', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const concKey = '_sleetStorm_concentration_TestWizard';
      const concCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === concKey,
      );
      expect(concCall).toBeDefined();
      expect(concCall[2]).toContain('Goblin');
    });

    it('stores sleet_storm effect in targetEffects', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockReturnValue([]);
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      expect(effectsCall).toBeDefined();
      const effects = effectsCall[2];
      const sleetEffect = effects.find(e => e.effect === 'sleet_storm');
      expect(sleetEffect).toBeDefined();
      expect(sleetEffect.target).toBe('Goblin');
      expect(sleetEffect.source).toBe(casterName);
      expect(sleetEffect.conditions).toContain('prone');
      expect(sleetEffect.duration).toBe('concentration');
      expect(sleetEffect.lostConcentration).toBe(true);
    });

    it('updates existing sleet_storm effect entry', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') {
          return [
            { target: 'Goblin', effect: 'sleet_storm', source: 'OldCaster', conditions: ['prone'] },
          ];
        }
        return null;
      });
      savePrompt.createSaveListener.mockReturnValue(failSaveListener());

      await handle(
        { ...makeAction(), metaCtx: { targets: ['Goblin'] } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const effectsCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1] === 'targetEffects',
      );
      const effects = effectsCall[2];
      const sleetEffect = effects.find(e => e.target === 'Goblin' && e.effect === 'sleet_storm');
      expect(sleetEffect.source).toBe(casterName);
    });
  });

  describe('tracking data storage', () => {
    it('stores sleet storm tracking data with all fields', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.startsWith('_sleetStorm_'),
      );
      expect(trackingCall).toBeDefined();
      expect(trackingCall[0]).toBe(casterName);
      expect(trackingCall[1]).toBe('_sleetStorm_TestWizard');
      expect(trackingCall[3]).toBe(campaignName);

      const data = trackingCall[2];
      expect(data).toEqual(
        expect.objectContaining({
          caster: casterName,
          mapName,
          campaignName,
          saveDc: 15,
          saveType: 'DEX',
          radius: 20,
          duration: expect.any(String),
        }),
      );
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('number');
    });

    it('uses duration from automation', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        { ...makeAction(), automation: { duration: '5_rounds' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.startsWith('_sleetStorm_'),
      );
      expect(trackingCall[2].duration).toBe('5_rounds');
    });

    it('handles caster name with spaces in tracking key', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const stats = makePlayerStats({ name: 'Test Wizard' });
      await handle(makeAction(), stats, campaignName, mapName);

      const trackingCall = useRuntimeState.setRuntimeValue.mock.calls.find(
        (c) => c[1]?.startsWith('_sleetStorm_'),
      );
      expect(trackingCall[1]).toBe('_sleetStorm_Test_Wizard');
    });
  });

  describe('duration parsing and expiration', () => {
    it('sets expiration for 1_minute duration (10 rounds)', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        { ...makeAction(), automation: { duration: '1_minute' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: expect.arrayContaining([expect.objectContaining({ type: 'remove_sleet_storm_area' })]), campaignName, rounds: 10 });
    });

    it('sets expiration for round-based duration', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        { ...makeAction(), automation: { duration: '3_rounds' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: casterName, targetName: casterName, effects: expect.any(Array), campaignName, rounds: 3 });
    });

    it('does not set expiration for unrecognized duration', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        { ...makeAction(), automation: { duration: 'unknown' } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });

    it('does not set expiration when duration is undefined', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(
        { ...makeAction(), automation: { duration: undefined } },
        makePlayerStats(),
        campaignName,
        mapName,
      );

      expect(expirations.addExpiration).not.toHaveBeenCalled();
    });
  });

  describe('concentration registration', () => {
    it('calls addConcentration with correct parameters', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      await handle(makeAction(), makePlayerStats(), campaignName, mapName);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        casterName,
        'Sleet Storm',
        15,
      );
      expect(storage.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
    });

    it('falls back to proficiency-based DC when spellAbilities.saveDc is missing', async () => {
      damageUtils.getCombatContext.mockResolvedValue(baseCombatContext);
      savePrompt.buildSaveDc.mockReturnValue(15);
      combatData.getCombatSummary.mockReturnValue({});
      storage.default.set.mockReturnValue(undefined);
      savePrompt.createSaveListener.mockReturnValue(successSaveListener());

      const stats = makePlayerStats({ spellAbilities: undefined, proficiency: 4 });
      await handle(makeAction(), stats, campaignName, mapName);

      expect(concentrationService.addConcentration).toHaveBeenCalledWith(
        expect.any(Object),
        casterName,
        'Sleet Storm',
        8 + 4, // formula: 8 + proficiency
      );
    });
  });
});
