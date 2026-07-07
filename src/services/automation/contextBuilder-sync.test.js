// @cleaned-by-ai
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

    it('returns playerStats reference in result', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.playerStats).toBe(mockStats);
    });

    it('sets autoDamageName from attack name', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.autoDamageName).toBe('Longsword');
    });

    it('returns hitBonus and hitBonusFormula from attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.hitBonus).toBe(7);
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
    it('passes non-normal conditionAttackMode through as forcedMode', async () => {
      let result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'death_attack', {});
      expect(result.forcedMode).toBe('death_attack');

      result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'some_mode', {});
      expect(result.forcedMode).toBe('some_mode');
    });

    it('does not set forcedMode when conditionAttackMode is normal', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBeUndefined();
    });
  });

  describe('stunning strike save advantage', () => {
    it('sets forcedMode to advantage when stored advantage exists for target and consumes it', async () => {
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




  });

  describe('goad and sap effects', () => {
    it('sets forcedMode to disadvantage when goad or sap effect targets attacker', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'goad', target: 'Fighter1' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.forcedMode).toBe('disadvantage');

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'disadvantage_next_attack', target: 'Fighter1' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const sapResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(sapResult.forcedMode).toBe('disadvantage');
    });

    it('does not set disadvantage when goad/sap targets another creature', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'goad', target: 'Other' }];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.forcedMode).toBeUndefined();
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



    it('adds saveDcBonus to saveDc', async () => {
      getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 2 });
      const attack = { ...mockAttack, saveDc: 13 };

      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveDc).toBe(15);
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

    it('accumulates stance damage from multiple rage buffs', async () => {
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
  });

  describe('activeBuffs — sacred weapon', () => {
    it('adds Charisma bonus to sacredWeaponBonus and hitBonus for melee attacks', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'sacred_weapon' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.sacredWeaponBonus).toBe(2);
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


  });

  describe('activeBuffs — vow of enmity and clairvoyant combatant', () => {
    it('sets advantage when vow of enmity or clairvoyant combatant active with matching target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        if (key === 'vowOfEnmityTarget') return 'Orc';
        return undefined;
      });

      const vowResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(vowResult.forcedMode).toBe('advantage');

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
        if (key === 'clairvoyantCombatantTarget') return 'Orc';
        return undefined;
      });

      const clairResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(clairResult.forcedMode).toBe('advantage');
    });

    it('does not set advantage when vow/clairvoyant target does not match or is undefined', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'vow_of_enmity' }];
        if (key === 'vowOfEnmityTarget') return 'Goblin';
        return undefined;
      });

      const vowResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(vowResult.forcedMode).toBeUndefined();

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'clairvoyant_combatant' }];
        return undefined;
      });

      const clairResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(clairResult.forcedMode).toBeUndefined();
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


  });

  describe('aura checks — no map (sync path)', () => {
    it('sets advantage when wolf or duplicity aura is active', async () => {
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.forcedMode).toBe('advantage');

      getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
      getDuplicityAdvantageAgainst.mockReturnValue({ advantage: true });

      const duplicityResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(duplicityResult.forcedMode).toBe('advantage');
    });

    it('sets disadvantage when lion aura or corona save disadvantage is active', async () => {
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.forcedMode).toBe('disadvantage');

      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
      getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: true });

      const coronaResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(coronaResult.forcedMode).toBe('disadvantage');
    });

    it('sets disadvantage when protection buff is on target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [{ effect: 'protection', target: 'Orc', source: 'Paladin' }];
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('disadvantage');
    });

    it('prefers advantage over disadvantage when multiple auras apply', async () => {
      getWolfAdvantageAgainst.mockReturnValue({ advantage: true });
      getLionDisadvantageAgainst.mockReturnValue({ disadvantage: true });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.forcedMode).toBe('advantage');
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

    it('does not set advantage or consume when distracting strike is from the attacker or targets a different creature', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: 'Orc', source: 'Fighter1' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const selfResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(selfResult.forcedMode).toBeUndefined();
      expect(setRuntimeValue).not.toHaveBeenCalled();

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'distracting_strike_advantage', target: 'Goblin', source: 'Ally' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const targetResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(targetResult.forcedMode).toBeUndefined();
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


    it('does not include hunterLoreNotice when target has no IRV data or passive does not exist', async () => {
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

      const noPassiveResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(noPassiveResult.hunterLoreNotice).toBeNull();
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

    it('returns empty string when no critical range passive or passive lacks value', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.criticalRange).toBe('');

      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'passive_rule', effect: 'critical_range' }] },
      };

      const noValueResult = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(noValueResult.criticalRange).toBe('');
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

    it('defaults gloriousDefenseBonus to 1 when active but bonus is falsy', async () => {
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

  describe('defensive duelist and bait and switch', () => {
    it('includes AC bonuses when active', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'defensiveDuelistActive') return true;
        if (key === 'defensiveDuelistBonus') return 1;
        return undefined;
      });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(result.defensiveDuelistBonus).toBe(1);

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'baitAndSwitchActive') return true;
        if (key === 'baitAndSwitchBonus') return 3;
        return undefined;
      });

      const baitResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(baitResult.baitAndSwitchBonus).toBe(3);
    });


  });

  describe('stroke of luck and boon of fate', () => {
    it('sets available when passive exists and not used', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return false;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      };

      const strokeResult = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(strokeResult.strokeOfLuck).toBe(true);

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'boonOfFateUsed') return false;
        return undefined;
      });
      const boonStats = {
        ...mockStats,
        automation: { passives: [{ type: 'modify_d20_roll' }] },
      };

      const boonResult = await buildAttackContextSync(mockAttack, boonStats, 'camp', 'normal', {});
      expect(boonResult.boonOfFate).toBe(true);
    });

    it('sets unavailable when passive exists but already used or passive does not exist', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'strokeOfLuckUsed') return true;
        return undefined;
      });
      const stats = {
        ...mockStats,
        automation: { passives: [{ type: 'stroke_of_luck' }] },
      };

      const strokeResult = await buildAttackContextSync(mockAttack, stats, 'camp', 'normal', {});
      expect(strokeResult.strokeOfLuck).toBe(false);

      const boonResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(boonResult.boonOfFate).toBe(false);
    });
  });

  describe('saveDc and saveType', () => {
    it('includes saveType and dcSuccess from attack when present', async () => {
      const attack = { ...mockAttack, saveDc: 13, saveType: 'DEX', saveSuccess: 0.5 };
      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.saveType).toBe('DEX');
      expect(result.dcSuccess).toBe(0.5);
    });

    it('includes saveType and dcSuccess as undefined when not on attack', async () => {
      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.saveType).toBeUndefined();
      expect(result.dcSuccess).toBeUndefined();
    });
  });

  describe('graze damage', () => {
    it('includes grazeDamage when weapon has Graze mastery in base or extra', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(true);
      expect(result.grazeAbilityName).toBe('Strength');
      expect(result.grazeAbilityMod).toBe(4);

      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: ['Graze'] });

      const extraResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(extraResult.grazeDamage).toBe(true);
      expect(extraResult.grazeAbilityMod).toBe(4);
    });

    it('uses attack.abilityName when provided, defaults to Strength', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });
      const attack = { ...mockAttack, abilityName: 'Dexterity' };

      const result = await buildAttackContextSync(attack, mockStats, 'camp', 'normal', {});

      expect(result.grazeAbilityName).toBe('Dexterity');
      expect(result.grazeAbilityMod).toBe(3);

      collectWeaponMastery.mockReturnValue({ baseMastery: 'Graze', extraMasteries: [] });
      const noAbilityAttack = { ...mockAttack, abilityName: undefined };

      const defaultResult = await buildAttackContextSync(noAbilityAttack, mockStats, 'camp', 'normal', {});
      expect(defaultResult.grazeAbilityName).toBe('Strength');
    });

    it('excludes grazeDamage when no Graze mastery', async () => {
      collectWeaponMastery.mockReturnValue({ baseMastery: 'Cleave', extraMasteries: [] });

      const result = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});

      expect(result.grazeDamage).toBe(false);
      expect(result.grazeAbilityName).toBeNull();
      expect(result.grazeAbilityMod).toBe(0);
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

    it('does not set advantage or consume when vex effect does not match', async () => {
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

      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'targetEffects') return [
          { effect: 'next_attack_advantage', target: 'Fighter1', vexTarget: 'Goblin', source: 'Thorn' },
        ];
        if (key === 'activeBuffs') return [];
        return undefined;
      });

      const mismatchResult = await buildAttackContextSync(mockAttack, mockStats, 'camp', 'normal', {});
      expect(mismatchResult.forcedMode).toBeUndefined();
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


  });
});
// @cleaned-by-ai
