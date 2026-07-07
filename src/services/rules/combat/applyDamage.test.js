// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

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

// ── Imports ─────────────────────────────────────────────────────

import {
  computeDamageAfterResistances,
  computeDamageAfterSave,
  hasEvasionForSave,
  computeDamageAfterEvasion,
  rollSaveForCreature,
  applyDamageToTarget,
} from './applyDamage.js';

import { rollD20 } from '../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'player',
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

function createPlayerCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createPlayerCharacter(name, extra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      ...extra.computedExtra,
    },
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
    .mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      if (subKey === 'arcaneWardActive') return undefined;
      if (subKey === 'arcaneWardHp') return 0;
      if (subKey === 'lastMetamagicDamage') return undefined;
      if (subKey === 'currentHitPoints') return currentHp;
      if (subKey === 'activeConditions') return conditions;
      return undefined;
    });
}

function stubNpcRuntime(currentHp, conditions = []) {
  getRuntimeValue.mockReset();
  getRuntimeValue
    .mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      if (subKey === 'arcaneWardActive') return undefined;
      if (subKey === 'arcaneWardHp') return 0;
      if (subKey === 'lastMetamagicDamage') return undefined;
      if (subKey === 'currentHitPoints') return currentHp;
      if (subKey === 'activeConditions') return conditions;
      return undefined;
    });
}

// ── Tests ───────────────────────────────────────────────────────

describe('computeDamageAfterResistances', () => {
  it('throws when damageTypes is null, undefined, empty, or contains null/empty entries', () => {
    expect(() => computeDamageAfterResistances(10, null)).toThrow();
    expect(() => computeDamageAfterResistances(10, undefined)).toThrow();
    expect(() => computeDamageAfterResistances(10, [])).toThrow();
    expect(() => computeDamageAfterResistances(10, [null])).toThrow();
    expect(() => computeDamageAfterResistances(10, [''])).toThrow();
  });

  it('returns raw damage when no resistances or immunities match', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], [], [])).toBe(10);
    expect(computeDamageAfterResistances(15, ['Fire', 'Cold'], ['poison'], [])).toBe(15);
  });

  it('applies immunity — returns 0', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], [], ['fire'])).toBe(0);
    expect(computeDamageAfterResistances(10, ['FIRE'], [], ['Fire'])).toBe(0);
  });

  it('applies resistance — halves damage with Math.floor', () => {
    expect(computeDamageAfterResistances(9, ['Fire'], ['fire'], [])).toBe(4);
    expect(computeDamageAfterResistances(10, ['fire'], ['Fire'], [])).toBe(5);
  });

  it('immunity takes priority over resistance for the same type', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], ['fire'], ['fire'])).toBe(0);
  });

  it('checks all damage types in array — halved on first resistance match, zero on immunity', () => {
    expect(computeDamageAfterResistances(10, ['Fire', 'Cold'], ['cold'], [])).toBe(5);
    expect(computeDamageAfterResistances(20, ['Fire', 'Cold'], [], ['cold'])).toBe(0);
  });
});

describe('computeDamageAfterSave', () => {
  it('returns raw damage when save fails regardless of dcSuccess', () => {
    expect(computeDamageAfterSave(10, false, 'half')).toBe(10);
  });

  it('returns half damage on success with dcSuccess "half"', () => {
    expect(computeDamageAfterSave(9, true, 'half')).toBe(4);
    expect(computeDamageAfterSave(10, true, 'half')).toBe(5);
  });

  it('returns 0 on success with any dcSuccess other than "half"', () => {
    expect(computeDamageAfterSave(10, true, 'none')).toBe(0);
  });

  it('returns 0 damage when raw damage is 0', () => {
    expect(computeDamageAfterSave(0, true, 'half')).toBe(0);
    expect(computeDamageAfterSave(0, false, 'half')).toBe(0);
  });
});

describe('rollSaveForCreature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct shape with single roll', () => {
    rollD20.mockReturnValueOnce(15);
    const creature = { saveBonuses: { dex: 3 } };
    const result = rollSaveForCreature(creature, 'dex', 18);
    expect(result).toEqual({
      roll: 15,
      total: 18,
      bonus: 3,
      success: true,
      rawRolls: [15, 15],
    });
  });

  it('takes minimum of two rolls on disadvantage', () => {
    rollD20.mockReturnValueOnce(17).mockReturnValueOnce(5);
    const creature = { saveBonuses: { con: 2 } };
    const result = rollSaveForCreature(creature, 'con', 18, true);
    expect(result.roll).toBe(5);
    expect(result.total).toBe(7);
    expect(result.success).toBe(false);
    expect(result.rawRolls).toEqual([17, 5]);
  });

  it('takes maximum of two rolls on advantage', () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(17);
    const creature = { saveBonuses: { con: 2 } };
    const result = rollSaveForCreature(creature, 'con', 18, false, true);
    expect(result.roll).toBe(17);
    expect(result.total).toBe(19);
    expect(result.success).toBe(true);
    expect(result.rawRolls).toEqual([5, 17]);
  });

  it('handles null creature, negative bonus, and ties as success', () => {
    rollD20.mockReturnValueOnce(8);
    expect(rollSaveForCreature(null, 'wis', 15).success).toBe(false);

    rollD20.mockReturnValueOnce(15);
    const negResult = rollSaveForCreature({ saveBonuses: { dex: -3 } }, 'dex', 18);
    expect(negResult.total).toBe(12);
    expect(negResult.success).toBe(false);

    rollD20.mockReturnValueOnce(10);
    const tieResult = rollSaveForCreature({ saveBonuses: { con: 5 } }, 'con', 15);
    expect(tieResult.success).toBe(true);
  });
});

describe('applyDamageToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('returns null when combatSummary is null or undefined', () => {
    expect(applyDamageToTarget(null, 'Goblin', 5, ['Bludgeoning'], 'TestCampaign')).toBeNull();
    expect(applyDamageToTarget(undefined, 'Goblin', 5, ['Bludgeoning'], 'TestCampaign')).toBeNull();
  });

  it('returns null when target creature not found', () => {
    const cs = makeCombatSummary([createNpcCreature('Orc', 10, 10)]);
    expect(applyDamageToTarget(cs, 'MissingTarget', 5, ['Slashing'], 'TestCampaign')).toBeNull();
  });

  describe('NPC damage application', () => {
    it('reduces NPC HP and returns result object', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Goblin', 6, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(4);
      expect(result.finalDamage).toBe(6);
      expect(result.damageReduced).toBe(false);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 4, 'TestCampaign');
    });

    it('clamps HP to 0 when damage exceeds max', () => {
      stubNpcRuntime(5);
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 0, 'TestCampaign');
    });

    it('applies resistance for NPC', () => {
      stubNpcRuntime(100);
      const npc = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { resistances: ['fire'] },
      })]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'currentHitPoints', 95, 'TestCampaign');
    });

    it('applies immunity for NPC', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Skeleton', 20, 20, { immunities: ['necrotic'] });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Skeleton', 15, ['Necrotic'], 'TestCampaign', [createPlayerCharacter('Skeleton', {
        computedExtra: { immunities: ['necrotic'] },
      })]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Skeleton', 'currentHitPoints', 20, 'TestCampaign');
    });

    it('removes frightened condition on NPC taking damage > 0, preserves other conditions, and does not remove when immune', () => {
      stubNpcRuntime(10, ['frightened']);
      const npc1 = createNpcCreature('Goblin', 10, 10, {
        conditions: [{ key: 'frightened' }],
      });
      const cs1 = makeCombatSummary([npc1]);
      applyDamageToTarget(cs1, 'Goblin', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], 'TestCampaign');

      stubNpcRuntime(10, ['frightened', 'poisoned']);
      const npc2 = createNpcCreature('Goblin2', 10, 10, {
        conditions: [{ key: 'frightened' }, { key: 'poisoned' }],
      });
      const cs2 = makeCombatSummary([npc2]);
      applyDamageToTarget(cs2, 'Goblin2', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Goblin2')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin2', 'activeConditions', ['poisoned'], 'TestCampaign');

      stubNpcRuntime(100, ['frightened']);
      const npc3 = createNpcCreature('Dragon', 100, 100, {
        immunities: ['fire'],
        conditions: [{ key: 'frightened' }],
      });
      const cs3 = makeCombatSummary([npc3]);
      applyDamageToTarget(cs3, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { immunities: ['fire'] },
      })]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'currentHitPoints', 100, 'TestCampaign');
    });

    it('removes charmed condition on NPC when endsOnDamage is true', () => {
      stubNpcRuntime(10, ['charmed']);
      const npc = createNpcCreature('Wolf', 10, 10, {
        type: 'monster',
        conditions: [{ key: 'charmed', endsOnDamage: true }],
      });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Wolf', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Wolf')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Wolf', 'activeConditions', [], 'TestCampaign');
    });

    it('updates concentration DC on NPC when damage > 0', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(npc.concentration.dc).toBe(10);
    });

    it('breaks NPC concentration save on fail', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 15 },
        saveBonuses: { con: -1 },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 8, total: 7 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(sendConcentrationPrompt).toHaveBeenCalled();
    });

    it('keeps NPC concentration on save success', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 5 },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 12, total: 17 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(npc.concentration).not.toBeNull();
    });

    it('recalculates concentration DC for odd damage', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Orc', 11, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      expect(npc.concentration.dc).toBe(Math.max(10, Math.floor(11 / 2)));
    });

    it('dispatches combat-summary-updated event', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(dispatched).toBe(true);
    });

    it('sets damageReduced based on final vs raw damage', () => {
      stubNpcRuntime(100);
      const npc1 = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs1 = makeCombatSummary([npc1]);
      const result1 = applyDamageToTarget(cs1, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { resistances: ['fire'] },
      })]);
      expect(result1.damageReduced).toBe(true);

      stubNpcRuntime(10);
      const npc2 = createNpcCreature('Goblin', 10, 10);
      const cs2 = makeCombatSummary([npc2]);
      const result2 = applyDamageToTarget(cs2, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(result2.damageReduced).toBe(false);

      stubNpcRuntime(20);
      const npc3 = createNpcCreature('Skeleton', 20, 20, { immunities: ['cold'] });
      const cs3 = makeCombatSummary([npc3]);
      const result3 = applyDamageToTarget(cs3, 'Skeleton', 5, ['Cold'], 'TestCampaign', [createPlayerCharacter('Skeleton', {
        computedExtra: { immunities: ['cold'] },
      })]);
      expect(result3.damageReduced).toBe(true);
    });

    it('handles zero damage without removing frightened', () => {
      stubNpcRuntime(10, ['frightened']);
      const npc = createNpcCreature('Dragon', 10, 10, {
        immunities: ['fire'],
        conditions: [{ key: 'frightened' }],
      });
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Dragon', 5, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { immunities: ['fire'] },
      })]);
      expect(result.finalDamage).toBe(0);
      // Ward damage is 0 (immune), so activeConditions is never touched
      const conditionCalls = setRuntimeValue.mock.calls.filter(
        c => c[1] === 'activeConditions',
      );
      expect(conditionCalls).toHaveLength(0);
    });
  });

  describe('Player damage application', () => {
    it('applies damage to player HP via runtime state', () => {
      stubPlayerRuntime(25);
      const player = createPlayerCreature('Alchemist');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Alchemist', 8, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Alchemist')]);
      expect(result.oldHp).toBe(25);
      expect(result.newHp).toBe(17);
      expect(setRuntimeValue).toHaveBeenCalledWith('Alchemist', 'currentHitPoints', 17, 'TestCampaign');
    });

    it('uses player computedStats for resistances', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Paladin');
      const characters = [createPlayerCharacter('Paladin', {
        computedExtra: { resistances: ['poison'] },
      })];
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Paladin', 10, ['Poison'], 'TestCampaign', characters);
      expect(result.finalDamage).toBe(5);
    });

    it('uses player computedStats for immunities', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Celestial');
      const characters = [createPlayerCharacter('Celestial', {
        computedExtra: { immunities: ['fire'] },
      })];
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Celestial', 15, ['Fire'], 'TestCampaign', characters);
      expect(result.finalDamage).toBe(0);
    });

    it('removes Frightened from player conditions on damage > 0, does not remove non-Frightened', () => {
      stubPlayerRuntime(20, ['Frightened']);
      const player1 = createPlayerCreature('Ranger');
      const cs1 = makeCombatSummary([player1]);
      applyDamageToTarget(cs1, 'Ranger', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Ranger')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Ranger', 'activeConditions', [], 'TestCampaign');

      setRuntimeValue.mockClear();
      stubPlayerRuntime(20, ['Poisoned']);
      const player2 = createPlayerCreature('Ranger2');
      const cs2 = makeCombatSummary([player2]);
      applyDamageToTarget(cs2, 'Ranger2', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Ranger2')]);
      const conditionCalls = setRuntimeValue.mock.calls.filter(
        c => c[1] === 'activeConditions',
      );
      expect(conditionCalls).toHaveLength(0);
    });

    it('sends death save prompt when player goes from alive to unconscious, not when already at 0 HP', () => {
      stubPlayerRuntime(5);
      const player1 = createPlayerCreature('Fighter');
      const cs1 = makeCombatSummary([player1]);
      applyDamageToTarget(cs1, 'Fighter', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(sendDeathSavePrompt).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: 'Fighter',
      });

      sendDeathSavePrompt.mockClear();
      stubPlayerRuntime(0);
      const player2 = createPlayerCreature('Fighter2');
      const cs2 = makeCombatSummary([player2]);
      applyDamageToTarget(cs2, 'Fighter2', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter2')]);
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    });

    it('sends concentration prompt for player with active spell, not when no concentration or damage is 0', () => {
      stubPlayerRuntime(30);
      const player1 = createPlayerCreature('Wizard', {
        concentration: { spell: 'Thunderwave' },
      });
      const cs1 = makeCombatSummary([player1]);
      applyDamageToTarget(cs1, 'Wizard', 8, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      expect(sendConcentrationPrompt).toHaveBeenCalled();

      sendConcentrationPrompt.mockClear();
      stubPlayerRuntime(30);
      const player2 = createPlayerCreature('Bard');
      player2.concentration = null;
      const cs2 = makeCombatSummary([player2]);
      applyDamageToTarget(cs2, 'Bard', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Bard')]);
      expect(sendConcentrationPrompt).not.toHaveBeenCalled();

      sendConcentrationPrompt.mockClear();
      stubPlayerRuntime(30);
      const player3 = createPlayerCreature('Wizard2', { concentration: { spell: 'Haste' } });
      const characters = [createPlayerCharacter('Wizard2', {
        computedExtra: { immunities: ['cold'] },
      })];
      const cs3 = makeCombatSummary([player3]);
      applyDamageToTarget(cs3, 'Wizard2', 5, ['Cold'], 'TestCampaign', characters);
      expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    });

    it('handles characters array matching by name prefix with space', () => {
      stubPlayerRuntime(20);
      const player = createPlayerCreature('Druid');
      const characters = [createPlayerCharacter('Druid the Wise', {
        computedExtra: { resistances: [] },
      })];
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Druid', 5, ['Fire'], 'TestCampaign', characters);
      expect(result.oldHp).toBe(20);
    });

    it('sets damageReduced for player with/without resistance, saves runtime state on unconscious', () => {
      stubPlayerRuntime(30);
      const player1 = createPlayerCreature('Goliath');
      const characters = [createPlayerCharacter('Goliath', {
        computedExtra: { resistances: ['cold'] },
      })];
      const cs1 = makeCombatSummary([player1]);
      const result1 = applyDamageToTarget(cs1, 'Goliath', 7, ['Cold'], 'TestCampaign', characters);
      expect(result1.damageReduced).toBe(true);

      stubPlayerRuntime(30);
      const player2 = createPlayerCreature('Human');
      const cs2 = makeCombatSummary([player2]);
      const result2 = applyDamageToTarget(cs2, 'Human', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Human')]);
      expect(result2.damageReduced).toBe(false);

      stubPlayerRuntime(3);
      const player3 = createPlayerCreature('Fighter');
      const cs3 = makeCombatSummary([player3]);
      applyDamageToTarget(cs3, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'currentHitPoints', 0, 'TestCampaign');
    });

    it('throws when currentHitPoints is not set from runtime', () => {
      stubPlayerRuntime(null);
      const player = createPlayerCreature('Monk');
      const cs = makeCombatSummary([player]);
      expect(() => applyDamageToTarget(cs, 'Monk', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Monk')])).toThrow('Arcane Ward: currentHitPoints not found for Monk');
    });

    it('dispatches combat-summary-updated for player damage', () => {
      stubPlayerRuntime(25);
      const player = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([player]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      applyDamageToTarget(cs, 'Warlock', 3, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('Warlock')]);
      expect(dispatched).toBe(true);
    });

    it('handles zero damage without sending death save prompt', () => {
      stubPlayerRuntime(5);
      const player = createPlayerCreature('Fighter');
      player.concentration = null;
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Fighter', 0, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(result.finalDamage).toBe(0);
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    });
  });

  describe('logDamageApplication side effects', () => {
    it('logs hp_change entry via fetch with correct type and isHealing', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(global.fetch).toHaveBeenCalled();
      const callBody = JSON.parse(global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}');
      expect(callBody.type).toBe('hp_change');
      expect(callBody.isHealing).toBe(false);
    });

    it('sets isUnconscious and threshold dead when creature dies', () => {
      stubNpcRuntime(5);
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}',
      );
      expect(callBody.isUnconscious).toBe(true);
      expect(callBody.threshold).toBe('dead');
    });

    it('sets threshold to "bloodied" when crossing bloodied line, not when going from bloodied to below', () => {
      // First, find the Orc log call
      const npc = { name: 'Orc', type: 'monster', maxHp: 40, currentHp: 30, conditions: [], template: [], concentration: null };
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Orc', 15, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      const orcCall = global.fetch.mock.calls.find(c => c[0].includes('/log'));
      const orcBody = JSON.parse(orcCall?.[1]?.body || '{}');
      expect(orcBody.threshold).toBe('bloodied');

      // Now test bloodied -> below bloodied (no recovering threshold)
      global.fetch.mockClear();
      stubNpcRuntime(3);
      const npc2 = createNpcCreature('Goblin', 10, 3);
      const cs2 = makeCombatSummary([npc2]);
      applyDamageToTarget(cs2, 'Goblin', 2, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const goblinCall = global.fetch.mock.calls.find(c => c[0].includes('/log'));
      const goblinBody = JSON.parse(goblinCall?.[1]?.body || '{}');
      expect(goblinBody.threshold).toBeUndefined();
    });

    it('does not set threshold or death saves when already dead, resets death saves when player dies', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String),
      );

      stubPlayerRuntime(3);
      const player2 = createPlayerCreature('Fighter2');
      const cs2 = makeCombatSummary([player2]);
      applyDamageToTarget(cs2, 'Fighter2', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter2')]);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter2', 'deathSaves', [false, false, false], 'TestCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter2', 'deathFailures', [false, false, false], 'TestCampaign',
      );
    });

    it('does not set death saves when not dying (still alive)', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Cleric');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Cleric', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Cleric')]);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String),
      );
    });

    it('handles Frightened condition as string (not object)', () => {
      stubPlayerRuntime(20, ['frightened']);
      const player = createPlayerCreature('Rogue');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Rogue', 3, ['Piercing'], 'TestCampaign', [createMinimalCharacter('Rogue')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Rogue', 'activeConditions', [], 'TestCampaign');
    });

    it('uses currentHp as oldHp for NPC even when creature has no maxHp', () => {
      stubNpcRuntime(8);
      const npc = { name: 'Creature', type: 'player', currentHp: 8, conditions: [], template: [], concentration: null };
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Creature', 3, ['Acid'], 'TestCampaign', [createMinimalCharacter('Creature')]);
      expect(result.oldHp).toBe(8);
      expect(result.newHp).toBe(5);
    });

    it('uses getRuntimeValue for player maxHp in log when not on creature', () => {
      stubPlayerRuntime(30);
      getRuntimeValue.mockReturnValueOnce(30);
      const player = createPlayerCreature('Bard');
      delete player.maxHp;
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Bard', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Bard')]);
    });
  });

  describe('concentration save logging for NPC', () => {
    it('does not run concentration save when no concentration or finalDamage is 0', () => {
      stubNpcRuntime(10);
      const npc1 = createNpcCreature('Goblin', 10, 10, { concentration: null });
      const cs1 = makeCombatSummary([npc1]);
      applyDamageToTarget(cs1, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(rollConcentrationSave).not.toHaveBeenCalled();

      stubNpcRuntime(20);
      const npc2 = createNpcCreature('Skeleton', 20, 20, {
        concentration: { spell: 'Haste' },
        immunities: ['necrotic'],
      });
      const cs2 = makeCombatSummary([npc2]);
      applyDamageToTarget(cs2, 'Skeleton', 10, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('Skeleton')]);
      expect(rollConcentrationSave).not.toHaveBeenCalled();
    });
  });
});

describe('hasEvasionForSave', () => {
  it('returns false when evasionEffects is null, undefined, or empty', () => {
    expect(hasEvasionForSave(null, 'dex')).toBe(false);
    expect(hasEvasionForSave(undefined, 'dex')).toBe(false);
    expect(hasEvasionForSave([], 'dex')).toBe(false);
  });

  it('matches saveType case-insensitively, returns false on no match, handles null saveType', () => {
    const effects = [{ saveType: 'DEX' }, { saveType: 'CON' }];
    expect(hasEvasionForSave(effects, 'dex')).toBe(true);
    expect(hasEvasionForSave(effects, 'Dex')).toBe(true);
    expect(hasEvasionForSave(effects, 'wis')).toBe(false);

    const effects2 = [{ saveType: '' }];
    expect(hasEvasionForSave(effects2, null)).toBe(true);
  });
});

describe('computeDamageAfterEvasion', () => {
  it('falls through to computeDamageAfterSave when evasion is not active', () => {
    expect(computeDamageAfterEvasion(10, true, 'half', false)).toBe(5);
  });

  it('returns 0 on save success with evasion active and dcSuccess half, half on fail', () => {
    expect(computeDamageAfterEvasion(10, true, 'half', true)).toBe(0);
    expect(computeDamageAfterEvasion(10, false, 'half', true)).toBe(5);
    expect(computeDamageAfterEvasion(9, false, 'half', true)).toBe(4);
    expect(computeDamageAfterEvasion(7, false, 'half', true)).toBe(3);
    expect(computeDamageAfterEvasion(1, false, 'half', true)).toBe(0);
  });

  it('falls through for any dcSuccess other than half when evasion is active', () => {
    expect(computeDamageAfterEvasion(10, true, 'none', true)).toBe(0);
    expect(computeDamageAfterEvasion(10, false, 'none', true)).toBe(10);
    expect(computeDamageAfterEvasion(20, true, 'all', true)).toBe(0);
    expect(computeDamageAfterEvasion(20, false, 'all', true)).toBe(20);
  });
});

describe('applyDamageToTarget — buff resistance merging', () => {
  it('merges resistanceTypes from activeBuffs for player', () => {
    getRuntimeValue
      .mockReturnValueOnce([{ resistanceTypes: ['fire'], resistanceTypes2: ['cold'] }])
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);
    const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
    expect(result.finalDamage).toBe(5);
  });

  it('deduplicates resistanceTypes from multiple buffs', () => {
    getRuntimeValue
      .mockReturnValueOnce([
        { resistanceTypes: ['fire'] },
        { resistanceTypes: ['fire', 'cold'] },
      ])
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);
    const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
    expect(result.finalDamage).toBe(5);
  });

  it('handles non-array and null activeBuffs gracefully, combines base resistances with buffs', () => {
    getRuntimeValue
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player1 = createPlayerCreature('Wizard');
    const cs1 = makeCombatSummary([player1]);
    const result1 = applyDamageToTarget(cs1, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
    expect(result1.finalDamage).toBe(10);

    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player2 = createPlayerCreature('Wizard2');
    const cs2 = makeCombatSummary([player2]);
    const result2 = applyDamageToTarget(cs2, 'Wizard2', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard2')]);
    expect(result2.finalDamage).toBe(10);

    getRuntimeValue
      .mockReturnValueOnce([{ resistanceTypes: ['cold'] }])
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player3 = createPlayerCreature('Paladin');
    const characters = [createPlayerCharacter('Paladin', {
      computedExtra: { resistances: ['fire'] },
    })];
    const cs3 = makeCombatSummary([player3]);
    const result3 = applyDamageToTarget(cs3, 'Paladin', 10, ['Cold'], 'TestCampaign', characters);
    expect(result3.finalDamage).toBe(5);
  });

  it('does not apply buff merging for NPCs', () => {
    stubNpcRuntime(10);
    const npc = createNpcCreature('Goblin', 10, 10);
    const cs = makeCombatSummary([npc]);
    applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', 'TestCampaign');
  });
});

describe('applyDamageToTarget — Projected Ward', () => {
  function createWizardCharacter(name, extra = {}) {
    return {
      name,
      computedStats: {
        resistances: [],
        immunities: [],
        class_levels: [],
        equipment: [],
        characterAdvancement: [],
        allFeatures: [],
        automation: {
          reactions: [
            { type: 'projected_ward', name: 'Projected Ward', range: 30, reaction: true },
          ],
        },
        ...extra.computedExtra,
      },
      ...extra,
    };
  }

  function stubWizardRuntime(wizardName, currentHp, wardActive, wardHp, conditions = []) {
    getRuntimeValue.mockReset();
    getRuntimeValue
      .mockImplementation((target, key, _campaignName) => {
        if (key === 'activeBuffs') return [];
        if (key === 'currentHitPoints') return currentHp;
        if (key === 'activeConditions') return conditions;
        if (key === 'lastMetamagicDamage') return undefined;
        if (target === wizardName) {
          if (key === 'arcaneWardActive') return wardActive;
          if (key === 'arcaneWardHp') return wardHp;
        }
        return undefined;
      });
  }

  it('does not auto-absorb with Projected Ward (absorption via reaction click), absorbs self-damage first', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    stubWizardRuntime('Diviner', 20, true, 15, []);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    expect(result.newHp).toBe(10);
    expect(setRuntimeValue).not.toHaveBeenCalledWith(wizardName, 'arcaneWardHp', expect.any(Number), 'TestCampaign');

    const wizardCreature2 = createPlayerCreature(wizardName);
    wizardCreature2.position = { gridX: 1, gridY: 1 };

    stubWizardRuntime('Diviner', 20, true, 15, []);

    const cs2 = makeCombatSummary([wizardCreature2]);
    const characters2 = [
      createWizardCharacter(wizardName),
    ];

    const result2 = applyDamageToTarget(cs2, wizardName, 10, ['Fire'], 'TestCampaign', characters2);

    expect(result2.newHp).toBe(20);
    expect(setRuntimeValue).toHaveBeenCalledWith(wizardName, 'arcaneWardHp', 5, 'TestCampaign');
  });
});
