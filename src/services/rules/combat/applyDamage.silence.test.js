// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import * as silenceService from '../../rules/features/silenceService.js';

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

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
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
  it('adds Thunder immunity when player is in silence zone and taking thunder damage', () => {
    silenceService.isCreatureInSilenceZone.mockImplementation(() => true);
    global.fetch.mockReset();

    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);

    // Provide a silence buff with sourceCharacter so the silence zone code path is triggered
    stubPlayerRuntime(20, [], [{ effect: 'silence', sourceCharacter: 'Bard' }]);

    const result = applyDamageToTarget(cs, 'Wizard', 10, ['Thunder'], 'TestCampaign', [
      createMinimalCharacter('Wizard'),
    ]);

    expect(result.finalDamage).toBe(0);
    expect(silenceService.isCreatureInSilenceZone).toHaveBeenCalledWith('Wizard', 'Bard', 'TestCampaign');
  });

  it('does not add Thunder immunity when not in silence zone, no silence buff, or silence buff lacks sourceCharacter', () => {
    // Not in silence zone
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();
    const player1 = createPlayerCreature('Wizard');
    const cs1 = makeCombatSummary([player1]);
    stubPlayerRuntime(20, [], [{ effect: 'silence', sourceCharacter: 'Bard' }]);
    let result = applyDamageToTarget(cs1, 'Wizard', 10, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).toHaveBeenCalledWith('Wizard', 'Bard', 'TestCampaign');

    // No silence buff
    silenceService.isCreatureInSilenceZone.mockClear();
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();
    const player2 = createPlayerCreature('Wizard2');
    const cs2 = makeCombatSummary([player2]);
    stubPlayerRuntime(20, [], []);
    result = applyDamageToTarget(cs2, 'Wizard2', 10, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Wizard2')]);
    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).not.toHaveBeenCalled();

    // Silence buff without sourceCharacter
    silenceService.isCreatureInSilenceZone.mockClear();
    silenceService.isCreatureInSilenceZone.mockImplementation(() => false);
    global.fetch.mockReset();
    const player3 = createPlayerCreature('Wizard3');
    const cs3 = makeCombatSummary([player3]);
    stubPlayerRuntime(20, [], [{ effect: 'silence' }]);
    result = applyDamageToTarget(cs3, 'Wizard3', 10, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Wizard3')]);
    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).not.toHaveBeenCalled();
  });

  it('Thunder immunity does not affect other damage types', () => {
    silenceService.isCreatureInSilenceZone.mockImplementation(() => true);
    global.fetch.mockReset();

    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);

    stubPlayerRuntime(20, [], [{ effect: 'silence', sourceCharacter: 'Bard' }]);

    const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [
      createMinimalCharacter('Wizard'),
    ]);

    expect(result.finalDamage).toBe(10);
  });
});

describe('Silence zone — does not apply to NPCs', () => {
  it('does not add Thunder immunity for NPC creatures', () => {
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

    const result = applyDamageToTarget(cs, 'Goblin', 10, ['Thunder'], 'TestCampaign', [
      createMinimalCharacter('Goblin'),
    ]);

    expect(result.finalDamage).toBe(10);
    expect(silenceService.isCreatureInSilenceZone).not.toHaveBeenCalled();
  });
});
