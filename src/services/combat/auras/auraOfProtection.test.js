// @maintained-by-ai
// auraOfProtection primitives lane — canonical home (folder lane map in
// auraComboEffects.test.js) for the saving-throw aura primitives and constants.
// auraComboEffects re-runs hasAuraOfProtection/hasCannotActCondition/getAuraRangeFromStats
// for its own channels and auraConditionImmunity delegates wholesale (#2071) — the
// gating semantics are pinned once, HERE.
// App semantics pinned from source, not book:
// - computeAuraBonus returns { bonus, sourceName } (consumed by savePromptHandlers,
//   concentrationService, conditionSaveService, CharConditions). Callers pass
//   campaignName/activeMapName/allCreatures which this pure helper ignores.
// - every gate-passing bearer clamps to a MINIMUM bonus of 1; strict '>' keeps the
//   first-set highest source on ties (duplicate bearers never stack).
// - getAllyList can never return null (useAllySelection self-falls-back to
//   [creatureName]), so computeAuraBonus has NO ally-fallback branch — the former
//   twin "falls back to no ally filtering" tests were vacuous: deleted, unreachable
//   (#2070 verdict).
// - radius is 10ft, expanded 30ft via the 'Aura Expansion' passive; distance math
//   is isWithinRange's own lane (mocked here). Call-time gating only — no clocks;
//   aura presence changes at turn seams.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

import {
  CANNOT_ACT_CONDITIONS,
  DEFAULT_AURA_RANGE_FT,
  EXPANDED_AURA_RANGE_FT,
  hasAura,
  hasAuraOfProtection,
  getAuraRangeFromStats,
  getChaModifier,
  hasCannotActCondition,
  computeAuraBonus,
} from './auraOfProtection.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';

beforeEach(() => {
  vi.resetAllMocks();
  // Defaults are all pass-gates: a zero-envelope result proves an explicitly
  // triggered gate, never missing fixture data.
  getRuntimeValue.mockReturnValue([]);
  getAllyList.mockReturnValue(['Cleric']);
  isWithinRange.mockResolvedValue(true);
});

const passive = (name) => ({ name });

// Full-shaped bearer: passives AND Charisma, so failures discriminate gates.
function bearer(name, passives, abilities = [{ name: 'Charisma', bonus: 5 }]) {
  return { name, computedStats: { automation: { passives: passives.map(passive) }, abilities } };
}

// As-invoked payload; campaignName/activeMapName ride along but the source gates
// only on targetName + characters.
const compute = (characters, targetName = 'Cleric') =>
  computeAuraBonus({ targetName, characters, campaignName: 'test-campaign', activeMapName: 'Map' });

describe('constants', () => {
  it('pins the cannot-act condition list and the 10/30 ft aura ranges', () => {
    expect(CANNOT_ACT_CONDITIONS).toEqual([
      'incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious',
    ]);
    expect(DEFAULT_AURA_RANGE_FT).toBe(10);
    expect(EXPANDED_AURA_RANGE_FT).toBe(30);
  });
});

describe('hasAura', () => {
  it('returns true when a passive has the exact aura name', () => {
    expect(hasAura(bearer('Paladin', ['Divine Smite', 'Aura of Protection']).computedStats, 'Aura of Protection')).toBe(true);
  });

  it.each([
    ['no passive matches the name', bearer('Wizard', ['Divine Smite']).computedStats],
    ['playerStats is null', null],
    ['playerStats is undefined', undefined],
    ['automation is missing', {}],
    ['passives is missing', { automation: {} }],
    ['passives is null', { automation: { passives: null } }],
  ])('returns false when %s', (_case, stats) => {
    expect(hasAura(stats, 'Aura of Protection')).toBe(false);
  });
});

describe('hasAuraOfProtection', () => {
  it('matches only the exact "Aura of Protection" passive', () => {
    expect(hasAuraOfProtection(bearer('Paladin', ['Aura of Protection']).computedStats)).toBe(true);
    expect(hasAuraOfProtection(bearer('Paladin', ['Aura of the Wolf']).computedStats)).toBe(false);
    expect(hasAuraOfProtection(null)).toBe(false);
  });
});

describe('getAuraRangeFromStats', () => {
  it.each([
    ['Aura Expansion alongside Aura of Protection', EXPANDED_AURA_RANGE_FT, ['Aura of Protection', 'Aura Expansion']],
    ['Aura Expansion alone (independent of Aura of Protection)', EXPANDED_AURA_RANGE_FT, ['Aura Expansion']],
    ['no Aura Expansion', DEFAULT_AURA_RANGE_FT, ['Aura of Protection']],
  ])('%s: radius %i ft', (_case, expected, passives) => {
    expect(getAuraRangeFromStats(bearer('Paladin', passives).computedStats)).toBe(expected);
  });
});

describe('getChaModifier', () => {
  it('uses cha.bonus verbatim when set — including 0 and negatives, over the score formula', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 5 }] })).toBe(5);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 0 }] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: -2 }] })).toBe(-2);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 7 }] })).toBe(7);
  });

  it('computes floor((score + increases - 10) / 2) when bonus is absent, flooring odd scores', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0 }] })).toBe(3);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', baseScore: 14, featIncrease: 2, miscIncrease: 2 }] })).toBe(4);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', baseScore: 15, featIncrease: 0, miscIncrease: 0 }] })).toBe(2);
  });

  it('returns 0 when Charisma is absent and throws when stats are null', () => {
    expect(getChaModifier({ abilities: [{ name: 'Strength' }] })).toBe(0);
    expect(getChaModifier({ abilities: [] })).toBe(0);
    expect(getChaModifier({})).toBe(0);
    expect(() => getChaModifier(null)).toThrow();
  });
});

describe('hasCannotActCondition', () => {
  it('returns true for every incapacitating condition and reads the activeConditions key', () => {
    for (const condition of CANNOT_ACT_CONDITIONS) {
      getRuntimeValue.mockReturnValue([condition]);
      expect(hasCannotActCondition('Gallant', 'Campaign')).toBe(true);
    }
    expect(getRuntimeValue).toHaveBeenCalledWith('Gallant', 'activeConditions');
  });

  it.each([
    ['none of the conditions match', () => getRuntimeValue.mockReturnValue(['blinded', 'poisoned'])],
    ['the condition list is empty', () => getRuntimeValue.mockReturnValue([])],
    ['activeConditions is not an array', () => getRuntimeValue.mockReturnValue(null)],
    ['the runtime store throws', () => getRuntimeValue.mockImplementation(() => { throw new Error('runtime unavailable'); })],
  ])('returns false when %s', (_case, setup) => {
    setup();
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
  });
});

describe('computeAuraBonus', () => {
  it.each([
    ['no characters', () => []],
    ['the bearer has no name', () => [bearer('', ['Aura of Protection'])]],
    ['computedStats is null or undefined', () => [{ name: 'Paladin', computedStats: null }, { name: 'Bard', computedStats: undefined }]],
    ['the source lacks Aura of Protection', () => [bearer('Wizard', ['Spell Sniper'])]],
    ['the bearer has a cannot-act condition', () => [bearer('Paladin', ['Aura of Protection'])], () => getRuntimeValue.mockReturnValue(['stunned'])],
    ['the bearer\'s ally list excludes the target', () => [bearer('Paladin', ['Aura of Protection'])], () => getAllyList.mockReturnValue(['OtherPlayer'])],
    ['the bearer is out of range', () => [bearer('Paladin', ['Aura of Protection'])], () => isWithinRange.mockResolvedValue(false)],
  ])('returns { bonus: 0, sourceName: null } when %s', async (_case, characters, setup) => {
    setup?.();
    expect(await compute(characters())).toEqual({ bonus: 0, sourceName: null });
  });

  it.each([
    ['the default aura', ['Aura of Protection'], DEFAULT_AURA_RANGE_FT],
    ['an Aura Expansion bearer', ['Aura of Protection', 'Aura Expansion'], EXPANDED_AURA_RANGE_FT],
  ])('grants the bearer\'s CHA bonus within %s at radius %i ft', async (_case, passives, range) => {
    const result = await compute([bearer('Paladin', passives, [{ name: 'Charisma', bonus: 3 }])]);
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', range);
  });

  it.each([
    ['an explicit negative bonus', [{ name: 'Charisma', bonus: -2 }]],
    ['a zero bonus derived from the score formula', [{ name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0 }]],
  ])('clamps %s to the app-minimum aura bonus of 1', async (_case, abilities) => {
    expect(await compute([bearer('Paladin', ['Aura of Protection'], abilities)])).toEqual({ bonus: 1, sourceName: 'Paladin' });
  });

  it('takes the highest able in-range bearer and never replaces it on a tie', async () => {
    // Aldric 2 valid (first-set winner), Bryn 5 out-of-range, Cora 8 petrified,
    // Doran 2 in-range tie. Dropping any single gate changes the winner:
    // cannot-act → Cora 8, range → Bryn 5, strict-'>' → Doran.
    getRuntimeValue.mockImplementation(name => (name === 'Cora' ? ['petrified'] : []));
    isWithinRange.mockImplementation(src => src !== 'Bryn');
    const characters = [
      bearer('Aldric', ['Aura of Protection'], [{ name: 'Charisma', bonus: 2 }]),
      bearer('Bryn', ['Aura of Protection'], [{ name: 'Charisma', bonus: 5 }]),
      bearer('Cora', ['Aura of Protection'], [{ name: 'Charisma', bonus: 8 }]),
      bearer('Doran', ['Aura of Protection'], [{ name: 'Charisma', bonus: 2 }]),
    ];
    expect(await compute(characters)).toEqual({ bonus: 2, sourceName: 'Aldric' });
  });

  it('skips a higher-bonus bearer whose own ally list excludes the target', async () => {
    // Per-source ally lists (not one answer for everyone): Paladin1 outscores
    // but does not cover Cleric, so the lower bonus wins.
    getAllyList.mockImplementation(name => (name === 'Paladin1' ? ['Wizard'] : ['Cleric']));
    const characters = [
      bearer('Paladin1', ['Aura of Protection'], [{ name: 'Charisma', bonus: 5 }]),
      bearer('Paladin2', ['Aura of Protection'], [{ name: 'Charisma', bonus: 3 }]),
    ];
    expect(await compute(characters)).toEqual({ bonus: 3, sourceName: 'Paladin2' });
  });
});
