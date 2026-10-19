// @maintained-by-ai
// Rules lane: exhaustionRules.js — the ONLY owner of exhaustion level math
// (app-authored DC ladder, death cap, long-rest reduction). Pure module:
// zero mocks (#952), fixed inputs -> exact outputs hand-derived ONCE from
// source + public/data/conditions.json golden census (#815/#710), never a
// loop-oracle.
// Data census (conditions.json, read 2026-10-19): 5e entry lists levels 1-5
// with level 6 = Death and "finishing a long rest reduces level by 1"; the
// 2024 entry agrees ("die if your Exhaustion level is 6", "Long Rest removes
// 1"). EXHAUSTION_LEVELS=6 and isDeadFromExhaustion(>=6) match both.
// getExhaustionSaveDC = 10 + level is app-authored (no DC in data): the
// sheet's "Constitution Save (Exhaustion)" prompt in CharConditions.jsx
// adjustExhaustion — pinned as authored (#983 honesty).
// Family map (do not duplicate here):
//   - saveProcessing.exhaustion.test.js — apply lane: store writes + log for
//     failed-save exhaustion clauses (rides the real cap only)
//   - CharConditions.exhaustion.test.jsx + siblings — render lane, MOCK this
//     module; pin badge UI only
//   - restRules*.test.js — consumer lane, MOCK getLevelAfterLongRest
//   - deathSaveRules.test.js #1007 — twin exemplar (distinct module: saves)
//   - travelService.test.js — pins its own re-exported cap constant
// Method: golden ladder census over the authored domain 0-7 folds the old
// three per-function tests into one byte-exact table; near-miss 5 vs death 6
// (#943/#986); over-cap 7 shows dead stays dead and rest reduces toward cap;
// floor 0 clamps; non-number/non-positive guards folded as rows (#936).
// Old->new: EXHAUSTION_LEVELS 'is 6' -> census pin; getExhaustionSaveDC
// (missed levels 2,4) + isDeadFromExhaustion x2 + getLevelAfterLongRest
// decrement/zero -> ladder table; null + undefined + non-number passthrough
// x3 -> guard table.
import { describe, it, expect } from 'vitest'
import {
  EXHAUSTION_LEVELS,
  getExhaustionSaveDC,
  isDeadFromExhaustion,
  getLevelAfterLongRest,
} from './exhaustionRules.js'

describe('exhaustionRules', () => {
  it('caps exhaustion at 6 levels (conditions.json golden census)', () => {
    expect(EXHAUSTION_LEVELS).toBe(6)
  })

  // Full authored-domain census: [level, saveDC, dead, levelAfterLongRest].
  it.each([
    [0, 10, false, 0],  // floor: rest never goes below 0
    [1, 11, false, 0],
    [2, 12, false, 1],
    [3, 13, false, 2],
    [4, 14, false, 3],
    [5, 15, false, 4],  // near-miss: one below the death cap
    [6, 16, true, 5],   // cap: level 6 = death (both rulesets)
    [7, 17, true, 6],   // over-cap: stays dead, rest reduces toward cap
  ])('level %i: DC %i, dead %s, after long rest %i', (level, dc, dead, afterRest) => {
    expect(getExhaustionSaveDC(level)).toBe(dc)
    expect(isDeadFromExhaustion(level)).toBe(dead)
    expect(getLevelAfterLongRest(level)).toBe(afterRest)
  })

  // Folded guards (#936): anything that is not a positive number passes
  // through untouched — the contract restRules consumers rely on when the
  // runtime store holds null/undefined for a never-exhausted character.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'invalid'],
    ['true', true],
    ['false', false],
    ['zero', 0],
    ['negative', -1],
  ])('getLevelAfterLongRest(%s) passes the input through unchanged', (_label, input) => {
    expect(getLevelAfterLongRest(input)).toBe(input)
  })
})
