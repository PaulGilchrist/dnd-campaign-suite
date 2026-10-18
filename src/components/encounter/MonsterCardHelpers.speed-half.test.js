// @maintained-by-ai
// MA-0073: parseSpeedHalfClause parser contract — Adult/Ancient Brass Dragon
// Scorching Sands authored failed-save "Speed is halved" clause arms the
// speed_half te producer in saveProcessing (MA-0038 parse shape). This is a
// DISTINCT helper from parseSlowedClauses (#562 owner, { effects:[...] }
// tuple on Slowing Breath); its own tuple { effect:'speed_half' } is the
// consumer key threaded as speedHalf at MonsterCardModal.jsx:1843 →
// grantSpeedHalf, producer-pinned by saveProcessing.speed-half.test.js (which
// delegates the parser contract here). Trimmed 2026-10-18: ancient-brass row
// is a byte-twin of the adult row for this single regex (single BY-name pin);
// generic clauseless negative collapses into the decoy negative (neighbor
// parseSpeedReduceClause wording must stay inert); falsy and typeof guards
// pinned one representative each.
import { describe, it, expect } from 'vitest';
import { parseSpeedHalfClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0073 parseSpeedHalfClause', () => {
  // BY-name disk fingerprint: the authored clause parses to the seam's key.
  it('matches the authored Adult Brass Dragon Scorching Sands save_effect', () => {
    const row = monstersData.find(m => m.name === 'Adult Brass Dragon')
      .legendary_actions.find(a => a.name === 'Scorching Sands');
    expect(parseSpeedHalfClause(row.save_effect)).toEqual({ effect: 'speed_half' });
  });

  // Once-per-branch table: /i lowercase positive; neighbor-wording negative;
  // falsy + non-string guard legs.
  it.each([
    ['lowercase /i match', 'speed is halved', { effect: 'speed_half' }],
    ['Speed-reduce-by-N wording stays inert', 'Speed reduced by 10 feet', null],
    ['falsy guard', null, null],
    ['non-string guard', 42, null],
  ])('%s', (_label, input, expected) => {
    expect(parseSpeedHalfClause(input)).toEqual(expected);
  });
});
