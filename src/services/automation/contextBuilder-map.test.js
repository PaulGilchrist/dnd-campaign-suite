import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContext } from './contextBuilder.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(async () => ({
    target: { name: 'Orc' },
    targetName: 'Orc',
    resistanceNotice: null,
  })),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => null),
  getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(async () => null),
}));

vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'ok' })),
  computeMeleeProximityEffect: vi.fn(() => ({ mode: 'ok' })),
  getDistanceFeet: vi.fn(() => 5),
  isHostileNPC: vi.fn(() => true),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((r) => (typeof r === 'number' ? r : 5)),
}));

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(() => ({ level: 'none', acBonus: 0 })),
}));

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(async () => []),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => undefined),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ spellAdvantage: false, saveDcBonus: 0 })),
}));

vi.mock('../combat/auras/wolfAuraUtils.js', () => ({
  getWolfAdvantageAgainst: vi.fn(() => ({ advantage: false })),
}));

vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({
  getDuplicityAdvantageAgainst: vi.fn(() => ({ advantage: false })),
}));

vi.mock('../combat/auras/lionAuraUtils.js', () => ({
  getLionDisadvantageAgainst: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../combat/auras/auraOfProtection.js', () => ({
  hasAuraOfProtection: vi.fn(() => false),
}));

vi.mock('../combat/auras/protectionBuffUtils.js', () => ({
  hasProtectionBuff: vi.fn(() => false),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(() => false),
  isAuraTarget: vi.fn(() => false),
}));

const mockStats = {
  name: 'Fighter1',
  level: 5,
  proficiency: 2,
  class: { class_levels: [{ rage_damage: 2 }] },
  abilities: [
    { name: 'Charisma', bonus: 2 },
    { name: 'Strength', bonus: 4 },
  ],
  automation: { passives: [] },
};

const mockRangedAttack = {
  name: 'Longbow',
  damage: '1d8+4',
  damageType: 'Piercing',
  hitBonus: 7,
  hitBonusFormula: 'To Hit = 4 + 2 + 1',
  weaponType: 'ranged',
  range: 150,
};

function makeCombatContextWithTarget(attackerName, targetName, targetGridX, targetGridY) {
  return {
    creatures: [
      { name: attackerName, targetName },
      { name: targetName, gridX: targetGridX, gridY: targetGridY },
    ],
  };
}

describe('contextBuilder: buildAttackContext (map-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic map behavior', () => {
    it('delegates to buildAttackContextSync when no mapName', async () => {
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', null, 'normal', {});
      expect(result).toBeDefined();
      expect(result.targetName).toBe('Orc');
    });

    it('loads map data when mapName is provided', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(loadMapData).toHaveBeenCalledWith('camp', 'test-map');
      expect(result).toBeDefined();
    });

    it('returns base when attacker not found on map', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Other', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result.targetName).toBe('Orc');
    });

    it('handles promise rejection gracefully', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockRejectedValue(new Error('map load failed'));
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });

    it('handles getCombatContext returning null', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue(null);
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });
  });

  describe('range effects', () => {
    it('calculates isRanged from range > 8 feet for melee attacks', async () => {
      const { computeRangeEffect } = await import('../rules/combat/rangeValidation.js');
      computeRangeEffect.mockReturnValue({ mode: 'ok' });
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const meleeAttack = { ...mockRangedAttack, range: 5, weaponType: 'melee' };
      const result = await buildAttackContext(meleeAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });
  });

  describe('cover calculations', () => {
    it('ignores cover when ignore_cover_ranged passive exists', async () => {
      const { computeCover } = await import('../rules/combat/coverService.js');
      computeCover.mockReturnValue({ level: 'full', acBonus: 4 });
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] },
      };
      const result = await buildAttackContext(mockRangedAttack, stats, 'camp', 'test-map', 'normal', {});
      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not add Nature\'s Sanctuary cover when not active', async () => {
      const { computeCover } = await import('../rules/combat/coverService.js');
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const stats = {
        ...mockStats,
        automation: { passives: [] },
      };
      const result = await buildAttackContext(mockRangedAttack, stats, 'camp', 'test-map', 'normal', {});
      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not add Bulwark of Force cover when not active', async () => {
      const { computeCover } = await import('../rules/combat/coverService.js');
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result.coverAcBonus).toBeUndefined();
    });
  });

  describe('melee proximity effect', () => {
    it('sets disadvantage when firing in melee range of hostile NPC', async () => {
      const { computeMeleeProximityEffect } = await import('../rules/combat/rangeValidation.js');
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [{ type: 'npc', name: 'Goblin', gridX: 2, gridY: 2, attitude: 'negative' }],
      });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Firing in melee');
    });
  });

  describe('target position resolution', () => {
    it('finds target position from combat context target', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      getCombatContext.mockResolvedValue(makeCombatContextWithTarget('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });

    it('finds target NPC position when not a player', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      });
      getCombatContext.mockResolvedValue(makeCombatContextWithTarget('Fighter1', 'Orc', 10, 10));
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });

    it('returns base when combat context is null', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [],
      });
      getCombatContext.mockResolvedValue(null);
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });
  });

  describe('improved illusions', () => {
    it('includes improved illusions range bonus for illusion spells with range 10+', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'improved_illusions' }] },
      };
      const illusionAttack = {
        ...mockRangedAttack,
        damage: '1d4',
        damageType: 'Force',
        range: 120,
        school: 'Illusion',
      };
      const result = await buildAttackContext(illusionAttack, stats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });

    it('does not apply improved illusions bonus for non-illusion spells', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'improved_illusions' }] },
      };
      const fireAttack = {
        ...mockRangedAttack,
        school: 'Evocation',
      };
      const result = await buildAttackContext(fireAttack, stats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });
  });

  describe('NPC handling', () => {
    it('matches NPCs with numeric suffixes', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [{ type: 'npc', name: 'Goblin 1', gridX: 2, gridY: 2 }],
      });
      const { loadNPCs } = await import('../npcs/npcsService.js');
      loadNPCs.mockResolvedValue([{ name: 'Goblin 1', attitude: 'negative' }]);
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });

    it('handles NPCs without matching NPC data', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({
        players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        placedItems: [{ type: 'npc', name: 'Goblin', gridX: 2, gridY: 2 }],
      });
      const { loadNPCs } = await import('../npcs/npcsService.js');
      loadNPCs.mockResolvedValue([]);
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result).toBeDefined();
    });
  });

  describe('feat range effects', () => {
    it('uses default feat effects when not provided', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', undefined);
      expect(result).toBeDefined();
    });

    it('uses provided feat range effects', async () => {
      const { loadMapData } = await import('../maps/mapsService.js');
      loadMapData.mockResolvedValue({ players: [{ name: 'Fighter1', gridX: 1, gridY: 1 }] });
      getCombatContext.mockResolvedValue({ creatures: [] });
      const feats = { ignoresMeleeDisadvantage: true, ignoresLongRangeDisadvantage: true, rangeMultiplier: 1, spellRangeBonus: 10 };
      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', feats);
      expect(result).toBeDefined();
    });
  });
});
