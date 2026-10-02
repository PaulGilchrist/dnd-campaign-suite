// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({
  isActive: vi.fn(),
  isAuraTarget: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({ handle: vi.fn(),
  endSanctuary: vi.fn(),
}));

vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
  isCreatureWarded: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));

vi.mock('../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }),
}));

vi.mock('../combat/automation/automationExpressions.js', () => ({
  resolveDiceExpression: vi.fn(),
}));

vi.mock('../combat/automation/automationPassives.js', () => ({
  isResilientSphereActive: vi.fn().mockReturnValue(false),
}));

vi.mock('../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn().mockReturnValue(1),
}));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { isActive: isAvengingAngelActive, isAuraTarget: checkIsAuraTarget } =
  await import('./handlers/class-cleric-paladin/avengingAngelHandler.js');
const { collectWeaponMastery } = await import('../combat/automation/automationService.js');
const { isResilientSphereActive } = await import('../combat/automation/automationPassives.js');

const mockStats = {
  name: 'Fighter1',
  level: 5,
  proficiency: 2,
  class: {
    class_levels: [{ rage_damage: 2 }],
  },
  abilities: [
    { name: 'Charisma', bonus: 2 },
    { name: 'Strength', bonus: 4 },
    { name: 'Dexterity', bonus: 3 },
  ],
  automation: {
    passives: [],
  },
};

const mockAttack = {
  name: 'Longsword',
  damage: '1d8+4',
  damageType: 'Slashing',
  hitBonus: 7,
  hitBonusFormula: 'To Hit = 4 + 2 + 1',
  weaponType: 'melee',
};

function defaultBaseAttackContext(targetName = 'Orc', target = null) {
  buildBaseAttackContext.mockResolvedValue({
    target: target ?? { name: targetName },
    targetName,
    resistanceNotice: null,
  });
}

function defaultAuraMocks() {
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  isAvengingAngelActive.mockReturnValue(false);
  checkIsAuraTarget.mockReturnValue(false);
  collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
  isResilientSphereActive.mockReturnValue(false);
}

describe('contextBuilder-sync: basic context fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    getRuntimeValue.mockReturnValue(undefined);
    defaultAuraMocks();
  });

  describe('target and attacker names', () => {
    it('returns context with target and attacker names from base context', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.targetName).toBe('Orc');
      expect(result.attackerName).toBe('Fighter1');
    });
  });

  describe('damage and weapon properties', () => {
    it('passes through damage type from attack with fallback to damage_type_primary', async () => {
      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.damageType).toBe('Slashing');

      const altAttack = { ...mockAttack, damageType: undefined, damage_type_primary: 'Bludgeoning' };
      result = await buildAttackContextSync(altAttack, mockStats, 'camp', 'normal', {});
      expect(result.damageType).toBe('Bludgeoning');
    });

    it('sets isMelee true for melee and unarmed, false for ranged', async () => {
      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isMelee).toBe(true);

      const unarmedAttack = { ...mockAttack, weaponType: 'unarmed' };
      result = await buildAttackContextSync(unarmedAttack, mockStats, 'camp', 'normal', {});
      expect(result.isMelee).toBe(true);

      const rangedAttack = { ...mockAttack, weaponType: 'ranged' };
      result = await buildAttackContextSync(rangedAttack, mockStats, 'camp', 'normal', {});
      expect(result.isMelee).toBe(false);
    });

    it('defaults isWeaponAttack to true, sets false when explicitly false', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isWeaponAttack).toBe(true);

      const spellAttack = { ...mockAttack, isWeaponAttack: false };
      const spellResult = await buildAttackContextSync(spellAttack, mockStats, 'camp', 'normal', {});
      expect(spellResult.isWeaponAttack).toBe(false);
    });

    it('sets isPsychicBlade true when set on attack, false otherwise', async () => {
      const psychicAttack = { ...mockAttack, isPsychicBlade: true };
      const result = await buildAttackContextSync(psychicAttack, mockStats, 'camp', 'normal', {});
      expect(result.isPsychicBlade).toBe(true);

      const normalResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(normalResult.isPsychicBlade).toBe(false);
    });
  });

  describe('resistance notice passthrough', () => {
    it('passes resistanceNotice through from base context (with value and null)', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: { name: 'Orc' },
        targetName: 'Orc',
        resistanceNotice: 'Orc resists Slashing',
      });

      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.resistanceNotice).toBe('Orc resists Slashing');

      buildBaseAttackContext.mockResolvedValue({
        target: { name: 'Orc' },
        targetName: 'Orc',
        resistanceNotice: null,
      });

      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.resistanceNotice).toBeNull();
    });
  });

  describe('conditionAttackMode passthrough (forcedMode)', () => {
    it('passes non-normal conditionAttackMode through as forcedMode, leaves undefined for normal', async () => {
      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'death_attack', {});
      expect(result.forcedMode).toBe('death_attack');

      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'some_mode', {});
      expect(result.forcedMode).toBe('some_mode');

      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.forcedMode).toBeUndefined();
    });

    it('preserves forcedMode from conditionAttackMode through all advantage/disadvantage logic', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_advantage_against' }];
        return undefined;
      });
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });

      // Even with multiple advantage sources, conditionAttackMode='disadvantage' wins
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('save DC and type passthrough', () => {
    it('includes saveType and dcSuccess from attack when present, undefined when not', async () => {
      const attack = { ...mockAttack, saveDc: 13, saveType: 'DEX', saveSuccess: 0.5 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveType).toBe('DEX');
      expect(result.dcSuccess).toBe(0.5);

      const result2 = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result2.saveType).toBeUndefined();
      expect(result2.dcSuccess).toBeUndefined();
    });

    it('includes saveDc from attack when present, NaN when not', async () => {
      const attack = { ...mockAttack, saveDc: 15 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});
      expect(result.saveDc).toBe(15);

      const result2 = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result2.saveDc).toBeNaN();
    });
  });

  describe('antimagic field early return', () => {
    it('returns auto miss when attacker is affected by antimagic field and attack is not a weapon attack', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return [
          { effect: 'antimagic_field', target: 'Fighter1' },
        ];
        return undefined;
      });

      const spellAttack = { ...mockAttack, isWeaponAttack: false, weaponType: undefined };
      const result = await buildAttackContextSync(spellAttack, mockStats, 'camp', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Antimagic Field blocks non-weapon attacks');
      expect(result.notice).toBe('Attack blocked by Antimagic Field — only weapon attacks are allowed.');
      expect(result.forcedMode).toBeUndefined();
      expect(result.hitBonus).toBe(0);
      expect(result.isMelee).toBe(false);
      expect(result.isWeaponAttack).toBe(false);
    });

    it('returns auto miss when target is affected by antimagic field and attack is not a weapon attack', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return [
          { effect: 'antimagic_field', target: 'Orc' },
        ];
        return undefined;
      });

      const spellAttack = { ...mockAttack, isWeaponAttack: false, weaponType: undefined };
      const result = await buildAttackContextSync(spellAttack, mockStats, 'camp', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Antimagic Field blocks non-weapon attacks');
    });

    it('allows weapon attacks and does not trigger when no one is affected or targetName is null', async () => {
      // Weapon attacks pass through even when attacker affected
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return [
          { effect: 'antimagic_field', target: 'Fighter1' },
        ];
        return undefined;
      });

      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isAutoMiss).toBeUndefined();

      // No one affected
      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isAutoMiss).toBeUndefined();

      // Null targetName does not trigger block
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'targetEffects') return [
          { effect: 'antimagic_field', target: 'Fighter1' },
        ];
        return undefined;
      });

      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isAutoMiss).toBeUndefined();
    });
  });

  describe('resilient sphere early return', () => {
    it('returns auto miss when attacker or target is enclosed in resilient sphere', async () => {
      isResilientSphereActive.mockReturnValue(true);

      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Resilient Sphere blocks attacks — nothing passes through the barrier');
      expect(result.notice).toBe('Attack blocked by Resilient Sphere — nothing can pass through the barrier.');
      expect(result.forcedMode).toBeUndefined();
      expect(result.hitBonus).toBe(0);

      isResilientSphereActive.mockImplementation((name) => name === 'Orc');

      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.isAutoMiss).toBe(true);
      expect(result.rangeReason).toBe('Resilient Sphere blocks attacks — nothing passes through the barrier');
    });

    it('does not trigger when no one is in a sphere or both are in spheres', async () => {
      isResilientSphereActive.mockReturnValue(false);

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.isAutoMiss).toBeUndefined();
      expect(result.forcedMode).toBeUndefined();

      isResilientSphereActive.mockReturnValue(true);

      const result2 = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result2.isAutoMiss).toBe(true);
    });
  });

  describe('hitBonus undefined on attack object', () => {
    it('defaults to 0 instead of producing NaN when attack.hitBonus is undefined', async () => {
      const attackWithoutHitBonus = {
        name: 'Greataxe',
        damage: '1d12',
        damageType: 'Slashing',
        weaponType: 'melee',
        hitBonus: undefined,
      };

      const result = await buildAttackContextSync(attackWithoutHitBonus, mockStats, 'camp', 'normal', {});

      expect(result.hitBonus).toBe(0);
      expect(Number.isNaN(result.hitBonus)).toBe(false);
    });

    it('defaults to 0 when attack.hitBonus is null', async () => {
      const attackWithNullHitBonus = {
        name: 'Greataxe',
        damage: '1d12',
        damageType: 'Slashing',
        weaponType: 'melee',
        hitBonus: null,
      };

      const result = await buildAttackContextSync(attackWithNullHitBonus, mockStats, 'camp', 'normal', {});

      expect(result.hitBonus).toBe(0);
      expect(Number.isNaN(result.hitBonus)).toBe(false);
    });
  });
});
