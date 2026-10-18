// @maintained-by-ai
// MA-0146: parseSpeedZeroClause parser contract — source pins /speed is 0\b/i
// → { effect:'speed_zero' } (MonsterCardHelpers.js:85-88). Adult White Dragon
// Freezing Burst authored failed-save "the target's Speed is 0" clause arms the
// speed_zero producer (te + activeCondition) at the picker/saveProcessing
// failed-save seams (MA-0073 parse shape). Consumer threading cite-skip (not
// re-pinned here): MonsterCardModal.jsx:359/:1863 speedZeroClause arm →
// SaveAttackAoeModal.speed-zero.test.jsx + freezing-burst-ancient-white
// picker lanes; saveProcessing.ma2013-sun-wukong-locking-word.test.js:61
// re-runs THIS parser on its own consumer lane. Registry te speed_zero
// re-pin delegated to targetEffectDefinitions.test.js owner (#566 precedent).
// Trimmed 2026-08+2026-10: adult-row BY-name fingerprint replaces the
// index lookup (#387 family convention); generic /i positive and the
// clauseless/falsy/non-string guard legs collapse into the once-per-branch
// table; Scorching Sands BY-name lookup becomes a halved-wording literal.
import { describe, it, expect } from 'vitest';
import { parseSpeedZeroClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0146 parseSpeedZeroClause', () => {
  // BY-name disk fingerprint: the authored clause parses to the seam's key.
  it('matches the authored Adult White Dragon Freezing Burst save_effect', () => {
    const row = monstersData.find(m => m.name === 'Adult White Dragon')
      .legendary_actions.find(a => a.name === 'Freezing Burst');
    expect(row.save_effect).toContain("Speed is 0");
    expect(parseSpeedZeroClause(row.save_effect)).toEqual({ effect: 'speed_zero' });
  });

  // Once-per-branch table: /i lowercase positive; neighbor-lane wording
  // negatives unpinned against THIS parser elsewhere (halved #562/#565,
  // decreases #566, near-miss verb — those files pin it against THEIR
  // parsers only); clauseless string; falsy + non-string guard legs.
  it.each([
    ['lowercase /i match', 'speed is 0', { effect: 'speed_zero' }],
    ['speed_half wording stays inert', "the target's Speed is halved until the end of its next turn", null],
    ['speed_decreases wording stays inert', "the target's Speed decreases by 10 feet until the end of the mephit's next turn", null],
    ['near-miss verb (reduced, not is) stays inert', 'Speed reduced by 10 feet', null],
    ['clauseless wording', 'Target is Poisoned.', null],
    ['falsy guard', null, null],
    ['non-string guard', 42, null],
  ])('%s', (_label, input, expected) => {
    expect(parseSpeedZeroClause(input)).toEqual(expected);
  });
});
