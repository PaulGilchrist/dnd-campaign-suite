// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { addEntry } from '../../ui/logService.js';
import storage from '../../ui/storage.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
  getStore: vi.fn(() => ({ keys: () => [] })),
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

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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
    it('grants concentration save advantage when Starry Form Dragon is active', async () => {
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

      await applyDamageToTarget(cs, 'Druid', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Druid', 1), ] });

      expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, true, false);
    });

    it('does not grant advantage for non-Dragon constellations', async () => {
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

      await applyDamageToTarget(cs, 'Druid', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Druid', 1), ] });

      expect(rollConcentrationSave).toHaveBeenCalledWith(0, 10, false, false);
    });
  });

  describe('Relentless Hunter — Ranger concentrating Hunter\'s Mark only', () => {
    const rangerFeatureLevels = [{ level: 13, features: [{ name: 'Relentless Hunter' }] }];

    it('skips concentration save for a Ranger with Relentless Hunter concentrating Hunter\'s Mark', async () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: "Hunter's Mark", dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([rangerCreature]);

      const rangerCharacter = createMinimalCharacter('Ranger', 13, {
        computedExtra: {
          class: { name: 'Ranger', class_levels: rangerFeatureLevels },
          level: 13,
        },
      });

      stubNpcRuntime(30);

      await applyDamageToTarget(cs, 'Ranger', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [rangerCharacter] });

      // Relentless Hunter suppresses the save for Hunter's Mark only
      expect(rollConcentrationSave).not.toHaveBeenCalled();
      expect(rangerCreature.concentration).not.toBeNull();
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'maintained',
        characterName: 'Ranger',
        condition: 'Concentration on Hunter\'s Mark',
        sourceName: 'Relentless Hunter',
      }));
    });

    it('DOES roll the concentration save for a qualifying Ranger concentrating a non-Hunter\'s-Mark spell (CLA-289)', async () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([rangerCreature]);

      const rangerCharacter = createMinimalCharacter('Ranger', 13, {
        computedExtra: {
          class: { name: 'Ranger', class_levels: rangerFeatureLevels },
          level: 13,
        },
      });

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 15 });

      await applyDamageToTarget(cs, 'Ranger', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [rangerCharacter] });

      expect(rollConcentrationSave).toHaveBeenCalled();
    });

    it('does not exempt a Ranger whose class_levels lack the Relentless Hunter feature', async () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: "Hunter's Mark", dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([rangerCreature]);

      const rangerCharacter = createMinimalCharacter('Ranger', 12, {
        computedExtra: {
          class: { name: 'Ranger', class_levels: [{ level: 12, features: [] }] },
          level: 12,
        },
      });

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 15 });

      await applyDamageToTarget(cs, 'Ranger', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [rangerCharacter] });

      expect(rollConcentrationSave).toHaveBeenCalled();
    });

    it('does not exempt non-Rangers regardless of level', async () => {
      const wizardCreature = createNpcCreature('Wizard', 30, 30, {
        concentration: { spell: "Hunter's Mark", dc: 10 },
        saveBonuses: { con: 0 },
      });
      const cs = makeCombatSummary([wizardCreature]);

      const wizardCharacter = createMinimalCharacter('Wizard', 1, {
        computedExtra: {
          class: { name: 'Wizard', class_levels: [{ level: 20, features: [{ name: 'Relentless Hunter' }] }] },
          level: 20,
        },
      });

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 15 });

      await applyDamageToTarget(cs, 'Wizard', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [wizardCharacter] });

      expect(rollConcentrationSave).toHaveBeenCalled();
    });

    it('throws when Ranger player level is null (Hunter\'s Mark concentration)', async () => {
      const rangerCreature = createNpcCreature('Ranger', 30, 30, {
        concentration: { spell: "Hunter's Mark", dc: 10 },
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
          class: { name: 'Ranger', class_levels: rangerFeatureLevels },
          level: null,
        },
      };

      stubNpcRuntime(30);

      await expect(applyDamageToTarget(cs, 'Ranger', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [rangerCharacter] })).rejects.toThrow('player level is required for relentless hunter check');
    });
  });



  describe('concentration save logging', () => {
    it('logs a condition entry when NPC fails save (no special features)', async () => {
      const orcCreature = createNpcCreature('Orc', 30, 30, {
        concentration: { spell: 'Haste', dc: 15 },
        saveBonuses: { con: -1 },
      });
      const cs = makeCombatSummary([orcCreature]);

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 5, total: 4 });

      await applyDamageToTarget(cs, 'Orc', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Orc', 1), ] });

      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: 'Orc',
        condition: 'Concentrating on Haste',
      }));
      expect(orcCreature.concentration).toBeNull();
    });

    it('logs a roll entry when NPC passes save (no special features)', async () => {
      const orcCreature = createNpcCreature('Orc', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 5 },
      });
      const cs = makeCombatSummary([orcCreature]);

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 12, total: 17 });

      await applyDamageToTarget(cs, 'Orc', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Orc', 1), ] });

      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'roll',
        rollType: 'save',
        characterName: 'Orc',
        name: 'Concentration Save',
        saveType: 'CON',
        saveDc: 10,
        saveResult: 'success',
      }));
      expect(orcCreature.concentration).not.toBeNull();
    });
  });

  describe('CLA-395: null/absent activeBuffs on EB monsters', () => {
    it('does not throw, rolls concentration save, and persists damage when activeBuffs is null', async () => {
      const wight = createNpcCreature('Wight 1', 82, 82, {
        concentration: { spell: 'Wight Hold Person', dc: 10 },
        saveBonuses: { con: 2 },
      });
      const cs = makeCombatSummary([wight]);

      stubNpcRuntime(82, [], { activeBuffs: null });
      rollConcentrationSave.mockReturnValue({ success: false, roll: 3, total: 5, rawRolls: [3] });

      await expect(applyDamageToTarget(cs, 'Wight 1', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('EvasiveFighter', 18), ] })).resolves.toBeTruthy();

      expect(rollConcentrationSave).toHaveBeenCalledWith(2, 10, false, false);
      expect(wight.currentHp).toBe(72);
      expect(wight.concentration).toBeNull();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'TestCampaign');
      expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
        type: 'condition',
        action: 'removed',
        characterName: 'Wight 1',
        condition: 'Concentrating on Wight Hold Person',
      }));
    });

    it('does not throw when activeBuffs runtime key is absent (undefined)', async () => {
      const wight = createNpcCreature('Wight 1', 82, 82, {
        concentration: { spell: 'Wight Hold Person', dc: 10 },
        saveBonuses: { con: 2 },
      });
      const cs = makeCombatSummary([wight]);

      getRuntimeValue.mockReset();
      getRuntimeValue.mockImplementation((_charName, key) => {
        if (key === 'arcaneWardActive') return false;
        if (key === 'arcaneWardHp') return 0;
        if (key === 'currentHitPoints') return 82;
        if (key === 'activeConditions') return [];
        if (key === 'targetEffects') return [];
        if (key === 'tempHp') return 0;
        return undefined;
      });
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 17, rawRolls: [15] });

      await expect(applyDamageToTarget(cs, 'Wight 1', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('EvasiveFighter', 18), ] })).resolves.toBeTruthy();

      expect(rollConcentrationSave).toHaveBeenCalledWith(2, 10, false, false);
      expect(wight.currentHp).toBe(72);
      expect(wight.concentration).not.toBeNull();
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'TestCampaign');
    });

    it('still rolls the save with activeBuffs present (control)', async () => {
      const wight = createNpcCreature('Wight 1', 82, 82, {
        concentration: { spell: 'Wight Hold Person', dc: 10 },
        saveBonuses: { con: 2 },
      });
      const cs = makeCombatSummary([wight]);

      stubNpcRuntime(82, [], { activeBuffs: [{ name: 'Some Buff' }] });
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 17, rawRolls: [15] });

      await expect(applyDamageToTarget(cs, 'Wight 1', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('EvasiveFighter', 18), ] })).resolves.toBeTruthy();

      expect(rollConcentrationSave).toHaveBeenCalledWith(2, 10, false, false);
      expect(wight.currentHp).toBe(72);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'TestCampaign');
    });

    it('still grants Dragon Starry Form advantage from a populated activeBuffs array', async () => {
      const wight = createNpcCreature('Wight 1', 82, 82, {
        concentration: { spell: 'Wight Hold Person', dc: 10 },
        saveBonuses: { con: 2 },
      });
      const cs = makeCombatSummary([wight]);

      stubNpcRuntime(82, [], { activeBuffs: [{ name: 'Starry Form', constellation: 'Dragon' }] });
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 17, rawRolls: [15] });

      await applyDamageToTarget(cs, 'Wight 1', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('EvasiveFighter', 18), ] });

      expect(rollConcentrationSave).toHaveBeenCalledWith(2, 10, true, false);
      expect(wight.currentHp).toBe(72);
    });
  });

  describe('save bonus from creature', () => {
    it('uses creature saveBonuses con for concentration save', async () => {
      const creature = createNpcCreature('Orc', 30, 30, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 3 },
      });
      const cs = makeCombatSummary([creature]);

      stubNpcRuntime(30);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 10, total: 13 });

      await applyDamageToTarget(cs, 'Orc', 10, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Orc', 1), ] });

      expect(rollConcentrationSave).toHaveBeenCalledWith(3, 10, false, false);
    });
  });
});
