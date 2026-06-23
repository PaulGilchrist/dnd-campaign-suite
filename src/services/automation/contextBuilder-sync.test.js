import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAttackContextSync } from './contextBuilder.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

describe('contextBuilder: buildAttackContextSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic context object', () => {
    it('returns a context object with required fields', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result).toBeDefined();
      expect(result.targetName).toBe('Orc');
      expect(result.attackerName).toBe('Fighter1');
      expect(result.damageType).toBe('Slashing');
      expect(result.isMelee).toBe(true);
      expect(result.hitBonus).toBe(7);
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

    it('includes isWeaponAttack as true when not explicitly false', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isWeaponAttack).toBe(true);
    });

    it('includes isWeaponAttack as false when explicitly false', async () => {
      const spellAttack = { ...mockAttack, isWeaponAttack: false };
      const result = await buildAttackContextSync(spellAttack, mockStats, 'camp', 'normal', {});
      expect(result.isWeaponAttack).toBe(false);
    });

    it('includes isPsychicBlade when set on attack', async () => {
      const psychicAttack = { ...mockAttack, isPsychicBlade: true };
      const result = await buildAttackContextSync(psychicAttack, mockStats, 'camp', 'normal', {});
      expect(result.isPsychicBlade).toBe(true);
    });

    it('includes isPsychicBlade as false when not set', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.isPsychicBlade).toBe(false);
    });

    it('includes playerStats in result', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.playerStats).toBe(mockStats);
    });

    it('includes autoDamageName from attack name', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.autoDamageName).toBe('Longsword');
    });
  });

  describe('forcedMode determination', () => {
    it('passes through conditionAttackMode when not normal', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'death_attack', {});
      expect(result.forcedMode).toBe('death_attack');
    });

    it('passes through conditionAttackMode with other non-normal values', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'some_mode', {});
      expect(result.forcedMode).toBe('some_mode');
    });

    it('sets forcedMode to advantage when save advantage is stored and consumed', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === '_advantageOn_Orc') return ['Orc'];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Fighter1', '_advantageOn_Orc', [], 'camp'
      );
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('does not set advantage when storedAdvantage is not an array', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === '_advantageOn_Orc') return 'not-an-array';
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('does not set advantage when targetName is null for stunning strike check', async () => {
      const { buildBaseAttackContext } = await import('./common/damageRoll.js');
      buildBaseAttackContext.mockResolvedValue({
        target: null,
        targetName: null,
        resistanceNotice: null,
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });

    it('does not override forcedMode once already set by conditionAttackMode', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ optionName: 'Ram' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'disadvantage', {});

      expect(result.forcedMode).toBe('disadvantage');
      expect(result.ramActive).toBe(true);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets forcedMode to advantage when innate sorcery spell advantage is active', async () => {
      const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ spellAdvantage: true, saveDcBonus: 0 });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.forcedMode).toBe('advantage');
    });

    it('sets forcedMode to advantage when reckless attack buff is active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'advantage_attacks_disadvantage_against' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets forcedMode to advantage when ram buff is active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ optionName: 'Ram' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      expect(result.ramActive).toBe(true);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets forcedMode to advantage when vow of enmity is active and target matches', async () => {
      const { hasProtectionBuff } = await import('../combat/auras/protectionBuffUtils.js');
      const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
      const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
      const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
      const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        if (key === 'vowOfEnmityTarget') return 'Orc';
        return undefined;
      });
      vi.mocked(hasProtectionBuff).mockReturnValue(false);
      vi.mocked(getWolfAdvantageAgainst).mockReturnValue({ advantage: false });
      vi.mocked(getDuplicityAdvantageAgainst).mockReturnValue({ advantage: false });
      vi.mocked(getLionDisadvantageAgainst).mockReturnValue({ disadvantage: false });
      vi.mocked(getCoronaSaveDisadvantage).mockReturnValue({ disadvantage: false });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets forcedMode to advantage when clairvoyant combatant is active and target matches', async () => {
      const { hasProtectionBuff } = await import('../combat/auras/protectionBuffUtils.js');
      const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
      const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
      const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
      const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
        if (key === 'clairvoyantCombatantTarget') return 'Orc';
        return undefined;
      });
      vi.mocked(hasProtectionBuff).mockReturnValue(false);
      vi.mocked(getWolfAdvantageAgainst).mockReturnValue({ advantage: false });
      vi.mocked(getDuplicityAdvantageAgainst).mockReturnValue({ advantage: false });
      vi.mocked(getLionDisadvantageAgainst).mockReturnValue({ disadvantage: false });
      vi.mocked(getCoronaSaveDisadvantage).mockReturnValue({ disadvantage: false });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets forcedMode to advantage when avenging angel is active and target is in aura', async () => {
      const { isActive: isAvengingAngelActive, isAuraTarget } = await import(
        './handlers/class-cleric-paladin/avengingAngelHandler.js'
      );
      vi.mocked(isAvengingAngelActive).mockReturnValue(true);
      vi.mocked(isAuraTarget).mockReturnValue(true);

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('sets forcedMode to advantage when create_illusion buff is active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'create_illusion' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets forcedMode to advantage when wolf aura is active', async () => {
      const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
      vi.mocked(getWolfAdvantageAgainst).mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('sets forcedMode to advantage when duplicity aura is active', async () => {
      const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
      vi.mocked(getDuplicityAdvantageAgainst).mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });

    it('prefers earlier advantage conditions over later disadvantage ones', async () => {
      const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
      const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
      vi.mocked(getWolfAdvantageAgainst).mockReturnValue({ advantage: true });
      vi.mocked(getLionDisadvantageAgainst).mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
    });
  });

  describe('sacred weapon', () => {
    it('does not modify hitBonusFormula when sacred weapon not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hitBonusFormula).toBe('To Hit = 4 + 2 + 1');
    });

    it('includes sacredWeaponBonus as 0 when sacred weapon not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(0);
    });
  });

  describe('stance damage bonus (rage)', () => {
    it('includes stance damage bonus in autoDamageFormula when rage buff active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+2');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('does not include stance damage when no rage buff', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4');
    });

    it('uses rage_damage from class_levels when buff is rage_damage', async () => {
      const stats = {
        ...mockStats,
        level: 2,
        class: {
          class_levels: [undefined, { rage_damage: 5 }],
        },
      };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+5');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('defaults to 2 for rage_damage when class_levels entry is undefined', async () => {
      const stats = {
        ...mockStats,
        class: {
          class_levels: [undefined, undefined, undefined],
        },
        level: 4,
      };
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'rage_damage' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4+2');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('ignores non-rage_damage damageBonusExpression', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ damageBonusExpression: 'some_other_expression' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageFormula).toBe('1d8+4');
      vi.mocked(getRuntimeValue).mockRestore();
    });
  });

  describe('saveDc and saveType', () => {
    it('adds innate sorcery saveDcBonus to saveDc', async () => {
      const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ spellAdvantage: false, saveDcBonus: 1 });

      const attack = { ...mockAttack, saveDc: 13 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveDc).toBe(14);
    });

    it('includes saveType from attack', async () => {
      const attack = { ...mockAttack, saveDc: 13, saveType: 'DEX' };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveType).toBe('DEX');
    });

    it('includes dcSuccess from attack', async () => {
      const attack = { ...mockAttack, saveDc: 13, saveSuccess: 0.5 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.dcSuccess).toBe(0.5);
    });
  });

  describe('hunter lore', () => {
    it('includes hunterLoreNotice when hunter lore passive exists and target has info', async () => {
      const { buildBaseAttackContext } = await import('./common/damageRoll.js');
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

    it('does not include hunterLoreNotice when target has no IRV data', async () => {
      const { buildBaseAttackContext } = await import('./common/damageRoll.js');
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
      const { buildBaseAttackContext } = await import('./common/damageRoll.js');
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

    it('includes only present IRV categories in hunterLoreNotice', async () => {
      const { buildBaseAttackContext } = await import('./common/damageRoll.js');
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
  });

  describe('critical range', () => {
    it('includes criticalRange from passives', async () => {
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' }] },
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
  });

  describe('glorious defense', () => {
    it('includes gloriousDefenseBonus when active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return 2;
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.gloriousDefenseBonus).toBe(2);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('defaults gloriousDefenseBonus to 1 when active but no bonus stored', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'gloriousDefenseActive') return true;
        if (key === 'gloriousDefenseBonus') return null;
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.gloriousDefenseBonus).toBe(1);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('returns 0 when glorious defense not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.gloriousDefenseBonus).toBe(0);
    });
  });

  describe('defensive duelist', () => {
    it('includes defensiveDuelistBonus when active', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return 1;
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.defensiveDuelistBonus).toBe(1);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('defaults defensiveDuelistBonus to 0 when active but no bonus stored', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return null;
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.defensiveDuelistBonus).toBe(0);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('returns 0 when defensive duelist not active', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.defensiveDuelistBonus).toBe(0);
    });
  });

  describe('stroke of luck', () => {
    it('includes strokeOfLuck when available', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return false;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      };
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(result.strokeOfLuck).toBe(true);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('excludes strokeOfLuck when already used', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return true;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      };
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(result.strokeOfLuck).toBe(false);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('excludes strokeOfLuck when passive does not exist', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.strokeOfLuck).toBe(false);
    });
  });

  describe('boon of fate', () => {
    it('includes boonOfFate when available', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'boonOfFateUsed') return false;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'modify_d20_roll' }] },
      };
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(result.boonOfFate).toBe(true);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('excludes boonOfFate when already used', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'boonOfFateUsed') return true;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'modify_d20_roll' }] },
      };
      const result = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(result.boonOfFate).toBe(false);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('excludes boonOfFate when passive does not exist', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.boonOfFate).toBe(false);
    });
  });

  describe('graze damage', () => {
    it('includes grazeDamage when graze effect exists', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Orc', abilityName: 'STR' }];
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.grazeDamage).toBe(true);
      expect(result.grazeAbilityName).toBe('STR');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('defaults grazeAbilityName to attack.abilityName when not in graze effect', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Orc' }];
        return undefined;
      });
      const attack = { ...mockAttack, abilityName: 'DEX' };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});
      expect(result.grazeAbilityName).toBe('DEX');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('defaults grazeAbilityName to STR when not in graze effect or attack', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Orc' }];
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.grazeAbilityName).toBe('STR');
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('includes grazeAbilityMod from playerStats abilities', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Orc', abilityName: 'Strength' }];
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.grazeAbilityMod).toBe(4);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('sets grazeAbilityMod to 0 when ability not found in playerStats', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Orc', abilityName: 'Intelligence' }];
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.grazeAbilityMod).toBe(0);
      vi.mocked(getRuntimeValue).mockRestore();
    });

    it('excludes grazeDamage when no graze effect exists', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.grazeDamage).toBe(false);
      expect(result.grazeAbilityName).toBeNull();
      expect(result.grazeAbilityMod).toBe(0);
    });

    it('ignores graze effect for different target', async () => {
      vi.mocked(getRuntimeValue).mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'graze', target: 'Goblin' }];
        return undefined;
      });
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.grazeDamage).toBe(false);
      vi.mocked(getRuntimeValue).mockRestore();
    });
  });
});
