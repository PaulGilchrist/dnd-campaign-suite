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

  it('returns { totalBonus: 0, details: [] } when no passives', () => {
    const result = resolveHealingBonusesWithDetails({ automation: { passives: [] } }, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('returns { totalBonus: 0, details: [] } when passives is null', () => {
    const result = resolveHealingBonusesWithDetails({ automation: { passives: null } }, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('returns { totalBonus: 0, details: [] } when automation is null', () => {
    const result = resolveHealingBonusesWithDetails({ automation: null }, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('evaluates bonus_healing expression and includes in details', () => {
    evaluateAutoExpression.mockReturnValue(5)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'TestFeature', bonusExpression: '2 + 3' }] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 5, details: [{ name: 'TestFeature', amount: 5 }] })
    expect(evaluateAutoExpression).toHaveBeenCalledWith('2 + 3', playerStats, 4, 3, 1)
  })

  it('evaluates max_hp_increase self-healing expression and includes in details', () => {
    evaluateAutoExpression.mockReturnValue(3)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', name: 'HPBoost', alsoSelfHealing: { extraHealingExpression: '1 + 2' } }] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 3, details: [{ name: 'HPBoost', amount: 3 }] })
  })

  it('excludes zero-amount bonuses from details', () => {
    evaluateAutoExpression.mockReturnValue(0)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'ZeroBonus', bonusExpression: '0' }] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('excludes negative-amount bonuses from details', () => {
    evaluateAutoExpression.mockReturnValue(-2)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'NegativeBonus', bonusExpression: '-2' }] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('skips expressions that evaluate to NaN', () => {
    evaluateAutoExpression.mockReturnValue(NaN)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'NaNBonus', bonusExpression: 'abc' }] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('skips expressions that evaluate to non-number', () => {
    evaluateAutoExpression.mockReturnValue('not a number')
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'StrBonus', bonusExpression: 'x' }] },
    }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
  })

  it('sums multiple healing bonuses with details', () => {
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

  it('skips bonus_healing without bonusExpression', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', name: 'NoExpr' }] } }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
    expect(evaluateAutoExpression).not.toHaveBeenCalled()
  })

  it('skips non-matching passive types', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    const result = resolveHealingBonusesWithDetails(playerStats, 4, 3, 1)
    expect(result).toEqual({ totalBonus: 0, details: [] })
    expect(evaluateAutoExpression).not.toHaveBeenCalled()
  })
})

// ── Boolean-check helper functions (delegate to hasPassiveEffect) ─

describe('hasInterception', () => {
  it('returns true when passive_rule interception exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'interception' }] } }
    expect(hasInterception(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasInterception({ automation: { passives: [] } })).toBe(false)
  })

  it('returns false when a different effect exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasInterception(playerStats)).toBe(false)
  })
})

describe('hasProtection', () => {
  it('returns true when passive_rule protection exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'protection' }] } }
    expect(hasProtection(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasProtection({ automation: { passives: [] } })).toBe(false)
  })

  it('returns false when a different effect exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasProtection(playerStats)).toBe(false)
  })
})

describe('hasThrownWeaponFighting', () => {
  it('returns true when passive_rule thrown_weapon_fighting exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'thrown_weapon_fighting' }] } }
    expect(hasThrownWeaponFighting(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasThrownWeaponFighting({ automation: { passives: [] } })).toBe(false)
  })

  it('returns false when a different effect exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasThrownWeaponFighting(playerStats)).toBe(false)
  })
})

describe('hasBlessedWarrior', () => {
  it('returns true when passive_rule blessed_warrior exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'blessed_warrior' }] } }
    expect(hasBlessedWarrior(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasBlessedWarrior({ automation: { passives: [] } })).toBe(false)
  })

  it('returns false when a different effect exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasBlessedWarrior(playerStats)).toBe(false)
  })
})
