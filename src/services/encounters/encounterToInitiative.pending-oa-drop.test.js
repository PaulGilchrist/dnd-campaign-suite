// @maintained-by-ai
// Regression: bug-new-initiative-roll-pendingoa-drop-never-fires — the pendingOAs
// drop law ("a new initiative roll retires every pending trigger marker",
// pendingOpportunityAttacks.js header) was implemented ONLY inside Initiative.jsx's
// `initiative-rolled` listener, but BOTH encounter→initiative lanes dispatch that
// event from the Encounters page while the Initiative view is UNMOUNTED, so no
// listener ever ran: a curl-seeded marker byte-survived a real Wolf+Goblin Join
// Encounter (live-proved 2026-11-10) and mounted live OA resolution affordances in
// the brand-new combat where no provocation happened. Fix: the drop runs at the
// PRODUCER (clearAllPendingOas) at the join seam itself — a shared runtime-store
// key DELETE whose null echo evicts the bucket in every tab, mounted or not.
// (The per-creature ruling 2026-11-10 later removed the clock sweep that used to
// sit beside it; the OA drop law stays owner-ratified.)
//
// Mock setup mirrors sibling encounterToInitiative.test.js /
// encounterToInitiative.join-write-failure.test.js. The pendingOAs module rides the
// REAL implementation (the pendingOpportunityAttacks.test.js mocking doctrine:
// stub the runtime-store transport, never the lane under proof), so these tests pin
// the actual eviction write bytes. NO `initiative-rolled` listener is registered
// anywhere in this file — that absence IS the regression condition, so every
// assertion below measures the PRODUCER's own write.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({
  default: { getName: vi.fn((n) => n || 'Unknown'), guid: vi.fn(() => 'probe-guid') },
}));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

// The runtime-store transport: getRuntimeValue primes the pendingOAs bucket,
// deleteRuntimeKey is the drain-to-evict write the drop law must produce.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('./combatData.js', () => ({
  loadCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { loadEncounterToInitiative, addMonstersToInitiative } from './encounterToInitiative.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js';
import { loadCombatSummary } from './combatData.js';
import { PENDING_OA_KEY } from '../combat/pendingOpportunityAttacks.js';

const CAMPAIGN = 'TestCampaign';
const oaWrites = () => setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === PENDING_OA_KEY);
const armedBucket = () => ({
  ElderPaladin: { defender: 'ElderPaladin', mover: 'EvasiveFighter', promptId: 'ga-drop-probe-1' },
});
/** Prime the stored bucket the runtime mock hands back on reads. */
const primeBucket = (map) => getRuntimeValue.mockImplementation((store, key) =>
  (store === 'campaign' && key === PENDING_OA_KEY) ? map : null);

const WOLF = [{ name: 'Wolf', qty: 1, armor_class: 13, hit_points: 11 }];
const liveBoard = () => ({
  round: 3,
  creatures: [{ name: 'Thorin', type: 'player', initiative: '18' }],
});

beforeEach(() => {
  vi.clearAllMocks();
  rollD20.mockReturnValue(10);
  storage.set.mockResolvedValue(true); // default: the server acks the board write
  loadCombatSummary.mockResolvedValue(null);
  primeBucket(armedBucket());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('new initiative roll — pendingOAs drop law at the PRODUCER (Initiative unmounted)', () => {
  it('loadEncounterToInitiative (saved-encounter load) evicts the bucket with one key DELETE', async () => {
    await loadEncounterToInitiative(WOLF, [], CAMPAIGN);

    expect(deleteRuntimeKey).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
    // Drain-to-evict law: the key is DELETEd, never a `pendingOAs:{}` POST.
    expect(oaWrites()).toHaveLength(0);
  });

  it('addMonstersToInitiative (EB "Join Encounter") evicts the bucket joining onto a LIVE board', async () => {
    loadCombatSummary.mockResolvedValue(liveBoard());

    const result = await addMonstersToInitiative(WOLF, [], CAMPAIGN);

    expect(result.creatures.map(c => c.name)).toEqual(['Thorin', 'Wolf']);
    expect(deleteRuntimeKey).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
    expect(oaWrites()).toHaveLength(0);
  });

  it('addMonstersToInitiative evicts on the fresh-board branch too (no prior initiative)', async () => {
    loadCombatSummary.mockResolvedValue(null);

    await addMonstersToInitiative(WOLF, [], CAMPAIGN);

    expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
  });

  it('nothing pending ⇒ zero writes (the seam stays a cheap no-op, no honest-404 churn)', async () => {
    primeBucket(null);

    await loadEncounterToInitiative(WOLF, [], CAMPAIGN);
    await addMonstersToInitiative(WOLF, [], CAMPAIGN);

    expect(deleteRuntimeKey).not.toHaveBeenCalled();
    expect(oaWrites()).toHaveLength(0);
  });

  it('a REJECTED board write drops nothing — the pre-ack throw still outranks the seam', async () => {
    loadCombatSummary.mockResolvedValue(liveBoard());
    storage.set.mockResolvedValue(false); // storage.js honest status after network failure

    await expect(addMonstersToInitiative(WOLF, [], CAMPAIGN))
      .rejects.toThrow('combatSummary board write failed');

    expect(deleteRuntimeKey).not.toHaveBeenCalled();
  });

  it('the initiative-rolled event still dispatches (mounted tabs keep their round-flag/HM/Vex clears)', async () => {
    const rolledListener = vi.fn();
    window.addEventListener('initiative-rolled', rolledListener);
    try {
      await loadEncounterToInitiative(WOLF, [], CAMPAIGN);
      await addMonstersToInitiative(WOLF, [], CAMPAIGN);
      expect(rolledListener).toHaveBeenCalledTimes(2); // one per lane
    } finally {
      window.removeEventListener('initiative-rolled', rolledListener);
    }
  });
});
