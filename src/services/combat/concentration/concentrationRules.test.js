// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rollConcentrationSave, breakConcentration, computeConcentrationDc } from './concentrationRules.js'
import { rollD20 } from '../../dice/diceRoller.js'

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}))

describe('rollConcentrationSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an object with success, roll, and total', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(0, 10)

    expect(result).toEqual(expect.objectContaining({
      success: expect.any(Boolean),
      roll: expect.any(Number),
      total: expect.any(Number),
    }))
  })

  it('computes total correctly with positive, negative, and zero bonuses', () => {
    rollD20.mockReturnValue(10)
    expect(rollConcentrationSave(5, 15).total).toBe(15)

    rollD20.mockReturnValue(10)
    expect(rollConcentrationSave(-2, 15).total).toBe(8)

    rollD20.mockReturnValue(8)
    expect(rollConcentrationSave(0, 8).total).toBe(8)

    rollD20.mockReturnValue(3)
    expect(rollConcentrationSave(10, 12).total).toBe(13)
  })

  it('returns success when total meets or exceeds dc, failure otherwise', () => {
    rollD20.mockReturnValue(10)
    expect(rollConcentrationSave(5, 15).success).toBe(true)
    expect(rollConcentrationSave(3, 15).success).toBe(false)
  })

  it('clamps dragon constellation low rolls up to 10', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15, true)
    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
    expect(result.success).toBe(false)
  })

  it('does not modify rolls when dragon constellation is false or undefined', () => {
    rollD20.mockReturnValue(5)
    expect(rollConcentrationSave(3, 15, false).roll).toBe(5)
    expect(rollConcentrationSave(3, 15).roll).toBe(5)
  })

  it('does not modify rolls of 10 or higher when dragon constellation is active', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(3, 15, true)
    expect(result.roll).toBe(10)
  })
})

describe('breakConcentration', () => {
  it('always returns null', () => {
    expect(breakConcentration({ spell: 'Haste' })).toBeNull()
    expect(breakConcentration(null)).toBeNull()
    expect(breakConcentration(undefined)).toBeNull()
  })
})

describe('computeConcentrationDc', () => {
  it('returns 10 for damage up to and including 20', () => {
    expect(computeConcentrationDc(0)).toBe(10)
    expect(computeConcentrationDc(18)).toBe(10)
    expect(computeConcentrationDc(20)).toBe(10)
  })

  it('returns floor(damage / 2) for damage above 20', () => {
    expect(computeConcentrationDc(21)).toBe(10)
    expect(computeConcentrationDc(22)).toBe(11)
    expect(computeConcentrationDc(30)).toBe(15)
    expect(computeConcentrationDc(100)).toBe(50)
  })
})
