// @maintained-by-ai 2026-11-26
// Deterministic unit tests for the manually-triggered undying sentinel handler
// (heal a willing target at 0 HP). Fully mocked; the separate applyDamage.js
// auto-trigger path is covered by applyDamage.undyingSentinel.test.js and the
// Long-Rest latch re-arm by restRules-longRest.js (:756 batch write) — neither
// is re-driven here. Dead exports isUndyingSentinelUsed/setUndyingSentinelUsed
// have zero callers repo-wide (grep 2026-11-26) so they are untested by design.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { handle } from './undyingSentinelHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import storage from '../../../ui/storage.js';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'TestCleric';
const targetName = 'DownedAlly';
const FROZEN_NOW = 1700000000000;
const AUTO = { type: 'undying_sentinel' };

function makePlayerStats(level = 5) {
  return {
    name: playerName,
    level,
    class: { class_levels: [{ level }] },
  };
}

function makeAction() {
  return { name: 'Undying Sentinel', automation: AUTO };
}

// Runtime-store router over the three keys the handler reads: the once-per-
// long-rest latch, the player target's current HP bucket, and the max-HP
// frame (the handler reads the SAME 'hitPoints' key for the caster-side heal
// cap and the target-side audit row, so one value answers both).
function mockStore({ used = false, currentHp = 0, maxHp = 50 } = {}) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'undyingSentinelUsed') return used;
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'hitPoints') return maxHp;
    return null;
  });
}

// Full-shape popup pin: every return carries name + the action's automation.
function popup(description) {
  return {
    type: 'popup',
    payload: { type: 'automation_info', name: 'Undying Sentinel', description, automation: AUTO },
  };
}

// ── beforeEach / afterEach ───────────────────────────────────────

let dispatchEventSpy;
let dateNowSpy;

beforeEach(() => {
  vi.clearAllMocks();
  dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
  dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
});

afterEach(() => {
  dispatchEventSpy.mockRestore();
  dateNowSpy.mockRestore();
});

// ── Tests ────────────────────────────────────────────────────────

describe('undyingSentinelHandler', () => {
  describe('handle — guard refusals (zero spend)', () => {
    // Each guard face: exact full-shape popup and a zero-write census — no
    // runtime write, no storage save, no log row, no refresh event.
    it.each([
      {
        title: 'refuses when the once-per-long-rest latch is set, before any combat read',
        store: { used: true },
        combat: undefined,
        stopsBeforeCombat: true,
        description: 'Undying Sentinel has already been used (once per long rest).',
      },
      {
        title: 'refuses when no combat is active',
        store: {},
        combat: null,
        description: 'No combat active.',
      },
      {
        title: 'refuses when no target is selected in combat',
        store: {},
        combat: {},
        target: null,
        description: 'Select a target in the combat tracker first.',
      },
      {
        title: 'refuses a target above 0 HP',
        store: { currentHp: 5 },
        combat: {},
        target: { name: targetName, type: 'player', currentHitPoints: 5 },
        description: 'DownedAlly is not at 0 Hit Points.',
      },
    ])('$title', async (tc) => {
      mockStore(tc.store);
      if (tc.combat !== undefined) getCombatContext.mockResolvedValue(tc.combat);
      if ('target' in tc) getTargetFromAttacker.mockReturnValue(tc.target);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual(popup(tc.description));
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
      if (tc.stopsBeforeCombat) {
        expect(getCombatContext).not.toHaveBeenCalled();
      }
    });
  });

  describe('handle — successful heal — player target', () => {
    // The commit contract in one table: latch write BEFORE the HP write
    // (source order), the 1 + 3xLevel heal scaled and capped at the stored
    // max, one combat-summary-updated event, and the full hp_change-family
    // audit row (2026-11-14 resurrection log-family split: the 0-HP rescue
    // rides hp_change, not the type:'healing' outlier).
    it.each([
      { title: 'heals at level 5 and expends the latch', level: 5, maxHp: 50, newHp: 16 },
      { title: 'scales the heal with level (7 -> 1 + 21)', level: 7, maxHp: 100, newHp: 22 },
      { title: 'caps the heal at the target maximum HP', level: 5, maxHp: 10, newHp: 10 },
    ])('$title', async (tc) => {
      mockStore({ used: false, currentHp: 0, maxHp: tc.maxHp });
      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({
        name: targetName,
        type: 'player',
        currentHitPoints: 0,
      });

      const result = await handle(makeAction(), makePlayerStats(tc.level), campaignName, null);

      expect(result).toEqual(popup(
        `${playerName} uses Undying Sentinel to survive! ${targetName} drops to ${tc.newHp} HP and the effect is expended until a long rest.`,
      ));
      expect(getCombatContext).toHaveBeenCalledTimes(1);
      expect(getCombatContext).toHaveBeenCalledWith(campaignName);
      expect(getTargetFromAttacker).toHaveBeenCalledWith({}, playerName);
      // Ordered commit census: exactly two writes, latch first.
      expect(setRuntimeValue.mock.calls).toEqual([
        [playerName, 'undyingSentinelUsed', true, campaignName],
        [targetName, 'currentHitPoints', tc.newHp, campaignName],
      ]);
      expect(storage.set).not.toHaveBeenCalled();
      expect(dispatchEventSpy.mock.calls.map(([e]) => e.type)).toEqual(['combat-summary-updated']);
      expect(addEntry).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName,
        delta: tc.newHp,
        currentHp: tc.newHp,
        maxHp: tc.maxHp,
        isHealing: true,
        sourceName: playerName,
        note: 'Undying Sentinel',
        timestamp: FROZEN_NOW,
      });
    });
  });

  describe('handle — successful heal — NPC target', () => {
    it('mutates currentHp on the combat-summary row and persists it via storage', async () => {
      const target = { name: 'Goblin', type: 'npc', currentHp: 0, maxHp: 7 };
      const cs = { creatures: [target] };
      mockStore({ used: false, maxHp: 50 });
      getCombatContext.mockResolvedValue(cs);
      getTargetFromAttacker.mockReturnValue(target);

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

      expect(result).toEqual(popup(
        `${playerName} uses Undying Sentinel to survive! Goblin drops to 16 HP and the effect is expended until a long rest.`,
      ));
      // NPC census: the latch is the ONLY runtime write — the HP lift lands
      // on the combat-summary object, never a currentHitPoints bucket.
      expect(setRuntimeValue.mock.calls).toEqual([
        [playerName, 'undyingSentinelUsed', true, campaignName],
      ]);
      expect(target.currentHp).toBe(16);
      expect(storage.set.mock.calls).toEqual([['combatSummary', cs, campaignName]]);
      expect(dispatchEventSpy.mock.calls.map(([e]) => e.type)).toEqual(['combat-summary-updated']);
      expect(addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        characterName: playerName,
        targetName: 'Goblin',
        delta: 16,
        currentHp: 16,
        maxHp: 7,
        isHealing: true,
        sourceName: playerName,
        note: 'Undying Sentinel',
        timestamp: FROZEN_NOW,
      });
    });

    it('logs to console when addEntry rejects and still commits the heal', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();
      addEntry.mockRejectedValue(new Error('log failure'));
      mockStore({ used: false, currentHp: 0, maxHp: 50 });
      getCombatContext.mockResolvedValue({});
      getTargetFromAttacker.mockReturnValue({ name: targetName, type: 'player', currentHitPoints: 0 });

      const result = await handle(makeAction(), makePlayerStats(), campaignName, null);
      // Drain the addEntry(...).catch(console.error) microtask.
      await Promise.resolve();

      expect(result.payload.description).toContain('survive');
      expect(setRuntimeValue).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[undyingSentinel] Error:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
