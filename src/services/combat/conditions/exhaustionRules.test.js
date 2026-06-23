// @improved-by-ai
import { describe, it, expect } from 'vitest'
import {
  EXHAUSTION_LEVELS,
  getExhaustionSaveDC,
  isDeadFromExhaustion,
  getLevelAfterLongRest,
} from './exhaustionRules.js'

describe('exhaustionRules', () => {
  describe('EXHAUSTION_LEVELS', () => {
    it('is 6', () => {
      expect(EXHAUSTION_LEVELS).toBe(6)
    })
  })

  describe('getExhaustionSaveDC', () => {
    it('returns 10 plus the exhaustion level', () => {
      expect(getExhaustionSaveDC(0)).toBe(10)
      expect(getExhaustionSaveDC(1)).toBe(11)
      expect(getExhaustionSaveDC(3)).toBe(13)
      expect(getExhaustionSaveDC(5)).toBe(15)
      expect(getExhaustionSaveDC(6)).toBe(16)
    })
  })

  describe('isDeadFromExhaustion', () => {
    it('returns false for exhaustion levels below 6', () => {
      expect(isDeadFromExhaustion(0)).toBe(false)
      expect(isDeadFromExhaustion(3)).toBe(false)
      expect(isDeadFromExhaustion(5)).toBe(false)
    })

    it('returns true at exhaustion level 6', () => {
      expect(isDeadFromExhaustion(6)).toBe(true)
    })

    it('returns true for exhaustion levels above 6', () => {
      expect(isDeadFromExhaustion(7)).toBe(true)
      expect(isDeadFromExhaustion(10)).toBe(true)
    })
  })

  describe('getLevelAfterLongRest', () => {
    it('reduces exhaustion level by one when above zero', () => {
      expect(getLevelAfterLongRest(1)).toBe(0)
      expect(getLevelAfterLongRest(2)).toBe(1)
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

    it('returns the input unchanged for non-number types', () => {
      expect(getLevelAfterLongRest('invalid')).toBe('invalid')
      expect(getLevelAfterLongRest(true)).toBe(true)
      expect(getLevelAfterLongRest(false)).toBe(false)
    })
  })
})
