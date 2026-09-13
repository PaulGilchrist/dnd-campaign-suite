// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(() => ({ actualHeal: 25, oldHp: 0, newHp: 25, maxHp: 50 })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(async () => {}),
}));

import { confirmSearingVengeance } from './searingVengeanceHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as diceRoller from '../../../dice/diceRoller.js';
import * as applyDamage from '../../../rules/combat/applyDamage.js';
import { addEntry } from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWarlock',
    level: 14,
    hitPoints: { max: 70 },
    currentHitPoints: 50,
    ...overrides,
  };
}

function mockRuntimeValues(values) {
  useRuntimeState.getRuntimeValue.mockImplementation((_subject, key, _campaign) => {
    if (key === 'searingvengeanceUses') return values.searingvengeanceUses;
    if (key === 'activeConditions') return values.activeConditions;
    return null;
  });
}

describe('confirmSearingVengeance - edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('early returns for invalid targets', () => {
    it.each([
      { selectedTargets: null, label: 'null' },
      { selectedTargets: undefined, label: 'undefined' },
    ])('returns popup when selectedTargets is $label', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: null,
      };

      const result = await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no creatures selected');
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns popup when selectedTargets is empty array', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: [],
      };

      const result = await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no creatures selected');
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    });
  });

  describe('combat context failures', () => {
    it('returns popup when no combat is active during confirm', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1 });
      damageUtils.getCombatContext.mockResolvedValue(null);

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      const result = await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('No combat active.');
    });
  });

  describe('damage application to targets', () => {
    it('skips blinded condition when creature already has it', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: ['blinded'] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [6, 6] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      // Should NOT call setRuntimeValue for Goblin's conditions since blinded already exists
      const goblinConditionCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
        (call) => call[0] === 'Goblin' && call[1] === 'activeConditions'
      );
      expect(goblinConditionCalls).toHaveLength(0);
    });

    it('treats null storedConditions as empty array and adds blinded', async () => {
      useRuntimeState.getRuntimeValue.mockImplementation((_subject, key, _campaign) => {
        if (key === 'searingvengeanceUses') return 1;
        if (key === 'activeConditions') return null;
        return null;
      });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded'],
        campaignName
      );
    });

    it('handles creature not found in combat context for hp_change log', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'hp_change',
          targetName: 'Goblin',
          currentHp: 0,
          maxHp: 0,
        })
      );
    });

    it('handles rollExpression returning zero damage', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      const result = await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('0 radiant damage');
    });

    it('uses default damageType when automation.damageType is not set', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          damageType: 'Radiant',
        })
      );
    });

    it('resolves CHA modifier from abilities bonus (canonical PlayerStats shape)', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [7, 8] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const playerStats = {
        name: 'TestWarlock',
        abilities: [{ name: 'Charisma', bonus: 5 }],
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats,
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+5');
    });

    it('formats negative CHA modifier without a double sign', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 4, rolls: [1, 3] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const playerStats = {
        name: 'TestWarlock',
        abilities: [{ name: 'Charisma', bonus: -2 }],
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats,
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8-2');
    });

    it('resolves zero CHA modifier when abilities are missing', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 7, rolls: [3, 4] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8+0');
    });

    it('handles multiple targets by applying damage to each', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
          { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 30 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin', 'Orc'],
      };

      await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(2);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'activeConditions',
        ['blinded'],
        campaignName
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Orc',
        'activeConditions',
        ['blinded'],
        campaignName
      );
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'roll',
          targetName: 'Goblin',
        })
      );
      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'roll',
          targetName: 'Orc',
        })
      );
    });
  });

  describe('error handling', () => {
    it('continues processing and returns result when addEntry rejects for damage log', async () => {
      mockRuntimeValues({ searingvengeanceUses: 1, activeConditions: [] });
      damageUtils.getCombatContext.mockResolvedValue({
        creatures: [
          { name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 20 },
        ],
      });
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [5, 5] });
      addEntry.mockRejectedValue(new Error('log fails'));

      const automation = {
        damageExpression: '2d8 + CHA modifier',
        damageType: 'Radiant',
        usesMax: 1,
      };

      const payload = {
        name: 'Searing Vengeance',
        targetName: 'Ally',
        healAmount: 25,
        selectedTargets: ['Goblin'],
      };

      const result = await confirmSearingVengeance({
            automation,
            playerStats: makePlayerStats(),
            campaignName,
            mapName: null,
            characters: [],
            payload,
        });

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('Searing Vengeance');
    });
  });
});
