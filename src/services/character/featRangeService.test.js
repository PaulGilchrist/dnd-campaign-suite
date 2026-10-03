// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest'
import { computeFeatRangeEffects, matchesExtraReachCondition, resolveMeleeReachBonus } from './featRangeService.js'
import { computeRangeEffect } from '../rules/combat/rangeValidation.js'
import * as dataLoader from '../ui/dataLoader.js'

vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(),
}))

describe('computeFeatRangeEffects', () => {
  const defaultResult = {
    ignoresMeleeDisadvantage: false,
    ignoresLongRangeDisadvantage: false,
    spellRangeBonus: 0,
    rangeMultiplier: 1,
    meleeReachBonus: 0,
    meleeReachGrants: [],
    cantripRangeBonus: 0,
  }

  const crossbowExpert = {
    name: 'Crossbow Expert',
    index: 'crossbow-expert',
    rangeEffects: { ignoresMeleeDisadvantage: true, appliesToWeaponType: 'crossbow' },
  }

  const sharpshooter = {
    name: 'Sharpshooter',
    index: 'sharpshooter',
    rangeEffects: { ignoresLongRangeDisadvantage: true },
  }

  const spellSniper = {
    name: 'Spell Sniper',
    index: 'spell-sniper',
    rangeEffects: { ignoresMeleeDisadvantage: true, appliesToAttackType: 'spell' },
  }

  const allFeats = [crossbowExpert, sharpshooter, spellSniper]

  afterEach(() => {
    vi.resetAllMocks()
  })

  // --- Input validation ---

  it('returns defaults when featNames is null, undefined, or empty', async () => {
    for (const invalid of [null, undefined, []]) {
      const result = await computeFeatRangeEffects(invalid, '5e')
      expect(result).toEqual(defaultResult)
    }
  })

  // --- Feat range effect detection ---

  it('detects Crossbow Expert melee disadvantage immunity', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats)
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('detects Sharpshooter long range disadvantage immunity', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats)
    const result = await computeFeatRangeEffects(['Sharpshooter'], '5e')
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
    expect(result.ignoresMeleeDisadvantage).toBe(false)
  })

  it('detects Spell Sniper melee disadvantage immunity for spells', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats)
    const result = await computeFeatRangeEffects(['Spell Sniper'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  it('combines effects from multiple feats', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats)
    const result = await computeFeatRangeEffects(['Crossbow Expert', 'Sharpshooter'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
  })

  it('ignores unknown feat names mixed with valid ones', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats)
    const result = await computeFeatRangeEffects(['Crossbow Expert', 'Fake Feat'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
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

  it('handles feats without or with null/undefined rangeEffects gracefully', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      { name: 'No Effects', index: 'no-effects' },
      { name: 'Null Effects', index: 'null-effects', rangeEffects: null },
      { name: 'Undefined Effects', index: 'undefined-effects', rangeEffects: undefined },
    ])
    const result = await computeFeatRangeEffects(['No Effects', 'Null Effects', 'Undefined Effects'], '5e')
    expect(result).toEqual(defaultResult)
  })

  it('strips parenthetical suffixes when matching feat names', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(allFeats)
    const result = await computeFeatRangeEffects(['Crossbow Expert (Level 4)'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
  })

  it('treats false and undefined boolean effects as not applied', async () => {
    const featFalse = { name: 'False Feat', index: 'false-feat', rangeEffects: { ignoresMeleeDisadvantage: false } }
    const featUndefined = { name: 'Undefined Feat', index: 'undefined-feat', rangeEffects: { ignoresMeleeDisadvantage: undefined } }
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([featFalse, featUndefined])
    const result = await computeFeatRangeEffects(['False Feat', 'Undefined Feat'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(false)
  })

  // --- spellRangeBonus ---

  it('applies the maximum spellRangeBonus across multiple feats', async () => {
    const featA = { name: 'Feat A', index: 'feat-a', rangeEffects: { spellRangeBonus: 20 } }
    const featB = { name: 'Feat B', index: 'feat-b', rangeEffects: { spellRangeBonus: 50 } }
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([featA, featB])
    const result = await computeFeatRangeEffects(['Feat A', 'Feat B'], '5e')
    expect(result.spellRangeBonus).toBe(50)
  })

  it('ignores spellRangeBonus values that are falsy (0, negative, null, undefined)', async () => {
    const feat = { name: 'Feat', index: 'feat', rangeEffects: { spellRangeBonus: 0 } }
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([feat])
    const result = await computeFeatRangeEffects(['Feat'], '5e')
    expect(result.spellRangeBonus).toBe(0)
  })

  // --- Passive automation ---

  it('extracts meleeReachBonus and cantripRangeBonus from passives', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [
        { effect: 'extra_reach', bonusExpression: '5' },
        { effect: 'cantrip_range_bonus', bonusExpression: '30' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(5)
    expect(result.cantripRangeBonus).toBe(30)
  })

  it('uses the highest bonus when multiple passives of the same type exist', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [
        { effect: 'extra_reach', bonusExpression: '5' },
        { effect: 'extra_reach', bonusExpression: '10' },
        { effect: 'cantrip_range_bonus', bonusExpression: '20' },
        { effect: 'cantrip_range_bonus', bonusExpression: '40' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(10)
    expect(result.cantripRangeBonus).toBe(40)
  })

  it('ignores non-matching, non-numeric, missing, negative, or zero bonusExpressions', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [
        { effect: 'some_other_effect', bonusExpression: '99' },
        { effect: 'extra_reach', bonusExpression: 'not-a-number' },
        { effect: 'extra_reach' },
        { effect: 'extra_reach', bonusExpression: '0' },
        { effect: 'extra_reach', bonusExpression: '-3' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('combines feat effects with passive automation bonuses', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([crossbowExpert])
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e', {
      automation: { passives: [{ effect: 'extra_reach', bonusExpression: '5' }] },
    })
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.meleeReachBonus).toBe(5)
  })

  // --- CLA-029: condition-gated extra reach (Battering Roots) ---

  it('routes conditional extra_reach into meleeReachGrants, not the ungated bonus', async () => {
    const result = await computeFeatRangeEffects([], '2024', {
      automation: { passives: [
        { name: 'Battering Roots', effect: 'extra_reach', bonusExpression: '10', condition: 'heavy_or_versatile_melee_weapon' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.meleeReachGrants).toEqual([{ bonus: 10, condition: 'heavy_or_versatile_melee_weapon', source: 'Battering Roots' }])
  })

  it('keeps unconditional extra_reach in meleeReachBonus alongside conditional grants', async () => {
    const result = await computeFeatRangeEffects([], '2024', {
      automation: { passives: [
        { effect: 'extra_reach', bonusExpression: '5' },
        { name: 'Battering Roots', effect: 'extra_reach', bonusExpression: '10', condition: 'heavy_or_versatile_melee_weapon' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(5)
    expect(result.meleeReachGrants.length).toBe(1)
  })

  describe('matchesExtraReachCondition', () => {
    it('matches Heavy or Versatile melee weapons', () => {
      expect(matchesExtraReachCondition('heavy_or_versatile_melee_weapon', { properties: ['Versatile'] })).toBe(true)
      expect(matchesExtraReachCondition('heavy_or_versatile_melee_weapon', { properties: ['Heavy', 'Two-Handed'] })).toBe(true)
    })
    it('rejects weapons without Heavy or Versatile', () => {
      expect(matchesExtraReachCondition('heavy_or_versatile_melee_weapon', { properties: ['Finesse', 'Light', 'Monk'] })).toBe(false)
      expect(matchesExtraReachCondition('heavy_or_versatile_melee_weapon', { properties: [] })).toBe(false)
    })
    it('is case-insensitive on tokens and properties', () => {
      expect(matchesExtraReachCondition('HEAVY_OR_VERSATILE_MELEE_WEAPON', { properties: ['versatile'] })).toBe(true)
    })
    it('treats unknown condition tokens as no-match (fail closed)', () => {
      expect(matchesExtraReachCondition('unknown_condition', { properties: ['Heavy'] })).toBe(false)
    })
    it('matches when condition is absent', () => {
      expect(matchesExtraReachCondition(undefined, { properties: [] })).toBe(true)
    })
  })

  describe('resolveMeleeReachBonus', () => {
    const feats = {
      meleeReachBonus: 0,
      meleeReachGrants: [{ bonus: 10, condition: 'heavy_or_versatile_melee_weapon', source: 'Battering Roots' }],
    }
    it('applies the grant for a Versatile weapon', () => {
      expect(resolveMeleeReachBonus(feats, { properties: ['Versatile'] }).meleeReachBonus).toBe(10)
    })
    it('withholds the grant for a Light/Finesse weapon', () => {
      expect(resolveMeleeReachBonus(feats, { properties: ['Finesse', 'Light'] }).meleeReachBonus).toBe(0)
    })
    it('returns feats untouched when there are no grants', () => {
      const plain = { meleeReachBonus: 5, meleeReachGrants: [] }
      expect(resolveMeleeReachBonus(plain, { properties: [] })).toBe(plain)
    })
    it('tolerates a feats object without a meleeReachGrants key', () => {
      const legacy = { meleeReachBonus: 3 }
      expect(resolveMeleeReachBonus(legacy, { properties: ['Heavy'] })).toBe(legacy)
    })
    it('takes the max of the base bonus and a matching grant', () => {
      const mixed = {
        meleeReachBonus: 5,
        meleeReachGrants: [{ bonus: 10, condition: 'heavy_or_versatile_melee_weapon', source: 'Battering Roots' }],
      }
      expect(resolveMeleeReachBonus(mixed, { properties: ['Heavy'] }).meleeReachBonus).toBe(10)
    })
    it('Battering Roots caps a Versatile Longsword at 18 ft but leaves a Shortsword at 8 ft', () => {
      const longsword = resolveMeleeReachBonus(feats, { properties: ['Versatile'] })
      const shortsword = resolveMeleeReachBonus(feats, { properties: ['Finesse', 'Light', 'Monk'] })
      expect(computeRangeEffect(5, 15, longsword).mode).toBe('normal')
      expect(computeRangeEffect(5, 18, longsword).mode).toBe('normal')
      expect(computeRangeEffect(5, 19, longsword).mode).toBe('miss')
      expect(computeRangeEffect(5, 8, shortsword).mode).toBe('normal')
      expect(computeRangeEffect(5, 9, shortsword).mode).toBe('miss')
    })
  })

  // --- playerStats edge cases ---

  it('handles null, undefined, or partial playerStats gracefully', async () => {
    const results = [
      await computeFeatRangeEffects([], '5e', null),
      await computeFeatRangeEffects([], '5e', undefined),
      await computeFeatRangeEffects([], '5e', { name: 'Test' }),
      await computeFeatRangeEffects([], '5e', { automation: {} }),
      await computeFeatRangeEffects([], '5e', { automation: { passives: [] } }),
    ]
    for (const result of results) {
      expect(result.meleeReachBonus).toBe(0)
      expect(result.cantripRangeBonus).toBe(0)
    }
  })
})
