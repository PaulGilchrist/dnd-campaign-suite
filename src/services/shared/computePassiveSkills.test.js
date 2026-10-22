// @maintained-by-ai
/**
 * LANE: computePassiveSkills.js (src/services/shared) — pure util, DIRECT unit tests.
 * Exporters->callers: race-rules 5e.js:99 getSenses and 2024.js:151 getSenses
 * (both push onto the returned array, so new-array identity is contract).
 * Caller-merge/sort lane lives in siblings 5e-senses.test.js / 2024-senses.test.js —
 * cited, not regrown here. This unit file owns the module's own arms: ability/skill
 * find-match, skill-outranks-ability, ability-bonus fallback, ||0 coercion incl.
 * NaN, exact-zero emission, shallow-copy identity, localeCompare sort, case gates.
 *
 * RULES LAW (disk): public/data/ability-scores.json — passive score "equals 10 +
 * the creature's Wisdom modifier, as well as any other bonuses or penalties".
 * The module consumes the sheet's PRE-COMBINED abilities[].bonus (proficiency+
 * expertise+misc folded upstream by abilityCalc/abilityCalc2024 — see
 * abilityCalc2024.test.js:154 '8 = 2 + 3 prof + 3 expertise'); it never re-derives
 * from scores. Boundary: NOT spell save-DC (#1506 computeSpellStats lane), NOT
 * armorClass, NOT initiative. Advantage +5/disadv -5 are not applied here.
 * 2024 ruleset: same 10+bonus consumer shape via 2024.js getSenses.
 *
 * FIXTURE provenance (STRUCT): abilities rows mirror REAL derived PlayerStats shape
 * { name, totalScore, bonus, skills:[{ name, bonus }] } — rules-playerStats-advanced
 * .test.js:111-116 and abilityCalc2024.test.js:154-161; sense entries { name, value }
 * strings mirror 5e.js:103-112 grants. No store/network/timers: mock census exact-of-0,
 * NO-CLOCK pure compute; unit-under-test fully REAL.
 *
 * QUIRKS pinned honest:
 *  - No dedup: computed passives COEXIST with same-named input senses (test 5).
 *  - Unnamed sense entries sort first via `a.name || ''` guard (test 4).
 *  - String bonus concatenates: 10 + '5' === '105' (test 6, current-behavior pin).
 *  - Exact 0 passes the `!== null` emission gate (test 2 'Investigation 0').
 *  - Golden crash: no-arg call TypeError on unchained playerStats deref (test 7).
 * - Kills additive-stacking, ??-vs-||, ability-priority, truthy-gate, deep-clone,
 *   sort-removal and name-normalization mutants; every table row carries kill-power.
 */
import { describe, it, expect } from 'vitest';
import { computePassiveSkills } from './computePassiveSkills.js';

describe('computePassiveSkills', () => {
  it('short-circuits and gates: empty/null/absent shapes, unmatched and lowercase ability names emit nothing', () => {
    // ?. short-circuit on absent/null abilities (js:3) and empty-array find miss
    expect(computePassiveSkills({})).toEqual([]);
    expect(computePassiveSkills({ abilities: [] })).toEqual([]);
    expect(computePassiveSkills({ abilities: null, senses: [{ name: 'Blindsight', value: '30 ft.' }] }))
      .toEqual([{ name: 'Blindsight', value: '30 ft.' }]);
    // abilities present but Wisdom/Intelligence absent -> senses only (js:4 null gate)
    expect(computePassiveSkills({
      abilities: [{ name: 'Strength', bonus: 2, skills: [{ name: 'Athletics', bonus: 3 }] }],
      senses: [{ name: 'Blindsight', value: '30 ft.' }],
    })).toEqual([{ name: 'Blindsight', value: '30 ft.' }]);
    // case-sensitive exact-match gate (js:3/5 ===): lowercase names are inert
    expect(computePassiveSkills({
      senses: [],
      abilities: [
        { name: 'wisdom', bonus: 5 },
        { name: 'intelligence', bonus: 3, skills: [{ name: 'investigation', bonus: 9 }] },
      ],
    })).toEqual([]);
  });

  it('skill bonus fully outranks ability bonus (no stacking); negatives and exact-0 emit', () => {
    const result = computePassiveSkills({
      abilities: [
        { name: 'Wisdom', totalScore: 6, bonus: -2, skills: [{ name: 'Perception', bonus: -3 }] },
        { name: 'Intelligence', bonus: -10, skills: [] },
      ],
    });
    // Perception: 10 + (-3) = 7 (ability -2 ignored, NOT added: additive mutant dies)
    // Insight: no skill row -> ability fallback 10 + (-2) = 8
    // Investigation: skills find-miss fallback 10 + (-10) = 0; exact 0 PASSES the !== null gate
    expect(result).toStrictEqual([
      { name: 'Passive Insight', value: '8' },
      { name: 'Passive Investigation', value: '0' },
      { name: 'Passive Perception', value: '7' },
    ]);
  });

  it('falls back to ability bonus via skills find-miss and skills?-short-circuit arms', () => {
    const result = computePassiveSkills({
      abilities: [
        { name: 'Wisdom', bonus: 3, skills: [{ name: 'Insight', bonus: 5 }] }, // skills:[] find-miss arm at js:7 for Perception
        { name: 'Intelligence', bonus: 1 }, // skills key absent -> ?. arm at js:5
      ],
    });
    expect(result).toStrictEqual([
      { name: 'Passive Insight', value: '15' }, // skill row wins: 10+5, distinct from fallback 13
      { name: 'Passive Investigation', value: '11' }, // ability fallback: 10+1
      { name: 'Passive Perception', value: '13' }, // ability fallback: 10+3
    ]);
  });

  it('merges with senses, sorts by localeCompare with nameless guard, copies without mutating input', () => {
    const blind = { value: '10 ft.' }; // adversarial nameless row: pins `a.name || ''` sort guard (js:20)
    const darkvision = { name: 'Darkvision', value: '60 ft.' };
    const input = {
      senses: [darkvision, blind],
      abilities: [
        { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] },
        { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toStrictEqual([
      { value: '10 ft.' }, // '' sorts first
      darkvision,
      { name: 'Passive Insight', value: '12' },
      { name: 'Passive Investigation', value: '13' },
      { name: 'Passive Perception', value: '15' },
    ]);
    // fresh array (callers 5e.js:100+ push onto it); shallow copy keeps sense object identity
    expect(result).not.toBe(input.senses);
    expect(result[1]).toBe(darkvision);
    expect(result[0]).toBe(blind);
    // input never mutated: length and order intact
    expect(input.senses).toHaveLength(2);
    expect(input.senses[0]).toBe(darkvision);
    // purity: repeat call deep-equal, distinct array
    const again = computePassiveSkills(input);
    expect(again).toEqual(result);
    expect(again).not.toBe(result);
  });

  it('does not dedupe computed passives against same-named senses; missing ability omits its passives', () => {
    const result = computePassiveSkills({
      senses: [{ name: 'Passive Perception', value: '20' }],
      abilities: [{ name: 'Wisdom', bonus: 2 }],
    });
    // quirk: original '20' AND computed '12' coexist; stable sort keeps sense first;
    // Intelligence absent -> Passive Investigation never emitted (null gate js:17)
    expect(result).toStrictEqual([
      { name: 'Passive Insight', value: '12' },
      { name: 'Passive Perception', value: '20' },
      { name: 'Passive Perception', value: '12' },
    ]);
  });

  it('coerces falsy bonuses to 0 via || arm incl. NaN (kills ?? mutants); string bonus concatenates', () => {
    // 0, null, undefined, NaN all falsy -> 10 + 0 = 10; ?? would leak 'NaN' (js:6/8)
    expect(computePassiveSkills({
      abilities: [
        { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: NaN }] },
        { name: 'Intelligence', bonus: null },
      ],
    })).toStrictEqual([
      { name: 'Passive Insight', value: '10' },
      { name: 'Passive Investigation', value: '10' },
      { name: 'Passive Perception', value: '10' },
    ]);
    // current-behavior pin: numeric hygiene is upstream's job — '5' becomes '105'
    expect(computePassiveSkills({
      abilities: [
        { name: 'Wisdom', bonus: NaN },
        { name: 'Intelligence', skills: [{ name: 'Investigation', bonus: '5' }] },
      ],
    })).toStrictEqual([
      { name: 'Passive Insight', value: '10' },
      { name: 'Passive Investigation', value: '105' },
      { name: 'Passive Perception', value: '10' },
    ]);
  });

  it('callable contract: throws TypeError on missing playerStats, arity 1, extra args ignored', () => {
    expect(() => computePassiveSkills()).toThrow(TypeError); // unchained playerStats deref js:3 (golden crash)
    expect(() => computePassiveSkills(null)).toThrow(TypeError);
    expect(computePassiveSkills.length).toBe(1);
    expect(computePassiveSkills({ abilities: [] }, 'extra', {})).toEqual([]);
  });
});
