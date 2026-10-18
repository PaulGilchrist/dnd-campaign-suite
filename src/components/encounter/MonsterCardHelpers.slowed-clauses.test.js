// @maintained-by-ai
// MA-0087: Adult Copper Dragon Slowing Breath "slowed" rider clause parse
// contract. 'slowed' is NOT a registered condition (no badge consumer), so
// each clause maps to an EXISTING registered te with a live consumer:
// speed_half, no_reactions, no_action_and_bonus_action. Threading seam
// (buildAbilitySaveRollContext arm → saveProcessing grantSlowedClausesInline)
// is covered by MonsterCardModal.euphoria-breath.test.js and
// saveProcessing.{euphoria-breath,ma1863-behemoth-trumpet,ma1872-cthulhu-madness-whisper,ma2013-sun-wukong-locking-word}.test.js.
// Row numerics (DC/type/dice) are consumed generically by the numeric
// save-leg router; adult-copper legendary shape is locked by MA-0206/0208
// (monsterLegendaryUses.test.js). This file pins the parser only.
import { describe, it, expect } from 'vitest';
import { parseSlowedClauses } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const COPPER = monstersData.find(m => m.index === 'adult-copper-dragon');

describe('MA-0087 parseSlowedClauses', () => {
  // BY-name disk fingerprint: all three clause branches fire once, in order.
  it('maps all three Adult Copper Slowing Breath clauses to registered te keys', () => {
    const row = COPPER.actions.find(a => a.name === 'Slowing Breath');
    expect(parseSlowedClauses(row.save_effect)).toEqual({
      effects: ['speed_half', 'no_reactions', 'no_action_and_bonus_action'],
    });
  });

  // Curly-apostrophe char class + lowercase (no on-disk row carries ’t take
  // Reactions — verified 2026-10-18), plus single-clause independence.
  it('tolerates curly apostrophe and lowercase prose (single-branch hit)', () => {
    expect(parseSlowedClauses('the target can\u2019t take reactions')).toEqual({ effects: ['no_reactions'] });
  });

  it('byte-inert: null for a clauseless string and for the non-string guard', () => {
    expect(parseSlowedClauses('The target is Poisoned.')).toBeNull();
    expect(parseSlowedClauses(null)).toBeNull();
  });
});
