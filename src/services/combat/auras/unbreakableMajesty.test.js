// @maintained-by-ai
// Unbreakable Majesty (2024 Paladin) — module internals.
// Consumers (hitResolution attack-side, navigationHandlers round-wrap,
// CharSummary/CreatureCard badges) mock this module wholesale in their own
// lanes, so runtime-store key spellings, per-round tracker semantics, and the
// prompt envelope are pinned here and only here.
// Zero-clock compliance: no wall-clock timers anywhere in this module — the
// per-attacker trigger is a round stamp gated at turn seams (CLA-370: at
// round-wrap the caller passes the explicit roundToSet because the
// combatSummary cache lags one round behind).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getRuntimeKeysByPrefix: vi.fn(() => []),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  isUnbreakableMajestyActive,
  getUnbreakableMajestySaveDc,
  clearUnbreakableMajesty,
  hasAttackerTriggeredMajesty,
  markAttackerTriggeredMajesty,
  clearPerRoundMajestyTrackers,
  buildMajestyPromptData,
} from './unbreakableMajesty.js';

import { getRuntimeValue, setRuntimeValue, getRuntimeKeysByPrefix } from '../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';

/**
 * In-memory runtime store keyed by the exact storage keys the module uses —
 * order-independent, stateful, and it catches key-spelling regressions.
 */
function fakeRuntimeStore(initial = {}) {
  const store = { ...initial };
  getRuntimeValue.mockImplementation((_, key) => store[key]);
  setRuntimeValue.mockImplementation((_, key, value) => { store[key] = value; });
  return store;
}

beforeEach(() => {
  vi.resetAllMocks();
  getRuntimeKeysByPrefix.mockReturnValue([]);
});

describe('isUnbreakableMajestyActive', () => {
  it('is true only for a strictly-true flag on the unbreakableMajestyActive key (campaign threaded)', () => {
    const cases = [
      [true, true],
      [false, false],
      [null, false],
      [undefined, false],
      ['true', false], // truthy strings must not arm the aura
      [1, false],
      [{ round: 1 }, false],
    ];
    for (const [stored, expected] of cases) {
      getRuntimeValue.mockReturnValue(stored);
      expect(isUnbreakableMajestyActive('Paladin', 'Campaign')).toBe(expected);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('Paladin', 'unbreakableMajestyActive', 'Campaign');
  });
});

describe('getUnbreakableMajestySaveDc', () => {
  it('reads unbreakableMajestySaveDc and coerces via Number(value || 0)', () => {
    const cases = [
      [15, 15],
      ['18', 18], // numeric strings accepted
      [0, 0],
      ['0', 0],
      [false, 0],
      [null, 0],
      [undefined, 0],
      ['', 0],
    ];
    for (const [stored, expected] of cases) {
      getRuntimeValue.mockReturnValue(stored);
      expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBe(expected);
    }
    // quirk, pinned honestly: no guard on garbage — NaN propagates to callers.
    getRuntimeValue.mockReturnValue('abc');
    expect(getUnbreakableMajestySaveDc('Paladin', 'Campaign')).toBeNaN();

    expect(getRuntimeValue).toHaveBeenCalledWith('Paladin', 'unbreakableMajestySaveDc', 'Campaign');
  });
});

describe('clearUnbreakableMajesty', () => {
  it('nulls both keys, exact envelopes in active-then-DC order, nothing else', () => {
    clearUnbreakableMajesty('Paladin', 'Campaign');

    expect(setRuntimeValue.mock.calls).toEqual([
      ['Paladin', 'unbreakableMajestyActive', null, 'Campaign'],
      ['Paladin', 'unbreakableMajestySaveDc', null, 'Campaign'],
    ]);
  });
});

describe('hasAttackerTriggeredMajesty', () => {
  it('is true only when the attacker\'s stamp round matches the campaign round', () => {
    fakeRuntimeStore({
      unbreakableMajestyBlocked_Goblin: { round: 3 }, // fresh stamp this round
      unbreakableMajestyBlocked_Orc: { round: 2 },    // stale stamp — re-armed
      unbreakableMajestyBlocked_Kobold: { other: 'data' }, // malformed stamp
    });
    getCurrentCombatRound.mockReturnValue(3);

    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true);
    expect(hasAttackerTriggeredMajesty('Paladin', 'Orc', 'Campaign')).toBe(false);
    expect(hasAttackerTriggeredMajesty('Paladin', 'Kobold', 'Campaign')).toBe(false);
    expect(hasAttackerTriggeredMajesty('Paladin', 'Troll', 'Campaign')).toBe(false); // never triggered
    expect(getCurrentCombatRound).toHaveBeenCalledWith('Campaign');
  });

  it('quirk: missing stamp passes the gate when current round is undefined (undefined === undefined)', () => {
    getCurrentCombatRound.mockReturnValue(undefined);
    getRuntimeValue.mockReturnValue(undefined);

    expect(hasAttackerTriggeredMajesty('Paladin', 'Goblin', 'Campaign')).toBe(true);
  });
});

describe('markAttackerTriggeredMajesty', () => {
  it('writes the per-attacker stamp with the round read at call time, exact envelope', () => {
    getCurrentCombatRound.mockReturnValue(7);

    markAttackerTriggeredMajesty('Paladin', 'Knight 1', 'Campaign');

    expect(setRuntimeValue.mock.calls).toEqual([
      ['Paladin', 'unbreakableMajestyBlocked_Knight 1', { round: 7 }, 'Campaign'],
    ]);
  });
});

describe('clearPerRoundMajestyTrackers', () => {
  it('clears every stamp whose round differs from current (past AND future), keeps current, skips nulls', () => {
    const store = fakeRuntimeStore({
      unbreakableMajestyBlocked_Past: { round: 3 },
      unbreakableMajestyBlocked_Current: { round: 4 },
      unbreakableMajestyBlocked_Older: { round: 2 },
      unbreakableMajestyBlocked_Future: { round: 9 }, // quirk: gate is !== not < — future clears too
      unbreakableMajestyBlocked_Null: null,           // already-empty: skipped
    });
    getRuntimeKeysByPrefix.mockReturnValue([
      'unbreakableMajestyBlocked_Past',
      'unbreakableMajestyBlocked_Current',
      'unbreakableMajestyBlocked_Older',
      'unbreakableMajestyBlocked_Future',
      'unbreakableMajestyBlocked_Null',
    ]);
    getCurrentCombatRound.mockReturnValue(4);

    clearPerRoundMajestyTrackers('Paladin', 'Campaign');

    // Fallback path: with no explicit round, must ask for the campaign-keyed round.
    expect(getRuntimeKeysByPrefix).toHaveBeenCalledWith('Paladin', 'unbreakableMajestyBlocked_');
    expect(getCurrentCombatRound).toHaveBeenCalledWith('Campaign');
    expect(store).toEqual({
      unbreakableMajestyBlocked_Past: null,
      unbreakableMajestyBlocked_Current: { round: 4 },
      unbreakableMajestyBlocked_Older: null,
      unbreakableMajestyBlocked_Future: null,
      unbreakableMajestyBlocked_Null: null,
    });
    // Exactly the three clears, campaign threaded — no writes for kept/null keys.
    expect(setRuntimeValue.mock.calls).toEqual([
      ['Paladin', 'unbreakableMajestyBlocked_Past', null, 'Campaign'],
      ['Paladin', 'unbreakableMajestyBlocked_Older', null, 'Campaign'],
      ['Paladin', 'unbreakableMajestyBlocked_Future', null, 'Campaign'],
    ]);
  });

  it('no tracked keys: reads prefix, writes nothing, never throws', () => {
    getCurrentCombatRound.mockReturnValue(1);

    expect(() => clearPerRoundMajestyTrackers('Paladin', 'Campaign')).not.toThrow();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('CLA-370 round-wrap re-arm: explicit roundToSet beats the lagging cache', () => {
    const store = fakeRuntimeStore();

    // Round 1: first hit stamps the tracker; re-hits stay gated.
    getCurrentCombatRound.mockReturnValue(1);
    markAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign');
    expect(hasAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign')).toBe(true);

    // Round-wrap seam: cache still lags at round 1 — caller passes roundToSet=2,
    // so the {round:1} stamp must clear even though it equals the cached round.
    getRuntimeKeysByPrefix.mockReturnValue(['unbreakableMajestyBlocked_Knight 1']);
    clearPerRoundMajestyTrackers('Bard', 'Campaign', 2);
    expect(store['unbreakableMajestyBlocked_Knight 1']).toBeNull();

    // Round 2: gate re-armed, prompt can fire again; stamp uses the real round.
    getCurrentCombatRound.mockReturnValue(2);
    expect(hasAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign')).toBe(false);
    markAttackerTriggeredMajesty('Bard', 'Knight 1', 'Campaign');
    expect(store['unbreakableMajestyBlocked_Knight 1']).toEqual({ round: 2 });
  });
});

describe('buildMajestyPromptData', () => {
  it('exact envelope: attacker is the CHA save target, defender is the source, DC passthrough', () => {
    expect(buildMajestyPromptData('Paladin', 'Goblin', 15)).toEqual({
      targetName: 'Goblin',
      saveType: 'CHA',
      saveDc: 15,
      sourceName: 'Paladin',
    });
  });
});
