// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'monster',
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

function createFiendWarlock(name, level, chaScore, warlockLevel) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      level,
      hitPoints: { max: 20 },
      class: {
        name: 'Warlock',
        class_levels: [{ level: warlockLevel ?? level }],
        subclass: { name: 'Fiend Patron' },
      },
      class_levels: [{ level: warlockLevel ?? level }],
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

function createNonFiendWarlock(name, level, chaScore, patronName) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      level,
      hitPoints: { max: 20 },
      class: {
        name: 'Warlock',
        class_levels: [{ level }],
        subclass: { name: patronName },
      },
      class_levels: [{ level }],
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

function stubPlayerRuntime(currentHp, conditions = [], extraOverrides = {}) {
  getRuntimeValue.mockReset();
  setRuntimeValue.mockReset();
  getRuntimeValue
    .mockImplementation((key, subKey) => {
      if (extraOverrides[subKey] !== undefined) return extraOverrides[subKey];
      if (subKey === 'activeBuffs') return [];
      if (subKey === 'arcaneWardActive') return undefined;
      if (subKey === 'arcaneWardHp') return 0;
      if (subKey === 'lastMetamagicDamage') return undefined;
      if (subKey === 'currentHitPoints') return currentHp;
      if (subKey === 'activeConditions') return conditions;
      return undefined;
    });
}

describe('Dark One\'s Blessing', () => {
  beforeEach(() => {
    getRuntimeValue.mockClear();
    setRuntimeValue.mockClear();
  });

  it('grants temp HP equal to CHA modifier + warlock level when a creature dies', () => {
    // CHA 16 -> modifier = 3, warlock level 5 -> 3 + 5 = 8 temp HP
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock', 'tempHp', 8, 'TestCampaign');
  });

  it('grants minimum 1 temp HP when CHA modifier + warlock level is 0 or negative', () => {
    // CHA 1 -> modifier = -5, warlock level 1 -> -5 + 1 = -4, clamped to 1
    const goblin = createCreature('Goblin', 3, 3);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('LowStatWarlock', 1, 1, 1);

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).toHaveBeenCalledWith('LowStatWarlock', 'tempHp', 1, 'TestCampaign');
  });

  it('stacks temp HP with existing temp HP value', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5); // 3 + 5 = 8

    stubPlayerRuntime(0, [], { tempHp: 3 }); // already has 3 temp HP
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    // existing 3 + 8 = 11
    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock', 'tempHp', 11, 'TestCampaign');
  });

  it('does not grant temp HP to non-Fiend Patron warlocks', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = createNonFiendWarlock('OtherWarlock', 5, 16, 'Great Old One Patron');

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    const tempHpCalls = setRuntimeValue.mock.calls.filter(
      (call) => call[1] === 'tempHp'
    );
    expect(tempHpCalls).toHaveLength(0);
  });

  it('does not grant temp HP when the feature is missing or lacks automation config', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);

    // Test: no characterAdvancement
    const warlockNoFeature = {
      ...createFiendWarlock('NoFeatureWarlock', 5, 16, 5),
      computedStats: {
        ...createFiendWarlock('NoFeatureWarlock', 5, 16, 5).computedStats,
        characterAdvancement: [],
      },
    };
    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlockNoFeature, createMinimalCharacter('Goblin')]);

    let tempHpCalls = setRuntimeValue.mock.calls.filter((call) => call[1] === 'tempHp');
    expect(tempHpCalls).toHaveLength(0);

    // Test: feature exists but automation is null
    const warlockNoAutomation = {
      ...createFiendWarlock('NoAutomationWarlock', 5, 16, 5),
      computedStats: {
        ...createFiendWarlock('NoAutomationWarlock', 5, 16, 5).computedStats,
        characterAdvancement: [{
          name: "Dark One's Blessing",
          automation: null,
        }],
      },
    };
    setRuntimeValue.mockClear();
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlockNoAutomation, createMinimalCharacter('Goblin')]);

    tempHpCalls = setRuntimeValue.mock.calls.filter((call) => call[1] === 'tempHp');
    expect(tempHpCalls).toHaveLength(0);
  });

  it('does not grant temp HP when the killing blow dealt 0 damage (immune)', () => {
    const skeleton = createCreature('Skeleton', 10, 10, { immunities: ['necrotic'] });
    const cs = makeCombatSummary([skeleton]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    stubPlayerRuntime(10);
    applyDamageToTarget(cs, 'Skeleton', 15, ['Necrotic'], 'TestCampaign', [warlock, createMinimalCharacter('Skeleton')]);

    const tempHpCalls = setRuntimeValue.mock.calls.filter(
      (call) => call[1] === 'tempHp'
    );
    expect(tempHpCalls).toHaveLength(0);
  });

  it('does not grant temp HP when the creature was already at 0 HP', () => {
    const goblin = createCreature('Goblin', 3, 0);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 5);

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    const tempHpCalls = setRuntimeValue.mock.calls.filter(
      (call) => call[1] === 'tempHp'
    );
    expect(tempHpCalls).toHaveLength(0);
    expect(goblin.currentHp).toBe(0);
  });

  it('falls back to character level when class_levels does not contain a matching entry', () => {
    // CHA 16 -> modifier = 3, class_levels has level 3 but computed.level is 5
    // find returns undefined, falls back to computed.level (5) -> 3 + 5 = 8 temp HP
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock = createFiendWarlock('FiendWarlock', 5, 16, 3);

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock', 'tempHp', 8, 'TestCampaign');
  });

  it('grants temp HP to each Fiend Patron warlock when multiple are present', () => {
    const goblin = createCreature('Goblin', 5, 5);
    const cs = makeCombatSummary([goblin]);
    const warlock1 = createFiendWarlock('FiendWarlock1', 5, 16, 5); // 3 + 5 = 8
    const warlock2 = createFiendWarlock('FiendWarlock2', 3, 20, 3); // 5 + 3 = 8

    stubPlayerRuntime(0);
    applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [warlock1, warlock2, createMinimalCharacter('Goblin')]);

    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock1', 'tempHp', 8, 'TestCampaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('FiendWarlock2', 'tempHp', 8, 'TestCampaign');
  });
});
