// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  expandMonstersToCreatures,
  loadEncounterToInitiative,
} from './encounterToInitiative.js';

import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { addEntry } from '../ui/logService.js';
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
    it('creates player creatures sorted alphabetically with correct defaults', async () => {
      const chars = [createCharacter('Zebra'), createCharacter('Alpha'), createCharacter('Bard')];
      const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

      const players = result.creatures.filter((c) => c.type === 'player');
      expect(players).toHaveLength(3);
      expect(players.map(p => p.name)).toEqual(['Alpha', 'Bard', 'Zebra']);
      players.forEach((p) => {
        expect(p.initiative).toBe('');
        expect(p.concentration).toBeNull();
        expect(p.targetName).toBeNull();
      });
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

    it('creates multiple npc creatures from qty > 1 with sequential names', async () => {
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

    it('defaults hp to 10 and ac to 10 when monster has no hit_points or armor_class', async () => {
      rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
      const monster = { name: 'Shadow', qty: 1 };
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.maxHp).toBe(10);
      expect(npc.currentHp).toBe(10);
      expect(npc.ac).toBe(10);
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
  });

  describe('monster data passthrough', () => {
    it('includes resistances, immunities, and save bonuses from monster data', async () => {
      rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
      const monster = createMonster('Skeleton', {
        damage_resistances: ['Cold'],
        damage_immunities: ['Necrotic', 'Poison'],
        saving_throws: { con: { modifier: 5 }, wis: { modifier: 3 } },
      });
      const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

      const npc = result.creatures.find((c) => c.type === 'npc');
      expect(npc.resistances).toEqual(['Cold']);
      expect(npc.immunities).toEqual(['Necrotic', 'Poison']);
      expect(npc.saveBonuses.con).toBe(5);
      expect(npc.saveBonuses.wis).toBe(3);
      expect(npc.saveBonuses.str).toBe(0);
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
  });
});

// ── Tests for loadEncounterToInitiative ─────────────────────────

describe('loadEncounterToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sorts creatures by initiative descending', async () => {
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

  it('returns combatSummary with round 1 and firstName of first creature', async () => {
    rollD20.mockReturnValueOnce(20).mockReturnValueOnce(10);
    const chars = [createCharacter('Player')];
    const result = await loadEncounterToInitiative([createMonster('Dragon')], chars, 'TestCampaign');

    expect(result.combatSummary.round).toBe(1);
    expect(result.firstName).toBe('Dragon');
  });

  it('handles empty monsters and characters', async () => {
    const result = await loadEncounterToInitiative([], [], 'TestCampaign');

    expect(result.combatSummary.creatures).toEqual([]);
    expect(result.firstName).toBeUndefined();
    expect(storage.set).toHaveBeenCalledWith(
      'activeCreatureName',
      undefined,
      'TestCampaign',
    );
  });

  it('handles only players without monsters', async () => {
    const chars = [createCharacter('Hero')];
    const result = await loadEncounterToInitiative([], chars, 'TestCampaign');

    expect(result.combatSummary.creatures).toHaveLength(1);
    expect(result.combatSummary.creatures[0].type).toBe('player');
    expect(result.combatSummary.creatures[0].initiative).toBe('');
  });

  it('calls addEntry for each npc roll with correct fields', async () => {
    rollD20.mockReturnValueOnce(17).mockReturnValueOnce(3);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    expect(addEntry).toHaveBeenCalledTimes(1);
    const entry = addEntry.mock.calls[0][1];
    expect(entry).toMatchObject({
      type: 'roll',
      rollType: 'initiative',
      total: 17,
      rolls: [17, 3],
    });
  });

  it('logs roll with isNatural20/isNatural1 flags', async () => {
    rollD20.mockReturnValueOnce(20).mockReturnValueOnce(15);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');
    expect(addEntry.mock.calls[0][1].isNatural20).toBe(true);

    vi.clearAllMocks();
    rollD20.mockReturnValueOnce(1).mockReturnValueOnce(8);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');
    expect(addEntry.mock.calls[0][1].isNatural1).toBe(true);
  });

  it('logs roll with correct bonus when monster has initiative_details', async () => {
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(8);
    const monster = createMonster('Dragon', { initiative_details: '+5' });
    await loadEncounterToInitiative([monster], [], 'TestCampaign');

    expect(addEntry.mock.calls[0][1].bonus).toBe(5);
  });

  it('logs roll for each npc when multiple exist', async () => {
    rollD20.mockImplementation(() => [10, 5, 12, 7].shift() || 10);
    await loadEncounterToInitiative([createMonster('Wolf', { qty: 2 })], [], 'TestCampaign');

    expect(addEntry).toHaveBeenCalledTimes(2);
  });

  it('includes both players and npcs in combatSummary.creatures', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const chars = [createCharacter('Hero')];
    const result = await loadEncounterToInitiative([createMonster('Goblin')], chars, 'TestCampaign');

    expect(result.combatSummary.creatures).toHaveLength(2);
  });
});
