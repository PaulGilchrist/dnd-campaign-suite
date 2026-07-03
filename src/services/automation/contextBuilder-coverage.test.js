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

  describe('cover AC bonus features', () => {
    // Each feature follows the same pattern: check runtime key, compare against existing cover,
    // apply if higher. These tests verify the shared behavior with representative features.
    const coverFeatureTests = [
      {
        name: "nature's sanctuary",
        activeKey: 'naturesSanctuaryActive',
        coordsXKey: 'naturesSanctuaryCubeX',
        coordsYKey: 'naturesSanctuaryCubeY',
        setupRuntime: (getRuntimeValue, inCube = true) => {
          getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'naturesSanctuaryActive') return true;
            if (key === 'naturesSanctuaryCubeX') return inCube ? 3 : 10;
            if (key === 'naturesSanctuaryCubeY') return inCube ? 3 : 10;
            return undefined;
          });
        },
        mockSetup: () => {
          loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
            [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
            [{ name: 'Orc', gridX: 3, gridY: 3, type: 'npc' }],
          ));
          getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 3, 3));
          getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
          getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 3, gridY: 3 });
          getDistanceFeet.mockReturnValue(50);
        },
      },
      {
        name: 'bulwark of force',
        activeKey: 'bulwarkOfForceActive',
        targetsKey: 'bulwarkOfForceTargets',
        setupRuntime: (getRuntimeValue, inList = true) => {
          getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'bulwarkOfForceActive') return true;
            if (key === 'bulwarkOfForceTargets') return inList ? ['Orc'] : ['Goblin'];
            return undefined;
          });
        },
        mockSetup: () => {
          loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
            [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
            [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
          ));
          getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
          getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
          getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
          getDistanceFeet.mockReturnValue(50);
        },
      },
      {
        name: 'glorious defense',
        activeKey: 'gloriousDefenseActive',
        bonusKey: 'gloriousDefenseBonus',
        setupRuntime: (getRuntimeValue, bonus = 3, _withinRange = true) => {
          getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'gloriousDefenseActive') return true;
            if (key === 'gloriousDefenseBonus') return bonus;
            return undefined;
          });
        },
        mockSetup: (targetGridX = 3, targetGridY = 3) => {
          loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
            [{ name: 'Fighter1', gridX: 1, gridY: 1 }, { name: 'Orc', gridX: targetGridX, gridY: targetGridY }],
            [{ name: 'Orc', gridX: targetGridX, gridY: targetGridY, type: 'npc' }],
          ));
          getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', targetGridX, targetGridY));
          getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: targetGridX, gridY: targetGridY });
          getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: targetGridX, gridY: targetGridY });
          getDistanceFeet.mockReturnValue(targetGridX <= 3 ? 10 : 50);
        },
      },
      {
        name: 'defensive duelist',
        activeKey: 'defensiveDuelistActive',
        bonusKey: 'defensiveDuelistBonus',
        setupRuntime: (getRuntimeValue, bonus = 4) => {
          getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'defensiveDuelistActive') return true;
            if (key === 'defensiveDuelistBonus') return bonus;
            return undefined;
          });
        },
        mockSetup: () => {
          loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
            [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
            [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
          ));
          getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
          getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
          getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
          getDistanceFeet.mockReturnValue(50);
        },
      },
      {
        name: 'bait and switch',
        activeKey: 'baitAndSwitchActive',
        bonusKey: 'baitAndSwitchBonus',
        setupRuntime: (getRuntimeValue, bonus = 5) => {
          getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'baitAndSwitchActive') return true;
            if (key === 'baitAndSwitchBonus') return bonus;
            return undefined;
          });
        },
        mockSetup: () => {
          loadMapData.mockResolvedValue(makeMapWithPlayersAndNpc(
            [{ name: 'Fighter1', gridX: 1, gridY: 1 }],
            [{ name: 'Orc', gridX: 10, gridY: 10, type: 'npc' }],
          ));
          getCombatContext.mockResolvedValue(makeCombatContext('Fighter1', 'Orc', 10, 10));
          getTargetFromAttacker.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
          getNearestPlacedItem.mockReturnValue({ name: 'Orc', gridX: 10, gridY: 10 });
          getDistanceFeet.mockReturnValue(50);
        },
      },
    ];

    for (const feature of coverFeatureTests) {
      describe(`${feature.name}`, () => {
        it('applies AC bonus when feature is active and bonus is higher than existing cover', async () => {
          feature.mockSetup();
          computeCover.mockReturnValue({ level: 'none', acBonus: 0 });
          feature.setupRuntime(getRuntimeValue);

          const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

          expect(result.coverAcBonus).toBeDefined();
          expect(result.coverAcBonus).toBeGreaterThan(0);
        });

        it('does not apply AC bonus when feature is not active', async () => {
          feature.mockSetup();
          computeCover.mockReturnValue({ level: 'none', acBonus: 0 });

          const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

          expect(result.coverAcBonus).toBeUndefined();
        });

        it('does not override existing cover when existing bonus is higher or equal', async () => {
          feature.mockSetup();
          computeCover.mockReturnValue({ level: 'half', acBonus: 2 });
          feature.setupRuntime(getRuntimeValue, 1);

          const result = await buildAttackContext(mockRangedAttack, mockStats, 'camp', 'test-map', 'normal', {});

          expect(result.coverAcBonus).toBe(2);
        });
      });
    }

    describe('smite of protection', () => {
      it('applies half cover when smite is active and target is within aura range', async () => {
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
    });
  });
});
