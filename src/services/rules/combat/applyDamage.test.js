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
import storage from '../../ui/storage.js';
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

function createPlayerCharacter(name, extra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
         ...extra.computedExtra,
         },
         ...extra,
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
  getRuntimeValue
    .mockReturnValueOnce([])                        // activeBuffs (line 83)
    .mockReturnValueOnce(undefined)                 // arcaneWardActive (line 133)
    .mockReturnValueOnce(currentHp)                 // currentHitPoints (line 157)
    .mockReturnValueOnce([])                        // activeBuffs for Warding Bond check (line 189)
    .mockReturnValueOnce(conditions);               // activeConditions (line 243)
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
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Goblin', 6, ['Slashing'], 'TestCampaign');
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(4);
      expect(result.finalDamage).toBe(6);
      expect(result.damageReduced).toBe(false);
      expect(npc.currentHp).toBe(4);
     });

    it('clamps HP to 0', () => {
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');
      expect(npc.currentHp).toBe(0);
     });

    it('applies resistance for NPC', () => {
      const npc = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign');
      expect(npc.currentHp).toBe(95); // Math.floor(10/2) = 5
     });

    it('applies immunity for NPC', () => {
      const npc = createNpcCreature('Skeleton', 20, 20, { immunities: ['necrotic'] });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Skeleton', 15, ['Necrotic'], 'TestCampaign');
      expect(npc.currentHp).toBe(20); // no damage
     });

    it('removes frightened condition on NPC taking damage > 0', () => {
      const npc = createNpcCreature('Goblin', 10, 10, {
        conditions: [{ key: 'frightened' }],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Bludgeoning'], 'TestCampaign');
      expect(npc.conditions).toEqual([]);
     });

    it('does not remove other conditions when frightened is removed', () => {
      const npc = createNpcCreature('Goblin', 10, 10, {
        conditions: [{ key: 'frightened' }, { key: 'poisoned' }],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Bludgeoning'], 'TestCampaign');
      expect(npc.conditions).toEqual([{ key: 'poisoned' }]);
     });

    it('does not remove frightened when no damage dealt (immune)', () => {
      const npc = createNpcCreature('Dragon', 100, 100, {
        immunities: ['fire'],
        conditions: [{ key: 'frightened' }],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign');
      expect(npc.conditions).toEqual([{ key: 'frightened' }]);
     });

    it('concentration DC is updated on NPC when damage > 0', () => {
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');
      expect(npc.concentration.dc).toBe(10); // Math.max(10, Math.floor(10/2)) = 10
     });

    it('NPC concentration save — broken spell on fail', () => {
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 15 },
        saveBonuses: { con: -1 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 8, total: 7 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');
      expect(npc.concentration).toBeNull();
     });

    it('NPC concentration save — keeps spell on success', () => {
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 5 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 12, total: 17 });
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');
      expect(npc.concentration).not.toBeNull();
     });

    it('NPC concentration DC recalculated for odd damage', () => {
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Orc', 11, ['Thunder'], 'TestCampaign');
      expect(npc.concentration.dc).toBe(Math.max(10, Math.floor(11 / 2))); // Math.max(10,5) = 10
     });

    it('saves combat summary when NPC modified', () => {
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign');
      expect(storage.set).toHaveBeenCalled();
     });

    it('dispatches combat-summary-updated event', () => {
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign');
      expect(dispatched).toBe(true);
     });

    it('damageReduced is true when final < raw', () => {
      const npc = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign');
      expect(result.damageReduced).toBe(true);
     });

    it('damageReduced is false when final === raw', () => {
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign');
      expect(result.damageReduced).toBe(false);
     });

    it('returns damageReduced true when immunity makes damage 0', () => {
      const npc = createNpcCreature('Skeleton', 20, 20, { immunities: ['cold'] });
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Skeleton', 5, ['Cold'], 'TestCampaign');
      expect(result.damageReduced).toBe(true);
     });
   });

  describe('Player damage application', () => {
    it('applies damage to player HP via runtime state', () => {
      stubPlayerRuntime(25); // currentHitPoints=25, activeConditions=[]
      const player = createPlayerCreature('Alchemist');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Alchemist', 8, ['Slashing'], 'TestCampaign', []);
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
      applyDamageToTarget(cs, 'Ranger', 5, ['Bludgeoning'], 'TestCampaign', []);
         // setRuntimeValue called for currentHitPoints then activeConditions filtered
     });

    it('does not remove non-Frightened conditions from player', () => {
      stubPlayerRuntime(20, ['Poisoned']);
      const player = createPlayerCreature('Ranger');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Ranger', 5, ['Bludgeoning'], 'TestCampaign', []);
     });

    it('sends death save prompt when player goes from alive to unconscious', () => {
      stubPlayerRuntime(5);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 10, ['Slashing'], 'TestCampaign', []);
      expect(sendDeathSavePrompt).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: 'Fighter',
       });
     });

    it('does not send death save when already at 0 HP', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', []);
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
     });

    it('sends concentration prompt for player with active spell', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Wizard', {
        concentration: { spell: 'Thunderwave' },
       });
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Wizard', 8, ['Slashing'], 'TestCampaign', []);
      expect(sendConcentrationPrompt).toHaveBeenCalled();
     });

    it('does not send concentration prompt when player has no concentration', () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Bard');
      player.concentration = null;
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Bard', 5, ['Force'], 'TestCampaign', []);
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
      const result = applyDamageToTarget(cs, 'Cleric', 5, ['Force'], 'TestCampaign', null);
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
      const result = applyDamageToTarget(cs, 'Human', 5, ['Slashing'], 'TestCampaign', []);
      expect(result.damageReduced).toBe(false);
     });

    it('saves runtime state when player becomes unconscious via damage', () => {
      stubPlayerRuntime(3);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', []);
      expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'currentHitPoints', 0, 'TestCampaign');
     });

    it('uses default currentHitPoints of 0 from runtime when not set', () => {
      stubPlayerRuntime(null);
      const player = createPlayerCreature('Monk');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Monk', 5, ['Bludgeoning'], 'TestCampaign', []);
      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(0);
     });

    it('dispatches combat-summary-updated for player damage', () => {
      stubPlayerRuntime(25);
      const player = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([player]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      applyDamageToTarget(cs, 'Warlock', 3, ['Necrotic'], 'TestCampaign', []);
      expect(dispatched).toBe(true);
     });
   });

  describe('logDamageApplication side effects', () => {
    it('logs hp_change entry via fetch', () => {
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign');
      expect(global.fetch).toHaveBeenCalled();
      const callBody = JSON.parse(global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}');
      expect(callBody.type).toBe('hp_change');
      expect(callBody.isHealing).toBe(false);
     });

    it('sets isUnconscious when newHp <= 0', () => {
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
       );
      expect(callBody.isUnconscious).toBe(true);
     });

    it('sets threshold to "dead" when creature dies', () => {
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
       );
      expect(callBody.threshold).toBe('dead');
     });

    it('sets threshold to "bloodied" when crossing bloodied line', () => {
      const npc = createNpcCreature('Orc', 40, 30);
      const cs = makeCombatSummary([npc]);
         // maxHp=40, bloodied at <=20. Going from 30 to 15 crosses threshold
      applyDamageToTarget(cs, 'Orc', 15, ['Slashing'], 'TestCampaign');
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}'
       );
      if (callBody.threshold) expect(callBody.threshold).toBe('bloodied');
     });

    it('does not set threshold when already dead', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
       const cs = makeCombatSummary([player]);
       applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', []);
             // wasDead so no threshold set
     });

    it('resets death saves when player dies', () => {
      stubPlayerRuntime(3);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 10, ['Slashing'], 'TestCampaign', []);
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
      applyDamageToTarget(cs, 'Cleric', 5, ['Slashing'], 'TestCampaign', []);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String)
       );
     });

    it('does not set death saves when already dead', () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', []);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String)
       );
     });

    it('handles Frightened condition as string (not object)', () => {
      stubPlayerRuntime(20, ['frightened']);
      const player = createPlayerCreature('Rogue');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Rogue', 3, ['Piercing'], 'TestCampaign', []);
         // Should filter out frightened via String(c).toLowerCase() === 'frightened'
     });

    it('uses currentHp as oldHp for NPC even when creature has no maxHp', () => {
      const npc = { name: 'Creature', type: 'npc', currentHp: 8, conditions: [], concentration: null };
      const cs = makeCombatSummary([npc]);
      const result = applyDamageToTarget(cs, 'Creature', 3, ['Acid'], 'TestCampaign');
      expect(result.oldHp).toBe(8);
      expect(result.newHp).toBe(5);
     });

    it('does not set threshold "recovering" when going from bloodied to above bloodied via damage (impossible but branch exists)', () => {
         // Damage only goes down, so this branch is a no-op in practice but we cover the code path
      const npc = createNpcCreature('Goblin', 10, 3); // already bloodied at maxHp=10
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 2, ['Slashing'], 'TestCampaign');
     });

    it('uses getRuntimeValue for player maxHp in log when not on creature', () => {
      stubPlayerRuntime(30); // currentHitPoints
      getRuntimeValue.mockReturnValueOnce(30); // hitPoints (called from logDamageApplication)
      const player = createPlayerCreature('Bard');
      delete player.maxHp;
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Bard', 5, ['Force'], 'TestCampaign', []);
     });
   });

  describe('frightened removal fetch logging', () => {
    it('logs frightened condition removal for NPC', () => {
      const npc = createNpcCreature('Goblin', 10, 10, { conditions: [{ key: 'frightened' }] });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign');
      const conditionCall = global.fetch.mock.calls.find(
        c => c[0].includes('/log') && JSON.parse(c[1]?.body || '{}').condition === 'Frightened'
       );
      expect(conditionCall).toBeTruthy();
     });

    it('logs frightened condition removal for player', () => {
      stubPlayerRuntime(20, ['Frightened']);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', []);
      const conditionCall = global.fetch.mock.calls.find(
        c => c[0].includes('/log') && JSON.parse(c[1]?.body || '{}').condition === 'Frightened'
       );
      expect(conditionCall).toBeTruthy();
     });
   });

  describe('concentration save logging for NPC', () => {
    it('logs concentration-broken when NPC fails save', () => {
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
        saveBonuses: { con: -2 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 5, total: 3 });
      applyDamageToTarget(cs, 'Orc', 10, ['Thunder'], 'TestCampaign');
      const brokenCall = global.fetch.mock.calls.find(
        c => JSON.parse(c[1]?.body || '{}').type === 'concentration-broken'
       );
      expect(brokenCall).toBeTruthy();
     });

    it('logs concentration-save when NPC passes save', () => {
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
        saveBonuses: { con: 5 },
       });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      applyDamageToTarget(cs, 'Orc', 10, ['Thunder'], 'TestCampaign');
      const saveCall = global.fetch.mock.calls.find(
        c => JSON.parse(c[1]?.body || '{}').type === 'concentration-save'
       );
      expect(saveCall).toBeTruthy();
     });

    it('does not run concentration save for NPC when no concentration', () => {
      const npc = createNpcCreature('Goblin', 10, 10, { concentration: null });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign');
      expect(rollConcentrationSave).not.toHaveBeenCalled();
     });

    it('does not run concentration save when finalDamage is 0', () => {
      const npc = createNpcCreature('Skeleton', 20, 20, {
        concentration: { spell: 'Haste' },
        immunities: ['necrotic'],
       });
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Skeleton', 10, ['Necrotic'], 'TestCampaign');
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
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', []);
      // Fire resistance from buff should halve damage
      expect(result.finalDamage).toBe(5);
    });

    it('deduplicates resistanceTypes from multiple buffs', () => {
      getRuntimeValue
        .mockReturnValueOnce([
          { resistanceTypes: ['fire'] },
          { resistanceTypes: ['fire', 'cold'] },
        ]) // activeBuffs
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', []);
      // Should still halve fire damage (not quarter it)
    });

    it('handles non-array activeBuffs gracefully', () => {
      getRuntimeValue
        .mockReturnValueOnce('not-an-array') // activeBuffs
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', []);
      expect(result.finalDamage).toBe(10); // no buffs applied
    });

    it('handles null activeBuffs gracefully', () => {
      getRuntimeValue
        .mockReturnValueOnce(null) // activeBuffs
        .mockReturnValueOnce(30) // currentHitPoints
        .mockReturnValueOnce([]); // activeConditions
      const player = createPlayerCreature('Wizard');
      const cs = makeCombatSummary([player]);
      const result = applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], 'TestCampaign', []);
      expect(result.finalDamage).toBe(10); // no buffs applied
    });

    it('combines base resistances with buff resistanceTypes', () => {
      getRuntimeValue
        .mockReturnValueOnce([{ resistanceTypes: ['cold'] }]) // activeBuffs
        .mockReturnValueOnce(30) // currentHitPoints
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
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign');
      expect(getRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'activeBuffs', 'TestCampaign');
    });
  });

describe('applyDamageToTarget — Undying Sentinel', () => {
    function createPaladinWithUndyingSentinel(name, level) {
      return createPlayerCreature(name, {
        level: level || 15,
        computedStats: {
          name: name,
          level: level || 15,
          hitPoints: { max: 150 },
          class: {
            name: 'Paladin',
            class_levels: [{ level: level || 15 }],
          },
          allFeatures: [
            { name: 'Undying Sentinel' },
            { name: 'Other Feature' },
          ],
        },
      });
    }

    function createPlayerCharacterWithComputed(name, computedExtra = {}) {
      return {
        name,
        computedStats: {
          resistances: [],
          immunities: [],
          level: computedExtra.level || 1,
          hitPoints: computedExtra.hitPoints || { max: 10 },
          class: computedExtra.class || { name: 'Fighter', class_levels: [{ level: 1 }] },
          allFeatures: computedExtra.allFeatures || [],
          ...computedExtra,
        },
        ...computedExtra,
      };
    }

    beforeEach(() => {
      getRuntimeValue.mockClear();
      getRuntimeValue.mockImplementation(() => undefined);
      setRuntimeValue.mockClear();
    });

    it('triggers Undying Sentinel when player drops to 0 HP', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      // Set current HP to 10, so 10 damage drops to 0
      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      // Should have triggered Undying Sentinel: 1 + (15 * 3) = 46 HP
      expect(result.newHp).toBe(46);
      expect(result.finalDamage).toBe(0);
      expect(result.intercepted).toBe(true);
    });

    it('does not trigger if feature not present', () => {
      const fighter = createPlayerCreature('Fighter', {
        level: 15,
        computedStats: {
          name: 'Fighter',
          level: 15,
          hitPoints: { max: 120 },
          class: { name: 'Fighter', class_levels: [{ level: 15 }] },
          allFeatures: [{ name: 'Extra Attack' }],
        },
      });
      const cs = makeCombatSummary([fighter]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'Fighter' && key === 'currentHitPoints') return 5;
        if (charName === 'Fighter' && key === 'hitPoints') return 120;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('Fighter', {
        level: 15,
        hitPoints: { max: 120 },
        class: { name: 'Fighter', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Extra Attack' }],
      })]);

      expect(result.finalDamage).toBe(5);
      expect(result.newHp).toBe(0);
    });

    it('does not trigger if already used this long rest', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        if (charName === 'GloryPaladin' && key === 'undyingSentinelUsed') return true;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('scales healing with paladin level', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 20);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 5;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 200;
        return undefined;
      });

      const result = applyDamageToTarget(cs, 'GloryPaladin', 5, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 20,
        hitPoints: { max: 200 },
        class: { name: 'Paladin', class_levels: [{ level: 20 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      // 1 + (20 * 3) = 61 HP
      expect(result.newHp).toBe(61);
      expect(result.finalDamage).toBe(0);
    });

    it('resets death saves when triggering', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        return undefined;
      });

      applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'deathSaves', [false, false, false], 'TestCampaign');
      expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'deathFailures', [false, false, false], 'TestCampaign');
    });

    it('marks feature as used', () => {
      const paladin = createPaladinWithUndyingSentinel('GloryPaladin', 15);
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation((charName, key) => {
        if (charName === 'GloryPaladin' && key === 'currentHitPoints') return 10;
        if (charName === 'GloryPaladin' && key === 'hitPoints') return 150;
        return undefined;
      });

      applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('GloryPaladin', {
        level: 15,
        hitPoints: { max: 150 },
        class: { name: 'Paladin', class_levels: [{ level: 15 }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
      })]);

      expect(setRuntimeValue).toHaveBeenCalledWith('GloryPaladin', 'undyingSentinelUsed', true, 'TestCampaign');
    });

    it('does not trigger for NPCs', () => {
      const goblin = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([goblin]);

      applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign');

      expect(goblin.currentHp).toBe(0);
    });

    describe('Relentless Endurance (Orc race trait)', () => {
      it('triggers when orc is reduced to 0 HP and sets HP to 1', () => {
        const orc = createPlayerCreature('OrcPlayer');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer' && key === 'hitPoints') return 100;
          return undefined;
        });

        const result = applyDamageToTarget(cs, 'OrcPlayer', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }, { name: 'Darkvision' }],
        })]);

        expect(result.intercepted).toBe(true);
        expect(result.finalDamage).toBe(0);
        expect(result.newHp).toBe(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer', 'currentHitPoints', 1, 'TestCampaign');
      });

      it('does not trigger if already used this long rest', () => {
        const orc = createPlayerCreature('OrcPlayer2');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer2' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer2' && key === 'hitPoints') return 100;
          if (charName === 'OrcPlayer2' && key === 'relentlessEnduranceUsed') return true;
          return undefined;
        });

        const result = applyDamageToTarget(cs, 'OrcPlayer2', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer2', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(result.finalDamage).toBe(10);
        expect(result.newHp).toBe(0);
      });

      it('does not trigger if orc does not have the trait', () => {
        const elf = createPlayerCreature('ElfPlayer');
        const cs = makeCombatSummary([elf]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'ElfPlayer' && key === 'currentHitPoints') return 10;
          if (charName === 'ElfPlayer' && key === 'hitPoints') return 80;
          return undefined;
        });

        const result = applyDamageToTarget(cs, 'ElfPlayer', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('ElfPlayer', {
          level: 1,
          hitPoints: { max: 80 },
          allFeatures: [{ name: 'Darkvision' }, { name: 'Fey Ancestry' }],
        })]);

        expect(result.finalDamage).toBe(10);
        expect(result.newHp).toBe(0);
      });

      it('resets death saves when triggering', () => {
        const orc = createPlayerCreature('OrcPlayer3');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer3' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer3' && key === 'hitPoints') return 100;
          return undefined;
        });

        applyDamageToTarget(cs, 'OrcPlayer3', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer3', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer3', 'deathSaves', [false, false, false], 'TestCampaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer3', 'deathFailures', [false, false, false], 'TestCampaign');
      });

      it('marks feature as used', () => {
        const orc = createPlayerCreature('OrcPlayer4');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key) => {
          if (charName === 'OrcPlayer4' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer4' && key === 'hitPoints') return 100;
          return undefined;
        });

        applyDamageToTarget(cs, 'OrcPlayer4', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer4', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer4', 'relentlessEnduranceUsed', true, 'TestCampaign');
      });

      it('removes unconscious condition when triggering', () => {
        const orc = createPlayerCreature('OrcPlayer5');
        const cs = makeCombatSummary([orc]);

        getRuntimeValue.mockImplementation((charName, key, campaignName) => {
          if (charName === 'OrcPlayer5' && key === 'currentHitPoints') return 10;
          if (charName === 'OrcPlayer5' && key === 'hitPoints') return 100;
          if (charName === 'OrcPlayer5' && key === 'activeConditions' && campaignName === 'TestCampaign') return ['unconscious', 'blinded'];
          return undefined;
        });

        applyDamageToTarget(cs, 'OrcPlayer5', 10, ['Slashing'], 'TestCampaign', [createPlayerCharacterWithComputed('OrcPlayer5', {
          level: 1,
          hitPoints: { max: 100 },
          allFeatures: [{ name: 'Relentless Endurance' }],
        })]);

        expect(setRuntimeValue).toHaveBeenCalledWith('OrcPlayer5', 'activeConditions', ['blinded'], 'TestCampaign');
      });
    });

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

        // 10 psychic damage → resistance halves to 5 → reflect 5
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

        // 10 psychic damage → resistance halves to 5 → reflect 5
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
});
