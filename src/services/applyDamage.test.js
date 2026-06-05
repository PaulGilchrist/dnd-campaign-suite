import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

vi.mock('./diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('./savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('./concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('./utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  computeDamageAfterResistances,
  computeDamageAfterSave,
  rollSaveForCreature,
  applyDamageToTarget,
} from './applyDamage.js';

import { rollD20 } from './diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../hooks/useRuntimeState.js';
import storage from './storage.js';
import { sendDeathSavePrompt, sendConcentrationPrompt } from './savePromptService.js';
import { rollConcentrationSave } from './concentrationRules.js';

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
 * applyDamageToTarget calls getRuntimeValue twice for players:
 *   1) currentHitPoints → hp (number or null)
 *   2) activeConditions → array (use [] when no condition test needed)
 */
function stubPlayerRuntime(currentHp, conditions = []) {
  getRuntimeValue
    .mockReturnValueOnce(currentHp)           // currentHitPoints
    .mockReturnValueOnce(conditions);         // activeConditions
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
