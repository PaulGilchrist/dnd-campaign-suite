// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest'
import { computeFeatRangeEffects } from './featRangeService.js'
import * as dataLoader from '../ui/dataLoader.js'

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadFeatData: vi.fn(),
}))

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

  const allFeats5e = [crossbowExpert5e, sharpshooter5e, spellSniper5e]

  const defaultResult = {
    ignoresMeleeDisadvantage: false,
    ignoresLongRangeDisadvantage: false,
    spellRangeBonus: 0,
    rangeMultiplier: 1,
    meleeReachBonus: 0,
    cantripRangeBonus: 0,
  }

  // --- Default behavior ---

  it('returns defaults when featNames is an empty array', async () => {
    const result = await computeFeatRangeEffects([], '5e')
    expect(result).toEqual(defaultResult)
  })

  it('returns defaults when featNames is null or undefined', async () => {
    const resultNull = await computeFeatRangeEffects(null, '5e')
    expect(resultNull).toEqual(defaultResult)
    const resultUndefined = await computeFeatRangeEffects(undefined, '5e')
    expect(resultUndefined).toEqual(defaultResult)
  })

  it('returns defaults when feat data returns an empty array', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([])
    const result = await computeFeatRangeEffects(['Some Feat'], '5e')
    expect(result).toEqual(defaultResult)
  })

  // --- Feat range effect detection ---

  it('detects Crossbow Expert melee disadvantage immunity', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('detects Sharpshooter long range disadvantage immunity', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats5e)
    const result = await computeFeatRangeEffects(['Sharpshooter'], '5e')
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
    expect(result.ignoresMeleeDisadvantage).toBe(false)
  })

  it('detects Spell Sniper melee disadvantage immunity for spells', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats5e)
    const result = await computeFeatRangeEffects(['Spell Sniper'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  it('combines effects from multiple feats', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert', 'Sharpshooter'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
  })

  it('ignores feat names that do not match any loaded feat', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats5e)
    const result = await computeFeatRangeEffects(['Nonexistent Feat'], '5e')
    expect(result).toEqual(defaultResult)
  })

  it('supports 2024 ruleset feats', async () => {
    const crossbowExpert2024 = {
      name: 'Crossbow Expert',
      index: 'crossbow-expert',
      rangeEffects: { ignoresMeleeDisadvantage: true, appliesToWeaponType: 'crossbow' },
    }
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([crossbowExpert2024])
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '2024')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  it('handles feats without rangeEffects gracefully', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([{ name: 'Tough', index: 'tough' }])
    const result = await computeFeatRangeEffects(['Tough'], '5e')
    expect(result).toEqual(defaultResult)
  })

  it('strips parenthetical suffixes when matching feat names', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert (Level 4)'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  // --- spellRangeBonus ---

  it('detects spellRangeBonus from a feat', async () => {
    const featWithRange = {
      name: 'Spell Sniper',
      index: 'spell-sniper',
      rangeEffects: { ignoresMeleeDisadvantage: true, spellRangeBonus: 30 },
    }
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([featWithRange])
    const result = await computeFeatRangeEffects(['Spell Sniper'], '5e')
    expect(result.spellRangeBonus).toBe(30)
  })

  it('takes the maximum spellRangeBonus across multiple feats', async () => {
    const featA = { name: 'Feat A', index: 'feat-a', rangeEffects: { spellRangeBonus: 20 } }
    const featB = { name: 'Feat B', index: 'feat-b', rangeEffects: { spellRangeBonus: 50 } }
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([featA, featB])
    const result = await computeFeatRangeEffects(['Feat A', 'Feat B'], '5e')
    expect(result.spellRangeBonus).toBe(50)
  })

  // --- Passive automation (meleeReachBonus, cantripRangeBonus) ---

  it('extracts meleeReachBonus from extra_reach passive', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [{ effect: 'extra_reach', bonusExpression: '5' }] },
    })
    expect(result.meleeReachBonus).toBe(5)
  })

  it('extracts cantripRangeBonus from cantrip_range_bonus passive', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [{ effect: 'cantrip_range_bonus', bonusExpression: '30' }] },
    })
    expect(result.cantripRangeBonus).toBe(30)
  })

  it('uses the highest meleeReachBonus when multiple extra_reach passives exist', async () => {
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

  it('uses the highest cantripRangeBonus when multiple cantrip_range_bonus passives exist', async () => {
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
      automation: { passives: [{ effect: 'some_other_effect', bonusExpression: '99' }] },
    })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('skips passives with non-numeric bonusExpression', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [{ effect: 'extra_reach', bonusExpression: 'not-a-number' }] },
    })
    expect(result.meleeReachBonus).toBe(0)
  })

  it('skips passives with missing bonusExpression', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [{ effect: 'extra_reach' }] },
    })
    expect(result.meleeReachBonus).toBe(0)
  })

  it('combines feat effects with passive automation bonuses', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([crossbowExpert5e])
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e', {
      automation: { passives: [{ effect: 'extra_reach', bonusExpression: '5' }] },
    })
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.meleeReachBonus).toBe(5)
  })

  // --- playerStats edge cases ---

  it('handles playerStats with no automation property', async () => {
    const result = await computeFeatRangeEffects([], '5e', { name: 'Test' })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('handles playerStats with automation but no passives', async () => {
    const result = await computeFeatRangeEffects([], '5e', { automation: {} })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('handles playerStats being null or undefined', async () => {
    const resultNull = await computeFeatRangeEffects([], '5e', null)
    expect(resultNull.meleeReachBonus).toBe(0)
    expect(resultNull.cantripRangeBonus).toBe(0)
    const resultUndefined = await computeFeatRangeEffects([], '5e')
    expect(resultUndefined.meleeReachBonus).toBe(0)
    expect(resultUndefined.cantripRangeBonus).toBe(0)
  })

  it('handles playerStats with empty passives array', async () => {
    const result = await computeFeatRangeEffects([], '5e', { automation: { passives: [] } })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })
})
