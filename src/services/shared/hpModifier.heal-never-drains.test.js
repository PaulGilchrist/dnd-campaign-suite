// @maintained-by-ai
//
// ── MM 2026-11-14 fix (bug-hoh-negative-heal-stale-snapshot-clamp) ──
// SUBJECT: modifyHitPoints — the heal-never-drains floor. A POSITIVE delta
// (heal intent) must never write a LOWER HP: when the row max sits BELOW the
// current HP (a stale 1/1 Initiative fan-out placeholder under a healed-up
// bucket, or any GM maxHp edit landing below current), the old upper clamp
// min(maxHp, oldHp + heal) resolved a newHp below oldHp and the "heal" drained
// the target (live-proved 2026-11-14: HoH commit with dispatch-snapshot max 1
// vs bucket current 60 wrote 60→1, hp_change delta:-59 stamped isHealing:true).
//
// The main hpModifier.test.js pins (ladder arithmetic, ??-fallback STRUCT
// probes, non-finite refusal) are UNCHANGED — including the maxHp-0 STRUCT pin
// (a heal onto an impossible-RAW 0-max keeps its pre-fix bytes: the floor is
// gated on maxHp > 0). This file pins only the floor itself, both lanes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store-boundary mock, mock-faithful REAL-null (useRuntimeState.js:74).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { modifyHitPoints } from './hpModifier.js';

const CAMPAIGN = 'test-campaign';

function makePlayer(overrides = {}) {
  return { name: 'Thorin', type: 'player', maxHp: 10, ...overrides };
}
function makeNpc(overrides = {}) {
  return { name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 15, ...overrides };
}
const summary = (...creatures) => ({ creatures });

function seedRuntime({ hitPoints = null, currentHitPoints = null, isDead = null } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'hitPoints') return hitPoints;
    if (key === 'currentHitPoints') return currentHitPoints;
    if (key === 'isDead') return isDead;
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getRuntimeValue.mockImplementation(() => null);
  vi.spyOn(window, 'dispatchEvent');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('modifyHitPoints — heal-never-drains floor', () => {
  it('player lane: stale row max BELOW the bucket current turns the heal into a zero-write, never a drain', () => {
    // The filed face: bucket current 60 with NO bucket max (the full-store POST
    // replaced the whole bucket), dispatch-snapshot row a 1/1 fan-out
    // placeholder. Pre-fix: min(1, 60+16) = 1 → delta −59 into the bucket.
    seedRuntime({ hitPoints: null, currentHitPoints: 60 });
    const target = makePlayer({ maxHp: 1 }); // stale snapshot row

    const result = modifyHitPoints(summary(target), 'Thorin', 16, CAMPAIGN);

    expect(result).toStrictEqual({
      oldHp: 60, newHp: 60, delta: 0, isPlayer: true, creature: target, maxHp: 1,
    });
    expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 60, CAMPAIGN);
    expect(window.dispatchEvent).not.toHaveBeenCalled(); // zero actualDelta → event gate shut
  });

  it('player lane: heal above a bucket max still clamps UP to it (normal headroom math untouched)', () => {
    seedRuntime({ hitPoints: 70, currentHitPoints: 60 });
    const target = makePlayer({ maxHp: 112 });

    const result = modifyHitPoints(summary(target), 'Thorin', 16, CAMPAIGN);

    expect(result.newHp).toBe(70); // min(bucket max 70, 76)
    expect(result.delta).toBe(10);
    expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 70, CAMPAIGN);
  });

  it('monster lane twin: heal on a row whose currentHp rides above its maxHp writes no drain', () => {
    // Mirror of the player-leg guard idiom (fix#352(a) twin-byte law).
    const target = makeNpc({ currentHp: 60, maxHp: 1 });

    const result = modifyHitPoints(summary(target), 'Goblin', 16, CAMPAIGN);

    expect(result).toStrictEqual({
      oldHp: 60, newHp: 60, delta: 0, isPlayer: false, creature: target, maxHp: 1,
    });
    expect(target.currentHp).toBe(60); // in-place entry never lowered
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it('damage lanes are untouched: negative deltas keep their exact clamp arithmetic (drain is the point there)', () => {
    const target = makeNpc({ currentHp: 7, maxHp: 15 });

    const result = modifyHitPoints(summary(target), 'Goblin', -4, CAMPAIGN);

    expect(result.newHp).toBe(3);
    expect(result.delta).toBe(-4);
    expect(target.currentHp).toBe(3);
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('maxHp-0 STRUCT exemption keeps its bytes (main-file ??-vs-|| pin unaffected by the floor)', () => {
    // hpModifier.test.js pins a HIT on a 0-max player as an 8→0 drain; the
    // floor's maxHp > 0 gate must NOT "rescue" that impossible-RAW lane.
    seedRuntime({ hitPoints: 0, currentHitPoints: 8 });
    const target = makePlayer();

    const result = modifyHitPoints(summary(target), 'Thorin', 5, CAMPAIGN);

    expect(result.newHp).toBe(0);
    expect(result.delta).toBe(-8);
  });
});
