// MA-0093: Adult Copper Dragon Giggling Magic authored failed-save
// subtract-die debuff clause — parse arms the giggling_magic_debuff te
// producer in saveProcessing (MA-0073 speed-half parse shape); the parsed
// die rides the te as subtractDie (Ancient Copper Dragon rolls 1d8).
// Roll-time consumer computeSubtractDiePenalty covered in
// d20RollComputation.subtract-die.test.js; legendary uses:3 economy in
// monsterLegendaryUses.test.js.
// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { parseSubtractDieClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0093 parseSubtractDieClause', () => {
  it('parses the Copper Dragon Giggling Magic rows (disk fingerprint, MA-0092 locks)', () => {
    const fingerprint = [
      ['Adult Copper Dragon', '1d6', 17],
      ['Ancient Copper Dragon', '1d8', 21],
    ];
    for (const [name, die, dc] of fingerprint) {
      const monster = monstersData.find(m => m.name === name);
      const row = monster.legendary_actions.find(a => a.name === 'Giggling Magic');
      expect(parseSubtractDieClause(row.save_effect)).toEqual({
        effect: 'giggling_magic_debuff',
        die,
        displayLabel: 'Giggling Magic',
      });
      expect(row.dc_success).toBe('none');
      expect(row.save_dc).toBe(dc);
      expect(row.save_type).toBe('Charisma');
    }
    expect(monstersData.find(m => m.name === 'Adult Copper Dragon').legendary_actions[0].uses).toBe(3);
  });

  it('matches case-insensitively, singular or plural subtract, lowercases the die', () => {
    expect(parseSubtractDieClause('the target rolls 1D8 whenever it attacks and subtracts the number rolled')).toEqual({
      effect: 'giggling_magic_debuff', die: '1d8', displayLabel: 'Giggling Magic',
    });
    expect(parseSubtractDieClause('the target rolls 2d10 and subtract the number rolled')).toEqual({
      effect: 'giggling_magic_debuff', die: '2d10', displayLabel: 'Giggling Magic',
    });
    // [^.]* clause guard: a full stop between the roll and the subtract breaks the match.
    expect(parseSubtractDieClause('the target rolls 1d6. Later it subtracts the number rolled')).toBeNull();
  });

  it('returns null for rows without the clause / non-strings', () => {
    for (const s of ['Target takes 7d6 Psychic damage.', 'Speed is halved until end of turn',
      'rolls a saving throw and subtracts nothing', null, undefined, 42]) {
      expect(parseSubtractDieClause(s)).toBeNull();
    }
  });
});
