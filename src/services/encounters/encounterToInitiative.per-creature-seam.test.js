// @maintained-by-ai
// Regression: bug-combat-seam-clears-board-wide-violate-per-creature-ruling —
// owner ruling (Paul, 2026-11-10, verbatim): "EB join is not a board wide new
// initiative roll. EB join can be used in the middle of combat and frequently
// is used for patrols and other reinforcements to join an existing battle.
// Initiative rolls only signal the creature making the initiative roll as
// joining what might be a pre-existing combat encounter. So an initiative
// roll, short rest, or long rest signals old combat ending and new combat
// beginning for the character making the initiative roll, not for everyone."
//
// Consequence proven here (join seams clear NOTHING):
//   - addMonstersToInitiative (EB "Join Encounter"), on BOTH the live-board
//     and the fresh-board branch, must leave every already-present creature's
//     pendingExpirations (until:'combat' clocks, dominated queues, finite
//     rider clocks) UNTOUCHED. Joiners are fresh, so even per-joiner sweeps
//     would be no-ops — the lane sweeps nobody.
//   - loadEncounterToInitiative (saved-encounter load / auto-encounter) — the
//     pre-fix unconditional board-wide sweepNewCombatClocks call is gone.
//   - Non-vacuous red: with the SAME seeded store, the real
//     sweepNewCombatClocks DOES evict the until:'combat' entries (a
//     reintroduced join-seam sweep would visibly wipe them), while
//     sweepRestClocks (rest seam) now sweeps ONLY the resting creature's own
//     store — the offender for the rest lane was the unscoped all-stores call.
//
// Mock doctrine mirrors sibling encounterToInitiative.test.js (which loaded
// zoneDurationClock + expirationQueue UNMOCKED against a runtime-store stub).
// clearExpirationEffects is stubbed as the eviction spy so "was this entry
// swept" is observable as a call, not just a byte diff.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map() }));

// ── Mocks BEFORE imports ────────────────────────────────────────

vi.mock('../dice/diceRoller.js', () => ({ rollD20: vi.fn() }));

vi.mock('../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown') } }));

vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));

// Live-ish runtime store: every read/write hits the Map, so sweeps EVICT
// exactly like the real client store would.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key) => (store.has(`${name}|${key}`) ? store.get(`${name}|${key}`) : null)),
  setRuntimeValue: vi.fn((name, key, value) => { store.set(`${name}|${key}`, value); }),
  setRuntimeObject: vi.fn((name, obj) => {
    for (const [k, v] of Object.entries(obj || {})) store.set(`${name}|${k}`, v);
  }),
  deleteRuntimeKey: vi.fn((name, key) => { store.delete(`${name}|${key}`); }),
  getAllStoreKeys: vi.fn(() => Array.from(new Set(Array.from(store.keys()).map((k) => k.split('|')[0])))),
}));

vi.mock('./combatData.js', () => ({
  loadCombatSummary: vi.fn(() => null),
  setCombatSummaryCache: vi.fn(),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// The eviction leg — stubbed as a spy so swept entries are observable.
vi.mock('../rules/effects/clearExpirationEffects.js', () => ({
  clearExpirationEffects: vi.fn(),
}));
vi.mock('../rules/effects/turnStartEffects.js', () => ({ KEY: 'pendingExpirations' }));

// ── Imports ─────────────────────────────────────────────────────

import { loadEncounterToInitiative, addMonstersToInitiative } from './encounterToInitiative.js';
import { rollD20 } from '../dice/diceRoller.js';
import storage from '../ui/storage.js';
import { addEntry } from '../ui/logService.js';
import { loadCombatSummary } from './combatData.js';
import { clearExpirationEffects } from '../rules/effects/clearExpirationEffects.js';
import { sweepNewCombatClocks, sweepRestClocks } from '../rules/effects/zoneDurationClock.js';

const CAMPAIGN = 'TestCampaign';
const WOLF = [{ name: 'Wolf', qty: 1, armor_class: 13, hit_points: 11 }];

// Creature A (already on the board / off-board party) seeded state:
// a combat-scoped clock, a finite rider clock, and a dominated queue entry
// living in a THIRD creature's store. These are the bytes the ruling says a
// join must never touch.
const COMBAT_CLOCK = { target: 'Thorin', effects: [{ type: 'condition', condition: 'poisoned' }], appliedRound: 1, expiryRounds: null, expireOnCreatureName: null, until: 'combat' };
const RIDER_CLOCK = { target: 'Thorin', effects: [{ type: 'condition', condition: 'dazed' }], appliedRound: 1, expiryRounds: 2, expireOnCreatureName: null };
const DOMINATED_QUEUE = { target: 'Thorin', effects: [{ type: 'dominated', effect: 'dominated', duration: '1 minute' }], appliedRound: 1, expiryRounds: null, expireOnCreatureName: null, until: 'combat' };

function seedVictims() {
  store.set('campaign|enforcement', { mode: 'on', zones: true });
  store.set('Thorin|pendingExpirations', [COMBAT_CLOCK, RIDER_CLOCK]);
  store.set('Thorin|activeConditions', ['poisoned']);
  store.set('Thorin|activeBuffs', [{ name: 'Test Ward', effect: 'test_ward' }]);
  store.set('MindFlayer|pendingExpirations', [DOMINATED_QUEUE]);
}
const victimsUntouched = () => {
  expect(store.get('Thorin|pendingExpirations')).toEqual([COMBAT_CLOCK, RIDER_CLOCK]);
  expect(store.get('Thorin|activeConditions')).toEqual(['poisoned']);
  expect(store.get('Thorin|activeBuffs')).toEqual([{ name: 'Test Ward', effect: 'test_ward' }]);
  expect(store.get('MindFlayer|pendingExpirations')).toEqual([DOMINATED_QUEUE]);
  expect(clearExpirationEffects).not.toHaveBeenCalled();
  // No combat-scoped sweep log row either way.
  expect(addEntry.mock.calls.filter(([, e]) => (e?.description || '').includes('combat-scoped'))).toEqual([]);
};

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  rollD20.mockReturnValue(10);
  storage.set.mockResolvedValue(true);
  loadCombatSummary.mockResolvedValue(null);
});

describe('EB Join is never a board-wide clear seam (owner ruling 2026-11-10)', () => {
  it('addMonstersToInitiative onto a LIVE board preserves every present creature until the joiner rows land', async () => {
    seedVictims();
    loadCombatSummary.mockResolvedValue({
      round: 3,
      creatures: [
        { name: 'Thorin', type: 'player', initiative: '18' },
        { name: 'Goblin', type: 'npc', initiative: '12' },
      ],
    });

    const board = await addMonstersToInitiative(WOLF, [], CAMPAIGN);

    // The join itself landed (mid-combat reinforcement semantics)…
    expect(board.creatures.map((c) => c.name)).toContain('Wolf');
    expect(board.round).toBe(3);
    // …while victim state is byte-untouched.
    victimsUntouched();
  });

  it('addMonstersToInitiative on the fresh-board branch also sweeps nobody (joiners are fresh)', async () => {
    seedVictims();
    loadCombatSummary.mockResolvedValue(null);

    await addMonstersToInitiative(WOLF, [], CAMPAIGN);

    victimsUntouched();
  });

  it('loadEncounterToInitiative (saved-encounter load / auto-encounter) clears nothing of the party', async () => {
    seedVictims();

    await loadEncounterToInitiative(WOLF, [], CAMPAIGN);

    victimsUntouched();
  });

  // Non-vacuous red: the same seeded bytes DO vanish when a board-wide sweep
  // runs — a reintroduced join-seam sweep cannot hide behind dead fixtures.
  it('the real sweepNewCombatClocks would evict these entries if a join seam called it', async () => {
    seedVictims();

    const swept = await sweepNewCombatClocks(CAMPAIGN);

    expect(swept).toBe(2); // Thorin's until:combat clock + MindFlayer's dominated queue
    expect(clearExpirationEffects).toHaveBeenCalledTimes(2);
    expect(store.get('Thorin|pendingExpirations')).toEqual([RIDER_CLOCK]); // finite rider clock survives any way
    expect(store.get('MindFlayer|pendingExpirations')).toEqual([]);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      automationType: 'enforcement_clock_expired',
      description: expect.stringContaining('2 combat-scoped effects ended'),
    }));
  });

  it('sweepRestClocks (rest seam) sweeps ONLY the resting creature store — foreign queues survive', async () => {
    seedVictims();

    const swept = await sweepRestClocks(CAMPAIGN, 'short', 'Thorin');

    expect(swept).toBe(1);
    expect(store.get('Thorin|pendingExpirations')).toEqual([RIDER_CLOCK]);
    expect(store.get('MindFlayer|pendingExpirations')).toEqual([DOMINATED_QUEUE]);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      characterName: 'Thorin',
      description: expect.stringContaining("Short rest: Thorin's 1 combat-scoped effect ended"),
    }));
  });
});
