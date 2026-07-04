// Removed redundant early-return tests (null/undefined/missing-creatures all test same guard),
// brittle internal-detail tests (fragile mock implementations for runtime prop names),
// and low-value tests (delta=0 trivial arithmetic, case-sensitivity implementation detail).
// Consolidated into tests that verify observable behavior: clamping, delta computation,
// player vs NPC paths, name matching, and runtime store interaction.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mocks ---

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { modifyHitPoints } from './hpModifier.js';

const campaignName = 'TestCampaign';

// --- helpers ---

function makeCreature(name, type, currentHp, maxHp) {
  const creature = { name, type };
  if (type === 'npc') {
    creature.currentHp = currentHp;
    creature.maxHp = maxHp;
  } else {
    creature.maxHp = maxHp;
  }
  return creature;
}

function makeCombatSummary(creatures) {
  return { creatures };
}

// --- tests ---

describe('modifyHitPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns', () => {
    it('returns null when combatSummary is invalid or creature not found', () => {
      expect(modifyHitPoints(null, 'Goblin', 5, campaignName)).toBeNull();
      expect(modifyHitPoints(undefined, 'Goblin', 5, campaignName)).toBeNull();
      expect(modifyHitPoints({}, 'Goblin', 5, campaignName)).toBeNull();
      expect(modifyHitPoints(makeCombatSummary([]), 'Goblin', 5, campaignName)).toBeNull();

      const summary = makeCombatSummary([makeCreature('Goblin', 'npc', 5, 7)]);
      expect(modifyHitPoints(summary, 'Dragon', 5, campaignName)).toBeNull();
    });
  });

  describe('NPC creatures', () => {
    it('decreases HP and clamps to 0', () => {
      const summary = makeCombatSummary([
        makeCreature('Goblin', 'npc', 3, 7),
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
        makeCreature('Orc', 'npc', 10, 15),
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
        makeCreature('Goblin', 'npc', 3, 7),
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
  });

  describe('Player creatures', () => {
    function mockPlayerRuntime(maxHp, currentHp) {
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'hitPoints') return maxHp;
        if (prop === 'currentHitPoints') return currentHp;
        return null;
      });
    }

    it('reads maxHp and currentHp from runtime store and clamps to 0', () => {
      mockPlayerRuntime(10, 3);

      const summary = makeCombatSummary([
        makeCreature('Thorin', 'player', undefined, 10),
      ]);

      const result = modifyHitPoints(summary, 'Thorin', -20, campaignName);

      expect(result.oldHp).toBe(3);
      expect(result.newHp).toBe(0);
      expect(result.delta).toBe(-3);
      expect(result.isPlayer).toBe(true);
      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 0, campaignName);
    });

    it('clamps player HP to maxHp on the high end', () => {
      mockPlayerRuntime(10, 8);

      const summary = makeCombatSummary([
        makeCreature('Thorin', 'player', undefined, 10),
      ]);

      const result = modifyHitPoints(summary, 'Thorin', 10, campaignName);

      expect(result.oldHp).toBe(8);
      expect(result.newHp).toBe(10);
      expect(result.delta).toBe(2);
      expect(result.isPlayer).toBe(true);
      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', 10, campaignName);
    });

    it('falls back to creature.maxHp when runtime hitPoints is null', () => {
      getRuntimeValue.mockReturnValue(null);

      const summary = makeCombatSummary([
        makeCreature('Elara', 'player', undefined, 12),
      ]);

      const result = modifyHitPoints(summary, 'Elara', 5, campaignName);

      expect(result.maxHp).toBe(12);
      expect(result.oldHp).toBe(0);
      expect(result.newHp).toBe(5);
    });
  });

  describe('multiple creatures in combat summary', () => {
    it('finds and modifies the correct creature by name', () => {
      const summary = makeCombatSummary([
        makeCreature('Goblin', 'npc', 5, 7),
        makeCreature('Orc', 'npc', 10, 15),
        makeCreature('Dragon', 'npc', 50, 100),
      ]);

      const result = modifyHitPoints(summary, 'Orc', -4, campaignName);

      expect(result.creature.name).toBe('Orc');
      expect(result.oldHp).toBe(10);
      expect(result.newHp).toBe(6);
      expect(summary.creatures[1].currentHp).toBe(6);
    });
  });
});
