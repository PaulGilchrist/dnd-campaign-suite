// MA-0093: Adult Copper Dragon Giggling Magic authored failed-save
// subtract-die debuff clause — parse arms the giggling_magic_debuff te
// producer in saveProcessing (MA-0073 speed-half parse shape); the parsed
// die rides the te as subtractDie (Ancient Copper Dragon rolls 1d8).
import { describe, it, expect } from 'vitest';
import { parseSubtractDieClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0093 parseSubtractDieClause', () => {
  it('matches the Adult Copper Dragon Giggling Magic save_effect with die 1d6', () => {
    const row = monstersData.find(m => m.name === 'Adult Copper Dragon')
      .legendary_actions.find(a => a.name === 'Giggling Magic');
    expect(parseSubtractDieClause(row.save_effect)).toEqual({
      effect: 'giggling_magic_debuff',
      die: '1d6',
      displayLabel: 'Giggling Magic',
    });
  });

  it('matches the Ancient Copper Dragon row with die 1d8', () => {
    const row = monstersData.find(m => m.name === 'Ancient Copper Dragon')
      .legendary_actions.find(a => a.name === 'Giggling Magic');
    expect(parseSubtractDieClause(row.save_effect)).toEqual({
      effect: 'giggling_magic_debuff',
      die: '1d8',
      displayLabel: 'Giggling Magic',
    });
  });

  it('Adult Copper Giggling Magic locks dc_success none + header uses:3 (MA-0092 defects)', () => {
    const copper = monstersData.find(m => m.name === 'Adult Copper Dragon');
    const row = copper.legendary_actions.find(a => a.name === 'Giggling Magic');
    expect(row.dc_success).toBe('none');
    expect(copper.legendary_actions[0].uses).toBe(3);
    expect(row.save_dc).toBe(17);
    expect(row.save_type).toBe('Charisma');
  });

  it('returns null for rows without the clause / non-strings', () => {
    expect(parseSubtractDieClause('Target takes 7d6 Psychic damage.')).toBeNull();
    expect(parseSubtractDieClause('Speed is halved until end of turn')).toBeNull();
    expect(parseSubtractDieClause('rolls a saving throw and subtracts nothing')).toBeNull();
    expect(parseSubtractDieClause(null)).toBeNull();
    expect(parseSubtractDieClause(undefined)).toBeNull();
    expect(parseSubtractDieClause(42)).toBeNull();
  });
});
