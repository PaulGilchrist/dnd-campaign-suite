// @maintained-by-ai
//
// Unit pins for src/services/shared/hpModifier.js — the canonical dead-detection
// and HP-adjustment chokepoint. Both exports are LIVE (dead-export hunt, none dead):
//   isCreatureDead   <- spellGates.js:6 (SP-100 gate), revivifyService.js:6
//   modifyHitPoints  <- applyHealing.js:4 (MA-0367 heal chokepoint)
//
// HP-key alias map pinned here (conflation family #1435-48 / #1481 / #1484):
//   runtime store, PC-canonical:   hitPoints = max, currentHitPoints = current, isDead = latch
//   combatSummary entry, monster-canonical: maxHp, currentHp
//   Players' summary entries are 1/1 placeholders (pitfall 37) — player truth MUST come
//   from runtime, never from the summary snapshot (snapshot-trap test below).
//
// No hit-dice derivation in this file: maxHp arrives pre-combined from callers and is
// never re-derived from classes.json rows here (boundary-cite: die formulas live upstream
// in the class/level lanes). CON mod is likewise never recomputed — canonical
// floor((score-10)/2) derivation is not re-rolled in this span (#1506 boundary-cite).
// NO-CLOCK: pure state read/write/derive only — no Date.now, no timers (no-timers law).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store-boundary mock, mock-faithful REAL-null: the real getRuntimeValue returns
// null (NOT undefined) for missing keys (useRuntimeState.js:74).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { modifyHitPoints, isCreatureDead } from './hpModifier.js';

const CAMPAIGN = 'test-campaign';

// Fresh fixtures per test (mutation law: the NPC lane mutates its summary entry in
// place, so objects must never be shared across tests — purity/shared-reference law).
function makePlayer(overrides = {}) {
  // Players carry NO currentHp on the summary — runtime is canonical (pitfall 37).
  return { name: 'Thorin', type: 'player', maxHp: 10, ...overrides };
}
function makeNpc(overrides = {}) {
  return { name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 15, ...overrides };
}
const summary = (...creatures) => ({ creatures });

// Runtime seed mirroring REAL store shapes: unrequested keys answer null.
function seedRuntime({ hitPoints = null, currentHitPoints = null, isDead = null } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'hitPoints') return hitPoints;
    if (key === 'currentHitPoints') return currentHitPoints;
    if (key === 'isDead') return isDead;
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks(); // call records only; implementation re-seeded per test
  getRuntimeValue.mockImplementation(() => null); // REAL-null default (NPC lane never reads)
  vi.spyOn(window, 'dispatchEvent');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('modifyHitPoints — early returns (pure null, zero side effects)', () => {
  it.each([
    { desc: 'combatSummary null', s: null, target: 'Goblin' },
    { desc: 'combatSummary undefined', s: undefined, target: 'Goblin' },
    { desc: 'creatures key absent', s: {}, target: 'Goblin' },
    { desc: 'creatures empty array', s: summary(), target: 'Goblin' },
    { desc: 'target not on the roster', s: summary(makeNpc({ currentHp: 7 })), target: 'Dragon' },
  ])('$desc returns null without touching the runtime store', ({ s, target }) => {
    expect(modifyHitPoints(s, target, 5, CAMPAIGN)).toBeNull();
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});

describe('modifyHitPoints — monster lane (combatSummary currentHp canonical)', () => {
  // Ladder arithmetic pin (disk-formula form): newHp = min(maxHp, max(0, oldHp + delta)).
  // Full-set toStrictEqual + result.creature identity + in-place mutation + event law,
  // all asserted per row (heal: delta negative; damage: delta positive).
  it.each([
    { desc: 'damage clamps to 0', currentHp: 3, maxHp: 15, delta: -7, oldHp: 3, newHp: 0, actual: -3, events: 1 },
    { desc: 'damage unclamped', currentHp: 7, maxHp: 15, delta: -4, oldHp: 7, newHp: 3, actual: -4, events: 1 },
    { desc: 'heal clamps to maxHp', currentHp: 7, maxHp: 15, delta: 20, oldHp: 7, newHp: 15, actual: 8, events: 1 },
    { desc: 'zero delta is a no-op', currentHp: 5, maxHp: 15, delta: 0, oldHp: 5, newHp: 5, actual: 0, events: 0 },
    { desc: 'damage onto a 0-HP monster stays dead, no event', currentHp: 0, maxHp: 15, delta: -3, oldHp: 0, newHp: 0, actual: 0, events: 0 },
  ])('$desc', ({ currentHp, maxHp, delta, oldHp, newHp, actual, events }) => {
    const target = makeNpc({ currentHp, maxHp });
    const result = modifyHitPoints(summary(target), 'Goblin', delta, CAMPAIGN);

    expect(result).toStrictEqual({
      oldHp, newHp, delta: actual, isPlayer: false, creature: target, maxHp,
    });
    expect(result.creature).toBe(target);
    expect(target.currentHp).toBe(newHp); // mutation law: summary entry written in place (CLA-208)
    expect(window.dispatchEvent).toHaveBeenCalledTimes(events);
    if (events) {
      expect(window.dispatchEvent.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
      expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated');
    }
    expect(setRuntimeValue).not.toHaveBeenCalled(); // monsters never write the runtime store
  });

  it('quirk byte-pin: maxHp missing poisons newHp with NaN, mutates it onto the summary, still dispatches', () => {
    // Unguarded on purpose (vs the player lane's maxHp != null guard — asymmetric by code):
    // Math.min(undefined, n) === NaN; NaN !== 0 so the event fires. Pinned as-is.
    const target = { name: 'Rug', type: 'npc', currentHp: 7 }; // maxHp absent
    const result = modifyHitPoints(summary(target), 'Rug', -2, CAMPAIGN);

    expect(result.maxHp).toBeUndefined();
    expect(result.newHp).toBeNaN();
    expect(result.delta).toBeNaN();
    expect(target.currentHp).toBeNaN();
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });
});

describe('modifyHitPoints — player lane (runtime canonical)', () => {
  // newHp = min(hitPoints ?? maxHp, max(0, currentHitPoints ?? 0 + delta)), written back
  // to the runtime store under the EXACT key 'currentHitPoints'.
  it.each([
    { desc: 'damage clamps to 0', currentHitPoints: 3, delta: -20, newHp: 0, actual: -3, events: 1 },
    { desc: 'heal clamps to hitPoints', currentHitPoints: 8, delta: 10, newHp: 10, actual: 2, events: 1 },
    { desc: 'zero delta: store write still happens, event suppressed (write-vs-event divergence pin)', currentHitPoints: 5, delta: 0, newHp: 5, actual: 0, events: 0 },
  ])('$desc', ({ currentHitPoints, delta, newHp, actual, events }) => {
    seedRuntime({ hitPoints: 10, currentHitPoints });
    const target = makePlayer();

    const result = modifyHitPoints(summary(target), 'Thorin', delta, CAMPAIGN);

    expect(result).toStrictEqual({
      oldHp: currentHitPoints, newHp, delta: actual, isPlayer: true, creature: target, maxHp: 10,
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', newHp, CAMPAIGN);
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(events);
    expect(target.currentHp).toBeUndefined(); // placeholder purity: player lane writes runtime ONLY
  });

  it('read-order census: maxHp read precedes oldHp read; summary snapshot never consulted for HP', () => {
    seedRuntime({ hitPoints: 10, currentHitPoints: 4 });
    const target = makePlayer({ currentHp: 0 }); // stale snapshot trap: 0 on the summary

    modifyHitPoints(summary(target), 'Thorin', -1, CAMPAIGN);

    expect(getRuntimeValue.mock.calls).toEqual([
      ['Thorin', 'hitPoints'],
      ['Thorin', 'currentHitPoints'],
    ]);
    expect(target.currentHp).toBe(0); // snapshot untouched — runtime is canonical (pitfall 37)
  });

  // Fallback + falsy-zero arms of the ?? chain (:29, :34, :36). HP-0 IS a load-bearing
  // death state: '??' MUST keep 0 distinct from null/absent (#1482 :296 ||-swallow precedent).
  it.each([
    {
      desc: 'hitPoints null falls back to summary maxHp',
      runtime: { hitPoints: null, currentHitPoints: 8 },
      player: { maxHp: 12 }, delta: 5,
      shape: { oldHp: 8, newHp: 12, delta: 4, isPlayer: true, maxHp: 12 },
    },
    {
      desc: 'hitPoints 0 survives ?? (a || would silently swap in the summary maxHp)',
      runtime: { hitPoints: 0, currentHitPoints: 8 },
      player: {}, delta: 5,
      shape: { oldHp: 8, newHp: 0, delta: -8, isPlayer: true, maxHp: 0 }, // STRUCT probe: 0-max is impossible RAW; pins ?? vs || byte-difference
    },
    {
      desc: 'maxHp absent everywhere: no upper clamp — heal passes through uncapped',
      runtime: { hitPoints: null, currentHitPoints: 8 },
      player: { maxHp: undefined }, delta: 500,
      shape: { oldHp: 8, newHp: 508, delta: 500, isPlayer: true, maxHp: undefined },
    },
    {
      desc: 'currentHitPoints null defaults oldHp to 0',
      runtime: { hitPoints: 10, currentHitPoints: null },
      player: {}, delta: 5,
      shape: { oldHp: 0, newHp: 5, delta: 5, isPlayer: true, maxHp: 10 },
    },
    {
      desc: 'currentHitPoints 0 (death state) survives ?? — oldHp 0, re-writes 0, no event',
      runtime: { hitPoints: 10, currentHitPoints: 0 },
      player: {}, delta: -3,
      shape: { oldHp: 0, newHp: 0, delta: 0, isPlayer: true, maxHp: 10 },
    },
  ])('$desc', ({ runtime, player, delta, shape }) => {
    seedRuntime(runtime);
    const target = makePlayer(player);

    const result = modifyHitPoints(summary(target), 'Thorin', delta, CAMPAIGN);

    expect(result).toStrictEqual({ ...shape, creature: target });
    expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', shape.newHp, CAMPAIGN);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(shape.delta === 0 ? 0 : 1);
  });
});

describe('isCreatureDead — canonical truth table', () => {
  it.each([
    // monster arm: reads ONLY the summary entry's currentHp (:14)
    { desc: 'monster at 0 HP is dead', type: 'npc', currentHp: 0, expectDead: true },
    { desc: 'monster at string "0" is dead (Number() coercion byte-probe)', type: 'npc', currentHp: '0', expectDead: true },
    { desc: 'monster at null HP is alive (guard != null)', type: 'npc', currentHp: null, expectDead: false },
    { desc: 'monster HP key absent is alive', type: 'npc', currentHp: undefined, expectDead: false },
    { desc: 'monster at 5 HP is alive', type: 'npc', currentHp: 5, expectDead: false },
    // player arm: reads ONLY the runtime store (:10-12) — isDead latch OR HP<=0
    { desc: 'player with isDead latch set is dead despite 7 HP', type: 'player', isDead: 1, runtimeHp: 7, expectDead: true },
    { desc: 'player at runtime 0 HP is dead even with latch false (falsy-zero survives)', type: 'player', isDead: 0, runtimeHp: 0, expectDead: true },
    { desc: 'player at runtime string "0" HP is dead', type: 'player', isDead: null, runtimeHp: '0', expectDead: true },
    { desc: 'player with both HP and latch null is alive', type: 'player', isDead: 0, runtimeHp: null, expectDead: false },
    { desc: 'player at 5 HP is alive', type: 'player', isDead: 0, runtimeHp: 5, expectDead: false },
  ])('$desc', ({ type, currentHp, isDead, runtimeHp, expectDead }) => {
    const entry = type === 'npc'
      ? makeNpc({ currentHp })
      : makePlayer(); // player placeholder carries no currentHp — runtime is canonical
    seedRuntime({ isDead, currentHitPoints: runtimeHp });

    expect(isCreatureDead(summary(entry), entry.name)).toBe(expectDead);
    if (type === 'npc') {
      expect(getRuntimeValue).not.toHaveBeenCalled(); // monster arm reads summary only (:14)
    }
  });

  it.each([
    { desc: 'undefined combatSummary', s: undefined, target: 'Goblin' },
    { desc: 'combatSummary without creatures key', s: {}, target: 'Goblin' },
    { desc: 'empty roster', s: summary(), target: 'Goblin' },
    { desc: 'name not on the roster', s: summary(makeNpc({ currentHp: 0 })), target: 'Dragon' },
  ])('$desc reports alive (false) without dereferencing the store', ({ s, target }) => {
    expect(isCreatureDead(s, target)).toBe(false);
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('snapshot trap: player with stale summary currentHp 0 but alive runtime is NOT dead; exact read census', () => {
    // #1481 runtime-vs-snapshot pair: the summary placeholder must never decide PC death.
    seedRuntime({ isDead: 0, currentHitPoints: 5 });
    const stale = makePlayer({ currentHp: 0 });

    expect(isCreatureDead(summary(stale), 'Thorin')).toBe(false);
    expect(getRuntimeValue.mock.calls).toEqual([
      ['Thorin', 'isDead'],
      ['Thorin', 'currentHitPoints'],
    ]); // never 'hitPoints', never the summary snapshot
  });
});
