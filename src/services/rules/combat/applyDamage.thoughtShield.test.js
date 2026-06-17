import { describe, it, expect, vi } from 'vitest';

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
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

describe('Thought Shield — Psychic damage reflection', () => {
  function createPlayerWithThoughtShield(name, _hp) {
    return {
      name,
      computedStats: {
        resistances: ['psychic'],
        immunities: [],
        level: 10,
        class: { name: 'Warlock', class_levels: [{ level: 10 }] },
        characterAdvancement: [{ name: 'Thought Shield' }],
      },
    };
  }

  it('reflects psychic damage back to the attacker', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const warlockCreature = createPlayerCreature('Warlock');
    const cs = makeCombatSummary([goblin, warlockCreature]);
    const warlock = createPlayerWithThoughtShield('Warlock', 20);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

    expect(goblin.currentHp).toBe(5);
  });

  it('does not reflect non-psychic damage', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const cs = makeCombatSummary([goblin]);
    const warlock = createPlayerWithThoughtShield('Warlock', 20);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Warlock', 10, ['Fire'], 'TestCampaign', [warlock], false, 'Goblin');

    expect(goblin.currentHp).toBe(10);
  });

  it('does not reflect when player has no Thought Shield', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const cs = makeCombatSummary([goblin]);
    const fighter = {
      name: 'Fighter',
      computedStats: {
        resistances: [],
        immunities: [],
        level: 10,
        class: { name: 'Fighter', class_levels: [{ level: 10 }] },
        characterAdvancement: [],
      },
    };

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Fighter' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Fighter', 10, ['Psychic'], 'TestCampaign', [fighter], false, 'Goblin');

    expect(goblin.currentHp).toBe(10);
  });

  it('does not reflect when attackerName is null', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const warlockCreature = createPlayerCreature('Warlock');
    const cs = makeCombatSummary([goblin, warlockCreature]);
    const warlock = createPlayerWithThoughtShield('Warlock', 20);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    const result = applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, null);

    expect(result).not.toBeNull();
  });

  it('does not reflect when attacker is the player themselves', () => {
    const warlock = createPlayerWithThoughtShield('Warlock', 20);
    const cs = makeCombatSummary([
      createNpcCreature('Warlock', 20, 20),
      createNpcCreature('Goblin', 10, 10),
    ]);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Warlock');

    expect(cs.creatures[1].currentHp).toBe(10);
  });

  it('does not reflect when attacker is already dead', () => {
    const deadGoblin = createNpcCreature('Goblin', 5, 0);
    const cs = makeCombatSummary([deadGoblin]);
    const warlock = createPlayerWithThoughtShield('Warlock', 20);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

    expect(deadGoblin.currentHp).toBe(0);
  });

  it('reflects the final (resistance-reduced) damage amount', () => {
    const goblin = createNpcCreature('Goblin', 8, 8);
    const warlockCreature = createPlayerCreature('Warlock');
    const cs = makeCombatSummary([goblin, warlockCreature]);
    const warlock = createPlayerWithThoughtShield('Warlock', 20);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

    expect(goblin.currentHp).toBe(3);
  });

  it('triggers concentration check on attacker when reflected damage is dealt', () => {
    const goblin = createNpcCreature('Goblin', 10, 10, {
      concentration: { spell: 'Burning Hands', dc: 10 },
    });
    const cs = makeCombatSummary([goblin]);
    const warlock = createPlayerWithThoughtShield('Warlock', 20);

    getRuntimeValue.mockImplementation((charName, key) => {
      if (charName === 'Warlock' && key === 'currentHitPoints') return 20;
      return [];
    });

    applyDamageToTarget(cs, 'Warlock', 10, ['Psychic'], 'TestCampaign', [warlock], false, 'Goblin');

    expect(goblin.concentration.dc).toBe(10);
  });
});
