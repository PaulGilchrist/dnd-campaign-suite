// @maintained-by-ai
// Regression: bug-new-initiative-roll-pendingoa-drop-never-fires — the pendingOAs
// drop law ("a new initiative roll retires every pending trigger marker") lived
// ONLY in Initiative.jsx's `initiative-rolled` listener, while addNPCToInitiative
// dispatches that event from the NPCs PAGE and only navigates to the Initiative
// view afterwards (`onViewInitiative()`), so nothing consumed it and a marker
// armed in the previous combat rode its live resolution affordance into the new
// one. Fix: the drop runs at the PRODUCER (clearAllPendingOas) beside the dispatch
// — a shared runtime-store key DELETE whose null echo evicts the bucket in every
// tab, mounted or not.
//
// Mock setup mirrors sibling npcCombatService.test.js (the transport stubs only);
// the pendingOAs module rides the REAL implementation, per the
// pendingOpportunityAttacks.test.js doctrine, so the eviction WRITE bytes are
// pinned here. No `initiative-rolled` listener is registered in this file — that
// absence is the regression condition: the assertions measure the producer.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../encounters/npcStatBlockUtils.js', async (importActual) => ({
  ...(await importActual()),
  npcHasStatBlock: vi.fn(() => true),
  npcHasAttacks: vi.fn(() => true),
}));

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn(() => 15) }));

vi.mock('../encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../ui/storage.js', () => ({ default: { set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid') } }));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

import { addNPCToInitiative } from './npcCombatService.js';
import { loadCombatSummary } from '../encounters/combatData.js';
import storage from '../ui/storage.js';
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js';
import { PENDING_OA_KEY } from '../combat/pendingOpportunityAttacks.js';

const CAMPAIGN = 'testCampaign';
const npc = () => ({ name: 'Grixxa', armorClass: 12, hitPoints: 7 });
const armedBucket = () => ({
  ElderPaladin: { defender: 'ElderPaladin', mover: 'EvasiveFighter', promptId: 'ga-drop-probe-1' },
});
const oaWrites = () => setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === PENDING_OA_KEY);
const primeBucket = (map) => getRuntimeValue.mockImplementation((store, key) =>
  (store === 'campaign' && key === PENDING_OA_KEY) ? map : null);

beforeEach(() => {
  vi.clearAllMocks();
  storage.set.mockResolvedValue(undefined);
  loadCombatSummary.mockResolvedValue(null);
  primeBucket(armedBucket());
  global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});

describe('addNPCToInitiative — pendingOAs drop law at the PRODUCER (Initiative unmounted)', () => {
  it('an accepted add evicts the bucket with one key DELETE, drain-to-evict style', async () => {
    const result = await addNPCToInitiative(CAMPAIGN, npc());

    expect(result).toBe('added');
    expect(deleteRuntimeKey).toHaveBeenCalledTimes(1);
    expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
    expect(oaWrites()).toHaveLength(0); // never a `pendingOAs:{}` POST
  });

  it('nothing pending ⇒ zero writes (no honest-404 DELETE churn)', async () => {
    primeBucket(null);

    await expect(addNPCToInitiative(CAMPAIGN, npc())).resolves.toBe('added');

    expect(deleteRuntimeKey).not.toHaveBeenCalled();
    expect(oaWrites()).toHaveLength(0);
  });

  it('a refused add (name already on the board) drops NOTHING and dispatches no roll', async () => {
    loadCombatSummary.mockResolvedValue({
      round: 2,
      creatures: [{ name: 'Grixxa', type: 'npc', initiative: '9' }],
    });

    const result = await addNPCToInitiative(CAMPAIGN, npc());

    expect(result).toBe('already');
    expect(deleteRuntimeKey).not.toHaveBeenCalled();
    expect(oaWrites()).toHaveLength(0);
  });
});
