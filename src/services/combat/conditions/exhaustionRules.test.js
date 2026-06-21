import { describe, it, expect } from 'vitest'
import {
  EXHAUSTION_LEVELS,
  getExhaustionSaveDC,
  isDeadFromExhaustion,
  getLevelAfterLongRest,
} from './exhaustionRules.js'

describe('exhaustionRules', () => {
  describe('EXHAUSTION_LEVELS', () => {
    it('equals 6', () => {
      expect(EXHAUSTION_LEVELS).toBe(6)
    })
  })

  describe('getExhaustionSaveDC', () => {
    it('returns 10 at level 0', () => {
      expect(getExhaustionSaveDC(0)).toBe(10)
    })

    it('returns 11 at level 1', () => {
      expect(getExhaustionSaveDC(1)).toBe(11)
    })

    it('returns 15 at level 5', () => {
      expect(getExhaustionSaveDC(5)).toBe(15)
    })

    it('returns 16 at level 6', () => {
      expect(getExhaustionSaveDC(6)).toBe(16)
    })

    it('returns 10 + level for any level', () => {
      for (let level = 0; level <= 6; level++) {
        expect(getExhaustionSaveDC(level)).toBe(10 + level)
      }
    })
  })

  describe('isDeadFromExhaustion', () => {
    it('returns false for levels below 6', () => {
      expect(isDeadFromExhaustion(0)).toBe(false)
      expect(isDeadFromExhaustion(1)).toBe(false)
      expect(isDeadFromExhaustion(2)).toBe(false)
      expect(isDeadFromExhaustion(3)).toBe(false)
      expect(isDeadFromExhaustion(4)).toBe(false)
      expect(isDeadFromExhaustion(5)).toBe(false)
    })

    it('returns true at level 6', () => {
      expect(isDeadFromExhaustion(6)).toBe(true)
    })

    it('returns true for levels above 6', () => {
      expect(isDeadFromExhaustion(7)).toBe(true)
      expect(isDeadFromExhaustion(10)).toBe(true)
    })
  })

  describe('getLevelAfterLongRest', () => {
    it('reduces exhaustion level by one when above zero', () => {
      expect(getLevelAfterLongRest(1)).toBe(0)
      expect(getLevelAfterLongRest(2)).toBe(1)
      expect(getLevelAfterLongRest(3)).toBe(2)
      expect(getLevelAfterLongRest(5)).toBe(4)
      expect(getLevelAfterLongRest(6)).toBe(5)
    })

    it('keeps level at zero when already at zero', () => {
      expect(getLevelAfterLongRest(0)).toBe(0)
    })

    it('returns null for null input', () => {
      expect(getLevelAfterLongRest(null)).toBeNull()
    })

    it('returns undefined for undefined input', () => {
      expect(getLevelAfterLongRest(undefined)).toBeUndefined()
    })

    it('returns the input unchanged when input is not a number', () => {
      expect(getLevelAfterLongRest('invalid')).toBe('invalid')
      expect(getLevelAfterLongRest('')).toBe('')
      expect(getLevelAfterLongRest(true)).toBe(true)
      expect(getLevelAfterLongRest(false)).toBe(false)
    })

    it('handles negative values by returning the same negative value', () => {
      expect(getLevelAfterLongRest(-1)).toBe(-1)
    })
  })
})
