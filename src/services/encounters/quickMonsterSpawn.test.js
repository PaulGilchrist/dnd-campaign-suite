// @maintained-by-ai
// Quick mob spawn service (roadmap Item 4). The heart of the acceptance is
// REUSE: quickSpawnMonster runs the REAL encounterToInitiative join lane
// (only its network/dice/log boundaries are mocked — same harness shape as
// encounterToInitiative.test.js), proving the "+ Monster" picker's cards get
// the exact join-lane bytes: quantity expansion, numbering continuation and
// series renumber, real HP/AC/IRV/save stats, initiative roll + sort, the
// ack-gated board write, and the EB-shaped `encounter/joined` log row.
// It also pins the npcs.json invariant by wire census: the ONLY keys written
// are combatSummary + activeCreatureName — no NPC row is ever created.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (mirrors encounterToInitiative.test.js) ──────────

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
  getRuntimeKeysByPrefix: vi.fn(() => []),
}));

vi.mock('./combatData.js', () => ({
  loadCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────

import { quickSpawnMonster, QUICK_SPAWN_ENCOUNTER_NAME } from './quickMonsterSpawn.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { addEntry } from '../ui/logService.js';
import { loadCombatSummary } from './combatData.js';

const GOBLIN = {
  index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'Small',
  challenge_rating: 0.25, xp: 50, environments: ['forest'],
  hit_points: 7, armor_class: 15, initiative_details: '+2',
  saving_throws: { dex: { modifier: 3 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  addEntry.mockResolvedValue(undefined);
  loadCombatSummary.mockResolvedValue(null);
  // Legacy success semantics (undefined === acked), same as the sibling lane.
  storage.set.mockResolvedValue(undefined);
});

const boardRows = () =>
  storage.set.mock.calls.filter(([key]) => key === 'combatSummary').at(-1)[1].creatures;
const loggedEntry = (pred) => addEntry.mock.calls.map(([, entry]) => entry).find(pred);

describe('quickSpawnMonster — spawn through the shared encounter-join lane', () => {
  it('spawns 3 numbered cards with REAL bestiary stats, sorted by initiative', async () => {
    rollD20.mockReturnValueOnce(4).mockReturnValueOnce(18).mockReturnValueOnce(11);

    const summary = await quickSpawnMonster(GOBLIN, 3, [], 'test-campaign');

    // The accepted board is the returned summary, sorted high→low.
    expect(summary.creatures.map(c => c.name)).toEqual(['Goblin 2', 'Goblin 3', 'Goblin 1']);
    const goblins = boardRows();
    expect(goblins.map(c => c.name)).toEqual(['Goblin 2', 'Goblin 3', 'Goblin 1']);
    expect(goblins.map(c => c.initiative)).toEqual(['20', '13', '6']); // roll + authored +2, string bytes
    // Real stat bytes (join-lane contract, not +NPC placeholders):
    for (const row of goblins) {
      expect(row).toMatchObject({
        type: 'npc', monsterType: 'humanoid', size: 'Small', ac: 15,
        maxHp: 7, currentHp: 7, monsterIndex: 'goblin', targetName: null,
      });
      expect(row.saveBonuses).toEqual({ str: 0, dex: 3, con: 0, int: 0, wis: 0, cha: 0 });
    }
    // Turn pointer re-anchors to the top row (join-lane law).
    expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Goblin 2', 'test-campaign');
  });

  it('continues an existing series: Goblin 1/2 on the board → joined rows are Goblin 3/4', async () => {
    loadCombatSummary.mockResolvedValue({ round: 2, creatures: [
      { name: 'Alice', type: 'player', initiative: '15', targetName: null },
      { name: 'Goblin 1', type: 'npc', initiative: '12', currentHp: 7, maxHp: 7 },
      { name: 'Goblin 2', type: 'npc', initiative: '9', currentHp: 7, maxHp: 7 },
    ] });

    await quickSpawnMonster(GOBLIN, 2, [{ name: 'Alice' }], 'test-campaign');

    const names = boardRows().map(c => c.name);
    expect(names).toContain('Goblin 3');
    expect(names).toContain('Goblin 4');
    expect(names.filter(n => /^Goblin/.test(n)).sort())
      .toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3', 'Goblin 4']);
  });

  it('renumbers a colliding plain row honestly (series law): Goblin → Goblin 1 + new Goblin 2', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [
      { name: 'Goblin', type: 'npc', initiative: '5', currentHp: 7, maxHp: 7 },
    ] });

    await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign');

    expect(boardRows().map(c => c.name).sort()).toEqual(['Goblin 1', 'Goblin 2']);
  });

  it('logs one EB-shaped encounter/joined row (N× Name roster) after per-creature initiative rows', async () => {
    await quickSpawnMonster(GOBLIN, 5, [], 'test-campaign');

    const joined = loggedEntry(e => e.type === 'encounter');
    expect(joined).toEqual({
      type: 'encounter',
      action: 'joined',
      encounterName: QUICK_SPAWN_ENCOUNTER_NAME,
      monsters: ['5x Goblin'],
    });
    // Initiative disclosure: exactly one roll row per spawned instance.
    expect(addEntry.mock.calls.filter(([, e]) => e.rollType === 'initiative')).toHaveLength(5);
  });

  it('a rejected board write THROWS before any log row lands (post-ack honesty)', async () => {
    storage.set.mockResolvedValue(false);

    await expect(quickSpawnMonster(GOBLIN, 2, [], 'test-campaign')).rejects.toThrow();

    expect(addEntry).not.toHaveBeenCalled();
  });

  it('writes ZERO NPC rows — only combatSummary + activeCreatureName hit the store', async () => {
    await quickSpawnMonster(GOBLIN, 3, [], 'test-campaign');

    const keys = storage.set.mock.calls.map(([key]) => key);
    expect([...new Set(keys)].sort()).toEqual(['activeCreatureName', 'combatSummary']);
  });
});
