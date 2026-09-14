// MA-0073: Adult Brass Dragon Scorching Sands authored failed-save
// speed-halved clause — parse arms the speed_half te producer in
// saveProcessing (MA-0038 concentration-disadvantage pattern).
import { describe, it, expect } from 'vitest';
import { parseSpeedHalfClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0073 parseSpeedHalfClause', () => {
  it('matches the authored Scorching Sands save_effect', () => {
    const row = monstersData.find(m => m.name === 'Adult Brass Dragon')
      .legendary_actions.find(a => a.name === 'Scorching Sands');
    expect(parseSpeedHalfClause(row.save_effect)).toEqual({ effect: 'speed_half' });
  });

  it('matches the Ancient Brass Dragon row too', () => {
    const row = monstersData.find(m => m.name === 'Ancient Brass Dragon')
      .legendary_actions.find(a => a.name === 'Scorching Sands');
    expect(parseSpeedHalfClause(row.save_effect)).toEqual({ effect: 'speed_half' });
  });

  it('case-insensitive "Speed is halved" match', () => {
    expect(parseSpeedHalfClause('and the target’s Speed is halved until the end of its next turn')).toEqual({ effect: 'speed_half' });
    expect(parseSpeedHalfClause('speed is halved')).toEqual({ effect: 'speed_half' });
  });

  it('returns null for rows without the clause / non-strings', () => {
    expect(parseSpeedHalfClause('Target is Poisoned.')).toBeNull();
    expect(parseSpeedHalfClause('Speed reduced by 10 feet')).toBeNull();
    expect(parseSpeedHalfClause(null)).toBeNull();
    expect(parseSpeedHalfClause(undefined)).toBeNull();
    expect(parseSpeedHalfClause(42)).toBeNull();
  });
});
