// @maintained-by-ai — MA-0115 OWNER truth-table for parseAcPenaltyClause
// (MonsterCardHelpers.js:226), the ac_penalty te parse lane. Branches:
// guard (non-string) → null; regex match /[\u2212-]\s*(\d+)\s*penalt(?:y|ies) to AC/i
// → {effect:'ac_penalty', value:N}; no clause → byte-inert null. Disk fixtures
// BY NAME: Adult + Ancient Green Dragon Noxious Miasma rows both feed this
// parse at the failed-save seams (saveProcessing + SaveAttackAoeModal picker,
// MA-0073 shape; consumers own their render pins, MA-lane canon — they no
// longer restate this parse). ASCII-hyphen / plural / lowercase-ac twins fold
// into one synthetic string covering all three regex alternations at once.
import { describe, it, expect } from 'vitest';
import { parseAcPenaltyClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const miasmaRow = name => monstersData.find(m => m.index === name)
  .legendary_actions.find(a => a.name === 'Noxious Miasma');

describe('MA-0115 parseAcPenaltyClause', () => {
  it.each([
    ['Adult Green Dragon Noxious Miasma disk fixture', miasmaRow('adult-green-dragon').save_effect, { effect: 'ac_penalty', value: 2 }],
    ['ASCII hyphen + plural + lowercase-ac (folded alternations)', 'the target takes a -4 penalties to ac until the end of its next turn', { effect: 'ac_penalty', value: 4 }],
    ['clauseless save_effect is byte-inert', 'the target is poisoned.', null],
  ])('%s', (_label, saveEffect, expected) => {
    expect(parseAcPenaltyClause(saveEffect)).toEqual(expected);
  });

  it('guard: nullish / empty / non-string inputs return null', () => {
    for (const input of [null, undefined, '', 42, {}]) {
      expect(parseAcPenaltyClause(input)).toBeNull();
    }
  });
});

describe('MA-0115 monsters.json data lock: Noxious Miasma rows', () => {
  it('keeps Adult DC 17 CON / 2d6 Poison and the verbatim −2 AC-penalty save_effect', () => {
    const row = miasmaRow('adult-green-dragon');
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Constitution');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Poison');
    expect(row.save_effect).toBe('7 (2d6) Poison damage, and the target takes a −2 penalty to AC until the end of its next turn. Success: No damage or effect');
  });

  it('keeps the Ancient Green Dragon twin row feeding the same parse (DC 21 / 5d6)', () => {
    const row = miasmaRow('ancient-green-dragon');
    expect(row.save_dc).toBe(21);
    expect(row.damage_dice_primary).toBe('5d6');
    expect(row.save_effect).toMatch(/takes a −2 penalty to AC until the end of its next turn/);
  });
});
