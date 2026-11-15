// @maintained-by-ai
// Network-shape lock for the merged Boon of Recovery (Last Stand) intercept
// write (backlog 2026-11-15 PW): the drop-to-0 rescue used to fire SIX
// separate setRuntimeValue legs (currentHitPoints,
// boonOfRecoveryLastStandUsed, deathSaves, deathFailures, isDead,
// activeConditions — one full-bucket POST + SSE echo each), the same shape
// fixed on the sheet-revive lane in db0ad4cf8. Rides the REAL
// useRuntimeState/store with both setters spy-wrapped (the
// undyingSentinelService twin's template) so BOTH censuses are assertions:
// exactly ONE setRuntimeBatch call carrying all six keys, ZERO per-key
// setRuntimeValue calls, one POST /<Char> with the merged bytes. Functional
// bytes (1 + floor(maxHp/2) heal, death-bucket reset, Unconscious strip,
// latch persistence across falls) are pinned alongside.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { checkBoonOfRecoveryLastStand } from './boonOfRecoveryService.js';
import {
  clearRuntimeState,
  setRuntimeObject,
  setRuntimeValue,
  setRuntimeBatch,
} from '../../../hooks/runtime/useRuntimeState.js';

// Spy-wrap (not replace) the two setters: the real store/POST lane still
// runs so the fetch census below is the network assertion, while the
// mock-call census is the shape assertion the CLA-092 write-batching law asks
// for. getRuntimeValue/setRuntimeObject stay real (importOriginal spread).
vi.mock('../../../hooks/runtime/useRuntimeState.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    setRuntimeValue: vi.fn(actual.setRuntimeValue),
    setRuntimeBatch: vi.fn(actual.setRuntimeBatch),
  };
});

// Log lane is a separate POST family; mock it so every fetch counted below
// belongs to the char-bucket surface.
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

import { addEntry } from '../../ui/logService.js';

const NAME = 'StalwartPaladin';
const CAMPAIGN = 'test-campaign';
const CHAR_URL = `/api/campaigns/${CAMPAIGN}/${NAME}`;
const LAST_STAND = [{ name: 'Last Stand' }];

let requests;

function mockFetch() {
  requests = [];
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    requests.push({
      url,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  }));
}

// Seeded directly into the runtime store via setRuntimeObject WITHOUT a
// campaignName — memory-only, zero fetches (the pre-intercept mount state).
function seedCharStore(seed) {
  setRuntimeObject(NAME, seed);
}

function makeComputed(features = LAST_STAND) {
  return {
    level: 20,
    class: { name: 'Paladin', class_levels: [{ level: 20 }] },
    allFeatures: features,
  };
}

const charPosts = () =>
  requests.filter((r) => r.method === 'POST' && r.url === CHAR_URL);
const charWrites = (spy) =>
  spy.mock.calls.filter(([key]) => key === NAME);

describe('boonOfRecoveryService — merged Last Stand intercept write (one batch POST)', () => {
  beforeEach(() => {
    mockFetch();
    addEntry.mockClear();
    setRuntimeValue.mockClear();
    setRuntimeBatch.mockClear();
    clearRuntimeState(NAME);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drop-to-0 intercept writes all six keys in exactly ONE setRuntimeBatch and ONE char POST', () => {
    seedCharStore({
      currentHitPoints: 0,
      hitPoints: 180,
      boonOfRecoveryLastStandUsed: false,
      deathSaves: [true, false, false],
      deathFailures: [true, false, false],
      isDead: 1,
      activeConditions: ['Unconscious', 'poisoned'],
      tempHp: 3, // unrelated key must survive untouched in the same bucket
    });

    const creature = { name: NAME, type: 'player', currentHp: 0 };
    const result = checkBoonOfRecoveryLastStand(creature, makeComputed(), CAMPAIGN);

    expect(result).toMatchObject({ intercepted: true, finalDamage: 0, newHp: 91 }); // 1 + floor(180/2)
    // Combat-summary creature mirror still updated on the player lane.
    expect(creature.currentHp).toBe(91);

    // Shape census: exactly ONE batch call with the full six-key write-set…
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).toHaveBeenCalledWith(NAME, {
      currentHitPoints: 91,
      boonOfRecoveryLastStandUsed: true,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
      activeConditions: ['poisoned'],
    }, CAMPAIGN);
    // …and ZERO residual per-key writes for this character.
    expect(charWrites(setRuntimeValue)).toHaveLength(0);

    // Network census (real setRuntimeBatch): ONE full-bucket POST whose
    // body.value carries every merged byte plus the untouched neighbours.
    const posts = charPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].body.value).toMatchObject({
      currentHitPoints: 91,
      boonOfRecoveryLastStandUsed: true,
      deathSaves: [false, false, false],
      deathFailures: [false, false, false],
      isDead: 0,
      activeConditions: ['poisoned'],
      hitPoints: 180,
      tempHp: 3,
    });

    // Audit row unchanged (AC4): the hp_change heal-family rescue leg stays.
    expect(addEntry).toHaveBeenCalledTimes(1);
    expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
      type: 'hp_change',
      targetName: NAME,
      delta: 91,
      currentHp: 91,
      maxHp: 180,
      isHealing: true,
      isUnconscious: false,
      sourceName: 'Boon Of Recovery - Last Stand',
    });
  });

  it.each([
    ['odd max HP floors the half (101 -> 51)', 101, 51],
    ['healing caps at max HP (max 1 -> 1)', 1, 1],
  ])('functional bytes: %s — one batch POST carries currentHitPoints', (_label, maxHp, expectedHp) => {
    seedCharStore({ currentHitPoints: 0, hitPoints: maxHp });

    const result = checkBoonOfRecoveryLastStand(
      { name: NAME, type: 'player', currentHp: 0 },
      makeComputed(),
      CAMPAIGN
    );

    expect(result).toMatchObject({ intercepted: true, newHp: expectedHp });
    expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
    expect(setRuntimeBatch).toHaveBeenCalledWith(NAME, expect.objectContaining({
      currentHitPoints: expectedHp,
    }), CAMPAIGN);
    expect(charPosts()).toHaveLength(1);
    expect(charPosts()[0].body.value.currentHitPoints).toBe(expectedHp);
  });

  it('strips unconscious case-insensitively while preserving other conditions', () => {
    seedCharStore({
      currentHitPoints: 0,
      hitPoints: 60,
      activeConditions: ['unconscious', 'Poisoned', 'PRONE'],
    });

    checkBoonOfRecoveryLastStand(
      { name: NAME, type: 'player', currentHp: 0 },
      makeComputed(),
      CAMPAIGN
    );

    expect(setRuntimeBatch).toHaveBeenCalledWith(NAME, expect.objectContaining({
      activeConditions: ['Poisoned', 'PRONE'],
    }), CAMPAIGN);
  });

  it('latch persists across falls: a second drop with boonOfRecoveryLastStandUsed set returns intercepted:false with zero writes and zero POSTs', () => {
    seedCharStore({
      currentHitPoints: 0,
      hitPoints: 180,
      boonOfRecoveryLastStandUsed: true,
      deathSaves: [true, true, false],
      deathFailures: [true, true, false],
      isDead: 0,
      activeConditions: ['Unconscious'],
    });

    const result = checkBoonOfRecoveryLastStand(
      { name: NAME, type: 'player', currentHp: 0 },
      makeComputed(),
      CAMPAIGN
    );

    // Chain law: honest fall-through to the next interceptor — the latched
    // Last Stand must not re-fire, rewrite, or re-POST anything.
    expect(result).toEqual({ intercepted: false });
    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(charWrites(setRuntimeValue)).toHaveLength(0);
    expect(requests).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('stays silent without the feature / malformed allFeatures — zero writes', () => {
    seedCharStore({ currentHitPoints: 0, hitPoints: 180 });

    expect(checkBoonOfRecoveryLastStand(
      { name: NAME },
      makeComputed([{ name: 'Extra Attack' }]),
      CAMPAIGN
    )).toEqual({ intercepted: false });
    expect(checkBoonOfRecoveryLastStand({ name: NAME }, { allFeatures: null }, CAMPAIGN))
      .toEqual({ intercepted: false });

    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(charWrites(setRuntimeValue)).toHaveLength(0);
    expect(requests).toHaveLength(0);
  });

  it('throws loudly (no silent fallback) when stored max HP is missing — no batch write', () => {
    seedCharStore({ currentHitPoints: 0 });

    expect(() => checkBoonOfRecoveryLastStand(
      { name: NAME, type: 'player', currentHp: 0 },
      makeComputed(),
      CAMPAIGN
    )).toThrow('Last Stand: hitPoints not found for StalwartPaladin');

    expect(setRuntimeBatch).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
    expect(addEntry).not.toHaveBeenCalled();
  });
});
