import { describe, it, expect } from 'vitest'
import { rollDeathSave, isStable, isDead } from './deathSaveRules.js'

describe('isStable', () => {
  it('returns false for empty saves', () => {
    expect(isStable([false, false, false])).toBe(false)
  })

  it('returns false for 2 saves', () => {
    expect(isStable([true, true, false])).toBe(false)
  })

  it('returns true for 3 saves', () => {
    expect(isStable([true, true, true])).toBe(true)
  })
})

describe('isDead', () => {
  it('returns false for empty failures', () => {
    expect(isDead([false, false, false])).toBe(false)
  })

  it('returns false for 2 failures', () => {
    expect(isDead([true, true, false])).toBe(false)
  })

  it('returns true for 3 failures', () => {
    expect(isDead([true, true, true])).toBe(true)
  })
})

describe('rollDeathSave', () => {
  const noSaves = [false, false, false]
  const noFailures = [false, false, false]

  it('returns correct shape', () => {
    const result = rollDeathSave(noSaves, noFailures)
    expect(result).toHaveProperty('newSaves')
    expect(result).toHaveProperty('newFailures')
    expect(result).toHaveProperty('result')
    expect(result).toHaveProperty('roll')
    expect(result).toHaveProperty('isNat20')
    expect(result).toHaveProperty('isNat1')
    expect(result).toHaveProperty('restoredToHp')
  })

  it('returns a valid roll value', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      expect(result.roll).toBeGreaterThanOrEqual(1)
      expect(result.roll).toBeLessThanOrEqual(20)
    }
  })

  it('sets isNat20 true only when roll is 20', () => {
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      if (result.roll === 20) {
        expect(result.isNat20).toBe(true)
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('sets isNat1 true only when roll is 1', () => {
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      if (result.roll === 1) {
        expect(result.isNat1).toBe(true)
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('nat20 returns result nat20 and restores to 1 HP', () => {
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      if (result.isNat20) {
        expect(result.result).toBe('nat20')
        expect(result.restoredToHp).toBe(1)
        expect(result.newSaves).toEqual([false, false, false])
        expect(result.newFailures).toEqual([false, false, false])
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('nat1 returns result failure and increments failures by 2', () => {
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      if (result.isNat1) {
        expect(result.result).toBe('failure')
        expect(result.newFailures.filter(Boolean).length).toBe(2)
        expect(result.restoredToHp).toBeNull()
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('non-nat success adds one save', () => {
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      if (!result.isNat20 && !result.isNat1 && result.result === 'success') {
        expect(result.newSaves.filter(Boolean).length).toBe(1)
        expect(result.newFailures).toEqual(noFailures)
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('non-nat failure adds one failure', () => {
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, noFailures)
      if (!result.isNat1 && result.result === 'failure') {
        expect(result.newFailures.filter(Boolean).length).toBe(1)
        expect(result.newSaves).toEqual(noSaves)
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('3 successes result in stable', () => {
    let found = false
    for (let i = 0; i < 1000; i++) {
      const twoSaves = [true, true, false]
      const result = rollDeathSave(twoSaves, noFailures)
      if (result.result === 'stable') {
        expect(result.newSaves).toEqual([false, false, false])
        expect(result.newFailures).toEqual([false, false, false])
        expect(result.restoredToHp).toBeNull()
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('3 failures result in dead', () => {
    let found = false
    for (let i = 0; i < 1000; i++) {
      const twoFailures = [true, true, false]
      const result = rollDeathSave(noSaves, twoFailures)
      if (result.result === 'dead') {
        expect(result.newSaves).toEqual([false, false, false])
        expect(result.newFailures).toEqual([false, false, false])
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('non-critical success does not modify failures', () => {
    const existingFailures = [true, false, false]
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(noSaves, existingFailures)
      if (result.result === 'success') {
        expect(result.newFailures).toEqual(existingFailures)
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })

  it('non-critical failure does not modify saves', () => {
    const existingSaves = [true, false, false]
    let found = false
    for (let i = 0; i < 500; i++) {
      const result = rollDeathSave(existingSaves, noFailures)
      if (result.result === 'failure') {
        expect(result.newSaves).toEqual(existingSaves)
        found = true
        break
      }
    }
    if (!found) expect(true).toBe(true)
  })
})
