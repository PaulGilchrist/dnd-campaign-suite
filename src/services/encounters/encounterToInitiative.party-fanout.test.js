// @maintained-by-ai
// Improvement 2026-11-03 CL: EB join PC-party fan-out is undocumented UI-wise.
// Joining a monster via the Encounter Builder seeds ALL saved PCs onto the
// initiative board (type:player entries, party-alive model) with no log row.
// Fix: addMonstersToInitiative writes exactly ONE `automation` row per acked
// join — "Party joined initiative (N members)" — where N counts the PC
// combatants on the accepted board that match saved characters. No saved
// party (or none present on the board) → no row. A failed board write logs
// nothing (same post-ack contract as the initiative-roll rows). Mock setup
// mirrors sibling encounterToInitiative.join-write-failure.test.js.

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { addMonstersToInitiative } from './encounterToInitiative.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { addEntry } from '../ui/logService.js';
import { loadCombatSummary } from './combatData.js';

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  loadCombatSummary.mockResolvedValue(null);
  storage.set.mockResolvedValue(true); // default: server acks the board write
});

const party = () => [{ name: 'Thorin' }, { name: 'Elara' }];

// Board as the campaign-select seed / Initiative mount merge leaves it:
// every saved PC present as a type:player combatant.
const partyBoard = () => ({
  round: 1,
  creatures: [
    { name: 'Thorin', type: 'player', initiative: '' },
    { name: 'Elara', type: 'player', initiative: '' },
  ],
});

const fanOutRows = () =>
  addEntry.mock.calls
    .map(([, entry]) => entry)
    .filter((e) => e.type === 'automation');

describe('addMonstersToInitiative — PC-party fan-out disclosure row', () => {
  it('writes exactly ONE automation row per join, of the form "Party joined initiative (N members)"', async () => {
    loadCombatSummary.mockResolvedValue(partyBoard());

    await addMonstersToInitiative(
      [{ name: 'Goblin', qty: 1, armor_class: 13 }], party(), 'TestCampaign');

    const rows = fanOutRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'automation',
      automationType: 'party_joined_initiative',
      characterName: 'Party',
      description: 'Party joined initiative (2 members) — the saved PC party is seeded onto the tracker with the encounter.',
    });
    expect(rows[0].timestamp).toEqual(expect.any(Number));
    // Existing join noise preserved: one roll row per monster + ONE fan-out row.
    expect(addEntry).toHaveBeenCalledTimes(2); // roll row + fan-out row
  });

  it('N counts only PC combatants matching saved characters — monsters and ghost party rows never inflate it', async () => {
    loadCombatSummary.mockResolvedValue({
      round: 2,
      creatures: [
        { name: 'Thorin', type: 'player', initiative: '18' },
        { name: 'Elara', type: 'player', initiative: '11' },
        { name: 'DeletedChar', type: 'player', initiative: '9' }, // no character file
        { name: 'Goblin', type: 'npc', initiative: '12' },
      ],
    });

    await addMonstersToInitiative(
      // 2 goblins joining → 2 new npc rows, but N stays the 2 matched PCs.
      [{ name: 'Goblin', qty: 2, armor_class: 13 }], party(), 'TestCampaign');

    const rows = fanOutRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toContain('Party joined initiative (2 members)');
  });

  it('writes ONE row per join even when the party was already on the board (repeat join)', async () => {
    loadCombatSummary.mockResolvedValue(partyBoard());

    await addMonstersToInitiative(
      [{ name: 'Ogre', qty: 1, armor_class: 11 }], party(), 'TestCampaign');
    expect(fanOutRows()).toHaveLength(1);

    addEntry.mockClear();
    await addMonstersToInitiative(
      [{ name: 'Ogre', qty: 1, armor_class: 11 }], party(), 'TestCampaign');
    expect(fanOutRows()).toHaveLength(1);
  });

  it('zero-member suppression: no saved characters → NO fan-out row (roll rows unchanged)', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });

    await addMonstersToInitiative(
      [{ name: 'Goblin', qty: 1, armor_class: 13 }], [], 'TestCampaign');

    expect(fanOutRows()).toHaveLength(0);
    expect(addEntry).toHaveBeenCalledTimes(1); // just the initiative roll row
  });

  it('zero-member suppression: saved characters but none seeded onto the board → NO fan-out row', async () => {
    loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });

    await addMonstersToInitiative(
      [{ name: 'Goblin', qty: 1, armor_class: 13 }], party(), 'TestCampaign');

    expect(fanOutRows()).toHaveLength(0);
    expect(addEntry).toHaveBeenCalledTimes(1); // just the initiative roll row
  });

  it('failed board write throws BEFORE the fan-out row — zero phantom log rows', async () => {
    loadCombatSummary.mockResolvedValue(partyBoard());
    storage.set.mockResolvedValue(false);

    await expect(
      addMonstersToInitiative(
        [{ name: 'Goblin', qty: 1, armor_class: 13 }], party(), 'TestCampaign')
    ).rejects.toThrow('combatSummary board write failed');

    expect(addEntry).not.toHaveBeenCalled();
  });
});
