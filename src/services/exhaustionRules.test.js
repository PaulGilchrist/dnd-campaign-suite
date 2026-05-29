import { describe, it, expect } from 'vitest'
import { getLevelAfterLongRest } from './exhaustionRules.js'

describe('getLevelAfterLongRest', () => {
  it('reduces exhaustion level by one when above zero', () => {
    expect(getLevelAfterLongRest(3)).toBe(2)
    expect(getLevelAfterLongRest(1)).toBe(0)
   })

  it('keeps at zero when already at zero', () => {
    expect(getLevelAfterLongRest(0)).toBe(0)
   })

  it('returns current level when null', () => {
    expect(getLevelAfterLongRest(null)).toBeNull()
   })

  it('returns current level when not a number', () => {
    expect(getLevelAfterLongRest(undefined)).toBeUndefined()
   })
})
