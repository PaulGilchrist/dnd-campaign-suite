import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

global.fetch = vi.fn(() => new Promise(() => {}));

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
        ...extra,
        };
}

function createMinimalCharacter(name) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
    },
  };
}

function stubPlayerRuntime(currentHp, conditions = []) {
  getRuntimeValue.mockReset();
  getRuntimeValue
    .mockReturnValueOnce([])                        // activeBuffs
    .mockReturnValueOnce(undefined)                 // arcaneWardActive
    .mockReturnValueOnce(currentHp)                 // currentHitPoints
    .mockReturnValueOnce([])                        // activeBuffs for Warding Bond check
    .mockReturnValueOnce(conditions);               // activeConditions
}

describe('Dark One\'s Blessing', () => {
  function createFiendWarlock(name, level, chaScore, warlockLevel) {
    return {
      name,
      computedStats: {
        resistances: [],
        immunities: [],
        level: level,
        hitPoints: { max: 20 },
        class: {
          name: 'Warlock',
          class_levels: [{ level: warlockLevel || level }],
          subclass: { name: 'Fiend Patron' },
        },
        class_levels: [{ level: warlockLevel || level }],
        abilities: [{ name: 'Charisma', score: chaScore }],
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: {
            type: 'dark_ones_blessing',
            tempHpExpression: 'CHA modifier + warlock level',
          },
        }],
        equipment: [],
        allFeatures: [],
      },
    };
  }

  beforeEach(() => {
    getRuntimeValue.mockClear();
    getRuntimeValue.mockImplementation(() => undefined);
    setRuntimeValue.mockClear();
  });



  it('does not grant temp HP to non-Fiend Patron warlocks', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = {
      name: 'OtherWarlock',
      computedStats: {
        resistances: [],
        immunities: [],
        level: 5,
        class: {
          name: 'Warlock',
          class_levels: [{ level: 5 }],
          subclass: { name: 'Great Old One Patron' },
        },
        class_levels: [{ level: 5 }],
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: { type: 'dark_ones_blessing' },
        }],
        equipment: [],
        allFeatures: [],
      },
    };

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('OtherWarlock', 'tempHp', expect.any(Number), 'TestCampaign');
  });

  it('does not grant temp HP when feature is missing', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = {
      name: 'NoFeatureWarlock',
      computedStats: {
        resistances: [],
        immunities: [],
        level: 5,
        class: {
          name: 'Warlock',
          class_levels: [{ level: 5 }],
          subclass: { name: 'Fiend Patron' },
        },
        class_levels: [{ level: 5 }],
        characterAdvancement: [],
        equipment: [],
        allFeatures: [],
      },
    };

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('NoFeatureWarlock', 'tempHp', expect.any(Number), 'TestCampaign');
  });

  it('does not grant temp HP when no automation on feature', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = {
      name: 'NoAutomationWarlock',
      computedStats: {
        resistances: [],
        immunities: [],
        level: 5,
        class: {
          name: 'Warlock',
          class_levels: [{ level: 5 }],
          subclass: { name: 'Fiend Patron' },
        },
        class_levels: [{ level: 5 }],
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: null,
        }],
        equipment: [],
        allFeatures: [],
      },
    };

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('NoAutomationWarlock', 'tempHp', expect.any(Number), 'TestCampaign');
  });

  it('does not grant temp HP when damage is 0 (creature was immune)', () => {
    const skeleton = createCreature('Skeleton', 10, 10, { immunities: ['necrotic'] });
    const cs = makeCombatSummary([skeleton]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    stubPlayerRuntime(10);
    applyDamageToTarget(cs, 'Skeleton', 15, ['Necrotic'], 'TestCampaign', [warlock, createMinimalCharacter('Skeleton')]);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('FiendWarlock', 'tempHp', expect.any(Number), 'TestCampaign');
  });

  it('does not grant temp HP when creature was already at 0 HP', () => {
    const goblin = createCreature('Goblin', 3, 0);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).not.toHaveBeenCalledWith('FiendWarlock', 'tempHp', expect.any(Number), 'TestCampaign');
    expect(goblin.currentHp).toBe(0);
  });

});
