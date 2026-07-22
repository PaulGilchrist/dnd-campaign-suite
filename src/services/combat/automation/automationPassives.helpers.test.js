// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  resolveHealingBonusesWithDetails,
  hasInterception,
  hasProtection,
  hasThrownWeaponFighting,
  hasBlessedWarrior,
} from './automationPassives.js'

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((_abilities, _abilityName) => 0),
}))

import { evaluateAutoExpression } from './automationExpressions.js'

// ── resolveHealingBonusesWithDetails ──────────────────────────────

describe('resolveHealingBonusesWithDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns { totalBonus: 0, details: [] } when no passives, passives is null, or automation is null', () => {
    expect(resolveHealingBonusesWithDetails({ automation: { passives: [] } }, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })
    expect(resolveHealingBonusesWithDetails({ automation: { passives: null } }, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })
    expect(resolveHealingBonusesWithDetails({ automation: null }, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })
  })

  it('evaluates bonus_healing and max_hp_increase expressions and includes in details', () => {
    evaluateAutoExpression.mockImplementation((expr) => (expr === '2 + 3' ? 5 : 2))
    const playerStats = {
      automation: { passives: [
        { type: 'passive_rule', effect: 'bonus_healing', name: 'Bonus1', bonusExpression: '2 + 3' },
        { type: 'passive_rule', effect: 'max_hp_increase', name: 'Bonus2', alsoSelfHealing: { extraHealingExpression: '1 + 1' } },
      ] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 7, details: [{ name: 'Bonus1', amount: 5 }, { name: 'Bonus2', amount: 2 }] })
  })

  it('excludes zero, negative, NaN, and non-number bonuses from details and total', () => {
    evaluateAutoExpression.mockReturnValue(0)
    const zero = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Zero', bonusExpression: '0' }] } }
    expect(resolveHealingBonusesWithDetails(zero, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })

    evaluateAutoExpression.mockReturnValue(-2)
    const negative = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Neg', bonusExpression: '-2' }] } }
    expect(resolveHealingBonusesWithDetails(negative, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })

    evaluateAutoExpression.mockReturnValue(NaN)
    const nan = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'NaN', bonusExpression: 'abc' }] } }
    expect(resolveHealingBonusesWithDetails(nan, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })

    evaluateAutoExpression.mockReturnValue('not a number')
    const str = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'Str', bonusExpression: 'x' }] } }
    expect(resolveHealingBonusesWithDetails(str, 4, 3, 1)).toEqual({ totalBonus: 0, details: [] })
  })

  it('skips bonus_healing without bonusExpression and non-matching passive types', () => {
    const noExpr = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'NoExpr' }] } }
    const result = resolveHealingBonusesWithDetails(noExpr, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
    expect(evaluateAutoExpression).not.toHaveBeenCalled()

    const wrongType = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    const result2 = resolveHealingBonusesWithDetails(wrongType, 4, 3, 1)
    expect(result2).toEqual({ totalBonus: 0, details: [] })
    expect(evaluateAutoExpression).not.toHaveBeenCalled()
  })
})

// ── Wrapper helpers delegate to hasPassiveEffect ──────────────────

describe('wrapper helpers (hasInterception, hasProtection, hasThrownWeaponFighting, hasBlessedWarrior)', () => {
  it('returns true when their respective passive exists', () => {
    const makePS = (effect) => ({ automation: { passives: [{ type: 'passive_rule', effect }] } })
    expect(hasInterception(makePS('interception'))).toBe(true)
    expect(hasProtection(makePS('protection'))).toBe(true)
    expect(hasThrownWeaponFighting(makePS('thrown_weapon_fighting'))).toBe(true)
    expect(hasBlessedWarrior(makePS('blessed_warrior'))).toBe(true)
  })

  it('returns false when the respective passive is absent or a different effect exists', () => {
    const ps = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasInterception(ps)).toBe(false)
    expect(hasProtection(ps)).toBe(false)
    expect(hasThrownWeaponFighting(ps)).toBe(false)
    expect(hasBlessedWarrior(ps)).toBe(false)

    const empty = { automation: { passives: [] } }
    expect(hasInterception(empty)).toBe(false)
    expect(hasProtection(empty)).toBe(false)
    expect(hasThrownWeaponFighting(empty)).toBe(false)
    expect(hasBlessedWarrior(empty)).toBe(false)
  })

  it('resolves fortified_health healing bonus from passives array', () => {
    evaluateAutoExpression.mockReturnValue(3)
    const playerStats = {
      automation: { passives: [
        { type: 'passive_rule', effect: 'fortified_health', name: 'Fortified Health', alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true } },
      ] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 3, details: [{ name: 'Fortified Health', amount: 3 }] })
  })

  it('resolves fortified_health healing bonus from target passives when casting on another creature', () => {
    evaluateAutoExpression.mockReturnValue(5)
    const casterStats = { automation: { passives: [] } }
    const targetStats = {
      automation: { passives: [
        { type: 'passive_rule', effect: 'fortified_health', name: 'Fortified Health', alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true } },
      ] },
    }
    const result = resolveHealingBonusesWithDetails(casterStats, 4, 3, 1, 'test-campaign', targetStats)
    expect(result).toEqual({ totalBonus: 5, details: [{ name: 'Fortified Health', amount: 5 }] })
  })
})
