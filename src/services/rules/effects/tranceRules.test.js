// @maintained-by-ai
import { describe, it, expect } from 'vitest'
import races5e from '../../../../public/data/races.json'
import races2024 from '../../../../public/data/2024/races.json'
import { hasTranceTrait } from './tranceRules.js'

// Standalone pure predicate: playerStats.race?.traits.some(t => t.name === 'Trance').
// NOT part of the applyLongRest pipeline — consumed by LongRestButton.jsx (elf UI)
// and sleepService.js:37 (trance => sleep immunity). No runtime-store keys, no timers.
// Consumer behavior is covered by sleepService.test.js / LongRestButton tests, which
// mock this module; this file pins the predicate's own truth table and disk contract.

describe('hasTranceTrait', () => {
  it('returns true for the Elf races straight off disk (5e and 2024 canon)', () => {
    // Disk anchor: both races.json ship an Elf whose trait list carries 'Trance'
    // verbatim among other traits — the exact-name contract both consumers rely on.
    for (const races of [races5e, races2024]) {
      const elf = races.find(r => r.name === 'Elf')
      expect(elf.traits.map(t => t.name)).toContain('Trance')
      expect(hasTranceTrait({ race: elf })).toBe(true)
    }
  })

  it('matches only the exact trait name "Trance" — near-miss bait names are false', () => {
    const stats = {
      race: {
        traits: [
          { name: 'Darkvision' },
          { name: 'Fey Ancestry' },
          { name: 'trance' },
          { name: 'Elven Trance' },
          { name: 'Trance of Order' },
        ],
      },
    }
    expect(hasTranceTrait(stats)).toBe(false)
  })

  it('returns false for every missing structure that the race?.traits guard covers', () => {
    const shapes = [
      {},
      { race: undefined },
      { race: null },
      { race: {} },
      { race: { traits: undefined } },
      { race: { traits: [] } },
    ]
    for (const stats of shapes) {
      expect(hasTranceTrait(stats)).toBe(false)
    }
  })

  it('throws TypeError when playerStats itself is nullish (guard is on .race, not on stats)', () => {
    // Callers guarantee a non-null object first: sleepService guards `if (!stats)` at :36.
    expect(() => hasTranceTrait(null)).toThrow(TypeError)
    expect(() => hasTranceTrait(undefined)).toThrow(TypeError)
  })
})
