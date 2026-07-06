// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { postLogEntry } from '../../shared/logPoster.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
}));

// ── Globals ─────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createMinimalCharacter(name, charLevel, extra = {}) {
  return {
    name,
    level: charLevel ?? 1,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
      ...extra.computedExtra,
    },
    ...extra,
  };
}

function stubNpcRuntime(currentHp, conditions = [], extraOverrides = {}) {
  getRuntimeValue.mockReset();
  getRuntimeValue
    .mockImplementation((_charName, key, _campaignName) => {
      if (extraOverrides[key] !== undefined) return extraOverrides[key];
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return currentHp;
      if (key === 'activeConditions') return conditions;
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'targetEffects') return [];
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });
}

// ── Tests ───────────────────────────────────────────────────────

describe('NPC Concentration — Dragon Constellation & Relentless Hunter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Dragon Constellation advantage', () => {
    it('grants concentration save advantage when Starry Form Dragon is active', () => {
      const dragonConstellationCreature = createNpcCreature('Druid', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([dragonConstellationCreature]);

      getRuntimeValue.mockReset();
      getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Dragon' }];
        if (key === 'arcaneWardActive') return false;
        if (key === 'arcaneWardHp') return 0;
        if (key === 'lastMetamagicDamage') return undefined;
        if (key === 'currentHitPoints') return 30;
        if (key === 'activeConditions') return [];
        if (key === 'holyAuraSaveDc') return undefined;
        if (key === 'stealthAttackCost') return undefined;
        if (key === 'targetEffects') return [];
        if (key === 'tempHp') return 0;
        if (key === 'resistanceUsedThisTurn') return undefined;
        return undefined;
      });

      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });

      applyDamageToTarget(cs, 'Druid', 10, ['Slashing'], 'TestCampaign', [
        createMinimalCharacter('Druid', 1),
      ]);

      expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, true);
    });

    it('does not grant advantage for non-Dragon constellations', () => {
      const druidCreature = createNpcCreature('Druid', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([druidCreature]);

      getRuntimeValue.mockReset();
      getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
        if (key === 'activeBuffs') return [{ name: 'Starry Form', constellation: 'Raven' }];
        if (key === 'arcaneWardActive') return false;
        if (key === 'arcaneWardHp') return 0;
        if (key === 'lastMetamagicDamage') return undefined;
        if (key === 'currentHitPoints') return 30;
        if (key === 'activeConditions') return [];
        if (key === 'holyAuraSaveDc') return undefined;
        if (key === 'stealthAttackCost') return undefined;
        if (key === 'targetEffects') return [];
        if (key === 'tempHp') return 0;
        if (key === 'resistanceUsedThisTurn') return undefined;
        return undefined;
      });

      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 15 });

      applyDamageToTarget(cs, 'Druid', 10, ['Slashing'], 'TestCampaign', [
        createMinimalCharacter('Druid', 1),
      ]);

      expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, false);
    });
  });

  describe('Relentless Hunter — Ranger level 13+', () => {
    it('skips concentration save for Rangers level 13+', () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([rangerCreature]);

      const rangerCharacter = createMinimalCharacter('Ranger', 13, {
        computedExtra: {
          class: { name: 'Ranger', class_levels: [{ level: 13 }] },
          level: 13,
        },
      });

      stubNpcRuntime(30);

      applyDamageToTarget(cs, 'Ranger', 10, ['Slashing'], 'TestCampaign', [rangerCharacter]);

      // Relentless Hunter skips the concentration save entirely
      expect(rollConcentrationSave).not.toHaveBeenCalled();
      // Concentration should still be active
      expect(rangerCreature.concentration).not.toBeNull();
    });

    it('does not skip concentration save for Rangers below level 13', () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([rangerCreature]);

      const rangerCharacter = createMinimalCharacter('Ranger', 10, {
        computedExtra: {
          class: { name: 'Ranger', class_levels: [{ level: 10 }] },
          level: 10,
        },
      });

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 15 });

      applyDamageToTarget(cs, 'Ranger', 10, ['Slashing'], 'TestCampaign', [rangerCharacter]);

      expect(rollConcentrationSave).toHaveBeenCalled();
    });

    it('does not skip concentration save for non-Rangers regardless of level', () => {
      const wizardCreature = createNpcCreature('Wizard', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([wizardCreature]);

      const wizardCharacter = createMinimalCharacter('Wizard', 1, {
        computedExtra: {
          class: { name: 'Wizard', class_levels: [{ level: 20 }] },
          level: 20,
        },
      });

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 15 });

      applyDamageToTarget(cs, 'Wizard', 10, ['Slashing'], 'TestCampaign', [wizardCharacter]);

      expect(rollConcentrationSave).toHaveBeenCalled();
    });

    it('throws when Ranger player level is null', () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([rangerCreature]);

      const rangerCharacter = {
        name: 'Ranger',
        level: null,
        computedStats: {
          resistances: [],
          immunities: [],
          class_levels: [],
          equipment: [],
          characterAdvancement: [],
          allFeatures: [],
          automation: { passives: [] },
          class: { name: 'Ranger', class_levels: [{ level: 13 }] },
          level: null,
        },
      };

      stubNpcRuntime(30);

      expect(() => applyDamageToTarget(
        cs, 'Ranger', 10, ['Slashing'], 'TestCampaign', [rangerCharacter],
      )).toThrow('player level is required for relentless hunter check');
    });
  });



  describe('concentration save logging', () => {
    it('logs concentration-broken when NPC fails save (no special features)', () => {
      const orcCreature = createNpcCreature('Orc', 30, 30, {
        concentration: { spell: 'Haste', dc: 15 },
        saveBonuses: { con: -1 },
      });
      const cs = makeCombatSummary([orcCreature]);

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 5, total: 4 });

      applyDamageToTarget(cs, 'Orc', 10, ['Slashing'], 'TestCampaign', [
        createMinimalCharacter('Orc', 1),
      ]);

      expect(postLogEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'concentration-broken',
        characterName: 'Orc',
        spellName: 'Haste',
        roll: 5,
        total: 4,
        dc: 10,
      }));
      expect(orcCreature.concentration).toBeNull();
    });

    it('logs concentration-save when NPC passes save (no special features)', () => {
      const orcCreature = createNpcCreature('Orc', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 5 },
      });
      const cs = makeCombatSummary([orcCreature]);

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 12, total: 17 });

      applyDamageToTarget(cs, 'Orc', 10, ['Slashing'], 'TestCampaign', [
        createMinimalCharacter('Orc', 1),
      ]);

      expect(postLogEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'concentration-save',
        characterName: 'Orc',
        spellName: 'Haste',
        roll: 12,
        total: 17,
        dc: 10,
        success: true,
      }));
      expect(orcCreature.concentration).not.toBeNull();
    });
  });

  describe('save bonus from creature', () => {
    it('uses creature saveBonuses con for concentration save', () => {
      const creature = createNpcCreature('Orc', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 3 },
      });
      const cs = makeCombatSummary([creature]);

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 10, total: 13 });

      applyDamageToTarget(cs, 'Orc', 10, ['Slashing'], 'TestCampaign', [
        createMinimalCharacter('Orc', 1),
      ]);

      expect(rollConcentrationSave).toHaveBeenCalledWith(3, 10, false);
    });
  });
});
