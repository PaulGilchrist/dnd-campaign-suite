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

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'npc',
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
        abilities: [{ name: 'Charisma', score: chaScore }],
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: {
            type: 'dark_ones_blessing',
            tempHpExpression: 'CHA modifier + warlock level',
          },
        }],
      },
    };
  }

  beforeEach(() => {
    getRuntimeValue.mockClear();
    getRuntimeValue.mockImplementation(() => undefined);
    setRuntimeValue.mockClear();
  });

  it('grants temp HP to Fiend Patron when enemy reduced to 0 HP', () => {
    const goblin = createNpcCreature('Goblin', 6, 6);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock', 'tempHp', 8, 'TestCampaign');
  });

  it('uses minimum of 1 when CHA modifier + warlock level is 0 or negative', () => {
    const goblin = createNpcCreature('Goblin', 3, 3);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 1, 8, 1);

    applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock', 'tempHp', 1, 'TestCampaign');
  });

  it('does not grant temp HP to non-Fiend Patron warlocks', () => {
    const goblin = createNpcCreature('Goblin', 5, 5);
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
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: { type: 'dark_ones_blessing' },
        }],
      },
    };

    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not grant temp HP when feature is missing', () => {
    const goblin = createNpcCreature('Goblin', 5, 5);
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
        characterAdvancement: [],
      },
    };

    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not grant temp HP when no automation on feature', () => {
    const goblin = createNpcCreature('Goblin', 5, 5);
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
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: null,
        }],
      },
    };

    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not grant temp HP when damage is 0 (creature was immune)', () => {
    const skeleton = createNpcCreature('Skeleton', 10, 10, { immunities: ['necrotic'] });
    const cs = makeCombatSummary([skeleton]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    applyDamageToTarget(cs, 'Skeleton', 15, ['Necrotic'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('does not grant temp HP when creature was already at 0 HP', () => {
    const goblin = createNpcCreature('Goblin', 3, 0);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(goblin.currentHp).toBe(0);
  });

  it('adds to existing temp HP', () => {
    const goblin = createNpcCreature('Goblin', 6, 6);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'FiendWarlock' && key === 'tempHp') return 5;
      return undefined;
    });

    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock]);

    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock', 'tempHp', 13, 'TestCampaign');
  });
});
