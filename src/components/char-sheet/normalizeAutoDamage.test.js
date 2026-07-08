import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeAutoDamage } from './useAttackDamageResolution.js';

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

const defaultPlayerStats = {
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
};

const defaultAutoDamage = {
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
};

describe('normalizeAutoDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an object with attack and ctx properties', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result).toHaveProperty('attack');
    expect(result).toHaveProperty('ctx');
  });

  it('maps basic autoDamage fields to attack object', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.attack.name).toBe('Fire Bolt');
    expect(result.attack.damage).toBe('1d10+4');
    expect(result.attack.damageType).toBe('Fire');
    expect(result.attack.weaponType).toBe('weapon');
    expect(result.attack.properties).toEqual([]);
  });

  it('sets hit to true by default', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.hit).toBe(true);
  });

  it('sets isNatural20 to false when isCrit is false', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.isNatural20).toBe(false);
  });

  it('sets isNatural20 to true when isCrit is true', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, true, defaultPlayerStats);
    expect(result.ctx.isNatural20).toBe(true);
  });

  it('sets isCrit from isCrit parameter', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, true, defaultPlayerStats);
    expect(result.ctx.isCrit).toBe(true);
  });

  it('sets isCrit from autoDamage.isAutoCrit when isCrit is false', () => {
    const autoDamage = { ...defaultAutoDamage, isAutoCrit: true };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.isCrit).toBe(true);
  });

  it('prefers isCrit parameter over isAutoCrit', () => {
    const autoDamage = { ...defaultAutoDamage, isAutoCrit: false };
    const result = normalizeAutoDamage(autoDamage, true, defaultPlayerStats);
    expect(result.ctx.isCrit).toBe(true);
  });

  it('sets targetName from autoDamage', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.targetName).toBe('Goblin');
  });

  it('sets targetName to null when not provided', () => {
    const autoDamage = { ...defaultAutoDamage, targetName: null };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.targetName).toBe(null);
  });

  it('sets isBonusActionAttack to false by default', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.isBonusActionAttack).toBe(false);
  });

  it('sets overchannelActive from autoDamage', () => {
    const autoDamage = { ...defaultAutoDamage, overchannelActive: true };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.overchannelActive).toBe(true);
  });

  it('sets overchannelUseCount from autoDamage', () => {
    const autoDamage = { ...defaultAutoDamage, overchannelUseCount: 3 };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.overchannelUseCount).toBe(3);
  });

  it('sets overchannelSpellLevel from autoDamage', () => {
    const autoDamage = { ...defaultAutoDamage, overchannelSpellLevel: 5 };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.overchannelSpellLevel).toBe(5);
  });

  it('defaults overchannelUseCount to 0 when not provided', () => {
    const autoDamage = { ...defaultAutoDamage };
    delete autoDamage.overchannelUseCount;
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.overchannelUseCount).toBe(0);
  });

  it('defaults overchannelSpellLevel to 1 when not provided', () => {
    const autoDamage = { ...defaultAutoDamage };
    delete autoDamage.overchannelSpellLevel;
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.overchannelSpellLevel).toBe(1);
  });

  it('sets sneakDice from autoDamage.sneakAttackDice', () => {
    const autoDamage = { ...defaultAutoDamage, sneakAttackDice: 4 };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.sneakDice).toBe(4);
  });

  it('defaults sneakDice to 0 when not provided', () => {
    const autoDamage = { ...defaultAutoDamage };
    delete autoDamage.sneakAttackDice;
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.sneakDice).toBe(0);
  });

  it('passes saveDc, saveType, and dcSuccess through', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.saveDc).toBe(15);
    expect(result.ctx.saveType).toBe('Dexterity');
    expect(result.ctx.dcSuccess).toBe('half');
  });

  it('sets autoDamageSource to true', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.autoDamageSource).toBe(true);
  });

  it('passes through secondary formula fields', () => {
    const autoDamage = {
      ...defaultAutoDamage,
      secondaryFormula: '1d6+2',
      secondaryName: 'Fire Bolt Secondary',
      secondaryDamageType: 'Fire',
    };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.autoDamageSecondaryFormula).toBe('1d6+2');
    expect(result.ctx.autoDamageSecondaryName).toBe('Fire Bolt Secondary');
    expect(result.ctx.autoDamageSecondaryDamageType).toBe('Fire');
  });

  it('passes attackerName through', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.attackerName).toBe('TestWizard');
  });

  it('passes isCantrip through', () => {
    const autoDamage = { ...defaultAutoDamage, isCantrip: true };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.isCantrip).toBe(true);
  });

  it('passes isCantrip false when not provided', () => {
    const autoDamage = { ...defaultAutoDamage };
    delete autoDamage.isCantrip;
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.isCantrip).toBe(false);
  });

  it('passes metamagicHeighten through', () => {
    const autoDamage = { ...defaultAutoDamage, metamagicHeighten: true };
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.metamagicHeighten).toBe(true);
  });

  it('defaults metamagicHeighten to false when not provided', () => {
    const autoDamage = { ...defaultAutoDamage };
    delete autoDamage.metamagicHeighten;
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.metamagicHeighten).toBe(false);
  });

  it('passes autoDamageSchool through as raw field', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.autoDamageSchool).toBe('evocation');
  });

  it('defaults autoDamageSchool to empty string when not provided', () => {
    const autoDamage = { ...defaultAutoDamage };
    delete autoDamage.autoDamageSchool;
    const result = normalizeAutoDamage(autoDamage, false, defaultPlayerStats);
    expect(result.ctx.autoDamageSchool).toBe('');
  });

  it('sets empoweredEvocationModifier to 0 when player has no Evocation features', () => {
    const result = normalizeAutoDamage(defaultAutoDamage, false, defaultPlayerStats);
    expect(result.ctx.empoweredEvocationModifier).toBe(0);
  });

  it('handles empty autoDamage object with defaults', () => {
    const minimalAutoDamage = { name: 'Test', formula: '1d4', damageType: 'Bludgeoning' };
    const result = normalizeAutoDamage(minimalAutoDamage, false, defaultPlayerStats);
    expect(result.attack.name).toBe('Test');
    expect(result.attack.damage).toBe('1d4');
    expect(result.attack.damageType).toBe('Bludgeoning');
    expect(result.ctx.hit).toBe(true);
    expect(result.ctx.isCrit).toBe(false);
    expect(result.ctx.targetName).toBe(null);
    expect(result.ctx.autoDamageSource).toBe(true);
  });
});
