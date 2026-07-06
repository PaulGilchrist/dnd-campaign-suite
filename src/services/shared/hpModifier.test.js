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
    it.each([
      { desc: 'decreases HP and clamps to 0', currentHp: 3, maxHp: 7, delta: -5, expectedOld: 3, expectedNew: 0, expectedDelta: -3 },
      { desc: 'decreases HP without clamping', currentHp: 10, maxHp: 15, delta: -4, expectedOld: 10, expectedNew: 6, expectedDelta: -4 },
      { desc: 'increases HP and clamps to maxHp', currentHp: 3, maxHp: 7, delta: 10, expectedOld: 3, expectedNew: 7, expectedDelta: 4 },
    ])('($desc)', ({ currentHp, maxHp, delta, expectedOld, expectedNew, expectedDelta }) => {
      const summary = makeCombatSummary([
        makeCreature('Goblin', 'npc', currentHp, maxHp),
      ]);

      const result = modifyHitPoints(summary, 'Goblin', delta, campaignName);

      expect(result).toEqual({
        oldHp: expectedOld,
        newHp: expectedNew,
        delta: expectedDelta,
        isPlayer: false,
        creature: expect.objectContaining({ name: 'Goblin' }),
        maxHp,
      });
      expect(result.creature.currentHp).toBe(expectedNew);
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

    it.each([
      { desc: 'decreases HP and clamps to 0', currentHp: 3, maxHp: 10, delta: -20, expectedOld: 3, expectedNew: 0, expectedDelta: -3 },
      { desc: 'increases HP and clamps to maxHp', currentHp: 8, maxHp: 10, delta: 10, expectedOld: 8, expectedNew: 10, expectedDelta: 2 },
    ])('($desc)', ({ currentHp, maxHp, delta, expectedOld, expectedNew, expectedDelta }) => {
      mockPlayerRuntime(maxHp, currentHp);

      const summary = makeCombatSummary([
        makeCreature('Thorin', 'player', undefined, maxHp),
      ]);

      const result = modifyHitPoints(summary, 'Thorin', delta, campaignName);

      expect(result.oldHp).toBe(expectedOld);
      expect(result.newHp).toBe(expectedNew);
      expect(result.delta).toBe(expectedDelta);
      expect(result.isPlayer).toBe(true);
      expect(setRuntimeValue).toHaveBeenCalledWith('Thorin', 'currentHitPoints', expectedNew, campaignName);
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
