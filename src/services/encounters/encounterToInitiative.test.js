// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../shared/logPoster.js', () => ({ postLogEntry: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  expandMonstersToCreatures,
  loadEncounterToInitiative,
} from './encounterToInitiative.js';

import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { postLogEntry } from '../shared/logPoster.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function createCharacter(name) {
  return { name, computedStats: {} };
}

function createMonster(name, extra = {}) {
  return {
    name,
    qty: 1,
    hit_points: 10,
    armor_class: 13,
    damage_resistances: [],
    damage_immunities: [],
    saving_throws: null,
    ability_score_modifiers: null,
    ...extra,
  };
}

// ── Tests for expandMonstersToCreatures ─────────────────────────

describe('expandMonstersToCreatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('player creatures', () => {
    it('creates player creatures from characters array', async () => {
      const chars = [createCharacter('Alchemist'), createCharacter('Bard')];
      const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

      const players = result.creatures.filter((c) => c.type === 'player');
      expect(players).toHaveLength(2);
      expect(players[0].initiative).toBe('');
      expect(players[0].concentration).toBeNull();
      expect(players[0].targetName).toBeNull();
    });

    it('sorts player creatures alphabetically by name', async () => {
      const chars = [createCharacter('Zebra'), createCharacter('Alpha')];
      const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

      const playerNames = result.creatures
        .filter((c) => c.type === 'player')
        .map((c) => c.name);
      expect(playerNames).toEqual(['Alpha', 'Zebra']);
    });

    it('uses utils.getName to resolve player names', async () => {
      const chars = [createCharacter('TestPlayer')];
      await expandMonstersToCreatures([], chars, 'TestCampaign');

      expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('handles empty characters list', async () => {
      const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');

      const players = result.creatures.filter((c) => c.type === 'player');
      expect(players).toHaveLength(0);
    });
  });

  describe('npc creature creation', () => {
    it('creates single npc from monster with qty=1', async () => {
      rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
      const monster = createMonster('Goblin');
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npcs = result.creatures.filter((c) => c.type === 'npc');
      expect(npcs).toHaveLength(1);
      expect(npcs[0].name).toBe('Goblin');
      expect(npcs[0].currentHp).toBe(10);
      expect(npcs[0].maxHp).toBe(10);
    });

    it('creates multiple npc creatures from qty > 1', async () => {
      rollD20.mockImplementation(() => [15, 3].shift() || 10);
      const monster = createMonster('Orc', { qty: 3, hit_points: 15 });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npcs = result.creatures.filter((c) => c.type === 'npc');
      expect(npcs).toHaveLength(3);
      expect(npcs[0].name).toBe('Orc 1');
      expect(npcs[1].name).toBe('Orc 2');
      expect(npcs[2].name).toBe('Orc 3');
      npcs.forEach((npc) => {
        expect(npc.maxHp).toBe(15);
        expect(npc.currentHp).toBe(15);
      });
    });

    it('defaults hp to 10 when monster has no hit_points', async () => {
      rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
      const monster = { name: 'Shadow', qty: 1 };
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.maxHp).toBe(10);
      expect(npc.currentHp).toBe(10);
    });

    it('defaults ac to 10 when monster has no armor_class', async () => {
      rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
      const monster = { name: 'Spirit', qty: 1, hit_points: 5 };
      delete monster.armor_class;
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.ac).toBe(10);
    });

    it('handles monster with no name', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('', { qty: 1 });
      delete monster.name;
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.name).toBe('Unnamed');
    });

    it('defaults qty to 1 when missing', async () => {
      rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
      const monster = { name: 'Ghoul' };
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npcs = result.creatures.filter((c) => c.type === 'npc');
      expect(npcs).toHaveLength(1);
      expect(npcs[0].name).toBe('Ghoul');
    });
  });

  describe('initiative rolling', () => {
    it('rolls initiative with positive bonus', async () => {
      rollD20.mockReturnValueOnce(14).mockReturnValueOnce(8);
      const monster = createMonster('Dragon', { qty: 1, initiative_details: '+5' });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.initiative).toBe('19');
    });

    it('handles monster with no initiative_details (bonus = 0)', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(6);
      const monster = createMonster('Rat', { qty: 1 });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.initiative).toBe('10');
    });

    it('handles negative initiative bonus', async () => {
      rollD20.mockReturnValueOnce(8).mockReturnValueOnce(4);
      const monster = createMonster('Slime', { qty: 1, initiative_details: '-3' });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.initiative).toBe('5');
    });

    it('handles empty initiative_details string', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Goblin', { initiative_details: '' });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.initiative).toBe('10');
    });

    it('rolls initiative once per npc instance', async () => {
      const monster = createMonster('Goblin', { qty: 2 });
      rollD20.mockImplementation(() => [15, 3, 8].shift() || 10);

      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');
      expect(result.npcRollResults).toHaveLength(2);
    });

    it('stores rollResult shape in npcRollResults', async () => {
      rollD20.mockReturnValueOnce(17).mockReturnValueOnce(5);
      const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');

      const rollData = result.npcRollResults[0].rollResult;
      expect(rollData).toHaveProperty('roll', 17);
      expect(rollData).toHaveProperty('total', 17);
      expect(rollData).toHaveProperty('rolls');
      expect(rollData.rolls).toHaveLength(2);
      expect(rollData).toHaveProperty('bonus', 0);
    });
  });

  describe('monster data passthrough', () => {
    it('includes resistances from monster data', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Skeleton', {
        damage_resistances: ['Cold'],
        damage_immunities: ['Necrotic', 'Poison'],
      });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.resistances).toEqual(['Cold']);
      expect(npc.immunities).toEqual(['Necrotic', 'Poison']);
    });

    it('defaults resistances and immunities to empty arrays', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Blob');
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.resistances).toEqual([]);
      expect(npc.immunities).toEqual([]);
    });

    it('includes save bonuses from saving_throws', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Golem', {
        saving_throws: { con: { modifier: 5 }, wis: { modifier: 3 } },
      });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.saveBonuses.con).toBe(5);
      expect(npc.saveBonuses.wis).toBe(3);
    });

    it('falls back to ability_score_modifiers for save bonuses', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Elemental', {
        saving_throws: null,
        ability_score_modifiers: { con: 4, str: 2 },
      });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.saveBonuses.con).toBe(4);
      expect(npc.saveBonuses.str).toBe(2);
    });

    it('defaults save bonuses to 0 when no data available', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Beast', {
        saving_throws: {},
        ability_score_modifiers: null,
      });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.saveBonuses.str).toBe(0);
      expect(npc.saveBonuses.dex).toBe(0);
      expect(npc.saveBonuses.con).toBe(0);
      expect(npc.saveBonuses.int).toBe(0);
      expect(npc.saveBonuses.wis).toBe(0);
      expect(npc.saveBonuses.cha).toBe(0);
    });

    it('handles saving_throws with missing modifier field', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Fiend', {
        saving_throws: { str: {} },
      });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.saveBonuses.str).toBe(0);
    });
  });

  describe('phantasmal summon hp halving', () => {
    it('halves hp for Bestial Spirit when character has it in phantasmal list', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      getRuntimeValue.mockImplementation((charName, prop) => {
        if (prop === '_phantasmalCreatures_list') return ['Bestial Spirit'];
        return null;
      });

      const monster = createMonster('Bestial Spirit', { hit_points: 20 });
      const chars = [createCharacter('Druid')];
      const result = await expandMonstersToCreatures([monster], chars, 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.maxHp).toBe(10);
      expect(npc.currentHp).toBe(10);
    });

    it('halves hp for Fey Spirit when character has it in phantasmal list', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      getRuntimeValue.mockImplementation((charName, prop) => {
        if (prop === '_phantasmalCreatures_list') return ['Fey Spirit'];
        return null;
      });

      const monster = createMonster('Fey Spirit', { hit_points: 30 });
      const chars = [createCharacter('Bard')];
      const result = await expandMonstersToCreatures([monster], chars, 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.maxHp).toBe(15);
    });

    it('does not halve hp when phantasmal list does not include the summon', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      getRuntimeValue.mockImplementation((charName, prop) => {
        if (prop === '_phantasmalCreatures_list') return ['Other Summon'];
        return null;
      });

      const monster = createMonster('Bestial Spirit', { hit_points: 20 });
      const chars = [createCharacter('Druid')];
      const result = await expandMonstersToCreatures([monster], chars, 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.maxHp).toBe(20);
    });

    it('does not halve hp when getRuntimeValue returns null', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      getRuntimeValue.mockReturnValue(null);

      const monster = createMonster('Bestial Spirit', { hit_points: 20 });
      const chars = [createCharacter('Druid')];
      const result = await expandMonstersToCreatures([monster], chars, 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.maxHp).toBe(20);
    });
  });

  describe('npcRollResults', () => {
    it('npcRollResults matches number of npc creatures created', async () => {
      rollD20.mockReturnValueOnce(12).mockReturnValueOnce(12);
      const result = await expandMonstersToCreatures([createMonster('Wolf', { qty: 2 })], [], 'TestCampaign');

      const npcs = result.creatures.filter((c) => c.type === 'npc');
      expect(result.npcRollResults).toHaveLength(npcs.length);
    });

    it('npcRollResults entries have name and rollResult', async () => {
      rollD20.mockReturnValueOnce(12).mockReturnValueOnce(12);
      const result = await expandMonstersToCreatures([createMonster('Wolf', { qty: 2 })], [], 'TestCampaign');

      expect(result.npcRollResults[0].name).toBe('Wolf 1');
      expect(result.npcRollResults[1].name).toBe('Wolf 2');
      expect(result.npcRollResults[0]).toHaveProperty('rollResult');
    });
  });

  describe('combined monsters and characters', () => {
    it('includes both players and npcs in result', async () => {
      rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
      const chars = [createCharacter('Hero')];
      const result = await expandMonstersToCreatures([createMonster('Goblin')], chars, 'TestCampaign');

      const players = result.creatures.filter((c) => c.type === 'player');
      const npcs = result.creatures.filter((c) => c.type === 'npc');
      expect(players).toHaveLength(1);
      expect(npcs).toHaveLength(1);
    });

    it('handles empty monsters list', async () => {
      const chars = [createCharacter('Hero')];
      const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

      const npcs = result.creatures.filter((c) => c.type === 'npc');
      expect(npcs).toHaveLength(0);
      expect(result.npcRollResults).toEqual([]);
    });
  });
});

// ── Tests for loadEncounterToInitiative ─────────────────────────

describe('loadEncounterToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sorts creatures by initiative descending', async () => {
    // Each monster calls rollD20 twice (r1 for initiative, r2 stored in rolls array)
    // Dragon r1=20, Goblin r1=15, Orc r1=10 → sorted: Dragon(20), Goblin(15), Orc(10)
    const rollValues = [20, 0, 15, 0, 10, 0];
    rollD20.mockImplementation(() => rollValues.shift() || 10);

    const monsters = [
      createMonster('Dragon', { qty: 1 }),
      createMonster('Goblin', { qty: 1 }),
      createMonster('Orc', { qty: 1 }),
    ];
    const result = await loadEncounterToInitiative(monsters, [], 'TestCampaign');

    const npcNames = result.combatSummary.creatures
      .filter((c) => c.type === 'npc')
      .map((c) => c.name);
    expect(npcNames).toEqual(['Dragon', 'Goblin', 'Orc']);
  });

  it('stores combatSummary in storage', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      expect.objectContaining({ round: 1, creatures: expect.any(Array) }),
      'TestCampaign',
    );
  });

  it('sets activeCreatureName to first creature after sorting', async () => {
    rollD20.mockReturnValueOnce(18).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Dragon')], [], 'TestCampaign');

    expect(storage.set).toHaveBeenCalledWith(
      'activeCreatureName',
      'Dragon',
      'TestCampaign',
    );
  });

  it('dispatches initiative-rolled event', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    let dispatched = false;
    const handler = () => { dispatched = true; };
    window.addEventListener('initiative-rolled', handler);

    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');
    expect(dispatched).toBe(true);

    window.removeEventListener('initiative-rolled', handler);
  });

  it('returns combatSummary with round 1', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const result = await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    expect(result.combatSummary.round).toBe(1);
  });

  it('includes both players and npcs in combatSummary.creatures', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const chars = [createCharacter('Hero')];
    const result = await loadEncounterToInitiative([createMonster('Goblin')], chars, 'TestCampaign');

    expect(result.combatSummary.creatures).toHaveLength(2);
  });

  it('returns firstName as name of first creature after sort', async () => {
    rollD20.mockReturnValueOnce(20).mockReturnValueOnce(10);
    const chars = [createCharacter('Player')];
    const result = await loadEncounterToInitiative([createMonster('Dragon')], chars, 'TestCampaign');

    expect(result.firstName).toBe('Dragon');
  });

  it('handles empty monsters and characters', async () => {
    const result = await loadEncounterToInitiative([], [], 'TestCampaign');

    expect(result.combatSummary.creatures).toEqual([]);
    expect(result.firstName).toBeUndefined();
  });

  it('handles only players without monsters', async () => {
    const chars = [createCharacter('Hero')];
    const result = await loadEncounterToInitiative([], chars, 'TestCampaign');

    expect(result.combatSummary.creatures).toHaveLength(1);
    expect(result.combatSummary.creatures[0].type).toBe('player');
    expect(result.combatSummary.creatures[0].initiative).toBe('');
  });

  it('sets activeCreatureName to undefined when no creatures exist', async () => {
    await loadEncounterToInitiative([], [], 'TestCampaign');

    expect(storage.set).toHaveBeenCalledWith(
      'activeCreatureName',
      undefined,
      'TestCampaign',
    );
  });

  it('calls postLogEntry for each npc roll', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    expect(postLogEntry).toHaveBeenCalledTimes(1);
    expect(postLogEntry).toHaveBeenCalledWith(
      'TestCampaign',
      expect.objectContaining({
        type: 'roll',
        rollType: 'initiative',
      }),
    );
  });

  it('logs roll with isNatural20 flag when roll is 20', async () => {
    rollD20.mockReturnValueOnce(20).mockReturnValueOnce(15);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const callArgs = postLogEntry.mock.calls[0][1];
    expect(callArgs.isNatural20).toBe(true);
  });

  it('logs roll with isNatural1 flag when roll is 1', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValueOnce(8);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const callArgs = postLogEntry.mock.calls[0][1];
    expect(callArgs.isNatural1).toBe(true);
  });

  it('logs roll with mode normal', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(5);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const callArgs = postLogEntry.mock.calls[0][1];
    expect(callArgs.mode).toBe('normal');
  });

  it('logs roll with correct total and rolls', async () => {
    rollD20.mockReturnValueOnce(17).mockReturnValueOnce(3);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const callArgs = postLogEntry.mock.calls[0][1];
    expect(callArgs.total).toBe(17);
    expect(callArgs.rolls).toEqual([17, 3]);
  });

  it('logs roll with correct bonus', async () => {
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(8);
    const monster = createMonster('Dragon', { initiative_details: '+5' });
    await loadEncounterToInitiative([monster], [], 'TestCampaign');

    const callArgs = postLogEntry.mock.calls[0][1];
    expect(callArgs.bonus).toBe(5);
  });

  it('logs roll with correct characterName', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const callArgs = postLogEntry.mock.calls[0][1];
    expect(callArgs.characterName).toBe('Goblin');
  });

  it('logs roll for each npc when multiple exist', async () => {
    rollD20.mockImplementation(() => [10, 5, 12, 7].shift() || 10);
    await loadEncounterToInitiative([createMonster('Wolf', { qty: 2 })], [], 'TestCampaign');

    expect(postLogEntry).toHaveBeenCalledTimes(2);
  });
});
