// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeAutoDamage } from './useAttackDamageResolution.js';

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

import * as postCastRiderService from '../../services/rules/spells/postCastRiderService.js';

const makePlayerStats = (overrides = {}) => ({
  name: 'TestWizard',
  level: 10,
  abilities: [
    { name: 'Strength', bonus: 1 },
    { name: 'Dexterity', bonus: 2 },
    { name: 'Constitution', bonus: 3 },
    { name: 'Intelligence', bonus: 4 },
    { name: 'Wisdom', bonus: 5 },
    { name: 'Charisma', bonus: 6 },
  ],
  proficiency: 5,
  class: { name: 'Wizard', class_levels: [{ level: 10 }] },
  automation: { actions: [], passives: [] },
  attacks: [],
  ...overrides,
});

const makeAutoDamage = (overrides = {}) => ({
  name: 'Fire Bolt',
  formula: '1d10+4',
  damageType: 'Fire',
  targetName: 'Goblin',
  attackerName: 'TestWizard',
  autoDamageSchool: 'evocation',
  saveDc: 15,
  saveType: 'Dexterity',
  dcSuccess: 'half',
  isAutoCrit: false,
  overchannelActive: false,
  overchannelUseCount: 0,
  overchannelSpellLevel: 1,
  sneakAttackDice: 0,
  ...overrides,
});

describe('normalizeAutoDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);
  });

  describe('return structure', () => {
    it('returns an object with attack and ctx properties', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result).toHaveProperty('attack');
      expect(result).toHaveProperty('ctx');
    });
  });

  describe('attack object', () => {
    it('maps name, formula, and damageType from autoDamage', () => {
      const autoDamage = makeAutoDamage({ name: 'Ray of Frost', formula: '1d8+4', damageType: 'Cold' });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.attack.name).toBe('Ray of Frost');
      expect(result.attack.damage).toBe('1d8+4');
      expect(result.attack.damageType).toBe('Cold');
    });

    it('identifies unarmed strikes as unarmed weaponType', () => {
      const autoDamage = makeAutoDamage({ name: 'Unarmed Strike' });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.attack.weaponType).toBe('unarmed');
    });

    it('looks up weaponType and properties from playerStats.attacks', () => {
      const playerStats = makePlayerStats({
        attacks: [{ name: 'Longsword', weaponType: 'melee', properties: ['Versatile'] }],
      });
      const autoDamage = makeAutoDamage({ name: 'Longsword' });
      const result = normalizeAutoDamage(autoDamage, false, playerStats);
      expect(result.attack.weaponType).toBe('melee');
      expect(result.attack.properties).toEqual(['Versatile']);
    });

    it('defaults weaponType to weapon when not unarmed and not found in attacks', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.attack.weaponType).toBe('weapon');
    });

    it('defaults properties to empty array when attack not found in playerStats', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.attack.properties).toEqual([]);
    });

    it('SP-112: carries spell school + attackType tokens through for weapon-only rider discrimination', () => {
      const autoDamage = makeAutoDamage({ name: 'Spiritual Weapon: Move & Attack', attackType: 'spell' });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.attack.school).toBe('evocation');
      expect(result.attack.attackType).toBe('spell');
      // weaponType stays registry-authoritative (not flipped by school alone).
      expect(result.attack.weaponType).toBe('weapon');
    });

    it('SP-112: registry weaponType wins over spell attackType token', () => {
      const playerStats = makePlayerStats({
        attacks: [{ name: 'Spiritual Weapon', weaponType: 'spell', attackType: 'spell', properties: [] }],
      });
      const result = normalizeAutoDamage(makeAutoDamage({ name: 'Spiritual Weapon', attackType: 'spell' }), false, playerStats);
      expect(result.attack.weaponType).toBe('spell');
      expect(result.attack.attackType).toBe('spell');
    });
  });

  describe('ctx hit and crit flags', () => {
    it('always sets hit to true', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.hit).toBe(true);
    });

    it('sets isNatural20 true only when isCrit param is true', () => {
      const resultTrue = normalizeAutoDamage(makeAutoDamage(), true, makePlayerStats());
      expect(resultTrue.ctx.isNatural20).toBe(true);

      const resultFalse = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(resultFalse.ctx.isNatural20).toBe(false);
    });

    it('sets isNatural20 false even when isAutoCrit is true', () => {
      const autoDamage = makeAutoDamage({ isAutoCrit: true });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.isNatural20).toBe(false);
    });

    it('sets isCrit from isCrit param when true', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), true, makePlayerStats());
      expect(result.ctx.isCrit).toBe(true);
    });

    it('falls back to isAutoCrit when isCrit param is false', () => {
      const autoDamage = makeAutoDamage({ isAutoCrit: true });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.isCrit).toBe(true);
    });

    it('defaults isCrit to false when neither source is true', () => {
      const result = normalizeAutoDamage(makeAutoDamage({ isAutoCrit: false }), false, makePlayerStats());
      expect(result.ctx.isCrit).toBe(false);
    });

    it('sets isAutoCrit on ctx to match isCrit resolution', () => {
      const autoDamage = makeAutoDamage({ isAutoCrit: true });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.isAutoCrit).toBe(true);
    });
  });

  describe('ctx target and attacker', () => {
    it('sets targetName from autoDamage', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.targetName).toBe('Goblin');
    });

    it('sets targetName to null when not provided', () => {
      const autoDamage = makeAutoDamage({ targetName: null });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.targetName).toBe(null);
    });

    it('passes attackerName through', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.attackerName).toBe('TestWizard');
    });
  });

  describe('ctx save fields', () => {
    it('passes saveDc, saveType, and dcSuccess through', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.saveDc).toBe(15);
      expect(result.ctx.saveType).toBe('Dexterity');
      expect(result.ctx.dcSuccess).toBe('half');
    });
  });

  describe('ctx overchannel fields', () => {
    it('passes overchannelActive from autoDamage', () => {
      const autoDamage = makeAutoDamage({ overchannelActive: true });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.overchannelActive).toBe(true);
    });

    it('defaults overchannelActive to false when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.overchannelActive;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.overchannelActive).toBe(false);
    });

    it('passes overchannelUseCount from autoDamage', () => {
      const autoDamage = makeAutoDamage({ overchannelUseCount: 3 });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.overchannelUseCount).toBe(3);
    });

    it('defaults overchannelUseCount to 0 when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.overchannelUseCount;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.overchannelUseCount).toBe(0);
    });

    it('passes overchannelSpellLevel from autoDamage', () => {
      const autoDamage = makeAutoDamage({ overchannelSpellLevel: 5 });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.overchannelSpellLevel).toBe(5);
    });

    it('defaults overchannelSpellLevel to 1 when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.overchannelSpellLevel;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.overchannelSpellLevel).toBe(1);
    });
  });

  describe('ctx sneak attack', () => {
    it('passes sneakDice from sneakAttackDice', () => {
      const autoDamage = makeAutoDamage({ sneakAttackDice: 4 });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.sneakDice).toBe(4);
    });

    it('defaults sneakDice to 0 when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.sneakAttackDice;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.sneakDice).toBe(0);
    });
  });

  describe('ctx secondary formula fields', () => {
    it('passes secondaryFormula, secondaryName, and secondaryDamageType', () => {
      const autoDamage = makeAutoDamage({
        secondaryFormula: '1d6+2',
        secondaryName: 'Fire Bolt Secondary',
        secondaryDamageType: 'Fire',
      });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.autoDamageSecondaryFormula).toBe('1d6+2');
      expect(result.ctx.autoDamageSecondaryName).toBe('Fire Bolt Secondary');
      expect(result.ctx.autoDamageSecondaryDamageType).toBe('Fire');
    });

    it('passes undefined secondary fields as undefined', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.autoDamageSecondaryFormula).toBeUndefined();
      expect(result.ctx.autoDamageSecondaryName).toBeUndefined();
      expect(result.ctx.autoDamageSecondaryDamageType).toBeUndefined();
    });
  });

  describe('ctx boolean flags', () => {
    it('sets isBonusActionAttack to false by default', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.isBonusActionAttack).toBe(false);
    });

    it('sets autoDamageSource to true', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.autoDamageSource).toBe(true);
    });

    it('passes isCantrip true when provided', () => {
      const autoDamage = makeAutoDamage({ isCantrip: true });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.isCantrip).toBe(true);
    });

    it('defaults isCantrip to false when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.isCantrip;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.isCantrip).toBe(false);
    });

    it('passes metamagicHeighten true when provided', () => {
      const autoDamage = makeAutoDamage({ metamagicHeighten: true });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.metamagicHeighten).toBe(true);
    });

    it('defaults metamagicHeighten to false when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.metamagicHeighten;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.metamagicHeighten).toBe(false);
    });
  });

  describe('ctx metamagicTwinTarget and d20Roll', () => {
    it('passes metamagicTwinTarget when provided', () => {
      const autoDamage = makeAutoDamage({ metamagicTwinTarget: 'Orc' });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.metamagicTwinTarget).toBe('Orc');
    });

    it('defaults metamagicTwinTarget to null when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.metamagicTwinTarget;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.metamagicTwinTarget).toBe(null);
    });

    it('passes d20Roll when provided', () => {
      const autoDamage = makeAutoDamage({ d20Roll: 18 });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.d20Roll).toBe(18);
    });

    it('passes d20Roll undefined when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.d20Roll;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.d20Roll).toBeUndefined();
    });
  });

  describe('ctx autoDamageSchool', () => {
    it('passes autoDamageSchool through', () => {
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.autoDamageSchool).toBe('evocation');
    });

    it('defaults to empty string when not provided', () => {
      const autoDamage = makeAutoDamage();
      delete autoDamage.autoDamageSchool;
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.autoDamageSchool).toBe('');
    });
  });

  describe('empowered evocation', () => {
    it('sets empoweredEvocationModifier to 0 when player has no features', () => {
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);
      const result = normalizeAutoDamage(makeAutoDamage(), false, makePlayerStats());
      expect(result.ctx.empoweredEvocationModifier).toBe(0);
    });

    it('does not apply modifier when school is not evocation', () => {
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(2);
      const autoDamage = makeAutoDamage({ autoDamageSchool: 'transmutation' });
      const result = normalizeAutoDamage(autoDamage, false, makePlayerStats());
      expect(result.ctx.empoweredEvocationModifier).toBe(0);
    });

    it('applies intelligence modifier for evocation when features exist', () => {
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(3);
      const result = normalizeAutoDamage(makeAutoDamage({ autoDamageSchool: 'evocation' }), false, makePlayerStats());
      expect(result.ctx.empoweredEvocationModifier).toBe(3);
    });

    it('does not apply modifier when int modifier is 0 even with features', () => {
      postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([{ name: 'Empowered Evocation' }]);
      postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);
      const result = normalizeAutoDamage(makeAutoDamage({ autoDamageSchool: 'evocation' }), false, makePlayerStats());
      expect(result.ctx.empoweredEvocationModifier).toBe(0);
    });
  });

  describe('minimal autoDamage', () => {
    it('handles a minimal autoDamage object with sensible defaults', () => {
      const minimal = { name: 'Test', formula: '1d4', damageType: 'Bludgeoning' };
      const result = normalizeAutoDamage(minimal, false, makePlayerStats());
      expect(result.attack.name).toBe('Test');
      expect(result.attack.damage).toBe('1d4');
      expect(result.attack.damageType).toBe('Bludgeoning');
      expect(result.attack.weaponType).toBe('weapon');
      expect(result.attack.properties).toEqual([]);
      expect(result.ctx.hit).toBe(true);
      expect(result.ctx.isCrit).toBe(false);
      expect(result.ctx.isNatural20).toBe(false);
      expect(result.ctx.targetName).toBe(null);
      expect(result.ctx.autoDamageSource).toBe(true);
    });
  });

  describe('Horde Breaker auto damage', () => {
    it('carries the bonus action attack type so housekeeping can mark it used', () => {
      const playerStats = makePlayerStats({
        attacks: [
          { name: 'Horde Breaker', weaponType: 'melee', properties: [], type: 'Bonus Action', isHordeBreaker: true },
        ],
      });
      const autoDamage = {
        name: 'Horde Breaker',
        formula: '1d6-1',
        damageType: 'Piercing',
        targetName: 'Zombie 2',
        attackerName: 'TestWizard',
      };
      const { attack } = normalizeAutoDamage(autoDamage, false, playerStats);
      expect(attack.type).toBe('Bonus Action');
      expect(attack.isHordeBreaker).toBe(true);
      expect(attack.weaponType).toBe('melee');
    });
  });
});
