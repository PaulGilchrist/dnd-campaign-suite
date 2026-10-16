// @maintained-by-ai
// auraComboEffects lane — the aggregate seam: membership/range gating + per-passive
// appliers producing the {speedBonus, immunities, resistances} envelope consumed by
// applyDamage.js:777, auraConditionImmunity.js (delegates here) and CharSheet.jsx:574.
//
// auras/ folder lane map (for successors — don't re-pin what lives there):
// - auraOfProtection.js: primitives lane — hasAura/getAuraRangeFromStats/getChaModifier/
//   hasCannotActCondition/computeAuraBonus; CANNOT_ACT list + 10/30 range constants pinned there.
// - auraConditionImmunity.js: CLA-019 channel — delegates membership here; covers/split/log pinned there.
// - corona/duplicity/elderChampion/lion/wolfAuraUtils: individual token auras, own lanes.
// - bardicInspirationState / pendingPopupRegistry / pendingSaveRegistry / unbreakableMajesty: state registries.
//
// Fixtures are disk-shaped against public/data/2024/classes.json (Aura of Alacrity's
// bonusExpression is "+10 ft.", Aura of Warding carries a resistances array). Aura metadata
// rides passive automation fields, NOT targetEffects registry keys. No clocks here: gating
// is call-time (isWithinRange + cannot-act conditions) — auras never expire on a timer.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

import { computeAuraComboEffects } from './auraComboEffects.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';

const ZERO_ENVELOPE = {
  speedBonus: 0,
  speedSource: null,
  immunities: [],
  immunitySources: {},
  resistances: [],
  resistanceSource: null,
};

// Every aura channel on one source: a zero envelope from this entry proves a
// gate fired, not that the entry had nothing to give.
function fullAuraPassives({ without = [] } = {}) {
  return [
    { name: 'Aura of Protection' },
    { name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: '10' },
    { name: 'Aura of Courage', conditionImmunity: 'frightened' },
    { name: 'Aura of Devotion', conditionImmunity: 'charmed' },
    { name: 'Aura of Warding', resistances: ['necrotic'] },
  ].filter(p => !without.includes(p.name));
}

function auraBearer(name, passives = fullAuraPassives()) {
  return { name, computedStats: { automation: { passives } } };
}

describe('computeAuraComboEffects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getRuntimeValue.mockReturnValue([]);
    getAllyList.mockReturnValue(['Cleric']);
    isWithinRange.mockResolvedValue(true);
  });

  it.each([
    ['no characters', () => [], null],
    ['source with no name', () => [auraBearer('')], null],
    ['null/undefined computedStats', () => [{ name: 'Paladin', computedStats: null }, { name: 'Bard', computedStats: undefined }], null],
    ['source without Aura of Protection', () => [auraBearer('Wizard', fullAuraPassives({ without: ['Aura of Protection'] }))], null],
    ['source with a cannot-act condition', () => [auraBearer('Paladin')], () => getRuntimeValue.mockReturnValue(['stunned'])],
    ['target absent from ally list', () => [auraBearer('Paladin')], () => getAllyList.mockReturnValue(['OtherPlayer'])],
    ['source out of range', () => [auraBearer('Paladin')], () => isWithinRange.mockResolvedValue(false)],
  ])('returns the zero envelope when %s', async (_case, characters, setup) => {
    setup?.();
    const result = await computeAuraComboEffects({ targetName: 'Cleric', characters: characters() });
    expect(result).toEqual(ZERO_ENVELOPE);
  });

  it('applies every aura channel from one contributing source', async () => {
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [auraBearer('Paladin')],
    });
    expect(result).toEqual({
      speedBonus: 10,
      speedSource: 'Paladin',
      immunities: ['frightened', 'charmed'],
      immunitySources: { frightened: 'Paladin', charmed: 'Paladin' },
      resistances: ['necrotic'],
      resistanceSource: 'Paladin',
    });
  });

  it('competes speed across sources while merging immunities and deduping resistances', async () => {
    // Paladin1: lower speed, Courage, Warding. Paladin2: higher speed, Devotion.
    // Cleric (target) is its own aura host despite listing no allies — self-bypass.
    getAllyList.mockImplementation(name => (name === 'Cleric' ? [] : ['Cleric']));
    const p1 = auraBearer('Paladin1', [
      { name: 'Aura of Protection' },
      { name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: '10' },
      { name: 'Aura of Courage', conditionImmunity: 'frightened' },
      { name: 'Aura of Warding', resistances: ['necrotic', 'radiant'] },
    ]);
    const p2 = auraBearer('Paladin2', [
      { name: 'Aura of Protection' },
      { name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: '20' },
      { name: 'Aura of Devotion', conditionImmunity: 'charmed' },
    ]);
    const self = auraBearer('Cleric', [
      { name: 'Aura of Protection' },
      { name: 'Aura of Warding', resistances: ['necrotic', 'psychic'] },
    ]);
    const result = await computeAuraComboEffects({ targetName: 'Cleric', characters: [p1, p2, self] });
    expect(result).toEqual({
      speedBonus: 20,
      speedSource: 'Paladin2',
      immunities: ['frightened', 'charmed'],
      immunitySources: { frightened: 'Paladin1', charmed: 'Paladin2' },
      resistances: ['necrotic', 'radiant', 'psychic'],
      resistanceSource: 'Cleric',
    });
  });

  it.each([
    ['+10 ft.', 10],
    ['15', 15],
    [undefined, 10],
    ['abc', 0],
    ['0', 0],
  ])('parses bonusExpression %s into speedBonus %s', async (expression, expected) => {
    const entry = auraBearer('Paladin', [
      { name: 'Aura of Protection' },
      { name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: expression },
    ]);
    const result = await computeAuraComboEffects({ targetName: 'Cleric', characters: [entry] });
    expect(result.speedBonus).toBe(expected);
    expect(result.speedSource).toBe(expected > 0 ? 'Paladin' : null);
  });

  it('selects the highest speed bonus and keeps the first on ties', async () => {
    const mk = (name, expr) => auraBearer(name, [
      { name: 'Aura of Protection' },
      { name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: expr },
    ]);
    const winner = await computeAuraComboEffects({ targetName: 'Cleric', characters: [mk('Paladin1', '15'), mk('Paladin2', '10')] });
    expect(winner.speedBonus).toBe(15);
    expect(winner.speedSource).toBe('Paladin1');

    const tied = await computeAuraComboEffects({ targetName: 'Cleric', characters: [mk('Paladin1', '10'), mk('Paladin2', '10')] });
    expect(tied.speedBonus).toBe(10);
    expect(tied.speedSource).toBe('Paladin1');
  });

  it('ignores foreign aura names, mismatched effect payloads, and empty resistance lists', async () => {
    const noise = auraBearer('Paladin', [
      { name: 'Aura of Protection' },
      { name: 'Aura of Alacrity', effect: 'other_effect', bonusExpression: '10' },
      { name: 'Aura of Courage', conditionImmunity: 'charmed' },
      { name: 'Aura of Devotion', conditionImmunity: 'frightened' },
      { name: 'Aura of Warding', resistances: [] },
      { name: 'Aura of Warding' },
      { name: 'Other Aura', effect: 'speed_bonus', bonusExpression: '20', conditionImmunity: 'frightened', resistances: ['fire'] },
    ]);
    const result = await computeAuraComboEffects({ targetName: 'Cleric', characters: [noise] });
    expect(result).toEqual(ZERO_ENVELOPE);
  });

  it('queries isWithinRange with 10 ft by default and 30 ft with Aura Expansion', async () => {
    const expanded = auraBearer('ElderPaladin', [
      ...fullAuraPassives(),
      { name: 'Aura Expansion' },
    ]);
    await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [auraBearer('Paladin'), expanded],
    });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', 10);
    expect(isWithinRange).toHaveBeenCalledWith('ElderPaladin', 'Cleric', 30);
  });
});
