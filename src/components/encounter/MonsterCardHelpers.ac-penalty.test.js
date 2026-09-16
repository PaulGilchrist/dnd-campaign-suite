// MA-0115: Adult Green Dragon Noxious Miasma authored failed-save AC-
// penalty clause — "the target takes a −2 penalty to AC until the end of
// its next turn". The parse arms the ac_penalty te producer at the failed-
// save seams (saveProcessing + SaveAttackAoeModal picker, MA-0073 shape);
// the live consumer (conditionEffects acPenalty) folds the value into AC.
import { describe, it, expect } from 'vitest';
import { parseAcPenaltyClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0115 parseAcPenaltyClause', () => {
  it('parses the Unicode-minus −2 clause from the Noxious Miasma row', () => {
    const green = monstersData.find(m => m.index === 'adult-green-dragon');
    const miasma = green.legendary_actions.find(a => a.name === 'Noxious Miasma');
    expect(parseAcPenaltyClause(miasma.save_effect)).toEqual({ effect: 'ac_penalty', value: 2 });
  });

  it('parses an ASCII-hyphen -N penalty clause', () => {
    expect(parseAcPenaltyClause('the target takes a -4 penalty to AC until the end of its next turn')).toEqual({ effect: 'ac_penalty', value: 4 });
  });

  it('accepts the plural penalties form', () => {
    expect(parseAcPenaltyClause('takes \u22122 penalties to AC')).toEqual({ effect: 'ac_penalty', value: 2 });
  });

  it('never matches a clauseless save_effect', () => {
    expect(parseAcPenaltyClause('the target is poisoned.')).toBeNull();
    expect(parseAcPenaltyClause('')).toBeNull();
    expect(parseAcPenaltyClause(null)).toBeNull();
    expect(parseAcPenaltyClause(undefined)).toBeNull();
  });
});

describe('MA-0115 monsters.json data lock: Adult Green Dragon Noxious Miasma row', () => {
  const miasma = monstersData.find(m => m.index === 'adult-green-dragon').legendary_actions.find(a => a.name === 'Noxious Miasma');

  it('keeps the canonical DC 17 CON / 2d6 Poison sphere shape', () => {
    expect(miasma.save_dc).toBe(17);
    expect(miasma.save_type).toBe('Constitution');
    expect(miasma.damage_dice_primary).toBe('2d6');
    expect(miasma.damage_type_primary).toBe('Poison');
    expect(miasma.save_effect).toMatch(/\u22122 penalty to AC until the end of its next turn/);
    expect(miasma.save_effect).toMatch(/Success: No damage or effect/i);
  });
});
