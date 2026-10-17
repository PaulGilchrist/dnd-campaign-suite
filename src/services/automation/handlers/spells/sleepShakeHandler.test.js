// @maintained-by-ai
/**
 * sleepShakeHandler.test.js — #1959 (main) — family quad #1957–#1959 CLOSED 2026-10-16
 * (seam map in sleepHandler.test.js header; handoff from #1958 executed here)
 *
 * Own lane: sleepShakeHandler.js handle(action, playerStats, campaignName, mapName)
 * — the POPUP branches (no context / no creatures / only caster) plus the MAP-WIRED
 * isWithinRange seam, which deliberately lives ONLY here — this file is the family's
 * unique map-seam home, kept strong with exact-call pins. Every call below passes 4 args
 * (arity pinned: handle is 4-param at source). makeAction MERGES automation overrides
 * (never replaces) — fixture convention.
 *
 * #1958 HANDOFF EXECUTED (closed 12→11, owner is #1958): this file SHEDS the three
 * filter-rule restatements — 'prefers sleep targets (incapacitated/unconscious) over
 * eligible targets', 'falls back to eligible targets when no sleep targets exist',
 * 'skips caster from eligible targets'. They are pinned exactly in
 * sleepShakeHandler.target-selection.test.js with the disjoint player/monster condition
 * sources and the full modal payload contract. This file no longer restates them; the
 * map fixtures below exercise no-sleep-target contexts and pin range wiring, not filters.
 *
 * CLOSED LANES (do not re-absorb):
 * - #1957 sleepShakeHandler.confirm.test.js owns handleConfirm — auto-success mechanics
 *   (no save/dice/RNG), UI-unreachable flag, player/monster log-asymmetry pins.
 *   handleConfirm is not imported here.
 * - #1958 owns handle() filter rules + full-shape modal payload contract; modal payload
 *   assertions below stay targets-focused (map outcome), never full-contract.
 *
 * LANE LIVENESS (verified honestly 2026-10-16): PENDING-WIRING whole family.
 * - index.js imports handle ONLY (:227); 'sleep_shake' dispatch key registered at :533;
 *   grep across public/ data and src/ finds ZERO producers of type sleep_shake.
 * - modalName 'sleepShake' is NOT in useCharActionsAutomation.js modalMap (:281+)
 *   → even a wired producer's modal result would be silently dropped.
 * - Manifest SP-107 gap; SaveAttackAoeModal.jsx:740: shake-awake stays GM-enforced.
 * Kept as contract-preservation (grease #1922 precedent) so the map-wired selection seam
 * is executable the moment a producer AND a modal are wired.
 *
 * No timers / no writes on this path: handle() is pure selection — setRuntimeValue and
 * addEntry no-side-effect guards keep writes in #1957's confirm lane.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveMapPositions: vi.fn(),
}));

import { handle } from './sleepShakeHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { resolveMapPositions } from '../../common/targetResolver.js';

const campaignName = 'TestCampaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    ...overrides,
  };
}

function makeAction(automation = {}, name = 'Shake Asleep') {
  return {
    name,
    automation: {
      type: 'sleep_shake',
      range: '5 ft',
      ...automation,
    },
  };
}

const caster = { name: 'TestCaster', gridX: 5, gridY: 10 };

const cast = (action = makeAction(), map = null) =>
  handle(action, makePlayerStats(), campaignName, map);

function ctxOf(creatures, players = [{ name: 'TestCaster', gridX: 5, gridY: 10 }]) {
  return { creatures, players, placedItems: [] };
}

describe('sleepShakeHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('popup branches', () => {
    it('returns popup with the exact payload when no combat context exists, touching nothing', async () => {
      getCombatContext.mockResolvedValue(null);

      const result = await cast();

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Shake Asleep',
          description: 'No combat context found.',
          automation: { type: 'sleep_shake', range: '5 ft' },
        },
      });
      // pure-selection guard: popup early-return touches no map, range, runtime, or log surface
      expect(resolveMapPositions).not.toHaveBeenCalled();
      expect(isWithinRange).not.toHaveBeenCalled();
      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns popup when combat context has no creatures', async () => {
      getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await cast();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No eligible targets within range.');
      expect(isWithinRange).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup with no eligible targets when only caster exists', async () => {
      getCombatContext.mockResolvedValue(ctxOf([caster]));

      const result = await cast();

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No eligible targets within range.');
      // null mapName → positions null → the isWithinRange gate stays closed (map seam = here);
      // null-map modal selection is #1958's lane, pinned there via cast(..., null)
      expect(resolveMapPositions).not.toHaveBeenCalled();
      expect(isWithinRange).not.toHaveBeenCalled();
      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('target selection — with map (isWithinRange seam, owned here)', () => {
    it('filters eligible targets by range when map positions are available', async () => {
      getCombatContext.mockResolvedValue(ctxOf([
        { name: 'Goblin', type: 'monster' },
        { name: 'Orc', type: 'monster' },
        caster,
      ]));
      isWithinRange.mockImplementation(async (_src, tgt) => tgt === 'Goblin');
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 5, gridY: 10 },
        mapData: {
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [
            { name: 'Goblin', gridX: 6, gridY: 10 },
            { name: 'Orc', gridX: 8, gridY: 10 },
          ],
        },
      });

      const result = await cast(makeAction(), mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.targets).toEqual(['Goblin']);
      // exact-key pins: map resolved once under (campaign, map, caster), BEFORE the ctx fetch
      expect(resolveMapPositions).toHaveBeenCalledTimes(1);
      expect(resolveMapPositions).toHaveBeenCalledWith(campaignName, mapName, 'TestCaster');
      expect(resolveMapPositions.mock.invocationCallOrder[0])
        .toBeLessThan(getCombatContext.mock.invocationCallOrder[0]);
      // every non-caster creature is range-checked at the parsed 5 ft; the caster never is
      expect(isWithinRange.mock.calls.map(c => c.slice(0, 3))).toEqual([
        ['TestCaster', 'Goblin', 5],
        ['TestCaster', 'Orc', 5],
      ]);
    });

    it('looks up target positions from placedItems on map', async () => {
      getCombatContext.mockResolvedValue(ctxOf([
        { name: 'Goblin', type: 'monster' },
        { name: 'Orc', type: 'monster' },
        caster,
      ]));
      isWithinRange.mockResolvedValue(true);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 5, gridY: 10 },
        mapData: {
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [{ name: 'Goblin', gridX: 6, gridY: 10 }],
        },
      });

      const result = await cast(makeAction(), mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      // wiring contract: names are handed to isWithinRange; position lookup is its own (foreign)
      expect(isWithinRange).toHaveBeenCalledWith('TestCaster', 'Goblin', 5);
      expect(isWithinRange).toHaveBeenCalledWith('TestCaster', 'Orc', 5);
    });

    it('looks up target positions from players on map', async () => {
      getCombatContext.mockResolvedValue(ctxOf(
        [
          { name: 'AllyPlayer', type: 'player' },
          { name: 'Orc', type: 'monster' },
          caster,
        ],
        [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
      ));
      isWithinRange.mockResolvedValue(true);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 5, gridY: 10 },
        mapData: {
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }, { name: 'AllyPlayer', gridX: 6, gridY: 10 }],
          placedItems: [],
        },
      });

      const result = await cast(makeAction(), mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.targets).toEqual(['AllyPlayer', 'Orc']);
      // player creatures are range-checked exactly like monsters — no positional immunity
      expect(isWithinRange).toHaveBeenCalledWith('TestCaster', 'AllyPlayer', 5);
      expect(isWithinRange).toHaveBeenCalledWith('TestCaster', 'Orc', 5);
    });

    it('skips distance check when target has no position data', async () => {
      getCombatContext.mockResolvedValue(ctxOf([
        { name: 'Goblin', type: 'monster' },
        { name: 'Orc', type: 'monster' },
        caster,
      ]));
      isWithinRange.mockResolvedValue(true);
      resolveMapPositions.mockResolvedValue({
        attackerPos: { gridX: 5, gridY: 10 },
        mapData: {
          players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
          placedItems: [],
        },
      });

      const result = await cast(makeAction(), mapName);

      expect(result.type).toBe('modal');
      expect(result.payload.targets).toEqual(['Goblin', 'Orc']);
      // handler still delegates both unpositioned names to isWithinRange — the skip itself
      // lives inside the real isWithinRange (foreign); wiring keeps the call, range 5 ft intact
      expect(isWithinRange).toHaveBeenCalledTimes(2);
    });
  });
});
