import { describe, it, expect } from 'vitest'
import { FIGHTING_STYLES, getFightingStyle } from './fightingStyles.js'

describe('FIGHTING_STYLES', () => {
  it('exports Great Weapon Fighting style', () => {
    const style = FIGHTING_STYLES['Great Weapon Fighting']
    expect(style.name).toBe('Great Weapon Fighting')
    expect(style.description).toContain('reroll')
  })

  it('exports Protection style', () => {
    const style = FIGHTING_STYLES['Protection']
    expect(style.name).toBe('Protection')
    expect(style.description).toContain('disadvantage')
  })
})

describe('getFightingStyle', () => {
  it('returns the style for a known name', () => {
    expect(getFightingStyle('Great Weapon Fighting')).toBeDefined()
    expect(getFightingStyle('Protection')).toBeDefined()
  })

  it('returns null for an unknown name', () => {
    expect(getFightingStyle('Dueling')).toBeNull()
    expect(getFightingStyle('')).toBeNull()
    expect(getFightingStyle(null)).toBeNull()
    expect(getFightingStyle(undefined)).toBeNull()
  })
})
