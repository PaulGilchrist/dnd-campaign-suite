import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyMaxHpPassives, getCarryingCapacity } from './carryingCapacity.js'

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

import { evaluateAutoExpression } from '../../combat/automation/automationExpressions.js'

function statsWithPassives(passives) {
  return { automation: { passives } }
}

describe('applyMaxHpPassives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('folds fortified_health amount into max HP (FT-012)', () => {
    const stats = statsWithPassives([
      { type: 'passive_rule', effect: 'fortified_health', name: 'Fortified Health', amount: 40, alsoSelfHealing: { extraHealingExpression: 'CON modifier', oncePerTurn: true } },
    ])
    expect(applyMaxHpPassives(stats, 143)).toBe(183)
  })

  it('still folds max_hp_increase unchanged (regression)', () => {
    const stats = statsWithPassives([
      { type: 'passive_rule', effect: 'max_hp_increase', name: 'Toughness', amount: 20 },
    ])
    expect(applyMaxHpPassives(stats, 100)).toBe(120)
  })

  it('folds max_hp_increase bonusExpression via evaluateAutoExpression', () => {
    evaluateAutoExpression.mockReturnValue(5)
    const stats = statsWithPassives([
      { type: 'passive_rule', effect: 'max_hp_increase', name: 'Expr', bonusExpression: 'level' },
    ])
    expect(applyMaxHpPassives(stats, 100)).toBe(105)
    expect(evaluateAutoExpression).toHaveBeenCalledWith('level', stats)
  })

  it('folds fortified_health bonusExpression when amount is absent', () => {
    evaluateAutoExpression.mockReturnValue(8)
    const stats = statsWithPassives([
      { type: 'passive_rule', effect: 'fortified_health', name: 'Fortified Health', bonusExpression: 'level / 2' },
    ])
    expect(applyMaxHpPassives(stats, 100)).toBe(108)
  })

  it('ignores passives of the wrong type even with matching effect', () => {
    const stats = statsWithPassives([
      { type: 'passive_buff', effect: 'fortified_health', amount: 40 },
      { type: 'passive_buff', effect: 'max_hp_increase', amount: 10 },
    ])
    expect(applyMaxHpPassives(stats, 100)).toBe(100)
  })

  it('stacks multiple max-HP passives', () => {
    const stats = statsWithPassives([
      { type: 'passive_rule', effect: 'fortified_health', amount: 40 },
      { type: 'passive_rule', effect: 'max_hp_increase', amount: 20 },
    ])
    expect(applyMaxHpPassives(stats, 100)).toBe(160)
  })
})

describe('getCarryingCapacity', () => {
  it('is STR x 15 with size multiplier', () => {
    const stats = { abilities: [{ name: 'Strength', totalScore: 10 }], sizeMultiplier: 2 }
    expect(getCarryingCapacity(stats)).toBe(300)
  })
})
