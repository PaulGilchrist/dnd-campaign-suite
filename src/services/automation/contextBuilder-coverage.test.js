// @improved-by-ai
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
import { hasProtectionBuff } from '../combat/auras/protectionBuffUtils.js';
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

vi.mock('../rules/combat/coverService.js', () => ({
  computeCover: vi.fn(),
}));

vi.mock('../npcs/npcsService.js', () => ({
  loadNPCs: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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

vi.mock('../combat/auras/protectionBuffUtils.js', () => ({
  hasProtectionBuff: vi.fn(),
}));

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(),
  isAuraTarget: vi.fn(),
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
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  hasProtectionBuff.mockReturnValue(false);
  getCombatContext.mockResolvedValue(null);
  getTargetFromAttacker.mockReturnValue(null);
  getDistanceFeet.mockReturnValue(5);
  computeRangeEffect.mockReturnValue({ mode: 'ok' });
  computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
  computeMeleeProximityEffect.mockReturnValue({ mode: 'ok' });
  getNearestPlacedItem.mockReturnValue(null);
  isHostileNPC.mockReturnValue(false);
}

describe('contextBuilder: buildAttackContext — cover AC bonuses (map path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  function makeMapWithPlayersAndNpc(players, npcs) {
    return makeMapData(players, npcs || []);
  }

  describe('nature sanctuary half cover', () => {
    it('applies half cover when target is inside sanctuary cube', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryCubeX') return 3;
        if (key === 'naturesSanctuaryCubeY') return 3;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    it('does not apply sanctuary cover when target is outside the cube', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryCubeX') return 3;
        if (key === 'naturesSanctuaryCubeY') return 3;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not override existing cover when sanctuary acBonus is lower', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryCubeX') return 3;
        if (key === 'naturesSanctuaryCubeY') return 3;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
    });

    it('does not apply sanctuary cover when sanctuary is not active', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply sanctuary cover when sanctuary coordinates are 0', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'naturesSanctuaryActive') return true;
        if (key === 'naturesSanctuaryCubeX') return 0;
        if (key === 'naturesSanctuaryCubeY') return 0;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });
  });

  describe('bulwark of force half cover', () => {
    it('applies half cover when target is in bulwark targets list', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bulwarkOfForceActive') return true;
        if (key === 'bulwarkOfForceTargets') return ['Orc'];
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    it('does not apply bulwark cover when target is not in targets list', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bulwarkOfForceActive') return true;
        if (key === 'bulwarkOfForceTargets') return ['Goblin'];
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply bulwark cover when bulwark is not active', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not override existing cover when bulwark acBonus is lower', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'bulwarkOfForceActive') return true;
        if (key === 'bulwarkOfForceTargets') return ['Orc'];
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
    });
  });

  describe('smite of protection half cover', () => {
    it('applies half cover when target is within aura of protection range', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 5, gridY: 5 }],
        [{ name: 'Orc', gridX: 5, gridY: 5, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 5, 5));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 5, gridY: 5 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 5, gridY: 5 });
      getDistanceFeet.mockReturnValue(30);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      hasAuraOfProtection.mockReturnValue(true);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'smiteOfProtectionActive') return true;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
      expect(result.coverLevel).toBe('half');
    });

    it('does not apply smite cover when smite is not active', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      hasAuraOfProtection.mockReturnValue(true);

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply smite cover when aura source is null (no players on map)', async () => {
      loadMapData.mockResolvedValue(makeMapData([], []));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      hasAuraOfProtection.mockReturnValue(true);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'smiteOfProtectionActive') return true;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply smite cover when target is outside aura range', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 20, gridY: 20 }],
        [{ name: 'Orc', gridX: 20, gridY: 20, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 20, 20));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 20, gridY: 20 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 20, gridY: 20 });
      getDistanceFeet.mockReturnValue(100);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      hasAuraOfProtection.mockReturnValue(true);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'smiteOfProtectionActive') return true;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not override existing cover when smite acBonus is lower', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 5, gridY: 5 }],
        [{ name: 'Orc', gridX: 5, gridY: 5, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 5, 5));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 5, gridY: 5 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 5, gridY: 5 });
      getDistanceFeet.mockReturnValue(30);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      hasAuraOfProtection.mockReturnValue(true);
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'smiteOfProtectionActive') return true;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
    });
  });

  describe('glorious defense AC bonus in cover', () => {
    it('applies glorious defense AC bonus when target is within 10 feet', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 3, gridY: 3 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(10);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 3;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(3);
    });

    it('does not apply glorious defense when target is more than 10 feet away', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 15, gridY: 15 }],
        [{ name: 'Orc', gridX: 15, gridY: 15, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 15, 15));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 15, gridY: 15 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 15, gridY: 15 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 3;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not apply glorious defense when not active', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 3, gridY: 3 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(10);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('does not override existing cover when glorious defense bonus is lower', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 3, gridY: 3 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(10);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 1;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
    });

    it('uses default glorious defense bonus of 1 when active but bonus is null', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: 3, gridY: 3 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(10);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return null;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(1);
    });

    it('does not apply glorious defense when target player not found on map', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
      getDistanceFeet.mockReturnValue(10);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 3;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });
  });

  describe('defensive duelist AC bonus in cover', () => {
    it('applies defensive duelist AC bonus when higher than existing cover', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return 4;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(4);
    });

    it('does not apply defensive duelist when bonus is lower than existing cover', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return 1;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
    });

    it('does not apply defensive duelist when not active', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('defaults defensive duelist bonus to 0 when active but bonus is null', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return null;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });
  });

  describe('bait and switch AC bonus in cover', () => {
    it('applies bait and switch AC bonus when higher than existing cover', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'baitAndSwitchActive') return true;
        if (key === 'baitAndSwitchBonus') return 5;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(5);
    });

    it('does not apply bait and switch when bonus is lower than existing cover', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'baitAndSwitchActive') return true;
        if (key === 'baitAndSwitchBonus') return 1;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBe(2);
    });

    it('does not apply bait and switch when not active', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });

    it('defaults bait and switch bonus to 0 when active but bonus is null', async () => {
      loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
        [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
        [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
      ));
      getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
      getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
      getDistanceFeet.mockReturnValue(50);
      computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'baitAndSwitchActive') return true;
        if (key === 'baitAndSwitchBonus') return null;
        return undefined;
      });

      const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

      expect(result.coverAcBonus).toBeUndefined();
    });
  });
});
