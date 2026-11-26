// @maintained-by-ai 2026-11-19
// Quick mob spawn service (roadmap Item 4). The heart of the acceptance is
// REUSE: quickSpawnMonster runs the REAL encounterToInitiative join lane
// (only its network/dice/log boundaries are mocked — same harness shape as
// encounterToInitiative.test.js), proving the "+ Monster" picker's cards get
// the exact join-lane bytes: quantity expansion, numbering continuation and
// series renumber, real HP/AC/IRV/save stats, initiative roll + sort, the
// ack-gated board write, and the EB-shaped `encounter/joined` log row.
// It also pins the npcs.json invariant by wire census: the ONLY keys written
// are combatSummary + activeCreatureName — no NPC row is ever created.
// The 2026-11-20 CCC opt-in leg pins the map-token stamp law: OFF = zero map
// traffic and zero pre-reads; ON = one full-doc PUT on the GM map lane whose
// token names EXACTLY equal the board names the join mints (suffix + renumber
// follow), skipped loudly with no active map / outdoor map / board race.
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

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
  saveMapData: vi.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────

import { quickSpawnMonster, predictSpawnedNames, QUICK_SPAWN_ENCOUNTER_NAME } from './quickMonsterSpawn.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { addEntry } from '../ui/logService.js';
import { loadCombatSummary } from './combatData.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import * as mapsService from '../maps/mapsService.js';

const GOBLIN = {
  index: 'goblin', name: 'Goblin', type: 'humanoid', size: 'Small',
  challenge_rating: 0.25, xp: 50, environments: ['forest'],
  hit_points: 7, armor_class: 15, initiative_details: '+2',
  saving_throws: { dex: { modifier: 3 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks keeps IMPLEMENTATIONS — reset the stamp-lane mocks so an
  // ON-test's active-map/loader stubs never leak into the next test.
  getRuntimeValue.mockReset().mockReturnValue(null);
  mapsService.loadMapData.mockReset();
  mapsService.saveMapData.mockReset();
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

// ── Opt-in map-token stamp (2026-11-20 CCC backlog) ────────────────────────

const indoorDoc = (over = {}) => ({
  name: 'qa-sandbox',
  displayName: 'QA Sandbox',
  type: 'indoor',
  gridSize: 20,
  walls: [],
  players: [{ id: 'alice', name: 'Alice', gridX: 3, gridY: 4 }],
  placedItems: [],
  ...over,
});

const putBody = () => mapsService.saveMapData.mock.calls.at(-1)[2];

describe('quickSpawnMonster — opt-in map-token stamp', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('OFF (explicit or default) performs byte-identical historical traffic: one board read, ZERO map requests', async () => {
    const off = await quickSpawnMonster(GOBLIN, 2, [], 'test-campaign', { placeToken: false });
    await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign');

    expect(off.creatures.map(c => c.name).sort()).toEqual(['Goblin 1', 'Goblin 2']);
    expect(loadCombatSummary).toHaveBeenCalledTimes(2); // each join's own strict read only
    expect(mapsService.loadMapData).not.toHaveBeenCalled();
    expect(mapsService.saveMapData).not.toHaveBeenCalled();
  });

  it('ON + active indoor map: ONE full-doc PUT adds fixture-shaped tokens named EXACTLY after the board (suffix law)', async () => {
    getRuntimeValue.mockImplementation((entity, key) =>
      (entity === '__map__' && key === 'activeMapName') ? 'qa-sandbox' : null);
    mapsService.loadMapData.mockResolvedValue(indoorDoc());
    mapsService.saveMapData.mockResolvedValue({ ok: true });

    await quickSpawnMonster(GOBLIN, 2, [], 'test-campaign', { placeToken: true });

    expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'qa-sandbox');
    expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
    expect(mapsService.saveMapData.mock.calls[0][1]).toBe('qa-sandbox');
    const body = putBody();
    // Whole-doc write keeps every existing field (players guard, editor contract).
    expect(body.players).toEqual(indoorDoc().players);
    expect(body.type).toBe('indoor');
    expect(body.gridSize).toBe(20);
    expect(body.placedItems).toEqual([
      { id: 'quick-spawn-goblin-1-5-4', type: 'npc', name: 'Goblin 1', gridX: 5, gridY: 4, visible: true },
      { id: 'quick-spawn-goblin-2-4-3', type: 'npc', name: 'Goblin 2', gridX: 4, gridY: 3, visible: true },
    ]);
  });

  it('ON + second spawn renumbers the plain row AND follows its token: Goblin→Goblin 1 keeps measuring, Goblin 2 gets a fresh token', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [
      { name: 'Goblin', type: 'npc', initiative: '5' },
    ] });
    getRuntimeValue.mockImplementation((entity, key) =>
      (entity === '__map__' && key === 'activeMapName') ? 'qa-sandbox' : null);
    mapsService.loadMapData.mockResolvedValue(indoorDoc({ placedItems: [
      { id: 'quick-spawn-goblin-5-4', type: 'npc', name: 'Goblin', gridX: 5, gridY: 4, visible: true },
    ] }));
    mapsService.saveMapData.mockResolvedValue({ ok: true });

    const summary = await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign', { placeToken: true });

    expect(summary.creatures.map(c => c.name).sort()).toEqual(['Goblin 1', 'Goblin 2']);
    const rows = putBody().placedItems;
    // Renamed in place (same cell/id) + one new row for the spawned instance.
    expect(rows.find(r => r.id === 'quick-spawn-goblin-5-4').name).toBe('Goblin 1');
    const fresh = rows.filter(r => r.name === 'Goblin 2');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ type: 'npc', visible: true });
  });

  it('ON with NO active map: zero map requests (and the join is untouched)', async () => {
    const summary = await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign', { placeToken: true });

    expect(summary.creatures.map(c => c.name)).toEqual(['Goblin']);
    expect(mapsService.loadMapData).not.toHaveBeenCalled();
    expect(mapsService.saveMapData).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('ON with an OUTDOOR active map logs the skip loudly and writes nothing', async () => {
    getRuntimeValue.mockImplementation((entity, key) =>
      (entity === '__map__' && key === 'activeMapName') ? 'hex-board' : null);
    mapsService.loadMapData.mockResolvedValue({ name: 'hex-board', type: 'outdoor', gridSize: 20 });

    await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign', { placeToken: true });

    expect(mapsService.saveMapData).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('indoor grid maps'));
  });

  it('a failed map PUT never falsifies the committed board join', async () => {
    getRuntimeValue.mockImplementation((entity, key) =>
      (entity === '__map__' && key === 'activeMapName') ? 'qa-sandbox' : null);
    mapsService.loadMapData.mockResolvedValue(indoorDoc());
    mapsService.saveMapData.mockRejectedValue(new Error('403'));

    const summary = await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign', { placeToken: true });

    expect(summary.creatures.map(c => c.name)).toEqual(['Goblin']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('map token stamp failed'), expect.any(Error));
  });

  it('a board race between the pre-read and the join SKIPS the stamp with named copy (no wrong-named token)', async () => {
    loadCombatSummary
      .mockResolvedValueOnce(null) // pre-read: series looks brand new
      .mockResolvedValue({ round: 1, creatures: [{ name: 'Goblin', type: 'npc', initiative: '9' }] }); // another tab joined mid-flight
    getRuntimeValue.mockImplementation((entity, key) =>
      (entity === '__map__' && key === 'activeMapName') ? 'qa-sandbox' : null);

    const summary = await quickSpawnMonster(GOBLIN, 1, [], 'test-campaign', { placeToken: true });

    expect(summary.creatures.map(c => c.name).sort()).toEqual(['Goblin 1', 'Goblin 2']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('reshaped the Goblin series'));
    expect(mapsService.loadMapData).not.toHaveBeenCalled();
    expect(mapsService.saveMapData).not.toHaveBeenCalled();
  });
});

describe('predictSpawnedNames — mirrors the join lane numbering law exactly', () => {
  it('fresh series: one keeps the plain name, N fans out 1..N', () => {
    expect(predictSpawnedNames('Goblin', 1, [])).toEqual(['Goblin']);
    expect(predictSpawnedNames('Goblin', 3, [])).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
  });

  it('continues and renumbers through the shared helpers (plain row → 1 first)', () => {
    expect(predictSpawnedNames('Goblin', 2, [{ name: 'Goblin 1', type: 'npc' }]))
      .toEqual(['Goblin 2', 'Goblin 3']);
    expect(predictSpawnedNames('Goblin', 1, [
      { name: 'Alice', type: 'player' }, { name: 'Goblin', type: 'npc' },
    ])).toEqual(['Goblin 2']);
    // A PLAYER named Goblin never renumbers (the plain-row probe skips players).
    expect(predictSpawnedNames('Goblin', 1, [{ name: 'Goblin', type: 'player' }]))
      .toEqual(['Goblin 1']);
  });
});
