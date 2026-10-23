// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeAutoDamage } from './useAttackDamageResolution.js';

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
  getEmpoweredEvocationFeatures: vi.fn(() => []),
  getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

import * as postCastRiderService from '../../services/rules/spells/postCastRiderService.js';

const EMPOWERED_EVOCATION = [{ name: 'Empowered Evocation' }];

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

describe('normalizeAutoDamage', () => {
  beforeEach(() => {
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue([]);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);
  });

  it('maps a fully-populated auto-damage popup to the exact pipeline attack + ctx', () => {
    const autoDamage = {
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
      overchannelActive: true,
      overchannelUseCount: 2,
      overchannelSpellLevel: 3,
      sneakAttackDice: 4,
      secondaryFormula: '1d6+2',
      secondaryName: 'Burn Hands Rider',
      secondaryDamageType: 'Fire',
      isCantrip: true,
      metamagicHeighten: true,
      metamagicTwinTarget: 'Orc',
      d20Roll: 18,
      isOpportunityAttack: true,
      attackType: 'spell',
    };

    const { attack, ctx } = normalizeAutoDamage(autoDamage, false, makePlayerStats());

    expect(attack).toEqual({
      name: 'Fire Bolt',
      damage: '1d10+4',
      damageType: 'Fire',
      weaponType: 'weapon',
      attackType: 'spell',
      school: 'evocation',
      properties: [],
      type: 'spell',
      isHordeBreaker: false,
    });
    expect(ctx).toEqual({
      attackName: 'Fire Bolt',
      hit: true,
      isCrit: false,
      isAutoCrit: false,
      isNatural20: false,
      targetName: 'Goblin',
      isBonusActionAttack: false,
      overchannelActive: true,
      overchannelUseCount: 2,
      overchannelSpellLevel: 3,
      sneakDice: 4,
      saveDc: 15,
      saveType: 'Dexterity',
      dcSuccess: 'half',
      autoDamageSource: true,
      empoweredEvocationModifier: 0,
      autoDamageSecondaryFormula: '1d6+2',
      autoDamageSecondaryName: 'Burn Hands Rider',
      autoDamageSecondaryDamageType: 'Fire',
      attackerName: 'TestWizard',
      isCantrip: true,
      metamagicHeighten: true,
      metamagicTwinTarget: 'Orc',
      autoDamageSchool: 'evocation',
      d20Roll: 18,
      isOpportunityAttack: true,
    });
  });

  it('applies documented defaults to a minimal auto-damage payload', () => {
    const { attack, ctx } = normalizeAutoDamage(
      { name: 'Test', formula: '1d4', damageType: 'Bludgeoning' },
      false,
      makePlayerStats(),
    );

    expect(attack).toEqual({
      name: 'Test',
      damage: '1d4',
      damageType: 'Bludgeoning',
      weaponType: 'weapon',
      properties: [],
      isHordeBreaker: false,
    });
    expect(ctx).toEqual({
      attackName: 'Test',
      hit: true,
      isCrit: false,
      isAutoCrit: false,
      isNatural20: false,
      targetName: null,
      isBonusActionAttack: false,
      overchannelActive: false,
      overchannelUseCount: 0,
      overchannelSpellLevel: 1,
      sneakDice: 0,
      autoDamageSource: true,
      empoweredEvocationModifier: 0,
      isCantrip: false,
      metamagicHeighten: false,
      metamagicTwinTarget: null,
      autoDamageSchool: '',
      isOpportunityAttack: false,
    });
  });

  // fix#202-migrated from the excised standalone block (ex 'defaults missing fields
  // to safe defaults'): the minimal payload above still carries name/formula/
  // damageType — this pins the true zero-input floor: payload {} transports every
  // token as undefined (toEqual drops undefined keys) yet every || default still
  // lands and nothing throws (autoDamageSchool '' vs undefined-name is the
  // discriminating byte, source :176).
  it('empty payload {} lands the full default shape with every token undefined', () => {
    const { attack, ctx } = normalizeAutoDamage({}, false, makePlayerStats());

    expect(attack).toEqual({ weaponType: 'weapon', properties: [], isHordeBreaker: false });
    expect(ctx).toEqual({
      hit: true,
      isCrit: false,
      isAutoCrit: false,
      isNatural20: false,
      targetName: null,
      isBonusActionAttack: false,
      overchannelActive: false,
      overchannelUseCount: 0,
      overchannelSpellLevel: 1,
      sneakDice: 0,
      autoDamageSource: true,
      empoweredEvocationModifier: 0,
      isCantrip: false,
      metamagicHeighten: false,
      metamagicTwinTarget: null,
      autoDamageSchool: '',
      isOpportunityAttack: false,
    });
  });

  it.each([
    // fix#202-migrated from the excised standalone block (ex 'detects unarmed
    // strike weaponType' + its ex null-playerStats twin): unarmed is NAME-derived
    // (source :183, before any registry lookup), so the token survives both an
    // empty registry and null playerStats — the default-weapon and registry-win
    // arms above cover neither combination.
    { label: 'empty registry', stats: () => makePlayerStats({ attacks: [] }) },
    { label: 'null playerStats', stats: () => null },
  ])('unarmed weaponType is name-derived — survives $label', ({ stats }) => {
    const autoDamage = { name: 'Unarmed Strike', formula: '1d4', damageType: 'bludgeoning' };

    expect(normalizeAutoDamage(autoDamage, false, stats()).attack.weaponType).toBe('unarmed');
  });

  it.each([
    { isCrit: false, isAutoCrit: false, critFlags: { isCrit: false, isAutoCrit: false, isNatural20: false } },
    { isCrit: true, isAutoCrit: false, critFlags: { isCrit: true, isAutoCrit: true, isNatural20: true } },
    { isCrit: false, isAutoCrit: true, critFlags: { isCrit: true, isAutoCrit: true, isNatural20: false } },
    { isCrit: true, isAutoCrit: true, critFlags: { isCrit: true, isAutoCrit: true, isNatural20: true } },
  ])('crit resolution: isCrit=$isCrit isAutoCrit=$isAutoCrit', ({ isCrit, isAutoCrit, critFlags }) => {
    const { ctx } = normalizeAutoDamage(
      { name: 'Fire Bolt', formula: '1d10+4', damageType: 'Fire', isAutoCrit },
      isCrit,
      makePlayerStats(),
    );

    expect({ isCrit: ctx.isCrit, isAutoCrit: ctx.isAutoCrit, isNatural20: ctx.isNatural20 }).toEqual(critFlags);
  });

  it.each([
    {
      label: 'registry attack carries type/properties/isHordeBreaker; ctx.isBonusActionAttack stays false',
      auto: { name: 'Horde Breaker', formula: '1d6-1', damageType: 'Piercing', targetName: 'Zombie 2' },
      attacks: [{ name: 'Horde Breaker', weaponType: 'melee', properties: [], type: 'Bonus Action', isHordeBreaker: true }],
      expected: { name: 'Horde Breaker', damage: '1d6-1', damageType: 'Piercing', weaponType: 'melee', properties: [], type: 'Bonus Action', isHordeBreaker: true },
      ctxIsBonusActionAttack: false,
    },
    {
      label: '"Unarmed Strike" name wins over registry weaponType',
      auto: { name: 'Unarmed Strike', formula: '1d4+2', damageType: 'Bludgeoning' },
      attacks: [{ name: 'Unarmed Strike', weaponType: 'melee', properties: ['Light'], type: 'Action' }],
      expected: { name: 'Unarmed Strike', damage: '1d4+2', damageType: 'Bludgeoning', weaponType: 'unarmed', properties: ['Light'], type: 'Action', isHordeBreaker: false },
      ctxIsBonusActionAttack: false,
    },
    {
      label: 'SP-112: attackType/school tokens from popup; weaponType stays registry-authoritative',
      auto: { name: 'Spiritual Weapon', formula: '1d8+4', damageType: 'Force', autoDamageSchool: 'evocation', attackType: 'spell' },
      attacks: [{ name: 'Spiritual Weapon', weaponType: 'spell', attackType: 'spell', properties: [] }],
      expected: { name: 'Spiritual Weapon', damage: '1d8+4', damageType: 'Force', weaponType: 'spell', attackType: 'spell', school: 'evocation', properties: [], type: 'spell', isHordeBreaker: false },
      ctxIsBonusActionAttack: false,
    },
    {
      label: 'SP-112: school and attackType fall back to the registry entry when popup omits them',
      auto: { name: 'Spiritual Weapon', formula: '1d8+4', damageType: 'Force' },
      attacks: [{ name: 'Spiritual Weapon', weaponType: 'spell', attackType: 'spell', school: 'evocation', properties: [], type: 'Action' }],
      expected: { name: 'Spiritual Weapon', damage: '1d8+4', damageType: 'Force', weaponType: 'spell', attackType: 'spell', school: 'evocation', properties: [], type: 'Action', isHordeBreaker: false },
      ctxIsBonusActionAttack: false,
    },
    {
      label: 'SP-112: variant name misses the registry — default weaponType, tokens still ride',
      auto: { name: 'Spiritual Weapon: Move & Attack', formula: '1d8+4', damageType: 'Force', autoDamageSchool: 'evocation', attackType: 'spell' },
      attacks: [{ name: 'Spiritual Weapon', weaponType: 'spell', attackType: 'spell', school: 'evocation', properties: [] }],
      expected: { name: 'Spiritual Weapon: Move & Attack', damage: '1d8+4', damageType: 'Force', weaponType: 'weapon', attackType: 'spell', school: 'evocation', properties: [], type: 'spell', isHordeBreaker: false },
      ctxIsBonusActionAttack: false,
    },
    // fix#202-migrated from the excised standalone block (ex 'returns attack and
    // ctx objects from a valid autoDamage payload'): popup school is an INDEPENDENT
    // SP-112 token — it rides onto the attack even when attackType is absent, so
    // attack.attackType/attack.type stay undefined (source :123/:126 ||-fallbacks
    // hit nothing: the registry entry supplies neither token either).
    {
      label: 'SP-112: popup school rides without attackType — type stays absent',
      auto: { name: 'Longsword', formula: '1d8+3', damageType: 'slashing', autoDamageSchool: 'evocation' },
      attacks: [{ name: 'Longsword', weaponType: 'weapon', properties: [] }],
      expected: { name: 'Longsword', damage: '1d8+3', damageType: 'slashing', weaponType: 'weapon', school: 'evocation', properties: [], isHordeBreaker: false },
      ctxIsBonusActionAttack: false,
    },
  ])('attack lookup: $label', ({ auto, attacks, expected, ctxIsBonusActionAttack }) => {
    const { attack, ctx } = normalizeAutoDamage(auto, false, makePlayerStats({ attacks }));

    expect(attack).toEqual(expected);
    expect(ctx.isBonusActionAttack).toBe(ctxIsBonusActionAttack);
  });

  it.each([
    { label: 'no features → 0', features: [], intMod: 3, school: 'evocation', expected: 0 },
    { label: 'non-evocation school → 0', features: EMPOWERED_EVOCATION, intMod: 3, school: 'transmutation', expected: 0 },
    { label: 'evocation + INT 3 → 3', features: EMPOWERED_EVOCATION, intMod: 3, school: 'evocation', expected: 3 },
    { label: 'school match is case-insensitive', features: EMPOWERED_EVOCATION, intMod: 3, school: 'Evocation', expected: 3 },
    { label: 'zero INT modifier → 0', features: EMPOWERED_EVOCATION, intMod: 0, school: 'evocation', expected: 0 },
    // fix#121 signed law (damageCalculation.js:34-40, quoting 2024/classes.json:13502
    // "add your Intelligence modifier"): the modifier is ADDED signed — negatives apply.
    // The old `empEvocIntMod > 0` gate floored them to +0, inflating weak-caster damage.
    { label: 'evocation + INT -1 → -1 (signed subtract, not floored)', features: EMPOWERED_EVOCATION, intMod: -1, school: 'evocation', expected: -1 },
    { label: 'evocation + INT -5 → -5 (deep negative stays signed)', features: EMPOWERED_EVOCATION, intMod: -5, school: 'evocation', expected: -5 },
    { label: 'negative INT outside evocation → 0 (school gate unchanged)', features: EMPOWERED_EVOCATION, intMod: -2, school: 'abjuration', expected: 0 },
    { label: 'negative INT without the feature → 0', features: [], intMod: -1, school: 'evocation', expected: 0 },
  ])('empowered evocation: $label', ({ features, intMod, school, expected }) => {
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue(features);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(intMod);

    const { ctx } = normalizeAutoDamage(
      { name: 'Fire Bolt', formula: '1d10+4', damageType: 'Fire', autoDamageSchool: school },
      false,
      makePlayerStats(),
    );

    expect(ctx.empoweredEvocationModifier).toBe(expected);
  });

  // fix#158 coupling idiom: what the resolver DISPLAYS equals what it WRITES —
  // ctx.empoweredEvocationModifier must be the selector's signed bytes verbatim
  // (postCastRiderService.js:217-220 returns intAbility?.bonus, negative included).
  // Pre-fix capture: INT 8 (mod -1) evocation wrote ctx.empoweredEvocationModifier:0
  // — a '+0' silent buff inflating the damage lane by |mod| versus the spell lane
  // (damageCalculation.js:77 `!== 0`).
  it('INT 8 (-1) evocation rides the ctx signed: no clamp byte, no +0 artifact', () => {
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue(EMPOWERED_EVOCATION);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(-1);

    const ps = makePlayerStats();
    const { attack, ctx } = normalizeAutoDamage(
      { name: 'Fire Bolt', formula: '1d10', damageType: 'Fire', autoDamageSchool: 'evocation' },
      false,
      ps,
    );

    expect(ctx.empoweredEvocationModifier).toBe(-1); // signed subtract rides on
    expect(ctx.empoweredEvocationModifier).not.toBe(0); // floored clamp byte killed
    // display-vs-written equality: written value === selector bytes for THIS character
    expect(ctx.empoweredEvocationModifier).toBe(postCastRiderService.getEmpoweredEvocationIntModifier(ps));
    // this seam contributes a VALUE, never rewrites the formula term (append owner
    // is the pipeline consumer / fix#121 spell bake) — so no '+0' or '- 0' artifact
    // can leak anywhere on the normalized output.
    expect(attack.damage).toBe('1d10');
    expect(JSON.stringify({ ...ctx, playerStats: undefined })).not.toMatch(/[+]0(\b|[^.\d])/);
  });

  it('zero INT modifier stays inert: ctx 0 with no signed-term artifact', () => {
    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue(EMPOWERED_EVOCATION);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(0);

    const { ctx } = normalizeAutoDamage(
      { name: 'Fire Bolt', formula: '1d10', damageType: 'Fire', autoDamageSchool: 'evocation' },
      false,
      makePlayerStats(),
    );

    expect(ctx.empoweredEvocationModifier).toBe(0); // inert, not '-0'
    expect(Object.is(ctx.empoweredEvocationModifier, -0)).toBe(false);
  });

  it('is neutral without playerStats (no registry lookup, no empowered evocation)', () => {
    const autoDamage = { name: 'Fire Bolt', formula: '1d10+4', damageType: 'Fire', autoDamageSchool: 'evocation' };

    postCastRiderService.getEmpoweredEvocationFeatures.mockReturnValue(EMPOWERED_EVOCATION);
    postCastRiderService.getEmpoweredEvocationIntModifier.mockReturnValue(3);

    const { attack, ctx } = normalizeAutoDamage(autoDamage, false, null);

    expect(attack.weaponType).toBe('weapon');
    expect(attack.properties).toEqual([]);
    expect(ctx.empoweredEvocationModifier).toBe(0);
  });
});
