import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks ---

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

const mockAddEntry = vi.fn(() => Promise.resolve());
function makeMockPostLogEntry() {
  return vi.fn((campaignName, entry) => mockAddEntry(campaignName, entry));
}
vi.mock('./logPoster.js', () => ({
  postLogEntry: makeMockPostLogEntry(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';
import { postLogEntry } from './logPoster.js';
import { modifyHitPoints } from './hpModifier.js';

// --- shared helpers ---

function clearMocks() {
  vi.clearAllMocks();
}

const campaignName = 'TestCampaign';

// --- tests ---

describe('modifyHitPoints', () => {
  beforeEach(() => {
    clearMocks();
  });

  describe('early returns', () => {
    it('should return null when combatSummary is null', () => {
      expect(modifyHitPoints(null, 'Goblin', 5, campaignName)).toBeNull();
    });

    it('should return null when combatSummary is undefined', () => {
      expect(modifyHitPoints(undefined, 'Goblin', 5, campaignName)).toBeNull();
    });

    it('should return null when creature is not found by name', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };
      expect(modifyHitPoints(combatSummary, 'Dragon', 5, campaignName)).toBeNull();
    });
  });

  describe('NPC creatures', () => {
    it('should decrease NPC HP and clamp to 0', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 3, maxHp: 7 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Goblin', -5, campaignName);

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

    it('should decrease NPC HP without clamping when within range', () => {
      const combatSummary = {
        creatures: [
          { name: 'Orc', type: 'npc', currentHp: 10, maxHp: 15 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Orc', -4, campaignName);

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

    it('should increase NPC HP and clamp to maxHp', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 3, maxHp: 7 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Goblin', 10, campaignName);

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

    it('should leave NPC HP unchanged when delta is 0', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Goblin', 0, campaignName);

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

    it('should not call postLogEntry when delta is 0', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', 0, campaignName);

      expect(postLogEntry).not.toHaveBeenCalled();
    });
  });

  describe('Player creatures', () => {
    it('should use getRuntimeValue for player maxHp and currentHp', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 15;
        return null;
      });

      const combatSummary = {
        creatures: [
          { name: 'Thorin', type: 'player', maxHp: 10 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Thorin', -3, campaignName);

      expect(getRuntimeValue).toHaveBeenCalledWith('Thorin', 'hitPoints');
      expect(getRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints');
      expect(result).toEqual({
        oldHp: 15,
        newHp: 12,
        delta: -3,
        isPlayer: true,
        creature: expect.objectContaining({ name: 'Thorin' }),
        maxHp: 20,
      });
      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 12, campaignName);
    });

    it('should fall back to creature.maxHp when runtime hitPoints is null', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return null;
        if (prop === 'currentHitPoints') return null;
        return null;
      });

      const combatSummary = {
        creatures: [
          { name: 'Elara', type: 'player', maxHp: 12 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Elara', 5, campaignName);

      expect(result.maxHp).toBe(12);
      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(5);
    });

    it('should fall back to 0 when runtime currentHitPoints is null', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 18;
        if (prop === 'currentHitPoints') return null;
        return null;
      });

      const combatSummary = {
        creatures: [
          { name: 'Elara', type: 'player', maxHp: 18 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Elara', -10, campaignName);

      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(0);
      expect(result.delta).toBe(0);
    });

    it('should clamp player HP to 0 on the low end', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 10;
        if (prop === 'currentHitPoints') return 3;
        return null;
      });

      const combatSummary = {
        creatures: [
          { name: 'Thorin', type: 'player', maxHp: 10 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Thorin', -20, campaignName);

      expect(result.newHp).toBe(0);
      expect(result.delta).toBe(-3);
    });

    it('should clamp player HP to maxHp on the high end', () => {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return 10;
        if (prop === 'currentHitPoints') return 8;
        return null;
      });

      const combatSummary = {
        creatures: [
          { name: 'Thorin', type: 'player', maxHp: 10 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Thorin', 10, campaignName);

      expect(result.newHp).toBe(10);
      expect(result.delta).toBe(2);
    });
  });

  describe('postLogEntry calls', () => {
    it('should call postLogEntry with hp_change type for NPC damage', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', -3, campaignName);

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

    it('should call postLogEntry with hp_change type for NPC healing', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', 4, campaignName);

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

    it('should set isUnconscious to true when HP reaches 0', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 2, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', -5, campaignName);

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

    it('should call postLogEntry with campaignName', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', -3, campaignName);

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.any(Object));
    });
  });

  describe('window event dispatch', () => {
    it('should dispatch combat-summary-updated event', () => {
      const customEventSpy = vi.spyOn(window, 'dispatchEvent');

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', -3, campaignName);

      expect(customEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
      const event = customEventSpy.mock.calls[0][0];
      expect(event.type).toBe('combat-summary-updated');

      customEventSpy.mockRestore();
    });

    it('should dispatch event even when delta is 0', () => {
      const customEventSpy = vi.spyOn(window, 'dispatchEvent');

      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', 0, campaignName);

      expect(customEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
      const event = customEventSpy.mock.calls[0][0];
      expect(event.type).toBe('combat-summary-updated');

      customEventSpy.mockRestore();
    });
  });

  describe('multiple creatures in combat summary', () => {
    it('should find and modify the correct creature by name', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'npc', currentHp: 10, maxHp: 15 },
          { name: 'Dragon', type: 'npc', currentHp: 50, maxHp: 100 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Orc', -4, campaignName);

      expect(result.creature.name).toBe('Orc');
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(6);
      expect(result.creature.name).toBe('Orc');
      // Original creature objects should be mutated
      expect(combatSummary.creatures[1].currentHp).toBe(6);
    });

    it('should not affect other creatures when modifying one', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
          { name: 'Orc', type: 'npc', currentHp: 10, maxHp: 15 },
        ],
      };

      modifyHitPoints(combatSummary, 'Goblin', -2, campaignName);

      expect(combatSummary.creatures[0].currentHp).toBe(3);
      expect(combatSummary.creatures[1].currentHp).toBe(10);
    });
  });

  describe('negative delta (damage)', () => {
    it('should correctly calculate damage as negative delta', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Goblin', -2, campaignName);

      expect(result.delta).toBe(-2);
      expect(result.oldHp).toBe(5);
      expect(result.newHp).toBe(3);
    });
  });

  describe('positive delta (healing)', () => {
    it('should correctly calculate healing as positive delta with clamping', () => {
      const combatSummary = {
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7 },
        ],
      };

      const result = modifyHitPoints(combatSummary, 'Goblin', 3, campaignName);

      expect(result.oldHp).toBe(5);
      expect(result.newHp).toBe(7);
      // delta is actualDelta = newHp - oldHp = 7 - 5 = 2 (clamped)
      expect(result.delta).toBe(2);
    });
  });
});
