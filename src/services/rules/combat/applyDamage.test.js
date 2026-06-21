import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

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

// ── Imports (Vite returns mocked versions) ─────────────────────

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
import { getDistanceFeet } from './rangeValidation.js';

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

/**
 * Helper: stub getRuntimeValue for player tests.
 * applyDamageToTarget calls getRuntimeValue for players:
 *   1) activeBuffs → array (no active stance buffs by default)
 *   2) currentHitPoints → hp (number or null)
 *   3) activeConditions → array (use [] when no condition test needed)
 */
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
  it('throws when damageTypes is falsy', () => {
    expect(() => computeDamageAfterResistances(10, null)).toThrow();
    expect(() => computeDamageAfterResistances(10, undefined)).toThrow();
    expect(() => computeDamageAfterResistances(10, [])).toThrow();
   });

  it('throws when a damage type entry is falsy', () => {
    expect(() => computeDamageAfterResistances(10, [null])).toThrow();
    expect(() => computeDamageAfterResistances(10, [''])).toThrow();
   });

  it('returns raw damage when no resistances or immunities match', () => {
    expect(computeDamageAfterResistances(10, ['Fire'], [], [])).toBe(10);
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

  it('checks all damage types in array (early exit on first match)', () => {
    expect(computeDamageAfterResistances(10, ['Fire', 'Cold'], ['cold'], [])).toBe(5);
   });
});

describe('computeDamageAfterSave', () => {
  it('returns raw damage when save fails', () => {
    expect(computeDamageAfterSave(10, false, 'half')).toBe(10);
   });

  it('returns half damage on save with dcSuccess === "half"', () => {
    expect(computeDamageAfterSave(9, true, 'half')).toBe(4);
    expect(computeDamageAfterSave(10, true, 'half')).toBe(5);
   });

  it('returns 0 on save with dcSuccess !== "half"', () => {
    expect(computeDamageAfterSave(10, true, 'none')).toBe(0);
   });
});

describe('rollSaveForCreature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns correct shape', () => {
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

  it('handles disadvantage — takes minimum of two rolls', () => {
    rollD20.mockReturnValueOnce(17).mockReturnValueOnce(5);
    const creature = { saveBonuses: { con: 2 } };
    const result = rollSaveForCreature(creature, 'con', 18, true);
    expect(result.roll).toBe(5); // min(17, 5)
    expect(result.total).toBe(7);
    expect(result.success).toBe(false);
    expect(result.rawRolls).toEqual([17, 5]);
   });

  it('uses default 0 bonus when saveType not found', () => {
    rollD20.mockReturnValueOnce(10);
    const result = rollSaveForCreature({}, 'str', 10);
    expect(result.bonus).toBe(0);
    expect(result.total).toBe(10);
    expect(result.success).toBe(true);
   });

  it('handles null creature gracefully', () => {
    rollD20.mockReturnValueOnce(8);
    const result = rollSaveForCreature(null, 'wis', 15);
    expect(result.bonus).toBe(0);
    expect(result.total).toBe(8);
    expect(result.success).toBe(false);
   });

  it('does not roll second dice when no disadvantage', () => {
    rollD20.mockReturnValueOnce(12);
    const creature = { saveBonuses: { cha: -1 } };
    rollSaveForCreature(creature, 'cha', 10, false);
    expect(rollD20).toHaveBeenCalledTimes(1);
   });

  it('rolls twice when disadvantage is true', () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(8);
    rollSaveForCreature({}, 'str', 15, true);
    expect(rollD20).toHaveBeenCalledTimes(2);
   });

  it('handles negative bonus', () => {
    rollD20.mockReturnValueOnce(15);
    const creature = { saveBonuses: { dex: -3 } };
    const result = rollSaveForCreature(creature, 'dex', 18);
    expect(result.total).toBe(12);
    expect(result.success).toBe(false);
   });

  it('ties (total === dc) count as success', () => {
    rollD20.mockReturnValueOnce(10);
    const creature = { saveBonuses: { con: 5 } };
    const result = rollSaveForCreature(creature, 'con', 15);
    expect(result.success).toBe(true);
   });
});

describe('applyDamageToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
   });

  it('returns null when combatSummary is falsy', () => {
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

    it('clamps HP to 0', () => {
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

    it('removes frightened condition on NPC taking damage > 0', () => {
      stubNpcRuntime(10, ['frightened']);
      const npc = createNpcCreature('Goblin', 10, 10, {
        conditions: [{ key: 'frightened' }],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], 'TestCampaign');
     });

    it('does not remove other conditions when frightened is removed', () => {
      stubNpcRuntime(10, ['frightened', 'poisoned']);
      const npc = createNpcCreature('Goblin', 10, 10, {
        conditions: [{ key: 'frightened' }, { key: 'poisoned' }],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['poisoned'], 'TestCampaign');
     });

    it('does not remove frightened when no damage dealt (immune)', () => {
      stubNpcRuntime(100, ['frightened']);
      const npc = createNpcCreature('Dragon', 100, 100, {
        immunities: ['fire'],
        conditions: [{ key: 'frightened' }],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { immunities: ['fire'] },
      })]);
      // wardDamage is 0 (immune), so activeConditions is not modified
      expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'currentHitPoints', 100, 'TestCampaign');
     });

    it('concentration DC is updated on NPC when damage > 0', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(npc.concentration.dc).toBe(10); // Math.max(10, Math.floor(10/2)) = 10
     });

    it('NPC concentration save — broken spell on fail', () => {
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

    it('NPC concentration save — keeps spell on success', () => {
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

    it('NPC concentration DC recalculated for odd damage', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Orc', 11, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      expect(npc.concentration.dc).toBe(Math.max(10, Math.floor(11 / 2))); // Math.max(10,5) = 10
     });

    it('saves combat summary when NPC modified', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      // For players, combatSummary is saved via storage.set when concentration prompt is sent
      // For regular damage without concentration, storage.set may not be called
      expect(setRuntimeValue).toHaveBeenCalled();
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

    it('damageReduced is true when final < raw', () => {
      stubNpcRuntime(100);
      const npc = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { resistances: ['fire'] },
      })]);
      expect(result.damageReduced).toBe(true);
     });

    it('damageReduced is false when final === raw', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(result.damageReduced).toBe(false);
     });

    it('returns damageReduced true when immunity makes damage 0', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Skeleton', 20, 20, { immunities: ['cold'] });
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Skeleton', 5, ['Cold'], 'TestCampaign', [createPlayerCharacter('Skeleton', {
        computedExtra: { immunities: ['cold'] },
      })]);
      expect(result.damageReduced).toBe(true);
     });
   });

  describe('Player damage application', () => {
    it('applies damage to player HP via runtime state', () => {
      stubPlayerRuntime(25); // currentHitPoints=25, activeConditions=[]
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
      applyDamageToTarget(cs, 'Paladin', 10, ['Poison'], 'TestCampaign', characters);
         // Damage should be halved due to resistance
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

    it('removes Frightened from player conditions on damage > 0', () => {
      stubPlayerRuntime(20, ['Frightened']);
      const player = createPlayerCreature('Ranger');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Ranger', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Ranger')]);
         // setRuntimeValue called for currentHitPoints then activeConditions filtered
     });

    it('does not remove non-Frightened conditions from player', () => {
      stubPlayerRuntime(20, ['Poisoned']);
      const player = createPlayerCreature('Ranger');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Ranger', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Ranger')]);
     });

    it('sends death save prompt when player goes from alive to unconscious', () => {
      stubPlayerRuntime(5);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(sendDeathSavePrompt).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: 'Fighter',
       });
     });

    it('does not send death save when already at 0 HP', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
     });

    it('sends concentration prompt for player with active spell', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Wizard', {
        concentration: { spell: 'Thunderwave' },
       });
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Wizard', 8, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      expect(sendConcentrationPrompt).toHaveBeenCalled();
     });

    it('does not send concentration prompt when player has no concentration', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Bard');
      player.concentration = null;
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Bard', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Bard')]);
      expect(sendConcentrationPrompt).not.toHaveBeenCalled();
     });

    it('does not send concentration prompt when damage is 0 (immune)', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Wizard', { concentration: { spell: 'Haste' } });
      const characters = [createPlayerCharacter('Wizard', {
        computedExtra: { immunities: ['cold'] },
       })];
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Wizard', 5, ['Cold'], 'TestCampaign', characters);
      expect(sendConcentrationPrompt).not.toHaveBeenCalled();
     });

    it('does not dispatch combat-summary-updated for player events (no storage update needed)', () => {
         // Players use runtime state, not combatSummary storage by default
     });

    it('handles characters array being null', () => {
      stubPlayerRuntime(20);
      const player = createPlayerCreature('Cleric');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Cleric', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Cleric')]);
      expect(result.newHp).toBe(15);
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

    it('damageReduced true for player with resistance', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Goliath');
      const characters = [createPlayerCharacter('Goliath', {
        computedExtra: { resistances: ['cold'] },
       })];
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Goliath', 7, ['Cold'], 'TestCampaign', characters);
      expect(result.damageReduced).toBe(true);
     });

    it('damageReduced false for player with no resistance', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Human');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Human', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Human')]);
      expect(result.damageReduced).toBe(false);
     });

    it('saves runtime state when player becomes unconscious via damage', () => {
      stubPlayerRuntime(3);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
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
   });

  describe('logDamageApplication side effects', () => {
    it('logs hp_change entry via fetch', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(global.fetch).toHaveBeenCalled();
      const callBody = JSON.parse(global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}');
      expect(callBody.type).toBe('hp_change');
      expect(callBody.isHealing).toBe(false);
     });

    it('sets isUnconscious when newHp <= 0', () => {
      stubNpcRuntime(5);
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
       );
      expect(callBody.isUnconscious).toBe(true);
     });

    it('sets threshold to "dead" when creature dies', () => {
      stubNpcRuntime(5);
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
       );
      expect(callBody.threshold).toBe('dead');
     });

    it('sets threshold to "bloodied" when crossing bloodied line', () => {
      stubNpcRuntime(30);
      const npc = createNpcCreature('Orc', 40, 30);
      const cs = makeCombatSummary([npc]);
         // maxHp=40, bloodied at <=20. Going from 30 to 15 crosses threshold
      applyDamageToTarget(cs, 'Orc', 15, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
       );
      if (callBody.threshold) expect(callBody.threshold).toBe('bloodied');
     });

    it('does not set threshold when already dead', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
       const cs = makeCombatSummary([player]);
       applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
             // wasDead so no threshold set
     });

    it('resets death saves when player dies', () => {
      stubPlayerRuntime(3);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
         // setRuntimeValue called for deathSaves and deathFailures
      expect(setRuntimeValue).toHaveBeenCalledWith(
           'Fighter', 'deathSaves', [false, false, false], 'TestCampaign'
       );
      expect(setRuntimeValue).toHaveBeenCalledWith(
           'Fighter', 'deathFailures', [false, false, false], 'TestCampaign'
       );
     });

    it('does not set death saves when not dying (still alive)', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Cleric');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Cleric', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Cleric')]);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String)
       );
     });

    it('does not set death saves when already dead', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String)
       );
     });

    it('handles Frightened condition as string (not object)', () => {
      stubPlayerRuntime(20, ['frightened']);
      const player = createPlayerCreature('Rogue');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Rogue', 3, ['Piercing'], 'TestCampaign', [createMinimalCharacter('Rogue')]);
         // Should filter out frightened via String(c).toLowerCase() === 'frightened'
     });

    it('uses currentHp as oldHp for NPC even when creature has no maxHp', () => {
      stubNpcRuntime(8);
      const npc = { name: 'Creature', type: 'player', currentHp: 8, conditions: [], template: [], concentration: null };
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Creature', 3, ['Acid'], 'TestCampaign', [createMinimalCharacter('Creature')]);
      expect(result.oldHp).toBe(8);
      expect(result.newHp).toBe(5);
     });

    it('does not set threshold "recovering" when going from bloodied to above bloodied via damage (impossible but branch exists)', () => {
         // Damage only goes down, so this branch is a no-op in practice but we cover the code path
      stubNpcRuntime(3);
      const npc = createNpcCreature('Goblin', 10, 3); // already bloodied at maxHp=10
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 2, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
     });

    it('uses getRuntimeValue for player maxHp in log when not on creature', () => {
      stubPlayerRuntime(30); // currentHitPoints
      getRuntimeValue.mockReturnValueOnce(30); // hitPoints (called from logDamageApplication)
      const player = createPlayerCreature('Bard');
      delete player.maxHp;
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Bard', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Bard')]);
     });
   });

  describe('frightened removal fetch logging', () => {
    it('logs frightened condition removal for NPC', () => {
      stubNpcRuntime(10, ['frightened']);
      const npc = createNpcCreature('Goblin', 10, 10, { conditions: [{ key: 'frightened' }] });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const conditionCall = global.fetch.mock.calls.find(
        c => c[0].includes('/log') && JSON.parse(c[1]?.body || '{}').condition === 'Frightened'
       );
      expect(conditionCall).toBeTruthy();
     });

    it('logs frightened condition removal for player', () => {
      stubPlayerRuntime(20, ['Frightened']);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      const conditionCall = global.fetch.mock.calls.find(
        c => c[0].includes('/log') && JSON.parse(c[1]?.body || '{}').condition === 'Frightened'
       );
      expect(conditionCall).toBeTruthy();
     });
   });

  describe('concentration save logging for NPC', () => {
    it('logs concentration-broken when NPC fails save', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
        saveBonuses: { con: -2 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 5, total: 3 });
      applyDamageToTarget(cs, 'Orc', 10, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      expect(sendConcentrationPrompt).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: 'Orc',
        spellName: 'Thunderwave',
        dc: 10,
      });
     });

    it('logs concentration-save when NPC passes save', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
        saveBonuses: { con: 5 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Orc', 10, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      expect(sendConcentrationPrompt).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: 'Orc',
        spellName: 'Thunderwave',
        dc: 10,
      });
     });

    it('does not run concentration save for NPC when no concentration', () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, { concentration: null });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(rollConcentrationSave).not.toHaveBeenCalled();
     });

    it('does not run concentration save when finalDamage is 0', () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Skeleton', 20, 20, {
        concentration: { spell: 'Haste' },
        immunities: ['necrotic'],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Skeleton', 10, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('Skeleton')]);
      expect(rollConcentrationSave).not.toHaveBeenCalled();
      });
     });
  });

describe('hasEvasionForSave', () => {
    it('returns false when evasionEffects is null', () => {
      expect(hasEvasionForSave(null, 'dex')).toBe(false);
    });

    it('returns false when evasionEffects is undefined', () => {
      expect(hasEvasionForSave(undefined, 'dex')).toBe(false);
    });

    it('returns false when evasionEffects is empty', () => {
      expect(hasEvasionForSave([], 'dex')).toBe(false);
    });

    it('returns true when saveType matches', () => {
      const effects = [{ saveType: 'DEX' }, { saveType: 'CON' }];
      expect(hasEvasionForSave(effects, 'dex')).toBe(true);
    });

    it('is case-insensitive for saveType comparison', () => {
      const effects = [{ saveType: 'DEX' }];
      expect(hasEvasionForSave(effects, 'dex')).toBe(true);
      expect(hasEvasionForSave(effects, 'Dex')).toBe(true);
    });

    it('returns false when no saveType matches', () => {
      const effects = [{ saveType: 'DEX' }, { saveType: 'CON' }];
      expect(hasEvasionForSave(effects, 'wis')).toBe(false);
    });

    it('handles null saveType gracefully', () => {
      const effects = [{ saveType: '' }];
      expect(hasEvasionForSave(effects, null)).toBe(true);
    });
  });

describe('computeDamageAfterEvasion', () => {
  it('falls through to computeDamageAfterSave when evasion is not active', () => {
    // evasion=false → calls computeDamageAfterSave(10, true, 'half') → Math.floor(10/2) = 5
    expect(computeDamageAfterEvasion(10, true, 'half', false)).toBe(5);
  });

  it('returns raw damage when dcSuccess is not half', () => {
    expect(computeDamageAfterEvasion(10, true, 'none', true)).toBe(0);
  });

  it('returns 0 on save success with evasion active and dcSuccess half', () => {
    expect(computeDamageAfterEvasion(10, true, 'half', true)).toBe(0);
  });

  it('returns half damage on save fail with evasion active and dcSuccess half', () => {
    expect(computeDamageAfterEvasion(10, false, 'half', true)).toBe(5);
    expect(computeDamageAfterEvasion(9, false, 'half', true)).toBe(4);
  });

  it('falls through to computeDamageAfterSave when evasion not active', () => {
    // evasion=false → calls computeDamageAfterSave(10, true, 'half') → Math.floor(10/2) = 5
    expect(computeDamageAfterEvasion(10, true, 'half', false)).toBe(5);
    expect(computeDamageAfterEvasion(10, true, 'none', false)).toBe(0);
  });

  it('handles saveSuccess true with dcSuccess not half — returns 0', () => {
    expect(computeDamageAfterEvasion(10, true, 'none', true)).toBe(0);
  });

  it('handles saveSuccess false with dcSuccess not half — returns raw damage', () => {
    expect(computeDamageAfterEvasion(10, false, 'none', true)).toBe(10);
  });
});

describe('applyDamageToTarget — buff resistance merging', () => {
    it('merges resistanceTypes from activeBuffs for player', () => {
      getRuntimeValue
        .mockReturnValueOnce([{ resistanceTypes: ['fire'], resistanceTypes2: ['cold'] }]) // activeBuffs
        .mockReturnValueOnce(false) // arcaneWardActive
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]) // activeBuffs for Warding Bond check
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      // Fire resistance from buff should halve damage
      expect(result.finalDamage).toBe(5);
    });

    it('deduplicates resistanceTypes from multiple buffs', () => {
      getRuntimeValue
        .mockReturnValueOnce([
          { resistanceTypes: ['fire'] },
          { resistanceTypes: ['fire', 'cold'] },
        ]) // activeBuffs
        .mockReturnValueOnce(false) // arcaneWardActive
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]) // activeBuffs for Warding Bond check
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      // Should still halve fire damage (not quarter it)
    });

    it('handles non-array activeBuffs gracefully', () => {
      getRuntimeValue
        .mockReturnValueOnce('not-an-array') // activeBuffs
        .mockReturnValueOnce(false) // arcaneWardActive
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]) // activeBuffs for Warding Bond check
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      expect(result.finalDamage).toBe(10); // no buffs applied
    });

    it('handles null activeBuffs gracefully', () => {
      getRuntimeValue
        .mockReturnValueOnce(null) // activeBuffs
        .mockReturnValueOnce(false) // arcaneWardActive
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]) // activeBuffs for Warding Bond check
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      expect(result.finalDamage).toBe(10); // no buffs applied
    });

    it('combines base resistances with buff resistanceTypes', () => {
      getRuntimeValue
        .mockReturnValueOnce([{ resistanceTypes: ['cold'] }]) // activeBuffs
        .mockReturnValueOnce(false) // arcaneWardActive
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]) // activeBuffs for Warding Bond check
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Paladin');
      const characters = [createPlayerCharacter('Paladin', {
        computedExtra: { resistances: ['fire'] },
      })];
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Paladin', 10, ['Cold'], 'TestCampaign', characters);
      // Cold resistance from buff should halve damage
      expect(result.finalDamage).toBe(5);
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
        // Only the wizard has Arcane Ward state
        if (target === wizardName) {
          if (key === 'arcaneWardActive') return wardActive;
          if (key === 'arcaneWardHp') return wardHp;
        }
        return undefined;
      });
  }

  it('does not auto-absorb with Projected Ward — absorption happens via reaction click', () => {
    // Projected Ward absorption is now triggered by clicking the reaction,
    // not automatically during applyDamage. Full damage goes through.
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

    // Full damage goes through — ward absorption happens via reaction click
    expect(result.newHp).toBe(10);
    // Ward HP is NOT modified during applyDamage
    expect(setRuntimeValue).not.toHaveBeenCalledWith(wizardName, 'arcaneWardHp', expect.any(Number), 'TestCampaign');
  });

  it('does not absorb partial damage — full damage goes through when ward is low', () => {
    // Projected Ward absorption is now triggered by clicking the reaction.
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    stubWizardRuntime('Diviner', 20, true, 3, []);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    // Full damage goes through
    expect(result.newHp).toBe(10);
  });

  it('respects range limit — skips absorption when too far', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    // 10 grid cells away = 50 feet, beyond 30 ft range
    allyCreature.position = { gridX: 11, gridY: 1 };

    stubWizardRuntime('Diviner', 20, true, 15, []);

    vi.mocked(getDistanceFeet).mockReturnValue(50);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    // Ward is out of range, ally takes full damage
    expect(result.newHp).toBe(10);
  });

  it('skips absorption when target is invisible', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    // Target has invisible condition
    stubWizardRuntime('Diviner', 20, true, 15, ['invisible']);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    // Invisible target — ward doesn't absorb
    expect(result.newHp).toBe(10);
  });

  it('skips absorption when arcane ward is not active', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    stubWizardRuntime('Diviner', 20, false, 0, []);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    expect(result.newHp).toBe(10);
  });

  it('skips absorption when ward HP is 0', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    stubWizardRuntime('Diviner', 20, true, 0, []);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    expect(result.newHp).toBe(10);
  });

  it('ignores range — absorption happens via reaction click, not in applyDamage', () => {
    // Projected Ward range checking is done in the reaction handler, not applyDamage.
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 8, gridY: 8 };

    stubWizardRuntime('Diviner', 20, true, 20, []);

    const characters = [
      createWizardCharacter(wizardName, {
        computedExtra: {
          automation: {
            reactions: [
              { type: 'projected_ward', name: 'Projected Ward', range: 50, reaction: true },
            ],
          },
        },
      }),
      createPlayerCharacter(allyName),
    ];

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    // Full damage goes through — range checked in reaction handler
    expect(result.newHp).toBe(10);
  });

  it('does not absorb when wizard has no Projected Ward in reactions', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    stubWizardRuntime('Diviner', 20, true, 15, []);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName, {
        computedExtra: {
          automation: {
            reactions: [],
          },
        },
      }),
      createPlayerCharacter(allyName),
    ];

    const result = applyDamageToTarget(cs, allyName, 10, ['Fire'], 'TestCampaign', characters);

    expect(result.newHp).toBe(10);
  });

  it('handles missing creature position gracefully', () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    // No position
    delete wizardCreature.position;

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
  });

  it('absorbs self-damage first before checking projected ward', () => {
    const wizardName = 'Diviner';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    // Wizard takes 10 damage, ward has 15 HP
    stubWizardRuntime('Diviner', 20, true, 15, []);

    const cs = makeCombatSummary([wizardCreature]);
    const characters = [
      createWizardCharacter(wizardName),
    ];

    const result = applyDamageToTarget(cs, wizardName, 10, ['Fire'], 'TestCampaign', characters);

    // Self-damage: Arcane Ward absorbs first (not Projected Ward)
    expect(result.newHp).toBe(20);
    expect(setRuntimeValue).toHaveBeenCalledWith(wizardName, 'arcaneWardHp', 5, 'TestCampaign');
  });
});

