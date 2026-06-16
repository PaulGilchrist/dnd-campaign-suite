import { describe, it, expect, vi } from 'vitest'
import { rollConcentrationSave, breakConcentration, computeConcentrationDc } from './concentrationRules.js'
import { rollD20 } from '../../dice/diceRoller.js'

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn()
}))

describe('rollConcentrationSave', () => {
  it('returns correct shape', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(5, 15)
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('roll')
    expect(result).toHaveProperty('total')
  })

  it('returns success when total >= dc', () => {
    rollD20.mockReturnValue(12)
    const result = rollConcentrationSave(4, 15)
    expect(result.success).toBe(true)
    expect(result.roll).toBe(12)
    expect(result.total).toBe(16)
  })

  it('returns failure when total < dc', () => {
    rollD20.mockReturnValue(8)
    const result = rollConcentrationSave(3, 15)
    expect(result.success).toBe(false)
    expect(result.roll).toBe(8)
    expect(result.total).toBe(11)
  })

  it('uses the provided saveBonus and dc', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(2, 10)
    expect(result.total).toBe(12)
    expect(result.success).toBe(true)
  })

  it('treats d20 rolls of 9 or lower as 10 when dragonConstellationActive is true', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15, true)
    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
    expect(result.success).toBe(false)
  })

  it('treats d20 roll of 9 as 10 when dragonConstellationActive is true', () => {
    rollD20.mockReturnValue(9)
    const result = rollConcentrationSave(3, 15, true)
    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
    expect(result.success).toBe(false)
  })

  it('does not modify d20 roll of 10 when dragonConstellationActive is true', () => {
    rollD20.mockReturnValue(10)
    const result = rollConcentrationSave(3, 15, true)
    expect(result.roll).toBe(10)
    expect(result.total).toBe(13)
  })

  it('does not modify d20 roll when dragonConstellationActive is false', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15, false)
    expect(result.roll).toBe(5)
    expect(result.total).toBe(8)
  })

  it('does not modify d20 roll when dragonConstellationActive is undefined', () => {
    rollD20.mockReturnValue(5)
    const result = rollConcentrationSave(3, 15)
    expect(result.roll).toBe(5)
    expect(result.total).toBe(8)
  })
})

describe('breakConcentration', () => {
  it('returns null when given a concentration object', () => {
    expect(breakConcentration({ spell: 'Haste' })).toBeNull()
  })

  it('returns null when given null', () => {
    expect(breakConcentration(null)).toBeNull()
  })
})

describe('computeConcentrationDc', () => {
  it('returns 10 for no damage', () => {
    expect(computeConcentrationDc(0)).toBe(10)
  })

  it('returns 10 for small damage below 20', () => {
    expect(computeConcentrationDc(5)).toBe(10)
    expect(computeConcentrationDc(18)).toBe(10)
  })

  it('returns half damage when half is >= 10', () => {
    expect(computeConcentrationDc(20)).toBe(10)
    expect(computeConcentrationDc(22)).toBe(11)
    expect(computeConcentrationDc(30)).toBe(15)
  })

  it('uses Math.floor for odd damage', () => {
    expect(computeConcentrationDc(21)).toBe(10)
    expect(computeConcentrationDc(23)).toBe(11)
    expect(computeConcentrationDc(25)).toBe(12)
  })
})
