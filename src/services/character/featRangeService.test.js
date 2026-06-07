import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeFeatRangeEffects } from './featRangeService.js'

beforeEach(() => {
  vi.clearAllMocks()
})

function mockFetch(data) {
  const headers = new Map()
  headers.set('content-type', 'application/json')
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers,
    json: async () => data,
  })
}

describe('computeFeatRangeEffects', () => {
  const crossbowExpert5e = {
    name: 'Crossbow Expert',
    index: 'crossbow-expert',
    rangeEffects: { ignoresMeleeDisadvantage: true, appliesToWeaponType: 'crossbow' },
  }

  const sharpshooter5e = {
    name: 'Sharpshooter',
    index: 'sharpshooter',
    rangeEffects: { ignoresLongRangeDisadvantage: true },
  }

  const spellSniper5e = {
    name: 'Spell Sniper',
    index: 'spell-sniper',
    rangeEffects: { ignoresMeleeDisadvantage: true, appliesToAttackType: 'spell' },
  }

  const feats5e = [crossbowExpert5e, sharpshooter5e, spellSniper5e]

  it('returns defaults for empty feat list', async () => {
    const result = await computeFeatRangeEffects([], '5e')
    expect(result).toEqual({
      ignoresMeleeDisadvantage: false,
      ignoresLongRangeDisadvantage: false,
      spellRangeBonus: 0,
      rangeMultiplier: 1,
    })
  })

  it('returns defaults for null feat list', async () => {
    const result = await computeFeatRangeEffects(null, '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(false)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('detects Crossbow Expert melee disadvantage immunity', async () => {
    mockFetch(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('detects Sharpshooter long range disadvantage immunity', async () => {
    mockFetch(feats5e)
    const result = await computeFeatRangeEffects(['Sharpshooter'], '5e')
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
    expect(result.ignoresMeleeDisadvantage).toBe(false)
  })

  it('detects Spell Sniper melee disadvantage immunity for spells', async () => {
    mockFetch(feats5e)
    const result = await computeFeatRangeEffects(['Spell Sniper'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  it('combines effects from multiple feats', async () => {
    mockFetch(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert', 'Sharpshooter'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
  })

  it('ignores feats not found in data', async () => {
    mockFetch(feats5e)
    const result = await computeFeatRangeEffects(['Nonexistent Feat'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(false)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('works with 2024 feats', async () => {
    const crossbowExpert2024 = {
      name: 'Crossbow Expert',
      index: 'crossbow-expert',
      rangeEffects: { ignoresMeleeDisadvantage: true, appliesToWeaponType: 'crossbow' },
    }
    mockFetch([crossbowExpert2024])
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '2024')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  it('handles feats without rangeEffects gracefully', async () => {
    mockFetch([{ name: 'Tough', index: 'tough' }])
    const result = await computeFeatRangeEffects(['Tough'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(false)
  })

  it('uses strip-parentheses matching for feat names', async () => {
    mockFetch(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert (Level 4)'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })
})
