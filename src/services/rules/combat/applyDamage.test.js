// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
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
  applyDamageToTarget,
} from './applyDamage.js';

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

describe('applyDamageToTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('returns null when combatSummary is null or undefined', async () => {
    expect(await applyDamageToTarget(null, 'Goblin', 5, ['Bludgeoning'], 'TestCampaign')).toBeNull();
    expect(await applyDamageToTarget(undefined, 'Goblin', 5, ['Bludgeoning'], 'TestCampaign')).toBeNull();
  });

  it('returns null when target creature not found', async () => {
    const cs = makeCombatSummary([createNpcCreature('Orc', 10, 10)]);
    expect(await applyDamageToTarget(cs, 'MissingTarget', 5, ['Slashing'], 'TestCampaign')).toBeNull();
  });

  describe('NPC damage application', () => {
    it('reduces NPC HP and returns result object', async () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      const result = await applyDamageToTarget(cs, 'Goblin', 6, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(4);
      expect(result.finalDamage).toBe(6);
      expect(result.damageReduced).toBe(false);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 4, 'TestCampaign');
    });

    it('clamps HP to 0 when damage exceeds max', async () => {
      stubNpcRuntime(5);
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'currentHitPoints', 0, 'TestCampaign');
    });

    it('applies resistance for NPC', async () => {
      stubNpcRuntime(100);
      const npc = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { resistances: ['fire'] },
      })]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'currentHitPoints', 95, 'TestCampaign');
    });

    it('applies immunity for NPC', async () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Skeleton', 20, 20, { immunities: ['necrotic'] });
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Skeleton', 15, ['Necrotic'], 'TestCampaign', [createPlayerCharacter('Skeleton', {
        computedExtra: { immunities: ['necrotic'] },
      })]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Skeleton', 'currentHitPoints', 20, 'TestCampaign');
    });

    it('removes frightened condition on NPC taking damage > 0, preserves other conditions, and does not remove when immune', async () => {
      stubNpcRuntime(10, ['frightened']);
      const npc1 = createNpcCreature('Goblin', 10, 10, {
        conditions: [{ key: 'frightened' }],
      });
      const cs1 = makeCombatSummary([npc1]);
      await applyDamageToTarget(cs1, 'Goblin', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], 'TestCampaign');

      stubNpcRuntime(10, ['frightened', 'poisoned']);
      const npc2 = createNpcCreature('Goblin2', 10, 10, {
        conditions: [{ key: 'frightened' }, { key: 'poisoned' }],
      });
      const cs2 = makeCombatSummary([npc2]);
      await applyDamageToTarget(cs2, 'Goblin2', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Goblin2')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Goblin2', 'activeConditions', ['poisoned'], 'TestCampaign');

      stubNpcRuntime(100, ['frightened']);
      const npc3 = createNpcCreature('Dragon', 100, 100, {
        immunities: ['fire'],
        conditions: [{ key: 'frightened' }],
      });
      const cs3 = makeCombatSummary([npc3]);
      await applyDamageToTarget(cs3, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { immunities: ['fire'] },
      })]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Dragon', 'currentHitPoints', 100, 'TestCampaign');
    });

    it('removes charmed condition on NPC when endsOnDamage is true', async () => {
      stubNpcRuntime(10, ['charmed']);
      const npc = createNpcCreature('Wolf', 10, 10, {
        type: 'monster',
        conditions: [{ key: 'charmed', endsOnDamage: true }],
      });
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Wolf', 3, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Wolf')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Wolf', 'activeConditions', [], 'TestCampaign');
    });

    it('updates concentration DC on NPC when damage > 0', async () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(npc.concentration.dc).toBe(10);
    });

    it('breaks NPC concentration save on fail', async () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 15 },
        saveBonuses: { con: -1 },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: false, roll: 8, total: 7 });
      await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(sendConcentrationPrompt).toHaveBeenCalled();
    });

    it('keeps NPC concentration on save success', async () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10, {
        concentration: { spell: 'Haste', dc: 10 },
        saveBonuses: { con: 5 },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 12, total: 17 });
      await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(npc.concentration).not.toBeNull();
    });

    it('recalculates concentration DC for odd damage', async () => {
      stubNpcRuntime(20);
      const npc = createNpcCreature('Orc', 20, 20, {
        concentration: { spell: 'Thunderwave' },
      });
      const cs = makeCombatSummary([npc]);
      rollConcentrationSave.mockReturnValue({ success: true, roll: 15, total: 20 });
      await applyDamageToTarget(cs, 'Orc', 11, ['Thunder'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      expect(npc.concentration.dc).toBe(Math.max(10, Math.floor(11 / 2)));
    });

    it('dispatches combat-summary-updated event', async () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      await applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(dispatched).toBe(true);
    });

    it('sets damageReduced based on final vs raw damage', async () => {
      stubNpcRuntime(100);
      const npc1 = createNpcCreature('Dragon', 100, 100, { resistances: ['fire'] });
      const cs1 = makeCombatSummary([npc1]);
      const result1 = await applyDamageToTarget(cs1, 'Dragon', 10, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
        computedExtra: { resistances: ['fire'] },
      })]);
      expect(result1.damageReduced).toBe(true);

      stubNpcRuntime(10);
      const npc2 = createNpcCreature('Goblin', 10, 10);
      const cs2 = makeCombatSummary([npc2]);
      const result2 = await applyDamageToTarget(cs2, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(result2.damageReduced).toBe(false);

      stubNpcRuntime(20);
      const npc3 = createNpcCreature('Skeleton', 20, 20, { immunities: ['cold'] });
      const cs3 = makeCombatSummary([npc3]);
      const result3 = await applyDamageToTarget(cs3, 'Skeleton', 5, ['Cold'], 'TestCampaign', [createPlayerCharacter('Skeleton', {
        computedExtra: { immunities: ['cold'] },
      })]);
      expect(result3.damageReduced).toBe(true);
    });

    it('handles zero damage without removing frightened', async () => {
      stubNpcRuntime(10, ['frightened']);
      const npc = createNpcCreature('Dragon', 10, 10, {
        immunities: ['fire'],
        conditions: [{ key: 'frightened' }],
      });
      const cs = makeCombatSummary([npc]);
      const result = await applyDamageToTarget(cs, 'Dragon', 5, ['Fire'], 'TestCampaign', [createPlayerCharacter('Dragon', {
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
    it('applies damage to player HP via runtime state', async () => {
      stubPlayerRuntime(25);
      const player = createPlayerCreature('Alchemist');
      const cs = makeCombatSummary([player]);
      const result = await applyDamageToTarget(cs, 'Alchemist', 8, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Alchemist')]);
      expect(result.oldHp).toBe(25);
      expect(result.newHp).toBe(17);
      expect(setRuntimeValue).toHaveBeenCalledWith('Alchemist', 'currentHitPoints', 17, 'TestCampaign');
    });

    it('uses player computedStats for resistances', async () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Paladin');
      const characters = [createPlayerCharacter('Paladin', {
        computedExtra: { resistances: ['poison'] },
      })];
      const cs = makeCombatSummary([player]);
      const result = await applyDamageToTarget(cs, 'Paladin', 10, ['Poison'], 'TestCampaign', characters);
      expect(result.finalDamage).toBe(5);
    });

    it('uses player computedStats for immunities', async () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Celestial');
      const characters = [createPlayerCharacter('Celestial', {
        computedExtra: { immunities: ['fire'] },
      })];
      const cs = makeCombatSummary([player]);
      const result = await applyDamageToTarget(cs, 'Celestial', 15, ['Fire'], 'TestCampaign', characters);
      expect(result.finalDamage).toBe(0);
    });

    it('removes Frightened from player conditions on damage > 0, does not remove non-Frightened', async () => {
      stubPlayerRuntime(20, ['Frightened']);
      const player1 = createPlayerCreature('Ranger');
      const cs1 = makeCombatSummary([player1]);
      await applyDamageToTarget(cs1, 'Ranger', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Ranger')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Ranger', 'activeConditions', [], 'TestCampaign');

      setRuntimeValue.mockClear();
      stubPlayerRuntime(20, ['Poisoned']);
      const player2 = createPlayerCreature('Ranger2');
      const cs2 = makeCombatSummary([player2]);
      await applyDamageToTarget(cs2, 'Ranger2', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Ranger2')]);
      const conditionCalls = setRuntimeValue.mock.calls.filter(
        c => c[1] === 'activeConditions',
      );
      expect(conditionCalls).toHaveLength(0);
    });

    it('sends death save prompt when player goes from alive to unconscious, not when already at 0 HP', async () => {
      stubPlayerRuntime(5);
      const player1 = createPlayerCreature('Fighter');
      const cs1 = makeCombatSummary([player1]);
      await applyDamageToTarget(cs1, 'Fighter', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(sendDeathSavePrompt).toHaveBeenCalledWith('TestCampaign', {
        promptId: 'test-guid-001',
        targetName: 'Fighter',
      });

      sendDeathSavePrompt.mockClear();
      stubPlayerRuntime(0);
      const player2 = createPlayerCreature('Fighter2');
      const cs2 = makeCombatSummary([player2]);
      await applyDamageToTarget(cs2, 'Fighter2', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter2')]);
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    });

    it('sends concentration prompt for player with active spell, not when no concentration or damage is 0', async () => {
      stubPlayerRuntime(30);
      const player1 = createPlayerCreature('Wizard', {
        concentration: { spell: 'Thunderwave' },
      });
      const cs1 = makeCombatSummary([player1]);
      await applyDamageToTarget(cs1, 'Wizard', 8, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Wizard')]);
      expect(sendConcentrationPrompt).toHaveBeenCalled();

      sendConcentrationPrompt.mockClear();
      stubPlayerRuntime(30);
      const player2 = createPlayerCreature('Bard');
      player2.concentration = null;
      const cs2 = makeCombatSummary([player2]);
      await applyDamageToTarget(cs2, 'Bard', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Bard')]);
      expect(sendConcentrationPrompt).not.toHaveBeenCalled();

      sendConcentrationPrompt.mockClear();
      stubPlayerRuntime(30);
      const player3 = createPlayerCreature('Wizard2', { concentration: { spell: 'Haste' } });
      const characters = [createPlayerCharacter('Wizard2', {
        computedExtra: { immunities: ['cold'] },
      })];
      const cs3 = makeCombatSummary([player3]);
      await applyDamageToTarget(cs3, 'Wizard2', 5, ['Cold'], 'TestCampaign', characters);
      expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    });

    it('handles characters array matching by name prefix with space', async () => {
      stubPlayerRuntime(20);
      const player = createPlayerCreature('Druid');
      const characters = [createPlayerCharacter('Druid the Wise', {
        computedExtra: { resistances: [] },
      })];
      const cs = makeCombatSummary([player]);
      const result = await applyDamageToTarget(cs, 'Druid', 5, ['Fire'], 'TestCampaign', characters);
      expect(result.oldHp).toBe(20);
    });

    it('sets damageReduced for player with/without resistance, saves runtime state on unconscious', async () => {
      stubPlayerRuntime(30);
      const player1 = createPlayerCreature('Goliath');
      const characters = [createPlayerCharacter('Goliath', {
        computedExtra: { resistances: ['cold'] },
      })];
      const cs1 = makeCombatSummary([player1]);
      const result1 = await applyDamageToTarget(cs1, 'Goliath', 7, ['Cold'], 'TestCampaign', characters);
      expect(result1.damageReduced).toBe(true);

      stubPlayerRuntime(30);
      const player2 = createPlayerCreature('Human');
      const cs2 = makeCombatSummary([player2]);
      const result2 = await applyDamageToTarget(cs2, 'Human', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Human')]);
      expect(result2.damageReduced).toBe(false);

      stubPlayerRuntime(3);
      const player3 = createPlayerCreature('Fighter');
      const cs3 = makeCombatSummary([player3]);
      await applyDamageToTarget(cs3, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Fighter', 'currentHitPoints', 0, 'TestCampaign');
    });

    it('throws when currentHitPoints is not set from runtime', async () => {
      stubPlayerRuntime(null);
      const player = createPlayerCreature('Monk');
      const cs = makeCombatSummary([player]);
      await expect(applyDamageToTarget(cs, 'Monk', 5, ['Bludgeoning'], 'TestCampaign', [createMinimalCharacter('Monk')])).rejects.toThrow('currentHitPoints not found for "Monk"');
    });

    it('dispatches combat-summary-updated for player damage', async () => {
      stubPlayerRuntime(25);
      const player = createPlayerCreature('Warlock');
      const cs = makeCombatSummary([player]);
      let dispatched = false;
      window.addEventListener('combat-summary-updated', () => { dispatched = true; });
      await applyDamageToTarget(cs, 'Warlock', 3, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('Warlock')]);
      expect(dispatched).toBe(true);
    });

    it('handles zero damage without sending death save prompt', async () => {
      stubPlayerRuntime(5);
      const player = createPlayerCreature('Fighter');
      player.concentration = null;
      const cs = makeCombatSummary([player]);
      const result = await applyDamageToTarget(cs, 'Fighter', 0, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(result.finalDamage).toBe(0);
      expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    });
  });

  describe('Projected Ward recent-damage writer', () => {
    it('records projectedWardDamage on a damaged non-warden player', async () => {
      stubPlayerRuntime(73);
      const player = createPlayerCreature('HexWarlock', { currentHp: 73 });
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'HexWarlock', 13, ['Slashing'], 'TestCampaign', [createMinimalCharacter('HexWarlock')], { ignoreResistance: false, attackerName: 'Wight 1' });
      expect(setRuntimeValue).toHaveBeenCalledWith('HexWarlock', 'projectedWardDamage',
        expect.objectContaining({ rawDamage: 13, damageType: 'Slashing', attackerName: 'Wight 1' }), 'TestCampaign');
    });

    it('does not record projectedWardDamage when the damaged player is an active warden (self-absorbed)', async () => {
      stubPlayerRuntime(73);
      getRuntimeValue.mockImplementation((key, subKey) => {
        if (subKey === 'activeBuffs') return [];
        if (subKey === 'arcaneWardActive') return true;
        if (subKey === 'arcaneWardHp') return 0;
        if (subKey === 'currentHitPoints') return 73;
        if (subKey === 'activeConditions') return [];
        return undefined;
      });
      const warden = createPlayerCreature('DivinationWizard', { currentHp: 73 });
      const cs = makeCombatSummary([warden]);
      await applyDamageToTarget(cs, 'DivinationWizard', 10, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('DivinationWizard')], { ignoreResistance: false, attackerName: 'Wight 1' });
      expect(setRuntimeValue).not.toHaveBeenCalledWith('DivinationWizard', 'projectedWardDamage', expect.anything(), 'TestCampaign');
    });

    it('does not record projectedWardDamage for zero damage', async () => {
      stubPlayerRuntime(73);
      const player = createPlayerCreature('HexWarlock', { currentHp: 73 });
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'HexWarlock', 0, ['Slashing'], 'TestCampaign', [createMinimalCharacter('HexWarlock')], { ignoreResistance: false, attackerName: 'Wight 1' });
      expect(setRuntimeValue).not.toHaveBeenCalledWith('HexWarlock', 'projectedWardDamage', expect.anything(), 'TestCampaign');
    });

    it('accumulates multi-part damage from the same attacker sequence', async () => {
      const store = new Map([['HexWarlock.currentHitPoints', 73]]);
      getRuntimeValue.mockImplementation((storeName, subKey) => store.get(`${storeName}.${subKey}`));
      setRuntimeValue.mockImplementation((storeName, subKey, value) => { store.set(`${storeName}.${subKey}`, value); });
      const player = createPlayerCreature('HexWarlock', { currentHp: 73 });
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'HexWarlock', 7, ['Slashing'], 'TestCampaign', [createMinimalCharacter('HexWarlock')], { ignoreResistance: false, attackerName: 'Wight 1' });
      await applyDamageToTarget(cs, 'HexWarlock', 6, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('HexWarlock')], { ignoreResistance: false, attackerName: 'Wight 1' });
      expect(store.get('HexWarlock.projectedWardDamage').rawDamage).toBe(13);
      expect(store.get('HexWarlock.currentHitPoints')).toBe(60);
    });

    it('does not record projectedWardDamage on NPC targets', async () => {
      stubNpcRuntime(55);
      const npc = { ...createNpcCreature('Wight 1', 55, 55), type: 'npc' };
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Wight 1', 12, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Wight 1')], { ignoreResistance: false, attackerName: 'HexWarlock' });
      expect(setRuntimeValue).not.toHaveBeenCalledWith('Wight 1', 'projectedWardDamage', expect.anything(), 'TestCampaign');
    });
  });

  describe('logDamageApplication side effects', () => {
    it('logs hp_change entry via fetch with correct type and isHealing', async () => {
      stubNpcRuntime(10);
      const npc = createNpcCreature('Goblin', 10, 10);
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Goblin', 3, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(global.fetch).toHaveBeenCalled();
      const callBody = JSON.parse(global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}');
      expect(callBody.type).toBe('hp_change');
      expect(callBody.isHealing).toBe(false);
    });

    it('sets isUnconscious and threshold dead when creature dies', async () => {
      stubNpcRuntime(5);
      const npc = createNpcCreature('Goblin', 5, 5);
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Goblin', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const callBody = JSON.parse(
        global.fetch.mock.calls.find(c => c[0].includes('/log'))?.[1]?.body || '{}',
      );
      expect(callBody.isUnconscious).toBe(true);
      expect(callBody.threshold).toBe('dead');
    });

    it('sets threshold to "bloodied" when crossing bloodied line, not when going from bloodied to below', async () => {
      // First, find the Orc log call
      const npc = { name: 'Orc', type: 'monster', maxHp: 40, currentHp: 30, conditions: [], template: [], concentration: null };
      const cs = makeCombatSummary([npc]);
      await applyDamageToTarget(cs, 'Orc', 15, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Orc')]);
      console.log('ORC TEST fetch calls:', JSON.stringify(global.fetch.mock.calls));
      const orcCall = global.fetch.mock.calls.find(c => c[0].includes('/log'));
      const orcBody = JSON.parse(orcCall?.[1]?.body || '{}');
      expect(orcBody.threshold).toBe('bloodied');

      // Now test bloodied -> below bloodied (no recovering threshold)
      global.fetch.mockClear();
      stubNpcRuntime(3);
      const npc2 = createNpcCreature('Goblin', 10, 3);
      const cs2 = makeCombatSummary([npc2]);
      await applyDamageToTarget(cs2, 'Goblin', 2, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      const goblinCall = global.fetch.mock.calls.find(c => c[0].includes('/log'));
      const goblinBody = JSON.parse(goblinCall?.[1]?.body || '{}');
      expect(goblinBody.threshold).toBeUndefined();
    });

    it('does not set threshold or death saves when already dead, resets death saves when player dies', async () => {
      stubPlayerRuntime(0);
      const player = createPlayerCreature('Fighter');
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter')]);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String),
      );

      stubPlayerRuntime(3);
      const player2 = createPlayerCreature('Fighter2');
      const cs2 = makeCombatSummary([player2]);
      await applyDamageToTarget(cs2, 'Fighter2', 10, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter2')]);
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter2', 'deathSaves', [false, false, false], 'TestCampaign',
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter2', 'deathFailures', [false, false, false], 'TestCampaign',
      );
    });

    it('does not set death saves when not dying (still alive)', async () => {
      stubPlayerRuntime(30);
      const player = createPlayerCreature('Cleric');
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'Cleric', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Cleric')]);
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        expect.any(String), 'deathSaves', expect.any(Array), expect.any(String),
      );
    });

    it('handles Frightened condition as string (not object)', async () => {
      stubPlayerRuntime(20, ['frightened']);
      const player = createPlayerCreature('Rogue');
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'Rogue', 3, ['Piercing'], 'TestCampaign', [createMinimalCharacter('Rogue')]);
      expect(setRuntimeValue).toHaveBeenCalledWith('Rogue', 'activeConditions', [], 'TestCampaign');
    });

    it('uses currentHp as oldHp for NPC even when creature has no maxHp', async () => {
      stubNpcRuntime(8);
      const npc = { name: 'Creature', type: 'player', currentHp: 8, conditions: [], template: [], concentration: null };
      const cs = makeCombatSummary([npc]);
      const result = await applyDamageToTarget(cs, 'Creature', 3, ['Acid'], 'TestCampaign', [createMinimalCharacter('Creature')]);
      expect(result.oldHp).toBe(8);
      expect(result.newHp).toBe(5);
    });

    it('uses getRuntimeValue for player maxHp in log when not on creature', async () => {
      stubPlayerRuntime(30);
      getRuntimeValue.mockReturnValueOnce(30);
      const player = createPlayerCreature('Bard');
      delete player.maxHp;
      const cs = makeCombatSummary([player]);
      await applyDamageToTarget(cs, 'Bard', 5, ['Force'], 'TestCampaign', [createMinimalCharacter('Bard')]);
    });
  });

  describe('concentration save logging for NPC', () => {
    it('does not run concentration save when no concentration or finalDamage is 0', async () => {
      stubNpcRuntime(10);
      const npc1 = createNpcCreature('Goblin', 10, 10, { concentration: null });
      const cs1 = makeCombatSummary([npc1]);
      await applyDamageToTarget(cs1, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Goblin')]);
      expect(rollConcentrationSave).not.toHaveBeenCalled();

      stubNpcRuntime(20);
      const npc2 = createNpcCreature('Skeleton', 20, 20, {
        concentration: { spell: 'Haste' },
        immunities: ['necrotic'],
      });
      const cs2 = makeCombatSummary([npc2]);
      await applyDamageToTarget(cs2, 'Skeleton', 10, ['Necrotic'], 'TestCampaign', [createMinimalCharacter('Skeleton')]);
      expect(rollConcentrationSave).not.toHaveBeenCalled();
    });
  });
});
