// MA-0102: gold-dragon Weakening Breath authored clause parse (disk-row
// fingerprint). The save_effect clause "Disadvantage on Strength-based D20
// Tests and subtracts N (XdY) from its damage rolls… After 1 minute, it
// succeeds automatically" maps to the registered weakening_breath te payload
// with the age-category die; every other row's save_effect is byte-inert
// (null). Consumer threading is owned elsewhere: modal grant/exclusion
// SaveAttackAoeModal.weakening-breath.test.jsx, roll-time consumers
// d20RollComputation.weakening-breath.test.js +
// handlePlainDamage.weakening-breath.test.js, auto-success clock
// weakeningBreathService.test.js + clearExpirationEffects.weakening-breath
// .test.js. Near-miss giggling subtract-die POSITIVE bytes are owned by the
// MA-0093 subtract-die lane (only its null-negative against this regex's
// prefix anchor lives here).
// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { parseWeakeningBreathClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const clause = idx => monstersData.find(m => m.index === idx).actions
  .find(a => a.name === 'Weakening Breath').save_effect;

describe('MA-0102 parseWeakeningBreathClause', () => {
  it('fingerprint: all four gold-dragon Weakening Breath disk rows parse to the weakening_breath payload with the age-category die', () => {
    // Unique die bytes per age category: wyrmling 1d4, young/adult 1d6, ancient 1d10.
    for (const [idx, die] of [
      ['gold-dragon-wyrmling', '1d4'],
      ['young-gold-dragon', '1d6'],
      ['adult-gold-dragon', '1d6'],
      ['ancient-gold-dragon', '1d10'],
    ]) {
      const parsed = parseWeakeningBreathClause(clause(idx));
      expect(parsed, idx).toMatchObject({
        effect: 'weakening_breath',
        strCheckDisadvantage: true,
        damageSubtractDie: die,
        repeatSave: true,
        autoSuccessMinutes: 1,
      });
    }
  });

  it('tolerates <strong> markup around "D20 Tests"; autoSuccessMinutes null without the 1-minute clause', () => {
    const parsed = parseWeakeningBreathClause('Disadvantage on Strength-based <strong>D20 Tests</strong> and subtracts 3 (1d6) from its damage rolls.');
    expect(parsed?.damageSubtractDie).toBe('1d6');
    expect(parsed?.autoSuccessMinutes).toBeNull();
  });

  it('is byte-inert null for nullish input, plain damage rows, the copper Slowing Breath rider, and near-miss giggling bytes', () => {
    expect(parseWeakeningBreathClause(null)).toBeNull();
    expect(parseWeakeningBreathClause(undefined)).toBeNull();
    expect(parseWeakeningBreathClause('66 (12d10) Fire damage. Success: Half damage.')).toBeNull();
    const slowing = monstersData.find(m => m.index === 'adult-copper-dragon').actions
      .find(a => a.name === 'Slowing Breath');
    expect(parseWeakeningBreathClause(slowing.save_effect)).toBeNull();
    expect(parseWeakeningBreathClause('the target rolls 1d6 whenever it makes an ability check or attack roll and subtracts the number rolled')).toBeNull();
  });
});
