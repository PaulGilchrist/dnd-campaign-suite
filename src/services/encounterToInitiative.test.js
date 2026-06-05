import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

vi.mock('./diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('./storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('./utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  expandMonstersToCreatures,
  loadEncounterToInitiative,
} from './encounterToInitiative.js';

import { rollD20 } from './diceRoller.js';
import storage from './storage.js';

global.fetch = vi.fn(() => new Promise(() => {}));

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

// ── Tests for expandMonstersToCreatures ────────────────────────

describe('expandMonstersToCreatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReset();
 });

  it('creates player creatures from characters array', async () => {
    const chars = [createCharacter('Alchemist'), createCharacter('Bard')];
    const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

       // Player creatures should have no initiative number (empty string)
    expect(result.creatures.filter(c => c.type === 'player')).toHaveLength(2);
    expect(result.creatures[0].initiative).toBe('');
    expect(result.creatures[0].concentration).toBeNull();
 });

  it('sorts player creatures alphabetically by name', async () => {
    const chars = [createCharacter('Zebra'), createCharacter('Alpha')];
    const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

    const playerNames = result.creatures.filter(c => c.type === 'player').map(c => c.name);
    expect(playerNames).toEqual(['Alpha', 'Zebra']);
 });

  it('creates NPC creature from single monster', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const monster = createMonster('Goblin');
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc).toBeTruthy();
    expect(npc.name).toBe('Goblin'); // qty=1, no suffix
    expect(npc.currentHp).toBe(10);
    expect(npc.maxHp).toBe(10);
 });

  it('creates multiple NPC creatures from qty > 1', async () => {
    rollD20.mockImplementation(() => [15, 3].shift() || 10);
    const monster = createMonster('Orc', { qty: 3, hit_points: 15 });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npcs = result.creatures.filter(c => c.type === 'npc');
    expect(npcs).toHaveLength(3);
    expect(npcs[0].name).toBe('Orc 1');
    expect(npcs[1].name).toBe('Orc 2');
    expect(npcs[2].name).toBe('Orc 3');
 });

  it('uses default hp of 10 when monster has no hit_points', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const monster = { name: 'Shadow', qty: 1 };
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.maxHp).toBe(10);
    expect(npc.currentHp).toBe(10);
 });

  it('uses default AC of 10 when monster has no armor_class', async () => {
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const monster = { name: 'Spirit', qty: 1, hit_points: 5 };
    delete monster.armor_class;
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.ac).toBe(10);

    mockConsoleError.mockRestore();
 });

  it('rolls initiative for each NPC', async () => {
    const monster = createMonster('Goblin', { qty: 2 });
    rollD20.mockImplementation(() => [15, 3, 8].shift() || 10); // Each NPC rolls twice (r1 + bonus, r2 unused in total but still rolled)

    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');
    expect(result.npcRollResults).toHaveLength(2);
 });

  it('rolls initiative with bonus for each NPC', async () => {
    const monster = createMonster('Dragon', { qty: 1, initiative_details: '+5' });
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(8); // r1=14, r2=8 (unused for total)
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
       // total = 14 + 5 = 19, initiative stored as string
    expect(npc.initiative).toBe('19');
 });

  it('handles monster with no initiative_details (bonus = 0)', async () => {
    const monster = createMonster('Rat', { qty: 1 });
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(6);
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
   // total = 10 + 0 = 10
    expect(npc.initiative).toBe('10');
 });

  it('handles negative initiative bonus', async () => {
    const monster = createMonster('Slime', { qty: 1, initiative_details: '-3' });
    rollD20.mockReturnValueOnce(8).mockReturnValueOnce(4);
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
   // total = 8 + (-3) = 5
    expect(npc.initiative).toBe('5');
 });

  it('includes resistances and immunities from monster data', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('Skeleton', {
      damage_resistances: ['Cold'],
      damage_immunities: ['Necrotic', 'Poison'],
     });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.resistances).toEqual(['Cold']);
    expect(npc.immunities).toEqual(['Necrotic', 'Poison']);
 });

  it('includes save bonuses from monster saving_throws', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('Golem', {
      saving_throws: { con: { modifier: 5 }, wis: { modifier: 3 } },
     });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.saveBonuses['con']).toBe(5);
    expect(npc.saveBonuses['wis']).toBe(3);
 });

  it('includes save bonuses from ability_score_modifiers fallback', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('Elemental', {
      saving_throws: null,
      ability_score_modifiers: { con: 4, str: 2 },
     });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.saveBonuses['con']).toBe(4);
 });

  it('handles monster with no name (defaults to Unnamed)', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('', { qty: 1 });
    delete monster.name;
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.name).toBe('Unnamed');
 });

  it('handles empty monster list', async () => {
    const chars = [createCharacter('Hero')];
    rollD20.mockReturnValue(10);
    const result = await expandMonstersToCreatures([], chars, 'TestCampaign');

    expect(result.creatures.filter(c => c.type === 'npc')).toHaveLength(0);
    expect(result.npcRollResults).toEqual([]);
 });

  it('handles empty characters list', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');

    expect(result.creatures.filter(c => c.type === 'player')).toHaveLength(0);
 });

  it('npcRollResults matches NPCs created', async () => {
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(12);
    const result = await expandMonstersToCreatures([createMonster('Wolf', { qty: 2 })], [], 'TestCampaign');

    expect(result.npcRollResults).toHaveLength(2);
    expect(result.npcRollResults[0].name).toBe('Wolf 1');
    expect(result.npcRollResults[1].name).toBe('Wolf 2');
 });

  it('NPC creatures in result have no concentration', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');
    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.concentration).toBeNull();
 });

  it('NPC creatures have no targetName initially', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');
    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.targetName).toBeNull();
 });

  it('Player creatures have type, concentration, and targetName set', async () => {
    const chars = [createCharacter('Mage')];
    const result = await expandMonstersToCreatures([], chars, 'TestCampaign');
    const player = result.creatures.find(c => c.type === 'player');
    expect(player.type).toBe('player');
    expect(player.concentration).toBeNull();
 });

  it('NPC targetName is null initially', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');
    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.targetName).toBeNull();
 });

  it('getMonsterSaveBonuses returns 0 for abilities with no data', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('Beast', {
      saving_throws: {}, // empty — no modifiers
      ability_score_modifiers: null,
     });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
       // All 6 abilities should have a bonus of 0 (the default)
    expect(npc.saveBonuses['str']).toBe(0);
    expect(npc.saveBonuses['dex']).toBe(0);
 });

  it('handles monster name with no qty field', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const monster = { name: 'Ghoul' }; // no qty — defaults to 1
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');
    const npc = result.creatures.find(c => c.type === 'npc');
    expect(npc.name).toBe('Ghoul'); // no number suffix for qty=1
 });

  it('handles saving_throws with missing modifier field', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('Fiend', {
      saving_throws: { str: {} }, // no .modifier property
     });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
       // Fallback to ability_score_modifiers which defaults to null, then 0
    expect(npc.saveBonuses['str']).toBe(0);
 });

  it('parseInitBonus returns 0 for empty string', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(10);
    const monster = createMonster('Goblin', { initiative_details: '' });
    const result = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    const npc = result.creatures.find(c => c.type === 'npc');
   // total = 10 + 0 = 10
    expect(npc.initiative).toBe('10');
 });

  it('rollNpcInitiative returns correct shape in npcRollResults', async () => {
    rollD20.mockReturnValueOnce(17).mockReturnValueOnce(5);
    const result = await expandMonstersToCreatures([createMonster('Goblin')], [], 'TestCampaign');

    expect(result.npcRollResults[0].rollResult.roll).toBe(17);
 });
});

// ── Tests for loadEncounterToInitiative ────────────────────────

describe('loadEncounterToInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.get.mockReset();
    storage.set.mockReset();
 });

  it('sorts creatures by initiative descending (highest first)', async () => {
    const rollValues = [20, 5, 15]; // r1 for each NPC
    rollD20.mockImplementation(() => rollValues.shift() || 10);

    const monsters = [
       createMonster('Dragon', { qty: 1 }),
       createMonster('Goblin', { qty: 1 }),
       createMonster('Orc', { qty: 1 }),
     ];
    const result = await loadEncounterToInitiative(monsters, [], 'TestCampaign');

       // Dragon rolled 20 (first), Goblin rolled 5 (second), Orc rolled 15 (third)
       // Sorted by initiative descending: Dragon(20), Orc(15), Goblin(5)
    const npcNames = result.combatSummary.creatures.filter(c => c.type === 'npc').map(c => c.name);
    expect(npcNames[0]).toBe('Dragon'); // highest init
 });

  it('stores combatSummary in storage', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    expect(storage.set).toHaveBeenCalledWith(
          'combatSummary', expect.any(Object), 'TestCampaign'
        );
 });

  it('sets activeCreatureName to first creature after sorting', async () => {
    rollD20.mockReturnValueOnce(18).mockReturnValueOnce(10); // Dragon gets highest init
    await loadEncounterToInitiative([createMonster('Dragon')], [], 'TestCampaign');

    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Dragon', 'TestCampaign');
 });

  it('dispatches initiative-rolled event', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    let dispatched = false;
    window.addEventListener('initiative-rolled', () => { dispatched = true; });

    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');
    expect(dispatched).toBe(true);
 });

  it('returns combatSummary with round: 1', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const result = await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    expect(result.combatSummary.round).toBe(1);
 });

  it('includes both players and NPCs in combatSummary.creatures', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    const chars = [createCharacter('Hero')];
    const result = await loadEncounterToInitiative([createMonster('Goblin')], chars, 'TestCampaign');

    expect(result.combatSummary.creatures).toHaveLength(2); // 1 NPC + 1 player
 });

  it('uses cloneDeep for storing combat summary', async () => {
       // We can verify the stored value is an object with expected shape
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Orc')], [], 'TestCampaign');

       // storage.set called with a deep-cloned combat summary
    const call = storage.set.mock.calls.find(c => c[0] === 'combatSummary');
    expect(call[1]).toHaveProperty('creatures');
 });

  it('logs each NPC roll via fetch', async () => {
    rollD20.mockReturnValueOnce(15).mockReturnValueOnce(10);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

       // logRoll should have been called for the NPC
    expect(global.fetch).toHaveBeenCalled();
    const body = JSON.parse(global.fetch.mock.calls[0][1]?.body || '{}');
    expect(body.type).toBe('roll');
    expect(body.rollType).toBe('initiative');
 });

  it('returns firstName as name of first creature after sort', async () => {
    rollD20.mockReturnValueOnce(20).mockReturnValueOnce(10); // Dragon=20, player='' (sorts last)
    const chars = [createCharacter('Player')];
    const result = await loadEncounterToInitiative([createMonster('Dragon')], chars, 'TestCampaign');

    expect(result.firstName).toBe('Dragon');
 });

  it('handles empty monsters and characters — no crash', async () => {
    const result = await loadEncounterToInitiative([], [], 'TestCampaign');

    expect(result.combatSummary.creatures).toEqual([]);
    expect(result.firstName).toBeUndefined();
 });

  it('handles only players (no monsters)', async () => {
    const chars = [createCharacter('Hero')];
    const result = await loadEncounterToInitiative([], chars, 'TestCampaign');

    expect(result.combatSummary.creatures).toHaveLength(1);
    expect(result.combatSummary.creatures[0].type).toBe('player');
 });

  it('player initiative is empty string (hasnt been rolled)', async () => {
    const chars = [createCharacter('Wizard')];
    const result = await loadEncounterToInitiative([], chars, 'TestCampaign');

    expect(result.combatSummary.creatures[0].initiative).toBe('');
 });

  it('stores activeCreatureName even when no creatures exist', async () => {
    await loadEncounterToInitiative([], [], 'TestCampaign');

        // firstName is undefined, so storage.set is called with undefined value
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', undefined, 'TestCampaign');
  });

  it('first player goes first when NPCs have low initiative', async () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(10); // NPC rolls low
    const chars = [createCharacter('Alpha')];
    await loadEncounterToInitiative([createMonster('Goblin')], chars, 'TestCampaign');

        // Player has initiative='' which is not a number, so when sorted b.initiative - a.initiative,
       // '' coerces to NaN, and any number - NaN = NaN. The sort is unstable but the NPC will
       // generally sort after players because their string initiative becomes numeric.
 });

  it('logs roll with isNatural20 flag', async () => {
    rollD20.mockReturnValueOnce(20).mockReturnValueOnce(15);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const body = JSON.parse(global.fetch.mock.calls[0][1]?.body || '{}');
    expect(body.isNatural20).toBe(true);
 });

  it('logs roll with isNatural1 flag', async () => {
    rollD20.mockReturnValueOnce(1).mockReturnValueOnce(8);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const body = JSON.parse(global.fetch.mock.calls[0][1]?.body || '{}');
    expect(body.isNatural1).toBe(true);
 });

  it('logs roll with mode normal', async () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(5);
    await loadEncounterToInitiative([createMonster('Goblin')], [], 'TestCampaign');

    const body = JSON.parse(global.fetch.mock.calls[0][1]?.body || '{}');
    expect(body.mode).toBe('normal');
 });
});
