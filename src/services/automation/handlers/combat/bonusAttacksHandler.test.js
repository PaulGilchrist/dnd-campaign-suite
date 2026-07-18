vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 4, newHp: 16 })),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, applyFlurryOfBlows } from './bonusAttacksHandler.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';
import { rollD20 } from '../../../dice/diceRoller.js';

describe('bonusAttacksHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCombatSummary.mockReturnValue(null);
  });

  describe('handle', () => {
    const action = {
      name: 'Heightened Flurry of Blows',
      automation: {
        type: 'bonus_attacks',
        attacks: 3,
        attackType: 'unarmed_strike',
      },
    };

    const playerStats = {
      name: 'TestMonk',
      attacks: [{ hitBonus: 6, damage: '1d6+3', damageType: 'Bludgeoning' }],
    };

    it('returns popup when no combat context', async () => {
      getCombatSummary.mockReturnValue(null);
      const result = await handle(action, playerStats, 'test-campaign', null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No combat context found');
    });

    it('returns popup when no creatures in combat', async () => {
      getCombatSummary.mockReturnValue({ creatures: [] });
      const result = await handle(action, playerStats, 'test-campaign', null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No valid targets found');
    });

    it('returns popup when only self in combat', async () => {
      getCombatSummary.mockReturnValue({
        creatures: [{ name: 'TestMonk', currentHp: 20, maxHp: 20, ac: 12 }],
      });
      const result = await handle(action, playerStats, 'test-campaign', null);
      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('No valid targets found');
    });

    it('returns modal with creature targets when creatures exist', async () => {
      getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'TestMonk', currentHp: 20, maxHp: 20, ac: 12 },
          { name: 'Goblin', currentHp: 7, maxHp: 7, ac: 15 },
          { name: 'Orc', currentHp: 15, maxHp: 15, ac: 13 },
        ],
      });

      const result = await handle(action, playerStats, 'test-campaign', 'test-map');
      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('flurryOfBlows');
      expect(result.payload.creatureTargets).toEqual(['Goblin', 'Orc']);
      expect(result.payload.numAttacks).toBe(3);
      expect(result.payload.attackBonus).toBe(6);
      expect(result.payload.damageFormula).toBe('1d6+3');
      expect(result.payload.damageType).toBe('Bludgeoning');
    });
  });

  describe('applyFlurryOfBlows', () => {
    const action = {
      name: 'Heightened Flurry of Blows',
      automation: {
        type: 'bonus_attacks',
        attacks: 3,
      },
    };

    const playerStats = {
      name: 'TestMonk',
      attacks: [{ hitBonus: 6, damage: '1d6+3', damageType: 'Bludgeoning' }],
    };

    const combatSummary = {
      creatures: [
        { name: 'TestMonk', currentHp: 20, maxHp: 20, ac: 12 },
        { name: 'Goblin', currentHp: 7, maxHp: 7, ac: 15 },
        { name: 'Orc', currentHp: 15, maxHp: 15, ac: 13 },
      ],
    };

    it('returns null when no distribution provided', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      const result = await applyFlurryOfBlows(action, playerStats, 'test-campaign', null, null, 3);
      expect(result).toBeNull();
    });

    it('skips targets with 0 attacks', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      const result = await applyFlurryOfBlows(
        action,
        playerStats,
        'test-campaign',
        null,
        { Goblin: 0, Orc: 3 },
        3
      );

      expect(result.type).toBe('popup');
      expect(addEntry).toHaveBeenCalled();
    });

    it('performs correct number of attacks per target', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      const mockRollD20 = vi.fn();
      mockRollD20.mockReturnValueOnce(18).mockReturnValueOnce(12).mockReturnValueOnce(20);
      vi.mocked(rollD20).mockImplementation(mockRollD20);

      const result = await applyFlurryOfBlows(
        action,
        playerStats,
        'test-campaign',
        null,
        { Goblin: 2, Orc: 1 },
        3
      );

      expect(mockRollD20).toHaveBeenCalledTimes(3);
      expect(result.type).toBe('popup');
      expect(addEntry).toHaveBeenCalled();
    });

    it('returns popup with summary', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValue(18);

      const result = await applyFlurryOfBlows(
        action,
        playerStats,
        'test-campaign',
        null,
        { Goblin: 1, Orc: 2 },
        3
      );

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Heightened Flurry of Blows');
    });

    it('includes detailed attack results in popup description', async () => {
      getCombatSummary.mockReturnValue(combatSummary);
      vi.mocked(rollD20).mockReturnValueOnce(1).mockReturnValueOnce(20).mockReturnValueOnce(10);

      const result = await applyFlurryOfBlows(
        action,
        playerStats,
        'test-campaign',
        null,
        { Goblin: 1, Orc: 2 },
        3
      );

      expect(result.payload.description).toContain('Miss');
      expect(result.payload.description).toContain('CRIT');
      expect(result.payload.description).toContain('Hit');
      expect(result.payload.description).toContain('AC 15');
      expect(result.payload.description).toContain('AC 13');
      expect(result.payload.description).toContain('doubled dice');
      expect(result.payload.description).toContain('Bludgeoning');
      expect(result.payload.description).toContain('d20: 1 + 6 = 7');
      expect(result.payload.description).toContain('d20: 20 + 6 = 26');
    });
  });
});
