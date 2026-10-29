// @maintained-by-ai
// Regression: bug-eb-join-swallowed-network-fail-phantom-row — when the
// combatSummary board write failed (network abort lane), storage.set swallowed
// the rejection AND addMonstersToInitiative never awaited it, so the join
// RESOLVED: handleJoinEncounter's catch never fired, the durable `joined` log
// row persisted, initiative-roll rows logged for creatures that never landed,
// and the UI navigated to a board that never received the join. Additionally
// the read side conflated a GET blip with "no combat" and silently normalized
// a live board away. Fix: STRICT read ({ strict: true } — transport failure
// throws), AWAITED authoritative write (resolves false on failure → THROW
// before the rolls/event), join onto a COPY so sync cache readers never see a
// phantom row. Mock setup mirrors sibling
// encounterToInitiative.empty-summary.test.js.

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
import { loadCombatSummary, setCombatSummaryCache } from './combatData.js';

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  loadCombatSummary.mockResolvedValue(null);
  storage.set.mockResolvedValue(true); // default: server acks the board write
});

const liveBoard = () => ({
  round: 3,
  creatures: [
    { name: 'Thorin', type: 'player', initiative: '18' },
    { name: 'Goblin', type: 'npc', initiative: '12' },
  ],
});

describe('addMonstersToInitiative — swallowed network-failure phantom join', () => {
  it('reads the board in STRICT mode; a rejected read aborts the join before ANY write or log', async () => {
    loadCombatSummary.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      addMonstersToInitiative([{ name: 'Ogre', qty: 1, armor_class: 13 }], [], 'TestCampaign')
    ).rejects.toThrow(TypeError);

    // #1010 transport stays change-data; strict is the join-lane extra.
    expect(loadCombatSummary).toHaveBeenCalledWith('TestCampaign', { strict: true });
    // A blipped READ must never normalize a possibly-live board away:
    expect(storage.set).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled(); // zero phantom rows of any kind
  });

  it('board write rejected (resolves false) THROWS — no roll rows, no activeCreatureName, no navigate event, cached board untouched', async () => {
    const board = liveBoard();
    loadCombatSummary.mockResolvedValue(board);
    storage.set.mockResolvedValue(false); // storage.js honest status after network failure
    const rolledListener = vi.fn();
    window.addEventListener('initiative-rolled', rolledListener);

    await expect(
      addMonstersToInitiative([{ name: 'Goblin', qty: 1, armor_class: 13 }], [], 'TestCampaign')
    ).rejects.toThrow('combatSummary board write failed');

    // The pre-fix divergence, pinned gone:
    expect(addEntry).not.toHaveBeenCalled(); // initiative rolls never reach the log
    expect(storage.set).not.toHaveBeenCalledWith('activeCreatureName', expect.anything(), expect.anything());
    expect(rolledListener).not.toHaveBeenCalled(); // handleJoinEncounter never navigates
    expect(setCombatSummaryCache).not.toHaveBeenCalled();
    // The object loadCombatSummary cached is shared with sync readers — the
    // join mutates a COPY, so a failed write leaves zero phantom rows client-side.
    expect(board.creatures.map((c) => c.name)).toEqual(['Thorin', 'Goblin']);

    window.removeEventListener('initiative-rolled', rolledListener);
  });

  it('acked write completes the join: cache refreshed with the new board, roll rows logged, event dispatched', async () => {
    loadCombatSummary.mockResolvedValue(liveBoard());
    const rolledListener = vi.fn();
    window.addEventListener('initiative-rolled', rolledListener);

    const result = await addMonstersToInitiative(
      [{ name: 'Goblin', qty: 1, armor_class: 13 }], [], 'TestCampaign');

    // Existing 'Goblin' on the board → new instance numbers off the series;
    // creatures sort initiative-desc (Thorin 18, Goblin 12, Goblin 1 = 10).
    expect(result.creatures.map((c) => c.name)).toEqual(['Thorin', 'Goblin', 'Goblin 1']);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 3 }), 'TestCampaign');
    expect(setCombatSummaryCache).toHaveBeenCalledWith(
      expect.objectContaining({ creatures: expect.any(Array) }), 'TestCampaign');
    expect(addEntry).toHaveBeenCalledTimes(1); // roll row lands only post-ack
    expect(rolledListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('initiative-rolled', rolledListener);
  });
});
