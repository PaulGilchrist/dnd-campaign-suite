// @maintained-by-ai
// Deterministic contract tests for the Encouraging Song buff handler: pure async
// logic with all side-effecting dependencies (runtime store, log, combat context)
// mocked. Stable behaviour — no churn expected as the app evolves.

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

  describe('handle returns target selection modal', () => {
    it('should return a modal with creature targets and maxTargets from proficiency bonus', async () => {
      combatData.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Bard', type: 'player', currentHp: 20, maxHp: 20 },
          { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 20 },
          { name: 'Ally2', type: 'player', currentHp: 10, maxHp: 20 },
          { name: 'Enemy1', type: 'creature', currentHp: 8, maxHp: 12 },
        ],
      });

      const action = makeAction();
      const ps = makePlayerStats();
      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('encouragingSongTarget');
      expect(result.payload.action).toBe(action);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.maxTargets).toBe(3); // proficiency bonus
      expect(result.payload.creatureTargets.map(c => c.name)).toEqual(['Bard', 'Ally1', 'Ally2', 'Enemy1']);
      // handle() must not consume resources before confirmation
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return empty creature targets when there are no creatures or no combat context', async () => {
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      let result = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);

      combatData.getCombatContext.mockResolvedValue(null);

      result = await handle(makeAction(), makePlayerStats(), campaignName);
      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should default missing creature properties', async () => {
      combatData.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Bard' },
          { name: 'Ally2', currentHp: 10, maxHp: 20 },
        ],
      });

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.payload.creatureTargets).toEqual([
        { name: 'Bard', type: 'player', currentHp: 0, maxHp: 0 },
        { name: 'Ally2', type: 'player', currentHp: 10, maxHp: 20 },
      ]);
    });
  });

  // ── handle: uses check ─────────────────────────────────────

  describe('handle uses check', () => {
    it('should return popup when no uses remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction(), makePlayerStats(), campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('cannot be used again');
      expect(combatData.getCombatContext).not.toHaveBeenCalled();
    });

    it('should treat usesMax 0 as unlimited and read the derived uses key', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(makeAction({ usesMax: 0 }), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should use custom resourceKey when provided in automation', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const result = await handle(makeAction({ resourceKey: 'customSongUses' }), makePlayerStats(), campaignName);

      expect(result.type).toBe('modal');
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses');
    });
  });

  // ── confirmEncouragingSong ─────────────────────────────────

  describe('confirmEncouragingSong', () => {
    it('should decrement uses, grant inspiration to selected allies, and return info popup', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const result = await confirmEncouragingSong(action, makePlayerStats(), campaignName, ['Ally1', 'Ally2']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses', 0, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'hasInspiration', true, campaignName);
      expect(result.type).toBe('popup');
      expect(result.payload).toEqual(expect.objectContaining({
        type: 'automation_info',
        name: 'Encouraging Song',
        automationType: 'heroic_inspiration_buff',
      }));
      expect(result.payload.description).toContain('2 allies');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should limit targets to proficiency bonus', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const result = await confirmEncouragingSong(
        makeAction(), makePlayerStats(), campaignName, ['Ally1', 'Ally2', 'Ally3', 'Ally4', 'Ally5']);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally3', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Ally4', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Ally5', 'hasInspiration', true, campaignName);
      expect(result.payload.description).toContain('3 allies');
    });

    it('should return error popup when no uses remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await confirmEncouragingSong(makeAction(), makePlayerStats(), campaignName, ['Ally1']);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should skip uses check when maxUses is 0 (unlimited) and use singular "ally"', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const result = await confirmEncouragingSong(makeAction({ usesMax: 0 }), makePlayerStats(), campaignName, ['Ally1']);

      expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1 ally');
      expect(result.payload.description).not.toContain('1 allies');
    });

    it('should handle empty or undefined selected targets', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      const ps = makePlayerStats();

      let result = await confirmEncouragingSong(makeAction(), ps, campaignName, []);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 allies');

      result = await confirmEncouragingSong(makeAction(), ps, campaignName, undefined);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 allies');
    });

    it('should read and decrement the custom resourceKey when provided', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      await confirmEncouragingSong(makeAction({ resourceKey: 'customSongUses' }), makePlayerStats(), campaignName, ['Ally1']);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses', 0, campaignName);
    });

    it('should log to campaign log', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      await confirmEncouragingSong(makeAction(), makePlayerStats(), campaignName, ['Ally1', 'Ally2']);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
      }));
    });
  });

  // ── skipEncouragingSong ────────────────────────────────────

  describe('skipEncouragingSong', () => {
    it('should log skip, return info popup, and consume no uses', async () => {
      const action = makeAction();

      const result = await skipEncouragingSong(action, makePlayerStats(), campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
        description: expect.stringContaining('skipped'),
      }));
      expect(result.type).toBe('popup');
      expect(result.payload).toEqual(expect.objectContaining({
        type: 'automation_info',
        name: 'Encouraging Song',
        automationType: 'heroic_inspiration_buff',
      }));
      expect(result.payload.description).toBe('Encouraging Song: No allies selected.');
      expect(result.payload.automation).toEqual(action.automation);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
