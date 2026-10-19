// @maintained-by-ai
// Rules lane: PURE decision math behind the concentration service (save roll →
// clamp → total → pass/fail; damage → DC). The service lane owns break/roll/popup
// orchestration (concentrationService.test.js mocks these rules — no duplication);
// family map: cla107-hex-purge + sp128-er-purge next, cleanup lane #990,
// user-driven BREAKS canon trio #833-#835. Single ruleset (no 2024 fork here).
// Only collaborator is the RNG rollD20 — mocked deterministically; the SUT itself
// is pure, so every expected byte below is hand-derived, no oracle.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rollConcentrationSave, breakConcentration, computeConcentrationDc } from './concentrationRules.js'
import { rollD20 } from '../../dice/diceRoller.js'

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}))

// rollConcentrationSave(saveBonus, dc, dragonConstellationActive, disadvantage)
// Rules under test, in order: disadvantage → keep min of two dice;
// dragon constellation → clamp chosen roll up to 10 when <= 9 (never down);
// total = roll + saveBonus; success = total >= dc; rawRolls = dice as rolled.
describe('rollConcentrationSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    // label, dice, saveBonus, dc, dragon, disadvantage, expRoll, expTotal, expSuccess, expRawRolls
    ['plain success', [10], 5, 15, false, false, 10, 15, true, [10]],
    ['total one below dc fails', [9], 5, 15, false, false, 9, 14, false, [9]],
    ['total equal to dc succeeds', [10], 0, 10, false, false, 10, 10, true, [10]],
    ['negative bonus reduces total', [10], -2, 15, false, false, 10, 8, false, [10]],
    ['dragon clamps 9 up to 10 and flips fail to pass', [9], 3, 13, true, false, 10, 13, true, [9]],
    ['dragon leaves a rolled 10 untouched', [10], 3, 14, true, false, 10, 13, false, [10]],
    ['disadvantage keeps the lower second die', [15, 7], 3, 15, false, true, 7, 10, false, [15, 7]],
    ['disadvantage keeps the lower first die', [4, 12], 8, 12, false, true, 4, 12, true, [4, 12]],
    ['disadvantage then dragon clamp', [18, 3], 4, 14, true, true, 10, 14, true, [18, 3]],
    ['undefined flags behave as plain single roll', [12], 3, 15, undefined, undefined, 12, 15, true, [12]],
  ])('%s', (_label, rolls, bonus, dc, dragon, disadvantage, expRoll, expTotal, expSuccess, expRawRolls) => {
    rolls.forEach((r) => rollD20.mockReturnValueOnce(r))
    const result = rollConcentrationSave(bonus, dc, dragon, disadvantage)
    expect(result).toEqual({ roll: expRoll, total: expTotal, success: expSuccess, rawRolls: expRawRolls })
  })
})

// The service consumes this after removing the concentrated spell itself and
// treats null as "rules layer broke nothing" (see concentrationService.test.js).
describe('breakConcentration', () => {
  it('returns null for the concentration shape the service passes and for empty input', () => {
    expect(breakConcentration({ spell: 'Bless', dc: 10 })).toBeNull()
    expect(breakConcentration(undefined)).toBeNull()
  })
})

describe('computeConcentrationDc', () => {
  // DC = max(10, floor(damage / 2)): 20 is the last damage where the floor branch
  // cannot beat 10; 21 still ties at 10; 22 is the first damage where it wins.
  it.each([
    ['zero damage', 0, 10],
    ['dc floor at 20', 20, 10],
    ['halved 21 still ties the floor', 21, 10],
    ['halved 22 exceeds the floor', 22, 11],
    ['odd damage rounds down', 25, 12],
    ['large damage', 53, 26],
  ])('%s → DC %i', (_label, damage, expected) => {
    expect(computeConcentrationDc(damage)).toBe(expected)
  })
})
