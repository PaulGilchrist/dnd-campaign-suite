// @maintained-by-ai
// Lane: EB-join species-series renumbering law (owner decision 2026-11-09).
// Once a SECOND creature of the same species joins, ALL rows of that species
// are numbered consecutively — the former plain row becomes '<name> 1' (every
// field except `name` preserved) and the new join takes the next number, so a
// plain+suffixed mix ('Kobold' init 20 alongside 'Kobold 1' init 5, as the ER
// saw) can never remain on the board. First join keeps the plain name.
// The byte-assembly contract of this lane lives in encounterToInitiative.test.js;
// this file pins ONLY the numbering law (and the direct normalizeMonsterSeries
// helper unit table).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

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

import { addMonstersToInitiative, normalizeMonsterSeries } from './encounterToInitiative.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { loadCombatSummary } from './combatData.js';

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  loadCombatSummary.mockResolvedValue(null);
});

function seedBoard(creatures, round = 3) {
  loadCombatSummary.mockResolvedValue({ round, creatures: creatures.map((c) => ({ ...c })) });
}

function join(name, qty = 1) {
  return addMonstersToInitiative([{ name, qty, hit_points: 7, armor_class: 12 }], [], 'TestCampaign');
}

const koboldRow = (overrides = {}) => ({
  name: 'Kobold',
  type: 'npc',
  monsterType: 'humanoid',
  size: 'Small',
  initiative: '20',
  targetName: null,
  ac: 12,
  resistances: [],
  immunities: [],
  vulnerabilities: [],
  concentration: null,
  maxHp: 7,
  currentHp: 5,
  saveBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  monsterIndex: 'kobold',
  controller: 'GM',
  ...overrides,
});

// ── The numbering law, end to end through the join lane ────────

describe('EB join species-series renumbering law', () => {
  it('criterion 1: first join of a species keeps the plain name', async () => {
    seedBoard([{ name: 'Hero', type: 'player', initiative: '18' }]);

    const result = await join('Kobold');

    expect(result.creatures.some((c) => c.name === 'Kobold')).toBe(true);
    expect(result.creatures.filter((c) => /^Kobold/.test(c.name)).map((c) => c.name))
      .toEqual(['Kobold']);
  });

  it('criteria 2+4+6: second join renumbers the series — plain row becomes Kobold 1 keeping its initiative, new row is Kobold 2, no plain row remains', async () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(1); // new join initiative 5
    seedBoard([
      { name: 'Hero', type: 'player', initiative: '18' },
      koboldRow(),
      koboldRow({ name: 'Goblin', monsterIndex: 'goblin', initiative: '9', currentHp: 9, maxHp: 9 }),
      { name: 'NPC 1', type: 'npc', initiative: '' },
    ]);

    const result = await join('Kobold');
    const kobolds = result.creatures.filter((c) => /^Kobold \d+$/.test(c.name));

    expect(kobolds.map((c) => [c.name, c.initiative])).toEqual([
      ['Kobold 1', '20'], // former plain row — KEPT its initiative (cards/log read the new name)
      ['Kobold 2', '5'],  // the new join
    ]);
    // criterion 2: no mixed plain+suffixed state after the join
    expect(result.creatures.some((c) => c.name === 'Kobold')).toBe(false);
    // criterion 4: renaming changed ONLY the name — every other field survives
    const renamed = result.creatures.find((c) => c.name === 'Kobold 1');
    expect(renamed).toEqual({ ...koboldRow(), name: 'Kobold 1' });
    // criterion 5: other species and +NPC placeholders untouched
    expect(result.creatures.some((c) => c.name === 'Goblin')).toBe(true);
    expect(result.creatures.some((c) => c.name === 'NPC 1')).toBe(true);
  });

  it('criterion 3: third join appends Kobold 3 with no renumbering needed', async () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(1);
    seedBoard([koboldRow({ name: 'Kobold 1' }), koboldRow({ name: 'Kobold 2', initiative: '5' })]);

    const result = await join('Kobold');

    expect(result.creatures.filter((c) => /^Kobold/.test(c.name)).map((c) => c.name).sort())
      .toEqual(['Kobold 1', 'Kobold 2', 'Kobold 3']);
  });

  it('criterion 3: a re-appeared plain row is re-normalized even over an established series', async () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(1);
    // legacy mixed board (plain row alongside a numbered series, pre-fix residue)
    seedBoard([koboldRow(), koboldRow({ name: 'Kobold 1', initiative: '12' })]);

    const result = await join('Kobold');

    // plain row takes the lowest FREE number (2), the new join draws 3
    expect(result.creatures.some((c) => c.name === 'Kobold')).toBe(false);
    expect(result.creatures.filter((c) => /^Kobold/.test(c.name)).map((c) => c.name).sort())
      .toEqual(['Kobold 1', 'Kobold 2', 'Kobold 3']);
  });

  it('count>1 join onto an existing plain row numbers the whole series (plain + 3 joins = 1..4)', async () => {
    seedBoard([koboldRow()]); // legacy plain 'Kobold' on the board
    const result = await join('Kobold', 3); // plain row on board + qty 3 fan-out

    expect(result.creatures.filter((c) => /^Kobold/.test(c.name)).map((c) => c.name).sort())
      .toEqual(['Kobold 1', 'Kobold 2', 'Kobold 3', 'Kobold 4']);
    expect(result.creatures.some((c) => c.name === 'Kobold')).toBe(false);
  });

  it('count>1 join onto an EMPTY board already numbers every instance (no plain row) — unchanged', async () => {
    const result = await join('Bandit', 2);

    expect(result.creatures.filter((c) => /^Bandit/.test(c.name)).map((c) => c.name))
      .toEqual(['Bandit 1', 'Bandit 2']);
  });

  it('criterion 5: a PC row and an AWAY monster row of the same species are never renamed by the player guard; the away row renumbers like any monster', async () => {
    rollD20.mockReturnValueOnce(5).mockReturnValueOnce(1);
    seedBoard([
      { name: 'Kobold', type: 'player', initiative: '18' }, // player-row guard: stays plain
      koboldRow({ away: true }),                            // away monster: renamed, flag kept
    ]);

    const result = await join('Kobold');

    const player = result.creatures.find((c) => c.type === 'player');
    expect(player.name).toBe('Kobold');
    const renamed = result.creatures.find((c) => c.name === 'Kobold 1');
    expect(renamed.away).toBe(true);
  });

  it('activeCreatureName never dangles on a renamed row — the join re-anchors it onto the sorted board head in the same write', async () => {
    rollD20.mockReturnValueOnce(3).mockReturnValueOnce(1); // join init 3 < 20: board head stays the renamed row
    seedBoard([koboldRow()]);
    storage.set.mockResolvedValue(true);

    const result = await join('Kobold');

    expect(result.creatures[0].name).toBe('Kobold 1'); // initiative 20 still leads
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Kobold 1', 'TestCampaign');
  });
});

// ── Direct unit of the helper ───────────────────────────────────

describe('normalizeMonsterSeries', () => {
  it.each([
    ['no plain row (series already numbered)', [{ name: 'Kobold 1' }], 'Kobold', false, ['Kobold 1']],
    ['no rows of the species at all', [{ name: 'Goblin' }], 'Kobold', false, ['Goblin']],
    ['plain row alone becomes 1', [{ name: 'Kobold' }], 'Kobold', true, ['Kobold 1']],
    ['plain row next to Kobold 1 takes the lowest free number', [{ name: 'Kobold' }, { name: 'Kobold 1' }], 'Kobold', true, ['Kobold 2', 'Kobold 1']],
    ['player rows are never rename candidates', [{ name: 'Kobold', type: 'player' }], 'Kobold', false, ['Kobold']],
    ['similarly-named species are untouched', [{ name: 'Kobold King' }], 'Kobold', false, ['Kobold King']],
    ['regex characters in the base name are escaped', [{ name: 'Goblin (Elite)' }], 'Goblin (Elite)', true, ['Goblin (Elite) 1']],
  ])('%s', (_label, creatures, base, expectedChanged, expectedNames) => {
    const rows = creatures.map((c) => ({ type: 'npc', ...c }));
    expect(normalizeMonsterSeries(base, rows)).toBe(expectedChanged);
    expect(rows.map((c) => c.name)).toEqual(expectedNames);
  });

  it('renames in place: object identity and every non-name field survive', () => {
    const row = koboldRow();
    const rows = [row];

    normalizeMonsterSeries('Kobold', rows);

    expect(rows[0]).toBe(row);
    expect(row.name).toBe('Kobold 1');
    expect(row).toMatchObject({ initiative: '20', currentHp: 5, maxHp: 7, ac: 12, controller: 'GM', monsterIndex: 'kobold', size: 'Small' });
  });
});
