// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks ---

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('./logPoster.js', () => ({
  postLogEntry: vi.fn(() => Promise.resolve()),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { postLogEntry } from './logPoster.js';
import { modifyHitPoints } from './hpModifier.js';

const campaignName = 'TestCampaign';

// --- helpers ---

function makeCombatSummary(creatures) {
  return { creatures };
}

// --- tests ---

describe('modifyHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns', () => {
    it('returns null when combatSummary is null', () => {
      expect(modifyHitPoints(null, 'Goblin', 5, campaignName)).toBeNull();
    });

    it('returns null when combatSummary is undefined', () => {
      expect(modifyHitPoints(undefined, 'Goblin', 5, campaignName)).toBeNull();
    });

    it('returns null when combatSummary has no creatures array', () => {
      expect(modifyHitPoints({}, 'Goblin', 5, campaignName)).toBeNull();
    });

    it('returns null when combatSummary has an empty creatures array', () => {
      expect(modifyHitPoints(makeCombatSummary([]), 'Goblin', 5, campaignName)).toBeNull();
    });

    it('returns null when creature is not found by name', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);
      expect(modifyHitPoints(summary, 'Dragon', 5, campaignName)).toBeNull();
    });
  });

  describe('NPC creatures', () => {
    it('decreases HP and clamps to 0', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 3, maxHp: 7 },
      ]);

      const result = modifyHitPoints(summary, 'Goblin', -5, campaignName);

      expect(result).toEqual({
        oldHp: 3,
        newHp: 0,
        delta: -3,
        isPlayer: false,
        creature: expect.objectContaining({ name: 'Goblin' }),
        maxHp: 7,
      });
      expect(result.creature.currentHp).toBe(0);
    });

    it('decreases HP without clamping when within range', () => {
      const summary = makeCombatSummary([
        { name: 'Orc', type: 'npc', currentHp: 10, maxHp: 15 },
      ]);

      const result = modifyHitPoints(summary, 'Orc', -4, campaignName);

      expect(result).toEqual({
        oldHp: 10,
        newHp: 6,
        delta: -4,
        isPlayer: false,
        creature: expect.objectContaining({ name: 'Orc' }),
        maxHp: 15,
      });
      expect(result.creature.currentHp).toBe(6);
    });

    it('increases HP and clamps to maxHp', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 3, maxHp: 7 },
      ]);

      const result = modifyHitPoints(summary, 'Goblin', 10, campaignName);

      expect(result).toEqual({
        oldHp: 3,
        newHp: 7,
        delta: 4,
        isPlayer: false,
        creature: expect.objectContaining({ name: 'Goblin' }),
        maxHp: 7,
      });
      expect(result.creature.currentHp).toBe(7);
    });

    it('leaves HP unchanged when delta is 0', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      const result = modifyHitPoints(summary, 'Goblin', 0, campaignName);

      expect(result).toEqual({
        oldHp: 5,
        newHp: 5,
        delta: 0,
        isPlayer: false,
        creature: expect.objectContaining({ name: 'Goblin' }),
        maxHp: 7,
      });
      expect(result.creature.currentHp).toBe(5);
    });

    it('does not call postLogEntry when delta is 0', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', 0, campaignName);

      expect(postLogEntry).not.toHaveBeenCalled();
    });

    it('mutates the original creature object in the combatSummary', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', -2, campaignName);

      expect(summary.creatures[0].currentHp).toBe(3);
    });
  });

  describe('Player creatures', () => {
    function mockPlayerRuntime(maxHp, currentHp) {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return maxHp;
        if (prop === 'currentHitPoints') return currentHp;
        return null;
      });
    }

    it('reads maxHp and currentHp from runtime store', () => {
      mockPlayerRuntime(20, 15);

      const summary = makeCombatSummary([
        { name: 'Thorin', type: 'player', maxHp: 10 },
      ]);

      const result = modifyHitPoints(summary, 'Thorin', -3, campaignName);

      expect(getRuntimeValue).toHaveBeenNthCalledWith(1, 'Thorin', 'hitPoints');
      expect(getRuntimeValue).toHaveBeenNthCalledWith(2, 'Thorin', 'currentHitPoints');
      expect(result).toEqual({
        oldHp: 15,
        newHp: 12,
        delta: -3,
        isPlayer: true,
        creature: expect.objectContaining({ name: 'Thorin' }),
        maxHp: 20,
      });
    });

    it('calls setRuntimeValue with the computed newHp', () => {
      mockPlayerRuntime(20, 15);

      const summary = makeCombatSummary([
        { name: 'Thorin', type: 'player', maxHp: 10 },
      ]);

      modifyHitPoints(summary, 'Thorin', -3, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 12, campaignName);
    });

    it('falls back to creature.maxHp when runtime hitPoints is null', () => {
      getRuntimeValue.mockReturnValue(null);

      const summary = makeCombatSummary([
        { name: 'Elara', type: 'player', maxHp: 12 },
      ]);

      const result = modifyHitPoints(summary, 'Elara', 5, campaignName);

      expect(result.maxHp).toBe(12);
      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(5);
    });

    it('falls back to 0 when runtime currentHitPoints is null', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 18;
        return null;
      });

      const summary = makeCombatSummary([
        { name: 'Elara', type: 'player', maxHp: 18 },
      ]);

      const result = modifyHitPoints(summary, 'Elara', -10, campaignName);

      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(0);
      expect(result.delta).toBe(0);
    });

    it('clamps player HP to 0 on the low end', () => {
      mockPlayerRuntime(10, 3);

      const summary = makeCombatSummary([
        { name: 'Thorin', type: 'player', maxHp: 10 },
      ]);

      const result = modifyHitPoints(summary, 'Thorin', -20, campaignName);

      expect(result.newHp).toBe(0);
      expect(result.delta).toBe(-3);
      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 0, campaignName);
    });

    it('clamps player HP to maxHp on the high end', () => {
      mockPlayerRuntime(10, 8);

      const summary = makeCombatSummary([
        { name: 'Thorin', type: 'player', maxHp: 10 },
      ]);

      const result = modifyHitPoints(summary, 'Thorin', 10, campaignName);

      expect(result.newHp).toBe(10);
      expect(result.delta).toBe(2);
      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 10, campaignName);
    });
  });

  describe('postLogEntry calls', () => {
    it('logs hp_change for NPC damage', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', -3, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin',
        delta: -3,
        currentHp: 2,
        maxHp: 7,
        isHealing: false,
        isUnconscious: false,
      });
    });

    it('logs hp_change for NPC healing with clamped delta', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', 4, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin',
        delta: 2,
        currentHp: 7,
        maxHp: 7,
        isHealing: true,
        isUnconscious: false,
      });
    });

    it('sets isUnconscious to true when NPC HP reaches 0', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 2, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', -5, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Goblin',
        delta: -2,
        currentHp: 0,
        maxHp: 7,
        isHealing: false,
        isUnconscious: true,
      });
    });

    it('sets isUnconscious to true when player HP reaches 0', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 10;
        if (prop === 'currentHitPoints') return 2;
        return null;
      });

      const summary = makeCombatSummary([
        { name: 'Thorin', type: 'player', maxHp: 10 },
      ]);

      modifyHitPoints(summary, 'Thorin', -5, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, {
        type: 'hp_change',
        targetName: 'Thorin',
        delta: -2,
        currentHp: 0,
        maxHp: 10,
        isHealing: false,
        isUnconscious: true,
      });
    });

    it('does not log when HP is unchanged', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', 0, campaignName);

      expect(postLogEntry).not.toHaveBeenCalled();
    });
  });

  describe('window event dispatch', () => {
    function captureEvent() {
      let captured = null;
      const spy = vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
        captured = event;
        return true;
      });
      return { spy, getCaptured: () => captured };
    }

    it('dispatches combat-summary-updated event on success', () => {
      const { spy, getCaptured } = captureEvent();

      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', -3, campaignName);

      expect(spy).toHaveBeenCalled();
      const event = getCaptured();
      expect(event.type).toBe('combat-summary-updated');
    });

    it('dispatches event even when delta is 0', () => {
      const { spy, getCaptured } = captureEvent();

      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      modifyHitPoints(summary, 'Goblin', 0, campaignName);

      expect(spy).toHaveBeenCalled();
      const event = getCaptured();
      expect(event.type).toBe('combat-summary-updated');
    });

    it('dispatches event for player HP changes', () => {
      const { spy, getCaptured } = captureEvent();

      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 10;
        if (prop === 'currentHitPoints') return 5;
        return null;
      });

      const summary = makeCombatSummary([
        { name: 'Thorin', type: 'player', maxHp: 10 },
      ]);

      modifyHitPoints(summary, 'Thorin', -2, campaignName);

      expect(spy).toHaveBeenCalled();
      const event = getCaptured();
      expect(event.type).toBe('combat-summary-updated');
    });
  });

  describe('multiple creatures in combat summary', () => {
    it('finds and modifies the correct creature by name', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'npc', currentHp: 10, maxHp: 15 },
        { name: 'Dragon', type: 'npc', currentHp: 50, maxHp: 100 },
      ]);

      const result = modifyHitPoints(summary, 'Orc', -4, campaignName);

      expect(result.creature.name).toBe('Orc');
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(6);
      expect(summary.creatures[1].currentHp).toBe(6);
    });

    it('does not affect other creatures when modifying one', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        { name: 'Orc', type: 'npc', currentHp: 10, maxHp: 15 },
      ]);

      modifyHitPoints(summary, 'Goblin', -2, campaignName);

      expect(summary.creatures[0].currentHp).toBe(3);
      expect(summary.creatures[1].currentHp).toBe(10);
    });

    it('returns the same creature reference as in the combatSummary', () => {
      const summary = makeCombatSummary([
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
      ]);

      const result = modifyHitPoints(summary, 'Goblin', -2, campaignName);

      expect(result.creature).toBe(summary.creatures[0]);
    });
  });
});
