import { describe, it, expect } from 'vitest'
import { hasTranceTrait } from './tranceRules.js'

describe('hasTranceTrait', () => {
  it('returns true when race has a Trance trait', () => {
    const stats = {
      race: {
        traits: [{ name: 'Trance' }],
      },
    }
    expect(hasTranceTrait(stats)).toBe(true)
  })

  it('returns false when race has no traits', () => {
    const stats = { race: { traits: [] } }
    expect(hasTranceTrait(stats)).toBe(false)
  })

  it('returns false when race has traits but none named Trance', () => {
    const stats = {
      race: {
        traits: [{ name: 'Darkvision' }, { name: 'Fey Ancestry' }],
      },
    }
    expect(hasTranceTrait(stats)).toBe(false)
  })

  it('returns false when race is null', () => {
    const stats = { race: null }
    expect(hasTranceTrait(stats)).toBe(false)
  })

  it('returns false when race is undefined', () => {
    const stats = { race: undefined }
    expect(hasTranceTrait(stats)).toBe(false)
  })

  it('throws when playerStats is null', () => {
    expect(() => hasTranceTrait(null)).toThrow(TypeError)
  })

  it('throws when playerStats is undefined', () => {
    expect(() => hasTranceTrait(undefined)).toThrow(TypeError)
  })

  it('returns false when playerStats has no race property', () => {
    const stats = {}
    expect(hasTranceTrait(stats)).toBe(false)
  })

  it('returns true when Trance trait appears among other traits', () => {
    const stats = {
      race: {
        traits: [
          { name: 'Darkvision' },
          { name: 'Fey Ancestry' },
          { name: 'Trance' },
          { name: 'Sleepless' },
        ],
      },
    }
    expect(hasTranceTrait(stats)).toBe(true)
  })

  it('returns false when race.traits is undefined', () => {
    const stats = { race: {} }
    expect(hasTranceTrait(stats)).toBe(false)
  })
})
