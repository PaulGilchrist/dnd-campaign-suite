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
      meleeReachBonus: 0,
      cantripRangeBonus: 0,
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

  it('extracts meleeReachBonus from passive automation', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {
        passives: [
          { effect: 'extra_reach', bonusExpression: '5' },
        ],
      },
    })

    expect(result.meleeReachBonus).toBe(5)
  })

  it('extracts cantripRangeBonus from passive automation', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {
        passives: [
          { effect: 'cantrip_range_bonus', bonusExpression: '30' },
        ],
      },
    })

    expect(result.cantripRangeBonus).toBe(30)
  })

  it('uses the highest meleeReachBonus when multiple passives exist', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {
        passives: [
          { effect: 'extra_reach', bonusExpression: '5' },
          { effect: 'extra_reach', bonusExpression: '10' },
        ],
      },
    })

    expect(result.meleeReachBonus).toBe(10)
  })

  it('uses the highest cantripRangeBonus when multiple passives exist', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {
        passives: [
          { effect: 'cantrip_range_bonus', bonusExpression: '20' },
          { effect: 'cantrip_range_bonus', bonusExpression: '40' },
        ],
      },
    })

    expect(result.cantripRangeBonus).toBe(40)
  })

  it('ignores non-matching passive effects', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {
        passives: [
          { effect: 'some_other_effect', bonusExpression: '99' },
        ],
      },
    })

    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('ignores NaN bonusExpression values', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {
        passives: [
          { effect: 'extra_reach', bonusExpression: 'not-a-number' },
        ],
      },
    })

    expect(result.meleeReachBonus).toBe(0)
  })

  it('returns defaults when allFeats is empty array', async () => {
    // Mock fetch to return empty array
    const headers = new Map()
    headers.set('content-type', 'application/json')
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers,
      json: async () => [],
    })

    const result = await computeFeatRangeEffects(['Some Feat'], '5e')

    expect(result.ignoresMeleeDisadvantage).toBe(false)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('detects spellRangeBonus from a feat', async () => {
    const spellSniperWithRange = {
      name: 'Spell Sniper',
      index: 'spell-sniper',
      rangeEffects: { ignoresMeleeDisadvantage: true, spellRangeBonus: 30 },
    }
    mockFetch([spellSniperWithRange])

    const result = await computeFeatRangeEffects(['Spell Sniper'], '5e')

    expect(result.spellRangeBonus).toBe(30)
  })

  it('takes max spellRangeBonus when multiple feats have it', async () => {
    const feat1 = {
      name: 'Feat A',
      index: 'feat-a',
      rangeEffects: { spellRangeBonus: 20 },
    }
    const feat2 = {
      name: 'Feat B',
      index: 'feat-b',
      rangeEffects: { spellRangeBonus: 50 },
    }
    mockFetch([feat1, feat2])

    const result = await computeFeatRangeEffects(['Feat A', 'Feat B'], '5e')

    expect(result.spellRangeBonus).toBe(50)
  })

  it('combines passive automation bonuses with feat effects', async () => {
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e', {
      automation: {
        passives: [
          { effect: 'extra_reach', bonusExpression: '5' },
        ],
      },
    })

    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.meleeReachBonus).toBe(5)
  })

  it('handles playerStats with no automation property', async () => {
    const result = await computeFeatRangeEffects([], '5e', { name: 'Test' })

    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('handles playerStats with automation but no passives', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: {},
    })

    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('handles playerStats as null', async () => {
    const result = await computeFeatRangeEffects([], '5e', null)

    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('handles playerStats as undefined', async () => {
    const result = await computeFeatRangeEffects([], '5e', undefined)

    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('returns all default fields when no effects apply', async () => {
    const result = await computeFeatRangeEffects([], '5e')

    expect(result).toEqual({
      ignoresMeleeDisadvantage: false,
      ignoresLongRangeDisadvantage: false,
      spellRangeBonus: 0,
      rangeMultiplier: 1,
      meleeReachBonus: 0,
      cantripRangeBonus: 0,
    })
  })
})
