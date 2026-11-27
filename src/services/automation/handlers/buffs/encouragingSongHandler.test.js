// @maintained-by-ai 2026-11-26
// Deterministic contract tests for the Encouraging Song buff handler: pure async
// logic with all side-effecting dependencies (runtime store, log, combat context)
// mocked. Stable behaviour — no churn expected as the app evolves.
// NOTE (family divergence, pinned honestly): like buffHandler's tracked-uses refusal
// (buffHandler.js:521-532), this handler's exhaustion refusal popups do NOT log to
// the campaign log — the zero-write censuses below pin that, vs. every-automation-logs.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, confirmEncouragingSong, skipEncouragingSong } from './encouragingSongHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

const EXHAUSTED_DESCRIPTION =
  'Encouraging Song has been used and cannot be used again until a short or long rest.';

function makePlayerStats(overrides = {}) {
  return {
    name: 'Bard',
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Encouraging Song',
    automation: {
      type: 'heroic_inspiration_buff',
      usesMax: 1,
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('encouragingSongHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── handle: target selection modal ─────────────────────────

  describe('handle: target selection modal', () => {
    it('returns the full modal payload: derived maxTargets plus normalized creature targets, consuming nothing pre-confirm', async () => {
      combatData.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Bard' }, // missing type/hp → defaults filled
          { name: 'Ally2', type: 'player', currentHp: 10, maxHp: 20 },
          { name: 'Enemy1', type: 'creature', currentHp: 8, maxHp: 12 },
        ],
      });

      const action = makeAction();
      const ps = makePlayerStats();
      const result = await handle(action, ps, campaignName);

      expect(result).toEqual({
        type: 'modal',
        modalName: 'encouragingSongTarget',
        payload: {
          action,
          playerStats: ps,
          campaignName,
          creatureTargets: [
            { name: 'Bard', type: 'player', currentHp: 0, maxHp: 0 },
            { name: 'Ally2', type: 'player', currentHp: 10, maxHp: 20 },
            { name: 'Enemy1', type: 'creature', currentHp: 8, maxHp: 12 },
          ],
          maxTargets: 3, // proficiency bonus
        },
      });
      // handle() must not consume resources or log before confirmation
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('returns an empty creature-target list for an empty creature list or missing combat context', async () => {
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      let result = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);

      combatData.getCombatContext.mockResolvedValue(null);

      result = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });
  });

  // ── uses gating and resource keys ──────────────────────────

  describe('uses gating and resource keys', () => {
    it.each([
      ['handle (before the modal opens)', (action, ps) => handle(action, ps, campaignName)],
      ['confirm (re-check at commit)', (action, ps) => confirmEncouragingSong(action, ps, campaignName, ['Ally1'])],
    ])('%s: with no uses remaining, returns the exhausted popup (no automationType key) and neither writes nor logs', async (_label, invoke) => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const action = makeAction();
      const result = await invoke(action, makePlayerStats());

      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Encouraging Song',
          description: EXHAUSTED_DESCRIPTION,
          automation: action.automation,
        },
      });
      // Zero-write census: refusal latches nothing, grants nothing, logs nothing
      // (family divergence: buffHandler.js:521-532 refusal also skips the log).
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
      expect(combatData.getCombatContext).not.toHaveBeenCalled();
    });

    it('treats usesMax 0 as unlimited in handle (still reads the derived key, opens the modal, writes nothing)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const result = await handle(makeAction({ usesMax: 0 }), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingSongUses');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(logService.addEntry).not.toHaveBeenCalled();
    });

    it('skips the uses read and decrement in confirm when usesMax is 0, and phrases a single grant as "1 ally"', async () => {
      const result = await confirmEncouragingSong(
        makeAction({ usesMax: 0 }), makePlayerStats(), campaignName, ['Ally1']);

      expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
      // Only the inspiration grant — no uses latch written for an unlimited feature.
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['Ally1', 'hasInspiration', true, campaignName],
      ]);
      expect(result.payload.description).toBe(
        'Encouraging Song: Granted Heroic Inspiration to 1 ally (Ally1).');
    });

    it('routes a custom resourceKey through handle (read-only) and confirm (read + decrement)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const action = makeAction({ resourceKey: 'customSongUses' });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName);
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

      await confirmEncouragingSong(action, ps, campaignName, ['Ally1']);
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['Bard', 'customSongUses', 0, campaignName],
        ['Ally1', 'hasInspiration', true, campaignName],
      ]);
    });
  });

  // ── confirmEncouragingSong ─────────────────────────────────

  describe('confirmEncouragingSong', () => {
    it('decrements uses, grants inspiration in target order, returns the full popup, and logs the exact entry', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const result = await confirmEncouragingSong(action, makePlayerStats(), campaignName, ['Ally1', 'Ally2']);

      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['Bard', 'encouragingSongUses', 0, campaignName],
        ['Ally1', 'hasInspiration', true, campaignName],
        ['Ally2', 'hasInspiration', true, campaignName],
      ]);
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Encouraging Song',
          automationType: 'heroic_inspiration_buff',
          description: 'Encouraging Song: Granted Heroic Inspiration to 2 allies (Ally1, Ally2).',
          automation: action.automation,
        },
      });
      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
        description: 'Bard used Encouraging Song to grant Heroic Inspiration to 2 allies: Ally1, Ally2.',
        timestamp: expect.any(Number),
      });
    });

    it('caps grants at proficiency bonus: first three targets latched, later ones untouched', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const result = await confirmEncouragingSong(
        makeAction(), makePlayerStats(), campaignName, ['Ally1', 'Ally2', 'Ally3', 'Ally4', 'Ally5']);

      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['Bard', 'encouragingSongUses', 0, campaignName],
        ['Ally1', 'hasInspiration', true, campaignName],
        ['Ally2', 'hasInspiration', true, campaignName],
        ['Ally3', 'hasInspiration', true, campaignName],
      ]);
      expect(result.payload.description).toBe(
        'Encouraging Song: Granted Heroic Inspiration to 3 allies (Ally1, Ally2, Ally3).');
    });

    it.each([
      ['empty array', []],
      ['undefined', undefined],
    ])('a confirm with %s selected targets still consumes a use and grants nothing', async (_label, selected) => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const result = await confirmEncouragingSong(makeAction(), makePlayerStats(), campaignName, selected);

      // The uses latch fires before target processing — an empty commit is not free.
      expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        ['Bard', 'encouragingSongUses', 0, campaignName],
      ]);
      expect(result.payload.description).toBe(
        'Encouraging Song: Granted Heroic Inspiration to 0 allies (no targets selected).');
    });
  });

  // ── skipEncouragingSong ────────────────────────────────────

  describe('skipEncouragingSong', () => {
    it('logs the skip with the exact entry, returns the full info popup, and consumes nothing', async () => {
      const action = makeAction();

      const result = await skipEncouragingSong(action, makePlayerStats(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
        description: 'Bard skipped using Encouraging Song.',
        timestamp: expect.any(Number),
      });
      expect(result).toEqual({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Encouraging Song',
          automationType: 'heroic_inspiration_buff',
          description: 'Encouraging Song: No allies selected.',
          automation: action.automation,
        },
      });
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
