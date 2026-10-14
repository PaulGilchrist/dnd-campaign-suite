import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
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
    abilities: [{ name: 'Charisma', score: 16, bonus: 3 }],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Encouraging Song',
    automation: {
      type: 'heroic_inspiration_buff',
      effect: 'heroic_inspiration',
      uses_expression: '1',
      usesMax: 1,
      recharge: 'short_or_long_rest',
      casting_time: 'passive',
      buffExpression: 'heroic_inspiration',
      targetsExpression: 'proficiency_bonus',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('encouragingSongHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Modal return ────────────────────────────────────────────

  describe('handle returns target selection modal', () => {
    it('should return a modal with creature targets from combat context', async () => {
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
      expect(result.payload.maxTargets).toBe(3); // proficiency bonus
      expect(result.payload.creatureTargets.length).toBe(4); // includes self
      expect(result.payload.creatureTargets.map(c => c.name)).toEqual(['Bard', 'Ally1', 'Ally2', 'Enemy1']);
    });

    it('should include all creatures in targets', async () => {
      combatData.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Bard', type: 'player', currentHp: 20, maxHp: 20 },
        ],
      });

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.payload.creatureTargets.length).toBe(1);
    });

    it('should return empty creature targets when combat context has no creatures', async () => {
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should return empty creature targets when getCombatContext returns null', async () => {
      combatData.getCombatContext.mockResolvedValue(null);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should default missing creature properties', async () => {
      combatData.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Bard' },
          { name: 'Ally1', type: 'player' },
          { name: 'Ally2', currentHp: 10, maxHp: 20 },
        ],
      });

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.payload.creatureTargets[0]).toEqual({
        name: 'Bard',
        type: 'player',
        currentHp: 0,
        maxHp: 0,
      });
      expect(result.payload.creatureTargets[1]).toEqual({
        name: 'Ally1',
        type: 'player',
        currentHp: 0,
        maxHp: 0,
      });
      expect(result.payload.creatureTargets[2]).toEqual({
        name: 'Ally2',
        type: 'player',
        currentHp: 10,
        maxHp: 20,
      });
    });
  });

  // ── Uses tracking (handle) ──────────────────────────────────

  describe('handle uses check', () => {
    it('should return popup when no uses remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('cannot be used again');
    });

    it('should return modal when uses are available', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('encouragingSongTarget');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return modal when maxUses is 0 (unlimited uses)', async () => {
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const action = makeAction({ usesMax: 0 });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('encouragingSongTarget');
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should default to maxUses when runtime value is null', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(null);
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const action = makeAction({ usesMax: 3 });
      const ps = makePlayerStats();

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('modal');
      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses');
    });

    it('should use custom resourceKey when provided in automation', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);
      combatData.getCombatContext.mockResolvedValue({ creatures: [] });

      const action = makeAction({ resourceKey: 'customSongUses' });
      const ps = makePlayerStats();

      await handle(action, ps, campaignName);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses');
    });
  });

  // ── Confirm ─────────────────────────────────────────────────

  describe('confirmEncouragingSong', () => {
    it('should decrement uses and set hasInspiration on targets', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();
      const selectedTargets = ['Ally1', 'Ally2'];

      const result = await confirmEncouragingSong(action, ps, campaignName, selectedTargets);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'encouragingsongUses', 0, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'hasInspiration', true, campaignName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('2 allies');
    });

    it('should limit targets to proficiency bonus', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();
      const selectedTargets = ['Ally1', 'Ally2', 'Ally3', 'Ally4', 'Ally5'];

      const result = await confirmEncouragingSong(action, ps, campaignName, selectedTargets);

      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally2', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally3', 'hasInspiration', true, campaignName);
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Ally4', 'hasInspiration', true, campaignName);
      expect(result.payload.description).toContain('3 allies');
    });

    it('should return error popup when no uses remaining', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, ['Ally1']);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('cannot be used again');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should skip uses check when maxUses is 0 (unlimited)', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(0);

      const action = makeAction({ usesMax: 0 });
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, ['Ally1']);

      expect(runtimeState.getRuntimeValue).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Ally1', 'hasInspiration', true, campaignName);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('1 ally');
    });

    it('should handle empty selected targets array', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, []);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 allies');
    });

    it('should handle undefined selected targets', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, undefined);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 allies');
    });

    it('should use custom resourceKey when provided in automation', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction({ resourceKey: 'customSongUses' });
      const ps = makePlayerStats();

      await confirmEncouragingSong(action, ps, campaignName, ['Ally1']);

      expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses');
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Bard', 'customSongUses', 0, campaignName);
    });

    it('should log to campaign log', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();

      await confirmEncouragingSong(action, ps, campaignName, ['Ally1', 'Ally2']);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
      }));
    });

    it('should return popup with correct payload structure', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, ['Ally1']);

      expect(result.payload).toEqual(expect.objectContaining({
        type: 'automation_info',
        name: 'Encouraging Song',
        automationType: 'heroic_inspiration_buff',
      }));
      expect(result.payload.description).toContain('1 ally');
      expect(result.payload.automation).toEqual(action.automation);
    });

    it('should use singular "ally" when exactly one target', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, ['Ally1']);

      expect(result.payload.description).toContain('1 ally');
      expect(result.payload.description).not.toContain('1 allies');
    });

    it('should use plural "allies" when more than one target', async () => {
      runtimeState.getRuntimeValue.mockReturnValue(1);

      const action = makeAction();
      const ps = makePlayerStats();

      const result = await confirmEncouragingSong(action, ps, campaignName, ['Ally1', 'Ally2']);

      expect(result.payload.description).toContain('2 allies');
    });
  });

  // ── Skip ────────────────────────────────────────────────────

  describe('skipEncouragingSong', () => {
    it('should log skip and return popup without consuming uses', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      const result = await skipEncouragingSong(action, ps, campaignName);

      expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'ability_use',
        characterName: 'Bard',
        abilityName: 'Encouraging Song',
        description: expect.stringContaining('skipped'),
      }));
      expect(result.type).toBe('popup');
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('should return popup with correct payload structure', async () => {
      const action = makeAction();
      const ps = makePlayerStats();

      const result = await skipEncouragingSong(action, ps, campaignName);

      expect(result.payload).toEqual(expect.objectContaining({
        type: 'automation_info',
        name: 'Encouraging Song',
        automationType: 'heroic_inspiration_buff',
      }));
      expect(result.payload.description).toBe('Encouraging Song: No allies selected.');
      expect(result.payload.automation).toEqual(action.automation);
    });
  });
});
