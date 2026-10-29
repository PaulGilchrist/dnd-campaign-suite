// @maintained-by-ai
// Lane: encounter → initiative ENTRY transformation. Initiative ROLL math is owned
// by the initiative lanes (#862-#875 / initiativeService.test.js); consumers of the
// initiative-rolled event live elsewhere (#863). IRV *resolution* is owned by
// src/services/npcs/monsterIrvUtils.test.js — this file proves only the WIRING of
// resolved IRV onto assembled creatures (the CLA-173 bug was vulnerabilities never
// copied at this seam). #1014 census baseline = this module's assembly byte contract:
// carrier bytes type:'npc', real creature type in monsterType (SP-094).
//
// Old → new map (44 → 18 blocks): qty-1 defaults+carrier+init-string folded into
// the exact-bytes test; bonus parse ×3 → it.each; save-bonuses ×3 → direct unit of
// getMonsterSaveBonuses; dual-schema IRV ×2 (expand) + 1 (add) → wiring proofs here,
// resolution stays in monsterIrvUtils.test.js; log-entry ×3 → it.each byte table;
// addMonsters numbering ×4 → it.each; getNextUniqueMonsterName ×7 → it.each;
// combined/empty-player trivialities folded into roster-shape tables.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

// Graph note: zoneDurationClock + expirationQueue (real, unmocked) import these too.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('./combatData.js', () => ({
  loadCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  expandMonstersToCreatures,
  loadEncounterToInitiative,
  getNextUniqueMonsterName,
  addMonstersToInitiative,
  getMonsterSaveBonuses,
} from './encounterToInitiative.js';

import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from './combatData.js';

// ── Determinism re-arm (#1057) ─────────────────────────────────
// Every NPC consumes exactly two rollD20 calls (first is the counted die);
// tests override with explicit once-values, everything else lands on 10.

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  getRuntimeValue.mockReturnValue(null);
  addEntry.mockResolvedValue(undefined);
  loadCombatSummary.mockResolvedValue(null);
});

// ── expandMonstersToCreatures ──────────────────────────────────

describe('expandMonstersToCreatures', () => {
  it('assembles a lone monster byte-exact onto the initiative entry (#1014 carrier contract)', async () => {
    rollD20.mockReturnValueOnce(14).mockReturnValueOnce(3);
    const monster = {
      name: 'Goblin', type: 'humanoid', size: 'Small', qty: 1,
      hit_points: 10, armor_class: 13, initiative_details: '+2',
    };

    const { creatures } = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    expect(creatures).toEqual([{
      name: 'Goblin',
      type: 'npc',                 // carrier byte; real type below (#1014/SP-094)
      monsterType: 'humanoid',
      size: 'Small',              // MN-015 size gate byte
      initiative: '16',          // string(14 + 2)
      targetName: null,
      ac: 13,
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      concentration: null,
      maxHp: 10,
      currentHp: 10,
      saveBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    }]);
  });

  it('defaults a missing stat block to hp 10 / ac 10, honestly (#945)', async () => {
    const { creatures } = await expandMonstersToCreatures([{ name: 'Shadow', qty: 1 }], [], 'TestCampaign');

    expect(creatures[0].maxHp).toBe(10);
    expect(creatures[0].currentHp).toBe(10);
    expect(creatures[0].ac).toBe(10);
  });

  it('expands qty 3 into three distinct numbered entries with independent rolls (#948)', async () => {
    rollD20
      .mockReturnValueOnce(10).mockReturnValueOnce(1)
      .mockReturnValueOnce(12).mockReturnValueOnce(2)
      .mockReturnValueOnce(14).mockReturnValueOnce(3);

    const { creatures } = await expandMonstersToCreatures(
      [{ name: 'Orc', qty: 3, hit_points: 15, armor_class: 13 }], [], 'TestCampaign');

    expect(creatures.map((c) => [c.name, c.initiative, c.maxHp, c.currentHp])).toEqual([
      ['Orc 1', '10', 15, 15],
      ['Orc 2', '12', 15, 15],
      ['Orc 3', '14', 15, 15],
    ]);
  });

  it('parses initiative_details into the entry bonus: positive, none, negative', async () => {
    const initiativeFor = async (details) => {
      const monster = { name: 'M', qty: 1, armor_class: 10 };
      if (details !== undefined) monster.initiative_details = details;
      const { creatures } = await expandMonstersToCreatures([monster], [], 'TestCampaign');
      return creatures[0].initiative;
    };

    await expect(initiativeFor('+5')).resolves.toBe('15');
    await expect(initiativeFor(undefined)).resolves.toBe('10');
    await expect(initiativeFor('-3')).resolves.toBe('7');
  });

  it('wires resolved dual-schema IRV onto the creature — vulnerabilities included (CLA-173)', async () => {
    // Legacy capitalized schema with conditions mixed into immunities;
    // resolution nuance is covered by monsterIrvUtils.test.js, wiring is ours.
    const monster = {
      name: 'Shadow', qty: 1, hit_points: 45, armor_class: 12,
      damage_resistances: null, damage_immunities: null, damage_vulnerabilities: null,
      resistances: ['Acid', 'Cold'],
      immunities: ['Necrotic', 'Poison', 'Exhaustion', 'Frightened'],
      vulnerabilities: ['Radiant'],
    };

    const { creatures } = await expandMonstersToCreatures([monster], [], 'TestCampaign');

    expect(creatures[0]).toMatchObject({
      resistances: ['Acid', 'Cold'],
      immunities: ['Necrotic', 'Poison'],
      vulnerabilities: ['Radiant'],
    });
  });

  it('derives saveBonuses: saving_throws wins, ability_score_modifiers falls back, else 0', () => {
    expect(getMonsterSaveBonuses({
      saving_throws: { con: { modifier: 5 }, str: {} },
      ability_score_modifiers: { con: 4, str: 2, dex: 1 },
    })).toEqual({ str: 2, dex: 1, con: 5, int: 0, wis: 0, cha: 0 });
  });

  // saveBonuses store contract (CLA-303): producer emits EXACTLY six
  // lowercase-abbreviation keys. Readers normalize incoming saveType
  // ('Dexterity' | 'DEX' | 'dex') into this shape via normalizeSaveType()
  // from applyDamage.js. If this pin fails, fix the readers — do not
  // retype it.
  it('saveBonuses contract: exactly six lowercase-abbreviation keys, full-name bytes harvested to the canonical shape (#CLA-303 family)', () => {
    const bonuses = getMonsterSaveBonuses({ saving_throws: { dex: { modifier: 7 } } });
    expect(bonuses).toEqual({ str: 0, dex: 7, con: 0, int: 0, wis: 0, cha: 0 });
    expect(Object.keys(bonuses).sort()).toEqual(['cha', 'con', 'dex', 'int', 'str', 'wis']);
  });

  it('harvests full-name-keyed saving_throws disk bytes (Adult Blue Dracolich shape) — no silent ability-modifier substitution', () => {
    expect(getMonsterSaveBonuses({
      saving_throws: { dexterity: { modifier: 6 }, constitution: { modifier: 12 }, wisdom: { modifier: 8 }, charisma: { modifier: 10 } },
      ability_score_modifiers: { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 },
    })).toEqual({ str: 1, dex: 6, con: 12, int: 4, wis: 8, cha: 10 });
  });

  it.each([
    ['Bestial Spirit', 21, 10],
    ['Fey Spirit', 20, 10],
  ])('halves (floor) HP for %s when a character lists it as phantasmal', async (name, hp, expected) => {
    getRuntimeValue.mockImplementation((charName, prop) =>
      prop === '_phantasmalCreatures_list' ? [name] : null);

    const { creatures } = await expandMonstersToCreatures(
      [{ name, qty: 1, hit_points: hp, armor_class: 10 }],
      [{ name: 'Druid', computedStats: {} }], 'TestCampaign');

    expect(creatures.filter((c) => c.type === 'npc')[0]).toMatchObject({ maxHp: expected, currentHp: expected });
  });

  it.each([
    ['list without the summon', ['Other Summon']],
    ['no phantasmal list at all', null],
  ])('does not halve HP when %s (#936 guard)', async (_label, list) => {
    getRuntimeValue.mockImplementation((charName, prop) =>
      prop === '_phantasmalCreatures_list' ? list : null);

    const { creatures } = await expandMonstersToCreatures(
      [{ name: 'Bestial Spirit', qty: 1, hit_points: 20, armor_class: 10 }],
      [{ name: 'Druid', computedStats: {} }], 'TestCampaign');

    expect(creatures.filter((c) => c.type === 'npc')[0].maxHp).toBe(20);
  });

  it('creates minimal player entries sorted alphabetically and never rolls for them (#948)', async () => {
    const chars = [{ name: 'Zebra', computedStats: {} }, { name: 'Alpha', computedStats: {} }];

    const { creatures } = await expandMonstersToCreatures(
      [{ name: 'Goblin', qty: 1, armor_class: 11 }], chars, 'TestCampaign');

    expect(creatures.filter((c) => c.type === 'player')).toEqual([
      { name: 'Alpha', type: 'player', initiative: '', targetName: null, concentration: null },
      { name: 'Zebra', type: 'player', initiative: '', targetName: null, concentration: null },
    ]);
  });
});

// ── loadEncounterToInitiative ──────────────────────────────────

describe('loadEncounterToInitiative', () => {
  it('sorts creatures by initiative descending with distinguishable bytes (#1036)', async () => {
    rollD20
      .mockReturnValueOnce(8).mockReturnValueOnce(1)    // Dragon +2 → 10
      .mockReturnValueOnce(20).mockReturnValueOnce(1)    // Goblin    → 20
      .mockReturnValueOnce(15).mockReturnValueOnce(1);    // Orc       → 15

    const monsters = [
      createInitMonster('Dragon', '+2'),
      createInitMonster('Goblin'),
      createInitMonster('Orc'),
    ];
    const result = await loadEncounterToInitiative(monsters, [], 'TestCampaign');

    expect(result.combatSummary.creatures.filter((c) => c.type === 'npc').map((c) => c.name))
      .toEqual(['Goblin', 'Orc', 'Dragon']);
    expect(result.firstName).toBe('Goblin');
    expect(result.combatSummary.round).toBe(1);
  });

  it('threads the campaign into both storage writes (#934)', async () => {
    await loadEncounterToInitiative([createInitMonster('Goblin')], [], 'TestCampaign');

    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      expect.objectContaining({ round: 1, creatures: expect.any(Array) }),
      'TestCampaign');
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Goblin', 'TestCampaign');
  });

  it('dispatches initiative-rolled exactly once', async () => {
    const listener = vi.fn();
    window.addEventListener('initiative-rolled', listener);

    await loadEncounterToInitiative([createInitMonster('Goblin')], [], 'TestCampaign');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener('initiative-rolled', listener);
  });

  it.each([
    ['empty roster', [], [], []],
    ['players only — no rolls, plain entry first', [], [{ name: 'Hero', computedStats: {} }], ['Hero']],
  ])('handles %s', async (_label, monsters, chars, expectedNames) => {
    const result = await loadEncounterToInitiative(monsters, chars, 'TestCampaign');

    expect(result.combatSummary.creatures.map((c) => c.name)).toEqual(expectedNames);
    expect(result.firstName).toBe(expectedNames[0]);
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', expectedNames[0], 'TestCampaign');
    expect(rollD20).toHaveBeenCalledTimes(monsters.length * 2);
    expect(addEntry).toHaveBeenCalledTimes(monsters.length);
  });

  // Entry byte: total is the raw die and bonus is logged separately (the UI adds
  // them) — asserted as-is; rolls carries both consumed dice.
  it.each([
    ['normal roll with bonus', '+5', 14, { total: 14, bonus: 5, isNatural20: false, isNatural1: false }],
    ['natural 20', undefined, 20, { total: 20, bonus: 0, isNatural20: true, isNatural1: false }],
    ['natural 1', undefined, 1, { total: 1, bonus: 0, isNatural20: false, isNatural1: true }],
  ])('logs one initiative roll entry per npc — %s', async (_label, details, die, expectedTail) => {
    rollD20.mockReturnValueOnce(die).mockReturnValueOnce(7);
    const monster = createInitMonster('Goblin', details);

    await loadEncounterToInitiative([monster], [], 'TestCampaign');

    expect(addEntry).toHaveBeenCalledWith('TestCampaign', {
      type: 'roll',
      characterName: 'Goblin',
      rollType: 'initiative',
      name: 'Initiative',
      rolls: [die, 7],
      mode: 'normal',
      ...expectedTail,
    });
  });

  it('logs every instance of a qty-expanded monster by its numbered name', async () => {
    await loadEncounterToInitiative([createInitMonster('Wolf', undefined, 2)], [], 'TestCampaign');

    expect(addEntry.mock.calls.map(([, e]) => e.characterName)).toEqual(['Wolf 1', 'Wolf 2']);
  });
});

function createInitMonster(name, initiativeDetails, qty = 1) {
  const monster = { name, qty, hit_points: 10, armor_class: 13 };
  if (initiativeDetails !== undefined) monster.initiative_details = initiativeDetails;
  return monster;
}

// ── getNextUniqueMonsterName ───────────────────────────────────

describe('getNextUniqueMonsterName', () => {
  it.each([
    ['no collision at all', [], 'Goblin', 'Goblin 1'],
    ['plain base name already present', [{ name: 'Goblin' }], 'Goblin', 'Goblin 1'],
    ['continues a sequential series', [{ name: 'Goblin 1' }, { name: 'Goblin 2' }], 'Goblin', 'Goblin 3'],
    ['uses max, not count, for non-sequential numbers', [{ name: 'Goblin 1' }, { name: 'Goblin 5' }], 'Goblin', 'Goblin 6'],
    ['ignores similarly-named but unnumbered creatures', [{ name: 'Goblin 1' }, { name: 'Goblin King' }], 'Goblin', 'Goblin 2'],
    ['escapes regex characters in the name', [{ name: 'Goblin (Elite)' }, { name: 'Goblin (Elite) 1' }], 'Goblin (Elite)', 'Goblin (Elite) 2'],
    ['handles an empty base name', [], '', ' 1'],
  ])('%s', (_label, creatures, base, expected) => {
    expect(getNextUniqueMonsterName(base, creatures)).toBe(expected);
  });
});

// ── addMonstersToInitiative ────────────────────────────────────

describe('addMonstersToInitiative', () => {
  it.each([
    ['lone monster with a new name keeps it plain', [{ name: 'Player 1', type: 'player', initiative: '18' }], 'Goblin', 1, ['Goblin']],
    ['no prior summary — fresh round 1, qty 2 numbers both instances', null, 'Bandit', 2, ['Bandit 1', 'Bandit 2']],
    ['continues an existing numbered series', [{ name: 'Orc 1', type: 'npc', initiative: '15' }], 'Orc', 1, ['Orc 2']],
    ['takes the next free number over a full series', [{ name: 'Goblin 1', type: 'npc', initiative: '12' }, { name: 'Goblin 2', type: 'npc', initiative: '11' }], 'Goblin', 1, ['Goblin 3']],
  ])('%s (#949 naming collisions exact)', async (_label, existing, name, qty, expectedNew) => {
    // Copy: addMonstersToInitiative mutates summary.creatures in place.
    loadCombatSummary.mockResolvedValue(existing === null ? null : { round: 4, creatures: existing.map((c) => ({ ...c })) });

    const result = await addMonstersToInitiative([{ name, qty, armor_class: 13 }], [], 'TestCampaign');

    const existingNames = (existing || []).map((c) => c.name);
    expect(result.creatures.filter((c) => c.type === 'npc').map((c) => c.name).filter((n) => !existingNames.includes(n)))
      .toEqual(expectedNew);
    expect(result.creatures).toHaveLength(existingNames.length + qty);
    expect(result.round).toBe(existing === null ? 1 : 4); // existing summary survives, else fresh round 1
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.anything(), 'TestCampaign');
  });

  it('joins byte-exact: monsterIndex, carrier type, size, ac fallback, IRV, sorted with existing (#1014/CLA-173)', async () => {
    rollD20.mockReturnValueOnce(12).mockReturnValueOnce(4);
    loadCombatSummary.mockResolvedValue({
      round: 2,
      creatures: [{ name: 'Shadow', type: 'npc', initiative: '5' }],
    });
    const monster = {
      index: 'shadow', name: 'Shadow', type: 'aberration', size: 'Medium', qty: 1,
      hit_points: 45, initiative_details: '+1',
      resistances: ['Acid', 'Cold'],
      immunities: ['Necrotic', 'Poison', 'Exhaustion'],
      vulnerabilities: ['Radiant'],
    };

    const result = await addMonstersToInitiative([monster], [], 'TestCampaign');

    expect(result.creatures[0]).toEqual({
      name: 'Shadow 1',          // series existed → collision-free numbering
      type: 'npc',               // carrier byte; real type in monsterType (#1014/SP-094)
      monsterType: 'aberration',
      size: 'Medium',           // MN-015
      initiative: '13',         // 12 + 1, and 13 > 5 so it sorts first
      targetName: null,
      ac: 10,                   // missing armor_class honest fallback (#945)
      resistances: ['Acid', 'Cold'],
      immunities: ['Necrotic', 'Poison'],
      vulnerabilities: ['Radiant'], // CLA-173: vulnerabilities copied at this seam
      concentration: null,
      maxHp: 45,
      currentHp: 45,
      saveBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      monsterIndex: 'shadow',
    });
    expect(result.round).toBe(2);
    expect(storage.set).toHaveBeenCalledWith(
      'combatSummary',
      expect.objectContaining({ creatures: expect.arrayContaining([expect.objectContaining({ name: 'Shadow 1', vulnerabilities: ['Radiant'] })]) }),
      'TestCampaign');
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Shadow 1', 'TestCampaign');
  });
});
