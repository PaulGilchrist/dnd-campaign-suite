// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContext } from './contextBuilder.js';
import { getCombatContext, getTargetFromAttacker } from '../rules/combat/damageUtils.js';
import { buildBaseAttackContext } from './common/damageRoll.js';
import { loadMapData } from '../maps/mapsService.js';
import { loadNPCs } from '../npcs/npcsService.js';
import {
  computeRangeEffect,
  computeMeleeProximityEffect,
  getDistanceFeet,
  isHostileNPC,
  getNearestPlacedItem,
  rangeToFeet,
} from '../rules/combat/rangeValidation.js';
import { computeCover } from '../rules/combat/coverService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../combat/buffs/buffService.js';
import { getWolfAdvantageAgainst } from '../combat/auras/wolfAuraUtils.js';
import { getDuplicityAdvantageAgainst } from '../combat/auras/duplicityAuraUtils.js';
import { getLionDisadvantageAgainst } from '../combat/auras/lionAuraUtils.js';
import { getCoronaSaveDisadvantage } from '../combat/auras/coronaAuraUtils.js';
import { hasAuraOfProtection } from '../combat/auras/auraOfProtection.js';
import { isActive, isAuraTarget } from './handlers/class-cleric-paladin/avengingAngelHandler.js';

vi.mock('./common/damageRoll.js', () => ({
  buildBaseAttackContext: vi.fn(),
}));

vi.mock('../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(),
  computeMeleeProximityEffect: vi.fn(),
  getDistanceFeet: vi.fn(),
  isHostileNPC: vi.fn(),
  getNearestPlacedItem: vi.fn(),
  rangeToFeet: vi.fn(),
}));

vi.mock('../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(),
}));

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(),
}));

vi.mock('../combat/auras/wolfAuraUtils.js', () => ({
  getWolfAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({
  getDuplicityAdvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/lionAuraUtils.js', () => ({
  getLionDisadvantageAgainst: vi.fn(),
}));

vi.mock('../combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../combat/auras/auraOfProtection.js', () => ({
  hasAuraOfProtection: vi.fn(),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(),
  isAuraTarget: vi.fn(),
  handle: vi.fn(),
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

function makeCombatContext(attackerName, targetName, targetGridX, targetGridY) {
  return {
    creatures: [
      { name: attackerName, targetName },
      { name: targetName, gridX: targetGridX, gridY: targetGridY },
    ],
  };
}

function makeMapData(players, placedItems) {
  return { players: players || [], placedItems: placedItems || [] };
}

// Default mock setup — all mocks return safe defaults
function setupDefaults() {
  buildBaseAttackContext.mockResolvedValue({
    target: { name: 'Orc' },
    targetName: 'Orc',
    resistanceNotice: null,
  });
  loadMapData.mockResolvedValue(null);
  loadNPCs.mockResolvedValue([]);
  rangeToFeet.mockImplementation((r) => (typeof r === 'number' ? r : 5));
  getRuntimeValue.mockReturnValue(undefined);
  setRuntimeValue.mockReturnValue(undefined);
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  hasAuraOfProtection.mockReturnValue(false);
  isActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
  // Sync path aura defaults
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  // Map path defaults
  getCombatContext.mockResolvedValue(null);
  getTargetFromAttacker.mockReturnValue(null);
  getDistanceFeet.mockReturnValue(5);
  computeRangeEffect.mockReturnValue({ mode: 'ok' });
  computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
  computeMeleeProximityEffect.mockReturnValue({ mode: 'ok' });
  getNearestPlacedItem.mockReturnValue(null);
  isHostileNPC.mockReturnValue(false);
}

describe('contextBuilder: buildAttackContext (map-based)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  describe('no map name — delegates to sync path', () => {
    it('returns base attack context when mapName is null or undefined', async () => {
      let result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', null, 'normal', {});
      expect(result.targetName).toBe('Orc');
      expect(result.attackerName).toBe('Fighter1');
      expect(result.damageType).toBe('Piercing');
      expect(result.isMelee).toBe(false);

      result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', undefined, 'normal', {});
      expect(result.targetName).toBe('Orc');
    });
  });

  describe('map data loading', () => {
    it('loads map data and NPC data when mapName is provided', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));

      await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(loadMapData).toHaveBeenCalledWith('camp', 'test-map');
      expect(loadNPCs).toHaveBeenCalledWith('camp');
    });

    it('returns base context when attacker is not found on map', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Other', gridX: 1, gridY: 1 }]));

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.targetName).toBe('Orc');
    });

    it('returns base context when map data is null or has no players array', async () => {
      let result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result.targetName).toBe('Orc');

      loadMapData.mockResolvedValue(null);
      result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result.targetName).toBe('Orc');

      loadMapData.mockResolvedValue({});
      result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});
      expect(result.targetName).toBe('Orc');
    });

    it('handles map loading rejection gracefully', async () => {
      loadMapData.mockRejectedValue(new Error('map load failed'));

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.targetName).toBe('Orc');
    });

    it('handles getCombatContext rejection gracefully', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockRejectedValue(new Error('combat context failed'));

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.targetName).toBe('Orc');
    });
  });

  describe('range effects', () => {
    it('marks attack as auto miss when range effect returns miss', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Out of range');
      expect(result.forcedMode).toBeUndefined();
    });

    it('sets disadvantage when range effect returns disadvantage', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeRangeEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Long range' });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Long range');
    });


  });

  describe('cover calculations', () => {
    it('ignores cover when ignore_cover_ranged passive exists', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'full', acBonus: 4 });

      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'ignore_cover_ranged' }] },
      };
      const result = await buildAttackContext(mockRangedAttack, stats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
      expect(result.isAutoMiss).toBeUndefined();
    });

    it('sets auto miss when cover is full', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'full', acBonus: 4 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
    });

    it('applies cover AC bonus when cover is not none and not full', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    it('does not apply cover when attack is auto miss from range', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply cover when isRanged is false', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });

      const meleeAttack = { ...mockRangedAttack, range: 5, weaponType: 'melee' };
      const result = await buildAttackContext(meleeAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply cover when target position cannot be resolved', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockResolvedValue(null);

      await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(computeCover).not.toHaveBeenCalled();
    });
  });

  describe('melee proximity disadvantage', () => {
    it('sets disadvantage when firing in melee range of hostile NPC', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      isHostileNPC.mockReturnValue(true);
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
      expect(result.rangeReason).toBe('Firing in melee');
    });



    it('skips melee proximity check when attack is auto miss', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      isHostileNPC.mockReturnValue(true);
      computeRangeEffect.mockReturnValue({ mode: 'miss', reason: 'Out of range' });
      computeMeleeProximityEffect.mockReturnValue({ mode: 'disadvantage', reason: 'Firing in melee' });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.forcedMode).toBeUndefined();
    });

    it('passes filtered hostile NPCs to proximity check', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [
          { type: 'npc', name: 'Friendly', gridX: 2, gridY: 2, attitude: 'friendly' },
          { type: 'npc', name: 'Hostile', gridX: 3, gridY: 3, attitude: 'negative' },
        ],
      ));
      loadNPCs.mockResolvedValue([
        { name: 'Friendly', attitude: 'friendly' },
        { name: 'Hostile', attitude: 'negative' },
      ]);
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      isHostileNPC.mockImplementation((npc) => npc.attitude === 'negative');

      await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(isHostileNPC).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Hostile', attitude: 'negative' }),
      );
    });
  });

  describe('target position resolution', () => {
    it('finds target position from combat context target when target is a player', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 10, gridY: 10 }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.targetName).toBe('Orc');
    });

    it('finds target NPC position from placedItems when target is not a player', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.targetName).toBe('Orc');
    });

    it('uses nearest placed item when target player not found on map', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 11, gridY: 11, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 11, gridY: 11 });

      await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(getNearestPlacedItem).toHaveBeenCalledWith(
        expect.any(Array),
        'Orc',
        expect.objectContaining({ gridX: 1, gridY: 1 }),
      );
    });

    it('skips cover when getTargetFromAttacker returns null', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue(null);

      await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(computeCover).not.toHaveBeenCalled();
    });
  });

  describe('improved illusions', () => {
    it('applies range bonus for illusion spells with range 10+ feet', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);

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

      await buildAttackContext(illusionAttack, stats, 'camp', 'test-map', 'normal', {});

      expect(computeRangeEffect).toHaveBeenCalledWith(180, expect.any(Number), expect.any(Object));
    });

    it('does not apply range bonus for non-illusion spells', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);

      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'improved_illusions' }] },
      };
      const fireAttack = {
        ...mockRangedAttack,
        school: 'Evocation',
      };

      await buildAttackContext(fireAttack, stats, 'camp', 'test-map', 'normal', {});

      expect(computeRangeEffect).toHaveBeenCalledWith(150, expect.any(Number), expect.any(Object));
    });

    it('does not apply range bonus when spell range is less than 10 feet', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);

      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'improved_illusions' }] },
      };
      const illusionAttack = {
        ...mockRangedAttack,
        range: 5,
        school: 'Illusion',
      };

      await buildAttackContext(illusionAttack, stats, 'camp', 'test-map', 'normal', {});

      expect(computeRangeEffect).toHaveBeenCalledWith(5, expect.any(Number), expect.any(Object));
    });

    it('applies feat spell range bonus on top of improved illusions', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);

      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'improved_illusions' }] },
      };
      const illusionAttack = {
        ...mockRangedAttack,
        range: 120,
        school: 'Illusion',
      };
      const feats = { spellRangeBonus: 30 };

      await buildAttackContext(illusionAttack, stats, 'camp', 'test-map', 'normal', feats);

      expect(computeRangeEffect).toHaveBeenCalledWith(210, expect.any(Number), expect.any(Object));
    });
  });

  describe('feat range effects', () => {
    it('handles undefined/null featRangeEffects and provided feat effects', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });

      let result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', undefined);
      expect(result).toBeDefined();

      result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', null);
      expect(result).toBeDefined();

      const feats = {
        ignoresMeleeDisadvantage: true,
        ignoresLongRangeDisadvantage: true,
        rangeMultiplier: 1,
        spellRangeBonus: 10,
      };
      result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', feats);
      expect(result).toBeDefined();
    });
  });

  describe('aura effects with map data — target position resolved', () => {
    it('applies wolf aura advantage when target position is resolved', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 10, gridY: 10 }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      // Map-path wolf returns true — need a second call override via mockImplementation
      getWolfAdvantageAgainst.mockImplementation((opts) =>
        opts.targetPos ? { advantage: true } : { advantage: false }
      );

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(getWolfAdvantageAgainst).toHaveBeenCalledWith(
        expect.objectContaining({
          targetPos: { gridX: 10, gridY: 10 },
          mapData: expect.any(Object),
        }),
      );
    });

    it('applies duplicity aura advantage when wolf does not', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('applies lion aura disadvantage when no advantage auras apply', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('applies protection buff disadvantage when target has it', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
      getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('prefers advantage over disadvantage when multiple auras apply', async () => {
      loadMapData.mockResolvedValue(makeMapData(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
      getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });


  });

  describe('aura effects with map data — no target position', () => {
    it('falls back to no-map aura checks when target position is null', async () => {
      loadMapData.mockResolvedValue(makeMapData([{ name: 'Fighter1', gridX: 1, gridY: 1 }]));
      getCombatContext.mockResolvedValue(null);
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(getWolfAdvantageAgainst).toHaveBeenCalledWith(
        expect.objectContaining({ skipRangeCheck: true }),
      );
    });


  });
});
