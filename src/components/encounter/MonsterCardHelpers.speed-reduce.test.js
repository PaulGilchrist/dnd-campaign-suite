// @maintained-by-ai
// MA-1530: parseSpeedReduceClause parser contract — Steam Mephit Steam Breath
// authored failed-save "Speed decreases by N feet" clause ("the target's Speed
// decreases by 10 feet until the end of the mephit's next turn") maps to the
// registered speed_reduction te with the parsed numeric value. Consumer
// threading cite-only (not re-pinned here): MonsterCardModal.jsx:369-371 →
// SaveAttackAoeModal picker fail leg, producer-pinned by
// SaveAttackAoeModal.speed-reduce.test.jsx. Registry reuse MA-0995 pinned by
// targetEffectDefinitions.test.js:280-308 (Movement group, value field,
// default 10). Trimmed 2026-10-18: once-per-branch table incl. numeric capture
// edge (5 vs 30) and /i + decrease/decreases legs; neighbor-wording negatives
// unpinned elsewhere for THIS helper (halved/zero positive owners are
// speed-half #565 / speed-zero; #565:30 and speed-zero:24 pin 'Speed reduced
// by 10 feet' only against THEIR parsers — the near-miss verb guard for this
// regex lives here). Dropped: ice-mephit 'Half damage' byte-inert audit and
// frost-giant Great Bow decoy (the parse-positive is already pinned by the
// fingerprint; the decoy's save_dc-less attack-row unreachability is a picker
// save-seam fact, not this pure-text helper's contract) and the
// registry-definition re-pin.
import { describe, it, expect } from 'vitest';
import { parseSpeedReduceClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-1530 parseSpeedReduceClause', () => {
  // BY-name disk fingerprint: the authored Steam Mephit Steam Breath save-lane
  // row's clause parses to the seam's te key with the RAW −10 ft capture.
  it('matches the authored Steam Mephit Steam Breath save_effect', () => {
    const row = monstersData.find(m => m.index === 'steam-mephit')
      .actions.find(a => a.name === 'Steam Breath');
    expect(row.save_dc).toBe(10);
    expect(row.save_effect).toContain("Speed decreases by 10 feet");
    expect(parseSpeedReduceClause(row.save_effect)).toEqual({ effect: 'speed_reduction', value: 10 });
  });

  // Once-per-branch table: /i + decrease/decreases + single vs multi-digit
  // numeric capture; neighbor-lane wording and near-miss verb stay inert;
  // clauseless string; falsy + non-string guard legs.
  it.each([
    ['decrease singular, single-digit capture', 'speed decrease by 5 feet', { effect: 'speed_reduction', value: 5 }],
    ['/i uppercase, multi-digit capture', 'Speed Decreases By 30 Feet', { effect: 'speed_reduction', value: 30 }],
    ['speed_half wording stays inert', "the target's Speed is halved until the end of its next turn", null],
    ['speed_zero wording stays inert', "the target's Speed is 0 until the end of the target's next turn", null],
    ['near-miss verb (reduced, not decreased) stays inert', 'Speed reduced by 10 feet', null],
    ['clauseless wording', 'Target is Poisoned.', null],
    ['falsy guard', null, null],
    ['non-string guard', 42, null],
  ])('%s', (_label, input, expected) => {
    expect(parseSpeedReduceClause(input)).toEqual(expected);
  });
});
