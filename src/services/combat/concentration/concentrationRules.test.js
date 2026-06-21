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

  it('returns an object with success (boolean), roll (number), and total (number)', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(0, 10)

    expect(result).toEqual(expect.objectContaining({
      success: expect.any(Boolean),
      roll: expect.any(Number),
      total: expect.any(Number),
    }))
  })

  it('returns success when total equals dc', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(5, 15)

    expect(result.success).toBe(true)
    expect(result.roll).toBe(10)
    expect(result.total).toBe(15)
  })

  it('returns success when total exceeds dc', () => {
    rollD20.mockReturnValue(12)
    const result = rollConcentrationSave(4, 15)

    expect(result.success).toBe(true)
    expect(result.total).toBe(16)
  })

  it('returns failure when total is below dc', () => {
    rollD20.mockReturnValue(8)
    const result = rollConcentrationSave(3, 15)

    expect(result.success).toBe(false)
    expect(result.total).toBe(11)
  })

  it('applies negative save bonuses', () => {
    rollD20.mockReturnValue(18)
    const result = rollConcentrationSave(-2, 15)

    expect(result.success).toBe(true)
    expect(result.total).toBe(16)
  })

  it('applies zero save bonus', () => {
    rollD20.mockReturnValue(7)
    const result = rollConcentrationSave(0, 8)

    expect(result.success).toBe(false)
    expect(result.total).toBe(7)
  })

  it('applies large save bonuses', () => {
    rollD20.mockReturnValue(3)
    const result = rollConcentrationSave(10, 12)

    expect(result.success).toBe(true)
    expect(result.total).toBe(13)
  })

  it('clamps dragon constellation low rolls up to 10', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15, true)

    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
    expect(result.success).toBe(false)
  })

  it('clamps dragon constellation boundary roll of 9 up to 10', () => {
    rollD20.mockReturnValue(9)
    const result = rollConcentrationSave(3, 15, true)

    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
  })

  it('does not modify rolls of 10 or higher when dragon constellation is active', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(3, 15, true)

    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
  })

  it('does not modify rolls when dragon constellation is false', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15, false)

    expect(result.roll).toBe(5)
    expect(result.total).toBe(8)
  })

  it('does not modify rolls when dragon constellation is undefined', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15)

    expect(result.roll).toBe(5)
    expect(result.total).toBe(8)
  })
})

describe('breakConcentration', () => {
  it('always returns null regardless of input', () => {
    expect(breakConcentration({ spell: 'Haste' })).toBeNull()
    expect(breakConcentration(null)).toBeNull()
    expect(breakConcentration(undefined)).toBeNull()
    expect(breakConcentration('')).toBeNull()
    expect(breakConcentration(0)).toBeNull()
    expect(breakConcentration([])).toBeNull()
    expect(breakConcentration({})).toBeNull()
  })
})

describe('computeConcentrationDc', () => {
  it('returns 10 for zero damage', () => {
    expect(computeConcentrationDc(0)).toBe(10)
  })

  it('returns 10 for damage below 20', () => {
    expect(computeConcentrationDc(1)).toBe(10)
    expect(computeConcentrationDc(18)).toBe(10)
  })

  it('returns 10 for damage of exactly 20', () => {
    expect(computeConcentrationDc(20)).toBe(10)
  })

  it('returns floor(damage / 2) for damage above 20', () => {
    expect(computeConcentrationDc(22)).toBe(11)
    expect(computeConcentrationDc(30)).toBe(15)
    expect(computeConcentrationDc(100)).toBe(50)
  })

  it('uses Math.floor for odd damage values above 20', () => {
    expect(computeConcentrationDc(21)).toBe(10)
    expect(computeConcentrationDc(23)).toBe(11)
    expect(computeConcentrationDc(25)).toBe(12)
    expect(computeConcentrationDc(99)).toBe(49)
  })
})
