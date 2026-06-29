// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { isActive: isAvengingAngelActive, isAuraTarget } = await import(
  './handlers/class-cleric-paladin/avengingAngelHandler.js'
);
const { collectWeaponMastery } = await import('../combat/automation/automationService.js');

vi.mock('../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn(),
}));

function defaultBaseAttackContext(targetName = 'Orc', target = null) {
  buildBaseAttackContext.mockResolvedValue({
    target: target ?? { name: targetName },
    targetName,
    resistanceNotice: null,
  });
}

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

function defaultAuraMocks() {
  getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
  getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
  getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
  getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
  getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  isAvengingAngelActive.mockReturnValue(false);
  isAuraTarget.mockReturnValue(false);
}

describe('contextBuilder: buildAttackContextSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultBaseAttackContext();
    defaultAuraMocks();
    getRuntimeValue.mockReturnValue(undefined);
    collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });
  });

  describe('basic context fields', () => {
    it('returns context with target and attacker names', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.targetName).toBe('Orc');
      expect(result.attackerName).toBe('Fighter1');
    });

    it('passes through damage type from attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.damageType).toBe('Slashing');
    });

    it('sets isMelee true for melee weaponType', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.isMelee).toBe(true);
    });

    it('sets isMelee true for unarmed weaponType', async () => {
      const unarmedAttack = { ...mockAttack, weaponType: 'unarmed' };
      const result = await buildAttackContextSync(unarmedAttack, mockStats, 'camp', 'normal', {});

      expect(result.isMelee).toBe(true);
    });

    it('sets isMelee false for ranged weaponType', async () => {
      const rangedAttack = { ...mockAttack, weaponType: 'ranged' };
      const result = await buildAttackContextSync(rangedAttack, mockStats, 'camp', 'normal', {});

      expect(result.isMelee).toBe(false);
    });

    it('defaults isWeaponAttack to true when not set on attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.isWeaponAttack).toBe(true);
    });

    it('sets isWeaponAttack to false when explicitly false on attack', async () => {
      const spellAttack = { ...mockAttack, isWeaponAttack: false };
      const result = await buildAttackContextSync(spellAttack, mockStats, 'camp', 'normal', {});

      expect(result.isWeaponAttack).toBe(false);
    });

    it('sets isPsychicBlade true when set on attack', async () => {
      const psychicAttack = { ...mockAttack, isPsychicBlade: true };
      const result = await buildAttackContextSync(psychicAttack, mockStats, 'camp', 'normal', {});

      expect(result.isPsychicBlade).toBe(true);
    });

    it('sets isPsychicBlade false when not set on attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.isPsychicBlade).toBe(false);
    });

    it('returns playerStats reference in result', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.playerStats).toBe(mockStats);
    });

    it('sets autoDamageName from attack name', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageName).toBe('Longsword');
    });

    it('returns hitBonus from attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hitBonus).toBe(7);
    });

    it('returns hitBonusFormula from attack when no modifiers', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hitBonusFormula).toBe('To Hit = 4 + 2 + 1');
    });

    it('returns resistanceNotice from base context', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: { name: 'Orc' },
        targetName: 'Orc',
        resistanceNotice: 'Orc resists Slashing',
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.resistanceNotice).toBe('Orc resists Slashing');
    });
  });

  describe('conditionAttackMode passthrough', () => {
    it('passes conditionAttackMode through when not normal', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'death_attack', {});

      expect(result.forcedMode).toBe('death_attack');
    });

    it('passes any non-normal conditionAttackMode through', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'some_mode', {});

      expect(result.forcedMode).toBe('some_mode');
    });

    it('does not set forcedMode when conditionAttackMode is normal', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });
  });

  describe('stunning strike save advantage', () => {
    it('sets forcedMode to advantage when stored advantage exists for target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === '_advantageOn_Orc') return ['Orc'];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter1',
        '_advantageOn_Orc',
        [],
        'camp',
      );
    });

    it('does not set advantage when stored advantage is not an array', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === '_advantageOn_Orc') return 'not-an-array';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set advantage when targetName is null', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not consume advantage when target name does not match stored list', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === '_advantageOn_Orc') return ['Goblin'];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('goad effect', () => {
    it('sets forcedMode to disadvantage when goad effect targets attacker', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'goad', target: 'Fighter1' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('does not set disadvantage when goad effect targets another creature', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'goad', target: 'Other' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set goad disadvantage when forcedMode is already set', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'goad', target: 'Fighter1' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('innate sorcery bonus', () => {
    it('sets forcedMode to advantage when spellAdvantage is true', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not set advantage when spellAdvantage is false', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set advantage when forcedMode is already set', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('adds saveDcBonus to saveDc', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 2 });
      const attack = { ...mockAttack, saveDc: 13 };

      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveDc).toBe(15);
    });

    it('adds zero saveDcBonus when not set', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
      const attack = { ...mockAttack, saveDc: 13 };

      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveDc).toBe(13);
    });
  });

  describe('activeBuffs — stance damage (rage)', () => {
    it('includes stance damage in autoDamageFormula when rage buff active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+2');
    });

    it('does not include stance damage when no rage buff', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4');
    });

    it('uses rage_damage from class_levels when buff expression is rage_damage', async () => {
      const stats = {
        ...mockStats,
        level: 2,
        class: {
          class_levels: [undefined, { rage_damage: 5 }],
        },
      };
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+5');
    });

    it('defaults to 2 for rage_damage when class_levels entry is undefined', async () => {
      const stats = {
        ...mockStats,
        class: {
          class_levels: [undefined, undefined, undefined],
        },
        level: 4,
      };
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+2');
    });

    it('ignores non-rage_damage damageBonusExpression', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'some_other_expression' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4');
    });

    it('accumulates stance damage from multiple buffs', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [
          { damageBonusExpression: 'rage_damage' },
          { damageBonusExpression: 'rage_damage' },
        ];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+4');
    });
  });

  describe('activeBuffs — reckless attack', () => {
    it('sets forcedMode to advantage when reckless attack buff is active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not override existing forcedMode with reckless attack', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('activeBuffs — Ram', () => {
    it('sets ramActive true when Ram buff is present', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ optionName: 'Ram' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.ramActive).toBe(true);
    });

    it('sets ramActive false when Ram buff is absent', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.ramActive).toBe(false);
    });

    it('does not set forcedMode from Ram buff alone', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ optionName: 'Ram' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });
  });

  describe('activeBuffs — sacred weapon', () => {
    it('defaults sacredWeaponBonus to 0 when not active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(0);
    });
  });

  describe('activeBuffs — vow of enmity', () => {
    it('sets advantage when vow of enmity active and target matches', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        if (key === 'vowOfEnmityTarget') return 'Orc';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not set advantage when vow target does not match', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        if (key === 'vowOfEnmityTarget') return 'Goblin';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set advantage when vow target is undefined', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not override existing forcedMode with vow of enmity', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        if (key === 'vowOfEnmityTarget') return 'Orc';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('activeBuffs — clairvoyant combatant', () => {
    it('sets advantage when clairvoyant combatant active and target matches', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
        if (key === 'clairvoyantCombatantTarget') return 'Orc';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not set advantage when clairvoyant target does not match', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
        if (key === 'clairvoyantCombatantTarget') return 'Goblin';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set advantage when clairvoyant target is undefined', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });
  });

  describe('activeBuffs — create_illusion', () => {
    it('sets advantage when create_illusion buff is active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'create_illusion' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not override existing forcedMode with create_illusion', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'create_illusion' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('activeBuffs — avenging angel', () => {
    it('sets advantage when avenging angel active and target is in aura', async () => {
      isAvengingAngelActive.mockReturnValue(true);
      isAuraTarget.mockReturnValue(true);

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not set advantage when avenging angel active but target not in aura', async () => {
      isAvengingAngelActive.mockReturnValue(true);
      isAuraTarget.mockReturnValue(false);

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set advantage when avenging angel not active', async () => {
      isAvengingAngelActive.mockReturnValue(false);

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not override existing forcedMode with avenging angel', async () => {
      isAvengingAngelActive.mockReturnValue(true);
      isAuraTarget.mockReturnValue(true);

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('aura checks — no map (sync path)', () => {
    it('sets advantage when wolf aura is active', async () => {
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('sets advantage when duplicity aura is active', async () => {
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('sets disadvantage when lion aura is active', async () => {
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('sets disadvantage when protection buff is on target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('does not set disadvantage from protection buff when target is null', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'protection', target: 'Goblin', source: 'Paladin' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('sets disadvantage when corona save disadvantage is active', async () => {
      getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('prefers advantage over disadvantage when multiple auras apply', async () => {
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('does not apply aura checks when forcedMode is already set', async () => {
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('stops checking auras after first advantage match', async () => {
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('stops checking auras after first disadvantage match (when no advantage found)', async () => {
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('distracting strike advantage', () => {
    it('sets advantage and consumes effect when distracting strike exists from another source', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Ally' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'camp',
        'targetEffects',
        [],
        'camp',
      );
    });

    it('does not set advantage when distracting strike is from the attacker themselves', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Fighter1' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not consume effect when distracting strike targets a different creature', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'Ally' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not consume effect when target is null', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: null, source: 'Ally' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('preserves other effects when consuming distracting strike', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Ally' },
          { effect: 'graze', target: 'Orc' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'camp',
        'targetEffects',
        [{ effect: 'graze', target: 'Orc' }],
        'camp',
      );
    });
  });

  describe('hunter lore', () => {
    it('includes hunterLoreNotice when passive exists and target has vulnerability data', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: { vulnerabilities: ['fire'], resistances: [], immunities: [] },
        targetName: 'Orc',
        resistanceNotice: null,
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.hunterLoreNotice).toContain('Vulnerabilities');
      expect(result.hunterLoreNotice).toContain('fire');
    });

    it('includes hunterLoreNotice with all IRV categories when present', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: { vulnerabilities: ['fire'], resistances: ['cold'], immunities: ['poison'] },
        targetName: 'Orc',
        resistanceNotice: null,
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.hunterLoreNotice).toContain('Vulnerabilities');
      expect(result.hunterLoreNotice).toContain('Resistances');
      expect(result.hunterLoreNotice).toContain('Immunities');
    });

    it('includes only present IRV categories in hunterLoreNotice', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: { vulnerabilities: ['fire'], resistances: [], immunities: [] },
        targetName: 'Orc',
        resistanceNotice: null,
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.hunterLoreNotice).toContain('Vulnerabilities');
      expect(result.hunterLoreNotice).not.toContain('Resistances');
      expect(result.hunterLoreNotice).not.toContain('Immunities');
    });

    it('does not include hunterLoreNotice when target has no IRV data', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: { name: 'Orc' },
        targetName: 'Orc',
        resistanceNotice: null,
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.hunterLoreNotice).toBeNull();
    });

    it('does not include hunterLoreNotice when passive does not exist', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hunterLoreNotice).toBeNull();
    });

    it('does not include hunterLoreNotice when target is null', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'hunter_lore' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.hunterLoreNotice).toBeNull();
    });
  });

  describe('critical range', () => {
    it('includes criticalRange from passives', async () => {
      const stats = {
        ...mockStats,
        automation: {
          passives: [{ type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' }],
        },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.criticalRange).toBe('19-20');
    });

    it('returns empty string when no critical range passive', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.criticalRange).toBe('');
    });

    it('ignores critical_range passive without criticalRange value', async () => {
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'critical_range' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.criticalRange).toBe('');
    });

    it('uses last matching critical_range passive when multiple exist', async () => {
      const stats = {
        ...mockStats,
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' },
            { type: 'passive_rule', effect: 'critical_range', criticalRange: '20' },
          ],
        },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.criticalRange).toBe('20');
    });
  });

  describe('glorious defense', () => {
    it('includes gloriousDefenseBonus when active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 2;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.gloriousDefenseBonus).toBe(2);
    });

    it('defaults gloriousDefenseBonus to 1 when active but bonus is null', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return null;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.gloriousDefenseBonus).toBe(1);
    });

    it('defaults gloriousDefenseBonus to 1 when active but bonus is undefined', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.gloriousDefenseBonus).toBe(1);
    });

    it('defaults gloriousDefenseBonus to 1 when active but bonus is 0 (falsy)', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 0;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.gloriousDefenseBonus).toBe(1);
    });

    it('returns 0 when glorious defense not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.gloriousDefenseBonus).toBe(0);
    });
  });

  describe('defensive duelist', () => {
    it('includes defensiveDuelistBonus when active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return 1;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.defensiveDuelistBonus).toBe(1);
    });

    it('defaults defensiveDuelistBonus to 0 when active but bonus is null', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return null;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.defensiveDuelistBonus).toBe(0);
    });

    it('returns 0 when defensive duelist not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.defensiveDuelistBonus).toBe(0);
    });
  });

  describe('bait and switch', () => {
    it('includes baitAndSwitchBonus when active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'baitAndSwitchActive') return true;
        if (key === 'baitAndSwitchBonus') return 3;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.baitAndSwitchBonus).toBe(3);
    });

    it('defaults baitAndSwitchBonus to 0 when active but bonus is null', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'baitAndSwitchActive') return true;
        if (key === 'baitAndSwitchBonus') return null;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.baitAndSwitchBonus).toBe(0);
    });

    it('returns 0 when bait and switch not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.baitAndSwitchBonus).toBe(0);
    });
  });

  describe('stroke of luck', () => {
    it('sets strokeOfLuck true when passive exists and not used', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return false;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.strokeOfLuck).toBe(true);
    });

    it('sets strokeOfLuck false when passive exists but already used', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return true;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.strokeOfLuck).toBe(false);
    });

    it('sets strokeOfLuck false when passive does not exist', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.strokeOfLuck).toBe(false);
    });
  });

  describe('boon of fate', () => {
    it('sets boonOfFate true when passive exists and not used', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'boonOfFateUsed') return false;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'modify_d20_roll' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.boonOfFate).toBe(true);
    });

    it('sets boonOfFate false when passive exists but already used', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'boonOfFateUsed') return true;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'modify_d20_roll' }] },
      };

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.boonOfFate).toBe(false);
    });

    it('sets boonOfFate false when passive does not exist', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.boonOfFate).toBe(false);
    });
  });

  describe('saveDc and saveType', () => {
    it('includes saveType from attack', async () => {
      const attack = { ...mockAttack, saveDc: 13, saveType: 'DEX' };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveType).toBe('DEX');
    });

    it('includes saveType as undefined when not on attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.saveType).toBeUndefined();
    });

    it('includes dcSuccess from attack', async () => {
      const attack = { ...mockAttack, saveDc: 13, saveSuccess: 0.5 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.dcSuccess).toBe(0.5);
    });

    it('includes dcSuccess as undefined when not on attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.dcSuccess).toBeUndefined();
    });

    it('includes base saveDc when no innate sorcery bonus', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
      const attack = { ...mockAttack, saveDc: 13 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveDc).toBe(13);
    });
  });

  describe('graze damage', () => {
    it('includes grazeDamage when weapon has Graze mastery', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(true);
      expect(result.grazeAbilityName).toBe('Strength');
      expect(result.grazeAbilityMod).toBe(4);
    });

    it('includes grazeDamage when weapon has Graze in extraMasteries', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: ['Graze'] });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(true);
      expect(result.grazeAbilityMod).toBe(4);
    });

    it('uses attack.abilityName when provided', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });
      const attack = { ...mockAttack, abilityName: 'Dexterity' };

      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(true);
      expect(result.grazeAbilityName).toBe('Dexterity');
      expect(result.grazeAbilityMod).toBe(3);
    });

    it('defaults grazeAbilityName to Strength when no abilityName on attack', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });
      const attack = { ...mockAttack, abilityName: undefined };

      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.grazeAbilityName).toBe('Strength');
    });

    it('excludes grazeDamage when no Graze mastery', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(false);
      expect(result.grazeAbilityName).toBeNull();
      expect(result.grazeAbilityMod).toBe(0);
    });

    it('excludes grazeDamage when mastery is null', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: null, extraMasteries: [] });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(false);
    });
  });

  describe('forcedMode priority chain', () => {
    it('conditionAttackMode takes highest priority over all advantage sources', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
        return undefined;
      });
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('stunning strike advantage is checked before innate sorcery', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
        if (key === '_advantageOn_Orc') return ['Orc'];
        return undefined;
      });
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('all advantage sources are checked before any disadvantage sources', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
        if (key === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
        return undefined;
      });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });
      getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });
  });

  describe('sapEffect (disadvantage_next_attack)', () => {
    it('sets forcedMode to disadvantage when sap effect targets attacker', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'disadvantage_next_attack', target: 'Fighter1' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('does not set disadvantage when sap effect targets another creature', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'disadvantage_next_attack', target: 'Other' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not set sap disadvantage when forcedMode is already set', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'disadvantage_next_attack', target: 'Fighter1' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'advantage', {});

      expect(result.forcedMode).toBe('advantage');
    });
  });

  describe('next_attack_advantage (vex effect)', () => {
    it('sets advantage and consumes effect when vex effect matches attacker and target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Orc', source: 'Thorn' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'camp',
        'targetEffects',
        [],
        'camp',
      );
    });

    it('does not set advantage when vex effect target does not match attacker', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Other', vexTarget: 'Orc', source: 'Thorn' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not set advantage when vex effect vexTarget does not match attack target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Goblin', source: 'Thorn' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not consume effect when vex effect does not match', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Goblin', source: 'Thorn' },
          { effect: 'graze', target: 'Orc' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('preserves other effects when consuming vex effect', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Orc', source: 'Thorn' },
          { effect: 'graze', target: 'Orc' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'camp',
        'targetEffects',
        [{ effect: 'graze', target: 'Orc' }],
        'camp',
      );
    });

    it('does not set advantage when target is null', async () => {
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: null, source: 'Thorn' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      // null === null is true, so it would match — but targetName is null so the condition `targetName` is falsy
      expect(result.forcedMode).toBeUndefined();
    });

    it('does not override existing forcedMode with vex effect', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Orc', source: 'Thorn' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
    });
  });

  describe('sacred weapon on melee attacks', () => {
    it('adds Charisma bonus to sacredWeaponBonus for melee attacks', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(2);
    });

    it('adds Charisma bonus to hitBonus when sacred weapon is active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hitBonus).toBe(9);
    });

    it('includes sacred weapon text in hitBonusFormula when active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hitBonusFormula).toBe('To Hit = 4 + 2 + 1 + Charisma Bonus (2)');
    });

    it('does not add sacred weapon bonus for ranged attacks', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const rangedAttack = { ...mockAttack, weaponType: 'ranged', hitBonus: 7, hitBonusFormula: 'To Hit = 5 + 2 + 1' };

      const result = await buildAttackContextSync(rangedAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(0);
      expect(result.hitBonus).toBe(7);
      expect(result.hitBonusFormula).toBe('To Hit = 5 + 2 + 1');
    });

    it('adds sacred weapon bonus for unarmed attacks', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const unarmedAttack = { ...mockAttack, weaponType: 'unarmed' };

      const result = await buildAttackContextSync(unarmedAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(2);
    });

    it('caps sacred weapon Charisma bonus at minimum 1', async () => {
      const stats = {
        ...mockStats,
        abilities: [
          { name: 'Charisma', bonus: -1 },
          { name: 'Strength', bonus: 4 },
        ],
      };
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(1);
    });

    it('does not add sacred weapon bonus when not active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(0);
      expect(result.hitBonus).toBe(7);
    });
  });

  describe('weaponType and weaponName', () => {
    it('returns weaponType from attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.weaponType).toBe('melee');
    });

    it('returns weaponName from attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.weaponName).toBe('Longsword');
    });
  });
});
