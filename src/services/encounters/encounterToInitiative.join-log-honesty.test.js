// @maintained-by-ai 2026-11-18
// Lane: EB join/load initiative-row HONESTY (improve eb-join-dangling-roll-row,
// 2026-11-18). The join seams used to emit a bare `roll | <Monster>` row — a
// type:'roll' entry whose characterName is a monster and which lacks
// description/message AND targetName (the TA-era "dangling roll row" face).
// Law pinned here: every join-lane initiative row is self-describing — it
// names the monster, the die, the sign-formatted bonus and the total.
// Assembly/byte contracts of the same rows live in encounterToInitiative.test.js;
// this file owns ONLY the honesty shape of the log rows.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (mirror sibling encounterToInitiative.test.js) ──

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

import {
  loadEncounterToInitiative,
  addMonstersToInitiative,
} from './encounterToInitiative.js';

import { rollD20 } from '../dice/diceRoller.js';
import { addEntry } from '../ui/logService.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from './combatData.js';

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  getRuntimeValue.mockReturnValue(null);
  addEntry.mockResolvedValue(undefined);
  loadCombatSummary.mockResolvedValue(null);
});

function monsterRollRows() {
  return addEntry.mock.calls.map(([, e]) => e).filter((e) => e.type === 'roll');
}

// The exact defect census from the backlog: a monster roll row dangling with
// no description, no message and no targetName.
function isDanglingRollRow(entry) {
  return entry.type === 'roll'
    && entry.characterName !== 'Party'
    && entry.description == null
    && entry.message == null
    && entry.targetName == null;
}

describe('loadEncounterToInitiative — join/load initiative rows are self-describing', () => {
  it('emits zero dangling roll rows and pins the honest row shape', async () => {
    rollD20.mockReturnValueOnce(14);
    await loadEncounterToInitiative(
      [{ name: 'Goblin', qty: 1, hit_points: 7, armor_class: 15, initiative_details: '+2' }],
      [],
      'TestCampaign'
    );

    const rows = monsterRollRows();
    expect(rows).toHaveLength(1);
    expect(rows.filter(isDanglingRollRow)).toEqual([]);
    expect(rows[0]).toMatchObject({
      type: 'roll',
      characterName: 'Goblin',
      rollType: 'initiative',
      name: 'Initiative',
      description: 'Goblin rolled initiative: d20 14 + 2 = 16',
      rolls: [14],
      total: 14,
      bonus: 2,
      mode: 'normal',
    });
  });

  it('sign-formats a negative initiative bonus (never "d20 5 + -1")', async () => {
    rollD20.mockReturnValueOnce(5);
    await loadEncounterToInitiative(
      [{ name: 'Skeleton', qty: 1, hit_points: 13, armor_class: 13, initiative_details: '-1' }],
      [],
      'TestCampaign'
    );

    expect(monsterRollRows()[0].description).toBe(
      'Skeleton rolled initiative: d20 5 - 1 = 4'
    );
  });

  it('describes every qty-expanded instance by its numbered name', async () => {
    const { creatures } = await loadEncounterToInitiative(
      [{ name: 'Wolf', qty: 2, hit_points: 11, armor_class: 12 }],
      [],
      'TestCampaign'
    );

    void creatures;
    const rows = monsterRollRows();
    expect(rows.map((r) => r.characterName)).toEqual(['Wolf 1', 'Wolf 2']);
    expect(rows.map((r) => r.description)).toEqual([
      'Wolf 1 rolled initiative: d20 10 + 0 = 10',
      'Wolf 2 rolled initiative: d20 10 + 0 = 10',
    ]);
    expect(rows.filter(isDanglingRollRow)).toEqual([]);
  });
});

describe('addMonstersToInitiative — EB join initiative rows are self-describing', () => {
  it('emits one honest initiative row per joined monster (no dangling roll)', async () => {
    rollD20.mockReturnValueOnce(8);
    await addMonstersToInitiative(
      [{ name: 'Goblin', qty: 1, hit_points: 7, armor_class: 15, initiative_details: '+2' }],
      [],
      'TestCampaign'
    );

    const rows = monsterRollRows();
    expect(rows).toHaveLength(1);
    expect(rows.filter(isDanglingRollRow)).toEqual([]);
    expect(rows[0]).toMatchObject({
      rollType: 'initiative',
      name: 'Initiative',
      description: 'Goblin rolled initiative: d20 8 + 2 = 10',
      total: 8,
      bonus: 2,
    });
  });
});
