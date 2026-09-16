// MA-0102: Adult Gold Dragon Weakening Breath authored clause parse. The
// save_effect clause "Disadvantage on Strength-based D20 Tests and subtracts
// 3 (1d6) from its damage rolls… After 1 minute, it succeeds automatically"
// maps to the registered weakening_breath te payload; every other row's
// save_effect is byte-inert (null).
import { describe, it, expect } from 'vitest';
import { parseWeakeningBreathClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const GOLD = monstersData.find(m => m.index === 'adult-gold-dragon');
const WEAKENING = GOLD.actions.find(a => a.name === 'Weakening Breath');

describe('MA-0102 parseWeakeningBreathClause', () => {
  it('parses the Adult Gold Dragon Weakening Breath save_effect verbatim', () => {
    const parsed = parseWeakeningBreathClause(WEAKENING.save_effect);
    expect(parsed).toBeTruthy();
    expect(parsed.effect).toBe('weakening_breath');
    expect(parsed.strCheckDisadvantage).toBe(true);
    expect(parsed.damageSubtractDie).toBe('1d6');
    expect(parsed.repeatSave).toBe(true);
    expect(parsed.autoSuccessMinutes).toBe(1);
  });

  it('tolerates the <strong> markup around "D20 Tests"', () => {
    const parsed = parseWeakeningBreathClause('Disadvantage on Strength-based <strong>D20 Tests</strong> and subtracts 3 (1d6) from its damage rolls.');
    expect(parsed?.damageSubtractDie).toBe('1d6');
  });

  it('autoSuccessMinutes null without the 1-minute clause', () => {
    const parsed = parseWeakeningBreathClause('Disadvantage on Strength-based D20 Tests and subtracts 3 (1d6) from its damage rolls.');
    expect(parsed?.autoSuccessMinutes).toBeNull();
  });

  it('is byte-inert null for other breath / clauseless save_effects', () => {
    expect(parseWeakeningBreathClause(null)).toBeNull();
    expect(parseWeakeningBreathClause(undefined)).toBeNull();
    expect(parseWeakeningBreathClause('66 (12d10) Fire damage. Success: Half damage.')).toBeNull();
    const slowing = monstersData.find(m => m.index === 'adult-copper-dragon').actions.find(a => a.name === 'Slowing Breath');
    expect(parseWeakeningBreathClause(slowing.save_effect)).toBeNull();
  });

  it('does not false-positive on the giggling subtract-die clause', () => {
    const giggling = monstersData.find(m => m.index === 'adult-copper-dragon').actions.find(a => a.name === 'Slowing Breath');
    expect(parseWeakeningBreathClause(giggling.save_effect)).toBeNull();
    expect(parseWeakeningBreathClause('the target rolls 1d6 whenever it makes an ability check or attack roll and subtracts the number rolled')).toBeNull();
  });
});
