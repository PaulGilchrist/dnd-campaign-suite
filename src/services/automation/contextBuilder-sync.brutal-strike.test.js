// CLA-044 regression: Brutal Strike effect clauses must grant registered
// targetEffects (speed_reduction / push) on the live sheet-attack lane,
// replace stale hamstring te, anchor one expiration clock, and log grants.
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
vi.mock('../maps/mapsService.js', () => ({ loadMapData: vi.fn() }));
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
vi.mock('../rules/combat/coverService.js', () => ({ computeCover: vi.fn() }));
vi.mock('../npcs/npcsService.js', () => ({ loadNPCs: vi.fn() }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../combat/buffs/buffService.js', () => ({ getInnateSorceryBonus: vi.fn() }));
vi.mock('../combat/auras/wolfAuraUtils.js', () => ({ getWolfAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/duplicityAuraUtils.js', () => ({ getDuplicityAdvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/lionAuraUtils.js', () => ({ getLionDisadvantageAgainst: vi.fn() }));
vi.mock('../combat/auras/coronaAuraUtils.js', () => ({ getCoronaSaveDisadvantage: vi.fn() }));
vi.mock('./handlers/class-cleric-paladin/avengingAngelHandler.js', () => ({ isActive: vi.fn(), isAuraTarget: vi.fn(), handle: vi.fn() }));
vi.mock('./handlers/spells/sanctuaryHandler.js', () => ({ endSanctuary: vi.fn(), handle: vi.fn() }));
vi.mock('../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn().mockReturnValue(false),
  isCreatureWarded: vi.fn().mockReturnValue(false),
  handle: vi.fn(),
}));
vi.mock('../automation/handlers/buffs/deathWardHandler.js', () => ({ isDeathWardActive: vi.fn().mockReturnValue(false) }));
vi.mock('../combat/automation/automationService.js', () => ({
  collectWeaponMastery: vi.fn().mockReturnValue({ baseMastery: null, extraMasteries: [] }),
}));
vi.mock('../combat/brutalStrikeSelection.js', () => ({ selectBrutalStrikeRiders: vi.fn() }));
vi.mock('../combat/automation/automationExpressions.js', () => ({ resolveDiceExpression: vi.fn() }));
vi.mock('../combat/automation/automationPassives.js', () => ({ isResilientSphereActive: vi.fn().mockReturnValue(false) }));
vi.mock('../encounters/combatData.js', () => ({ getCurrentCombatRound: vi.fn().mockReturnValue(1) }));
vi.mock('../rules/effects/expirationQueue.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue({}) }));

const { buildBaseAttackContext } = await import('./common/damageRoll.js');
const { selectBrutalStrikeRiders } = await import('../combat/brutalStrikeSelection.js');
const { addExpiration } = await import('../rules/effects/expirationQueue.js');
const logService = await import('../ui/logService.js');
const { getWolfAdvantageAgainst } = await import('../combat/auras/wolfAuraUtils.js');
const { getDuplicityAdvantageAgainst } = await import('../combat/auras/duplicityAuraUtils.js');
const { getLionDisadvantageAgainst } = await import('../combat/auras/lionAuraUtils.js');
const { getCoronaSaveDisadvantage } = await import('../combat/auras/coronaAuraUtils.js');
const { getInnateSorceryBonus } = await import('../combat/buffs/buffService.js');

const LV9_RIDER = {
  name: 'Brutal Strike',
  damageExpression: '1d10',
  options: [
    { name: 'Forceful Blow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn' },
    { name: 'Hamstring Blow', effect: 'push_15ft' },
  ],
};

const stats = {
  name: 'Korgath',
  level: 20,
  proficiency: 6,
  class: { class_levels: [] },
  abilities: [{ name: 'Strength', bonus: 5 }],
  automation: { passives: [], actions: [] },
};

const attack = {
  name: 'Greataxe',
  damage: '1d12+5',
  damageType: 'Slashing',
  hitBonus: 11,
  hitBonusFormula: 'To Hit = 5 + 6',
  weaponType: 'melee',
};

function runtime({ stored = [], choices = null, active = true } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (name === 'Korgath' && key === '_brutalStrikeActive') return active;
    if (name === 'Korgath' && key === '_brutalStrikeEffects') return choices;
    if (name === 'campaign' && key === 'targetEffects') return stored;
    return undefined;
  });
}

function storedWrites() {
  return setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'targetEffects').map(c => c[2]);
}

describe('CLA-044: Brutal Strike effect clause grants (live lane)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildBaseAttackContext.mockResolvedValue({ target: { name: 'Bandit 1' }, targetName: 'Bandit 1', resistanceNotice: null });
    selectBrutalStrikeRiders.mockReturnValue([LV9_RIDER]);
    getWolfAdvantageAgainst.mockReturnValue({ advantage: false });
    getDuplicityAdvantageAgainst.mockReturnValue({ advantage: false });
    getLionDisadvantageAgainst.mockReturnValue({ disadvantage: false });
    getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
    getInnateSorceryBonus.mockReturnValue({ spellAdvantage: false, saveDcBonus: 0 });
  });

  it('grants speed_reduction te with numeric value 15 and anchors one clock', async () => {
    runtime({ choices: ['Forceful Blow'] });

    await buildAttackContextSync(attack, stats, 'test-campaign', 'normal');

    const write = storedWrites().find(list => Array.isArray(list) && list.some(te => te.effect === 'speed_reduction'));
    expect(write).toBeDefined();
    expect(write).toEqual([expect.objectContaining({
      target: 'Bandit 1',
      source: 'Korgath',
      option: 'Forceful Blow',
      effect: 'speed_reduction',
      value: 15,
      duration: 'until_start_of_next_turn',
    })]);
    expect(addExpiration).toHaveBeenCalledTimes(1);
    const clock = addExpiration.mock.calls[0][0];
    expect(clock.expireOnCreatureName).toBe('Korgath');
    expect(clock.effects).toEqual([expect.objectContaining({
      type: 'remove_target_effect',
      effectKey: 'speed_reduction',
      source: 'Korgath',
      option: 'Forceful Blow',
      target: 'Bandit 1',
    })]);
    const grant = logService.addEntry.mock.calls.map(c => c[1]).find(e => e?.abilityName === 'Forceful Blow');
    expect(grant).toBeDefined();
    expect(grant.description).toContain('speed reduced 15 ft');
  });

  it('grants registered push te (value 15, instant) for push_15ft with no clock', async () => {
    runtime({ choices: ['Hamstring Blow'] });

    await buildAttackContextSync(attack, stats, 'test-campaign', 'normal');

    const write = storedWrites().find(list => Array.isArray(list) && list.some(te => te.effect === 'push'));
    expect(write).toBeDefined();
    expect(write).toEqual([expect.objectContaining({
      target: 'Bandit 1',
      source: 'Korgath',
      option: 'Hamstring Blow',
      effect: 'push',
      value: 15,
      duration: 'instant',
    })]);
    expect(addExpiration).not.toHaveBeenCalled();
  });

  it('replaces a stale hamstring te (most recent wins)', async () => {
    const stale = { target: 'Bandit 1', source: 'Korgath', option: 'Hamstring Blow', effect: 'push', value: 15, duration: 'instant' };
    const unrelated = { target: 'Ogre', source: 'Korgath', option: 'X', effect: 'speed_reduction', value: 10, duration: 'until_start_of_next_turn' };
    runtime({ stored: [stale, unrelated], choices: ['Hamstring Blow'] });

    await buildAttackContextSync(attack, stats, 'test-campaign', 'normal');

    const finalWrite = storedWrites().at(-1);
    const pushes = finalWrite.filter(te => te.effect === 'push');
    expect(pushes).toHaveLength(1);
    expect(finalWrite.some(te => te === unrelated)).toBe(true);
  });

  it('grants lv17 four-option rider clauses and keeps dice formula', async () => {
    selectBrutalStrikeRiders.mockReturnValue([{
      name: 'Brutal Strike',
      damageExpression: '2d10',
      options: [
        { name: 'Forceful Blow', effect: 'speed_reduction', value: '15_ft_until_start_of_next_turn' },
        { name: 'Hamstring Blow', effect: 'push_15ft' },
        { name: 'Tiring Blow', effect: 'disadvantage_on_next_save' },
        { name: 'Sundering Blow', effect: 'next_attack_bonus', value: 5 },
      ],
    }]);
    runtime({ choices: ['Forceful Blow', 'Tiring Blow'] });

    const result = await buildAttackContextSync(attack, stats, 'test-campaign', 'normal');

    expect(result.autoDamageFormula).toContain('2d10 [Brutal Strike]');
    const finalWrite = storedWrites().at(-1);
    expect(finalWrite.some(te => te.effect === 'speed_reduction' && te.option === 'Forceful Blow')).toBe(true);
    expect(finalWrite.some(te => te.effect === 'disadvantage_on_next_save' && te.option === 'Tiring Blow' && te.target === 'Bandit 1')).toBe(true);
  });

  it('unknown option effect logs error and grants nothing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockReturnValue();
    selectBrutalStrikeRiders.mockReturnValue([{
      name: 'Brutal Strike',
      damageExpression: '1d10',
      options: [{ name: 'Mystery Blow', effect: 'not_registered' }],
    }]);
    runtime({ choices: ['Mystery Blow'] });

    await buildAttackContextSync(attack, stats, 'test-campaign', 'normal');

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('not_registered'));
    expect(addExpiration).not.toHaveBeenCalled();
    const pushWrites = storedWrites().filter(list => Array.isArray(list) && list.some(te => te.option === 'Mystery Blow'));
    expect(pushWrites).toHaveLength(0);
    errSpy.mockRestore();
  });

  it('consumes the sticky so the next attack is not retroactively buffed', async () => {
    runtime({ choices: ['Forceful Blow'] });

    await buildAttackContextSync(attack, stats, 'test-campaign', 'normal');

    expect(setRuntimeValue).toHaveBeenCalledWith('Korgath', '_brutalStrikeActive', null, 'test-campaign');
    expect(setRuntimeValue).toHaveBeenCalledWith('Korgath', '_brutalStrikeEffects', null, 'test-campaign');
  });
});
