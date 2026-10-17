// @maintained-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { computeFeatRangeEffects, matchesExtraReachCondition, resolveMeleeReachBonus } from './featRangeService.js'
import { computeRangeEffect } from '../rules/combat/rangeValidation.js'
import * as dataLoader from '../ui/dataLoader.js'

vi.mock('../ui/dataLoader.js', () => ({
  loadFeatData: vi.fn(),
}))

// Disk anchors: fixtures flow the real bestiary rows through the service
// instead of hand-typed copies (verified against disk 2026-10-16).
const feats5e = JSON.parse(readFileSync('public/data/feats.json', 'utf8'))
const feats2024 = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'))
const classes2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'))

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

  afterEach(() => {
    vi.resetAllMocks()
  })

  // --- Input validation ---

  it('returns defaults when featNames is null, undefined, or empty', async () => {
    for (const invalid of [null, undefined, []]) {
      const result = await computeFeatRangeEffects(invalid, '5e')
      expect(result).toEqual(defaultResult)
    }
    // short-circuits before touching the data loader
    expect(dataLoader.loadFeatData).not.toHaveBeenCalled()
  })

  // --- Feat range effect detection (disk feats.json rows) ---

  it('detects Crossbow Expert melee disadvantage immunity', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
    expect(dataLoader.loadFeatData).toHaveBeenCalledWith('5e')
  })

  it('detects Sharpshooter long range disadvantage immunity', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result = await computeFeatRangeEffects(['Sharpshooter'], '5e')
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
    expect(result.ignoresMeleeDisadvantage).toBe(false)
    // rangeMultiplier is a fixed passthrough — no feat on disk mutates it
    expect(result.rangeMultiplier).toBe(1)
  })

  it('detects Spell Sniper melee disadvantage immunity for spells', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result = await computeFeatRangeEffects(['Spell Sniper'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('combines effects from multiple feats', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert', 'Sharpshooter'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(true)
  })

  it('ignores unknown feat names mixed with valid ones', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert', 'Fake Feat'], '5e')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.ignoresLongRangeDisadvantage).toBe(false)
  })

  it('Sharpshooter discriminates rulesets: 5e long-range only, 2024 also melee', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result5e = await computeFeatRangeEffects(['Sharpshooter'], '5e')
    expect(result5e.ignoresLongRangeDisadvantage).toBe(true)
    expect(result5e.ignoresMeleeDisadvantage).toBe(false)
    expect(dataLoader.loadFeatData).toHaveBeenLastCalledWith('5e')

    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats2024)
    const result2024 = await computeFeatRangeEffects(['Sharpshooter'], '2024')
    expect(result2024.ignoresLongRangeDisadvantage).toBe(true)
    expect(result2024.ignoresMeleeDisadvantage).toBe(true) // 2024 disk row adds melee immunity
    expect(dataLoader.loadFeatData).toHaveBeenLastCalledWith('2024')
  })

  it('2024 Spell Sniper contributes spellRangeBonus 60 from the disk row', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats2024)
    const result = await computeFeatRangeEffects(['Spell Sniper'], '2024')
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.spellRangeBonus).toBe(60)
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
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
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
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
      { name: 'Zero Feat', index: 'zero-feat', rangeEffects: { spellRangeBonus: 0 } },
      { name: 'Negative Feat', index: 'negative-feat', rangeEffects: { spellRangeBonus: -50 } },
      { name: 'Null Feat', index: 'null-feat', rangeEffects: { spellRangeBonus: null } },
      { name: 'Missing Feat', index: 'missing-feat', rangeEffects: {} },
    ])
    const result = await computeFeatRangeEffects(
      ['Zero Feat', 'Negative Feat', 'Null Feat', 'Missing Feat'], '5e')
    expect(result.spellRangeBonus).toBe(0)
  })

  // --- Passive automation ---

  it('extracts meleeReachBonus and cantripRangeBonus from passives', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [
        { type: 'passive_buff', effect: 'extra_reach', bonusExpression: '5' },
        { type: 'cantrip_range_bonus', effect: 'cantrip_range_bonus', bonusExpression: '30' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(5)
    expect(result.cantripRangeBonus).toBe(30)
  })

  it('uses the highest bonus when multiple passives of the same type exist', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [
        { type: 'passive_buff', effect: 'extra_reach', bonusExpression: '5' },
        { type: 'passive_buff', effect: 'extra_reach', bonusExpression: '10' },
        { type: 'cantrip_range_bonus', effect: 'cantrip_range_bonus', bonusExpression: '20' },
        { type: 'cantrip_range_bonus', effect: 'cantrip_range_bonus', bonusExpression: '40' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(10)
    expect(result.cantripRangeBonus).toBe(40)
  })

  it('ignores non-matching, non-numeric, missing, negative, or zero bonusExpressions', async () => {
    const result = await computeFeatRangeEffects([], '5e', {
      automation: { passives: [
        { type: 'passive_buff', effect: 'some_other_effect', bonusExpression: '99' },
        { type: 'passive_buff', effect: 'extra_reach', bonusExpression: 'not-a-number' },
        { type: 'passive_buff', effect: 'extra_reach' },
        { type: 'passive_buff', effect: 'extra_reach', bonusExpression: '0' },
        { type: 'passive_buff', effect: 'extra_reach', bonusExpression: '-3' },
        { type: 'cantrip_range_bonus', effect: 'cantrip_range_bonus', bonusExpression: '0' },
        { type: 'cantrip_range_bonus', effect: 'cantrip_range_bonus', bonusExpression: '-20' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.cantripRangeBonus).toBe(0)
  })

  it('combines feat effects with passive automation bonuses', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const result = await computeFeatRangeEffects(['Crossbow Expert'], '5e', {
      automation: { passives: [{ type: 'passive_buff', effect: 'extra_reach', bonusExpression: '5' }] },
    })
    expect(result.ignoresMeleeDisadvantage).toBe(true)
    expect(result.meleeReachBonus).toBe(5)
  })

  // --- CLA-029: condition-gated extra reach (Battering Roots) ---

  it('disk anchor: Battering Roots row declares extra_reach with bonus "10 ft"', () => {
    const roots = classes2024
      .flatMap(c => (c.majors || []).flatMap(m => m.features || []))
      .find(f => f.name === 'Battering Roots')
    expect(roots.automation).toMatchObject({
      type: 'passive_buff',
      effect: 'extra_reach',
      bonus: '10 ft',
      condition: 'heavy_or_versatile_melee_weapon',
    })
    // automationInfoBuilder/passive.js maps auto.bonus → bonusExpression,
    // so the shape that reaches this service is bonusExpression: '10 ft'.
  })

  it('routes conditional extra_reach into meleeReachGrants, not the ungated bonus', async () => {
    const result = await computeFeatRangeEffects([], '2024', {
      automation: { passives: [
        { name: 'Battering Roots', type: 'passive_buff', effect: 'extra_reach', bonusExpression: '10 ft', condition: 'heavy_or_versatile_melee_weapon' },
      ]},
    })
    expect(result.meleeReachBonus).toBe(0)
    expect(result.meleeReachGrants).toEqual([{ bonus: 10, condition: 'heavy_or_versatile_melee_weapon', source: 'Battering Roots' }])
  })

  it('records a zero-valued conditional grant but never extends reach', async () => {
    const result = await computeFeatRangeEffects([], '2024', {
      automation: { passives: [
        { name: 'Broken Roots', type: 'passive_buff', effect: 'extra_reach', bonusExpression: '0', condition: 'heavy_or_versatile_melee_weapon' },
      ]},
    })
    // honest source behavior: conditional branch records the grant regardless of size
    expect(result.meleeReachGrants).toEqual([{ bonus: 0, condition: 'heavy_or_versatile_melee_weapon', source: 'Broken Roots' }])
    expect(result.meleeReachBonus).toBe(0)
    expect(resolveMeleeReachBonus(result, { properties: ['Heavy'] }).meleeReachBonus).toBe(0)
  })

  it('keeps unconditional extra_reach in meleeReachBonus alongside conditional grants', async () => {
    const result = await computeFeatRangeEffects([], '2024', {
      automation: { passives: [
        { effect: 'extra_reach', bonusExpression: '5' },
        { name: 'Battering Roots', type: 'passive_buff', effect: 'extra_reach', bonusExpression: '10 ft', condition: 'heavy_or_versatile_melee_weapon' },
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
    it('base bonus higher than a matching grant is kept', () => {
      const mixed = {
        meleeReachBonus: 15,
        meleeReachGrants: [{ bonus: 10, condition: 'heavy_or_versatile_melee_weapon', source: 'Battering Roots' }],
      }
      expect(resolveMeleeReachBonus(mixed, { properties: ['Heavy'] }).meleeReachBonus).toBe(15)
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

  // --- computeRangeEffect integration with computed feat effects ---

  it('Sharpshooter output turns a 150 ft long-range shot from disadvantage into a clean hit', async () => {
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue(feats5e)
    const sharp = await computeFeatRangeEffects(['Sharpshooter'], '5e')
    // 100 ft weapon: long band is 101-200 ft, miss beyond
    expect(computeRangeEffect(100, 101, {})).toMatchObject({ mode: 'disadvantage' })
    expect(computeRangeEffect(100, 150, {}).mode).toBe('disadvantage')
    expect(computeRangeEffect(100, 150, sharp).mode).toBe('normal')
    expect(computeRangeEffect(100, 200, sharp).mode).toBe('normal')
    expect(computeRangeEffect(100, 201, sharp).mode).toBe('miss')
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
      expect(result).toEqual(defaultResult)
    }
  })
})
