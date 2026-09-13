// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import * as silenceService from '../../rules/features/silenceService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
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

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createMinimalCharacter(name, extra = {}) {
  return {
    name,
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

function stubPlayerRuntime(currentHp, conditions = [], activeBuffs = [], arcaneWardActive = false, arcaneWardHp = 0) {
  getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
    if (key === 'activeBuffs') return activeBuffs;
    if (key === 'arcaneWardActive') return arcaneWardActive;
    if (key === 'arcaneWardHp') return arcaneWardHp;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'activeConditions') return conditions;
    return undefined;
  });
}

// ── Tests ───────────────────────────────────────────────────────

describe('Silence zone — Thunder immunity for players', () => {
  it('adds Thunder immunity when player is in silence zone and taking thunder damage', async () => {
    silenceService.isCreatureInSilenceZone.mockImplementation(() => true);
    global.fetch.mockReset();

    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);

    // Provide a silence buff with sourceCharacter so the silence zone code path is triggered
    stubPlayerRuntime(20, [], [{ effect: 'silence', sourceCharacter: 'Bard' }]);

    const result = await applyDamageToTarget(cs, 'Wizard', 10, ['Thunder'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Wizard'), ] });

    expect(result.finalDamage).toBe(0);
    expect(silenceService.isCreatureInSilenceZone).toHaveBeenCalledWith('Wizard', 'Bard', 'TestCampaign');
  });

  it('does not add Thunder immunity when not in silence zone, no silence buff, or silence buff lacks sourceCharacter', async () => {
    // Not in silence zone
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();
    const player1 = createPlayerCreature('Wizard');
    const cs1 = makeCombatSummary([player1]);
    stubPlayerRuntime(20, [], [{ effect: 'silence', sourceCharacter: 'Bard' }]);
    let result = await applyDamageToTarget(cs1, 'Wizard', 10, ['Thunder'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard')] });
    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).toHaveBeenCalledWith('Wizard', 'Bard', 'TestCampaign');

    // No silence buff
    silenceService.isCreatureInSilenceZone.mockClear();
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();
    const player2 = createPlayerCreature('Wizard2');
    const cs2 = makeCombatSummary([player2]);
    stubPlayerRuntime(20, [], []);
    result = await applyDamageToTarget(cs2, 'Wizard2', 10, ['Thunder'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard2')] });
    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).not.toHaveBeenCalled();

    // Silence buff without sourceCharacter
    silenceService.isCreatureInSilenceZone.mockClear();
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();
    const player3 = createPlayerCreature('Wizard3');
    const cs3 = makeCombatSummary([player3]);
    stubPlayerRuntime(20, [], [{ effect: 'silence' }]);
    result = await applyDamageToTarget(cs3, 'Wizard3', 10, ['Thunder'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard3')] });
    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).not.toHaveBeenCalled();
  });

  it('Thunder immunity does not affect other damage types', async () => {
    silenceService.isCreatureInSilenceZone.mockImplementation(() => true);
    global.fetch.mockReset();

    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);

    stubPlayerRuntime(20, [], [{ effect: 'silence', sourceCharacter: 'Bard' }]);

    const result = await applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Wizard'), ] });

    expect(result.finalDamage).toBe(10);
  });
});

describe('Silence zone — NPC creatures', () => {
  it('adds Thunder immunity for NPC creatures with a silence buff in the zone (SP-106)', async () => {
    silenceService.isCreatureInSilenceZone.mockImplementation(() => true);
    global.fetch.mockReset();

    const npc = {
      name: 'Thug 1',
      type: 'monster',
      maxHp: 32,
      currentHp: 32,
      resistances: [],
      immunities: [],
      conditions: [],
      template: [],
      concentration: null,
      saveBonuses: {},
    };
    const cs = makeCombatSummary([npc]);

    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [{ name: 'Silence', effect: 'silence', sourceCharacter: 'Divine_Cleric' }];
      if (key === 'currentHitPoints') return 32;
      if (key === 'activeConditions') return ['deafened'];
      if (key === 'tempHp') return 0;
      if (key === 'polymorphTempHp') return 0;
      return undefined;
    });

    const logModule = await import('../../ui/logService.js');
    logModule.addEntry.mockClear();

    const result = await applyDamageToTarget(cs, 'Thug 1', 9, ['Thunder'], { campaignName: 'TestCampaign', characters: [] });

    expect(silenceService.isCreatureInSilenceZone).toHaveBeenCalledWith('Thug 1', 'Divine_Cleric', 'TestCampaign');
    expect(result.finalDamage).toBe(0);
    expect(npc.immunities).toEqual([]);
    expect(npc.currentHp).toBe(32);
    const immunityLog = logModule.addEntry.mock.calls.find(
      (c) => c[1].type === 'automation' && c[1].name === 'Silence'
    );
    expect(immunityLog).toBeDefined();
    expect(immunityLog[1].description).toContain('immune to Thunder');
    expect(immunityLog[1].description).toContain('9 damage negated');
  });

  it('does not add Thunder immunity for NPC creatures outside the zone', async () => {
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();

    const npc = {
      name: 'Thug 2',
      type: 'monster',
      maxHp: 32,
      currentHp: 32,
      resistances: [],
      immunities: [],
      conditions: [],
      template: [],
      concentration: null,
      saveBonuses: {},
    };
    const cs = makeCombatSummary([npc]);

    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [{ name: 'Silence', effect: 'silence', sourceCharacter: 'Divine_Cleric' }];
      if (key === 'currentHitPoints') return 32;
      if (key === 'activeConditions') return [];
      if (key === 'tempHp') return 0;
      if (key === 'polymorphTempHp') return 0;
      return undefined;
    });

    const result = await applyDamageToTarget(cs, 'Thug 2', 9, ['Thunder'], { campaignName: 'TestCampaign', characters: [] });

    expect(result.finalDamage).toBe(9);
    expect(npc.currentHp).toBe(23);
  });

  it('does not consult silence for NPC creatures with no silence buff', async () => {
    silenceService.isCreatureInSilenceZone.mockClear();
    silenceService.isCreatureInSilenceZone.mockImplementation(() => true);
    global.fetch.mockReset();

    const npc = {
      name: 'Goblin',
      type: 'monster',
      maxHp: 10,
      currentHp: 10,
      resistances: [],
      immunities: [],
      conditions: [],
      template: [],
      concentration: null,
      saveBonuses: {},
    };
    const cs = makeCombatSummary([npc]);

    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 10;
      if (key === 'activeConditions') return [];
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'targetEffects') return [];
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });

    const result = await applyDamageToTarget(cs, 'Goblin', 10, ['Thunder'], { campaignName: 'TestCampaign', characters: [ createMinimalCharacter('Goblin'), ] });

    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).not.toHaveBeenCalled();
  });
});
