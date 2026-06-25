// @improved-by-ai
import { describe, it, expect } from 'vitest'

import {
  getPassiveBuffs,
  collectWeaponMastery,
  resolveHealingBonuses,
  hasHealingMaximization,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── getPassiveBuffs ───────────────────────────────────────────────
describe('getPassiveBuffs', () => {
  it('returns empty array when features is null', () => {
    expect(getPassiveBuffs(null, makePlayerStats())).toEqual([])
  })

  it('returns empty array when features is undefined', () => {
    expect(getPassiveBuffs(undefined, makePlayerStats())).toEqual([])
  })

  it('returns empty array when features is an empty array', () => {
    expect(getPassiveBuffs([], makePlayerStats())).toEqual([])
  })

  it('collects passive_buff entries from features', () => {
    const features = [makeFeature({ type: 'passive_buff', effect: '+2 saving throws vs frightened' }, 'Aura')]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'passive_buff',
      effect: '+2 saving throws vs frightened',
      hasAutomation: true,
    })
  })

  it('collects passive_rule entries from features', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'superior_dice' }, 'Epic Boon')]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'passive_rule',
      effect: 'superior_dice',
      hasAutomation: true,
    })
  })

  it('collects passive_immunity entries from features', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Immune to Charm')]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'passive_immunity',
      conditionImmunity: 'charmed',
      hasAutomation: true,
    })
  })

  it('skips features with non-passive automation types', () => {
    const features = [
      makeFeature({ type: 'save_attack' }, 'Spike'),
      makeFeature({ type: 'passive_rule' }, 'Passive'),
    ]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('skips features with no automation property', () => {
    const feature = { name: 'Orphan', automation: undefined }
    const result = getPassiveBuffs([feature], makePlayerStats())
    expect(result).toEqual([])
  })

  it('handles features with array of automations', () => {
    const feature = makeFeature(
      [
        { type: 'passive_rule', effect: 'superior_dice' },
        { type: 'action', effect: 'damage' },
        { type: 'passive_buff', effect: 'blindsight' },
      ],
      'Multi-Automation',
    )
    const result = getPassiveBuffs([feature], makePlayerStats())
    expect(result).toHaveLength(2)
    const types = result.map((r) => r.type)
    expect(types).toContain('passive_rule')
    expect(types).toContain('passive_buff')
  })

  it('sets hasAutomation flag on all returned items', () => {
    const features = [
      makeFeature({ type: 'passive_rule' }, 'R1'),
      makeFeature({ type: 'passive_buff' }, 'R2'),
      makeFeature({ type: 'passive_immunity' }, 'R3'),
    ]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result.every((r) => r.hasAutomation === true)).toBe(true)
  })

  it('collects all passive types from multiple features', () => {
    const features = [
      makeFeature({ type: 'passive_buff', effect: 'blindsight' }, 'A'),
      makeFeature({ type: 'passive_rule', effect: 'superior_dice' }, 'B'),
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' }, 'C'),
      makeFeature({ type: 'action' }, 'D'),
    ]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(3)
    const types = result.map((r) => r.type)
    expect(types).toEqual(expect.arrayContaining(['passive_buff', 'passive_rule', 'passive_immunity']))
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────
describe('collectWeaponMastery', () => {
  it('returns null baseMastery when weapon not in equipment', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Longsword', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: [] })
  })

  it('returns base mastery from weapon when found in equipment', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Longsword', mastery: 'trip' }],
    })
    const result = collectWeaponMastery('Longsword', ps)
    expect(result).toEqual({ baseMastery: 'trip', extraMasteries: [] })
  })

  it('strips magic prefix when looking up weapon in equipment', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Greataxe', mastery: 'heave' }],
    })
    const result = collectWeaponMastery('+1 Greataxe', ps)
    expect(result).toEqual({ baseMastery: 'heave', extraMasteries: [] })
  })

  it('collects extra masteries from automation passives', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Club', mastery: 'none' }],
      automation: {
        passives: [
          { type: 'passive_buff', extraMastery: ['push', 'topple'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result).toEqual({ baseMastery: 'none', extraMasteries: ['push', 'topple'] })
  })

  it('deduplicates extra masteries across multiple passives', () => {
    const ps = makePlayerStats({
      equipment: [],
      automation: {
        passives: [
          { type: 'passive_buff', extraMastery: ['push'] },
          { type: 'passive_buff', extraMastery: ['push', 'topple'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: ['push', 'topple'] })
  })

  it('returns empty extraMasteries when no automation passives exist', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Sword', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: [] })
  })

  it('handles missing equipment gracefully', () => {
    const ps = makePlayerStats()
    const result = collectWeaponMastery('Sword', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: [] })
  })

  it('handles missing automation passives gracefully', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Sword', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: [] })
  })

  it('handles missing automation object on playerStats', () => {
    const ps = makePlayerStats({ equipment: [] })
    delete ps.automation
    const result = collectWeaponMastery('Sword', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: [] })
  })

  it('adds replaceMastery to extraMasteries without clearing baseMastery', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Club', mastery: 'trip' }],
      automation: {
        passives: [
          { type: 'passive_buff', replaceMastery: ['push', 'heave'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result).toEqual({ baseMastery: 'trip', extraMasteries: ['push', 'heave'] })
  })

  it('combines replaceMastery with extraMastery from multiple passives', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Club', mastery: 'trip' }],
      automation: {
        passives: [
          { type: 'passive_buff', replaceMastery: ['push'] },
          { type: 'passive_buff', extraMastery: ['topple', 'heave'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result).toEqual({ baseMastery: 'trip', extraMasteries: ['topple', 'heave', 'push'] })
  })

  it('returns null baseMastery when replaceMastery exists but weapon not found', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', replaceMastery: ['push'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result).toEqual({ baseMastery: null, extraMasteries: ['push'] })
  })
})

// ── resolveHealingBonuses ────────────────────────────────────────
describe('resolveHealingBonuses', () => {
  it('returns 0 when no automation passives exist', () => {
    const ps = makePlayerStats()
    expect(resolveHealingBonuses(ps)).toBe(0)
  })

  it('sums numeric bonusExpression values from passive_rule with bonus_healing', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' },
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '5' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(8)
  })

  it('skips passive_rule entries that are not bonus_healing', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'superior_dice' },
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(2)
  })

  it('skips entries where bonusExpression evaluates to non-number', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '1d6' },
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(3)
  })

  it('uses playerStats level in bonus expressions', () => {
    const ps = makePlayerStats({
      level: 5,
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'level' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(5)
  })

  it('uses playerStats abilities in bonus expressions via ability modifiers', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'STR modifier' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(5)
  })

  it('handles missing automation object on playerStats', () => {
    const ps = makePlayerStats()
    expect(resolveHealingBonuses(ps)).toBe(0)
  })

  it('handles empty passives array', () => {
    const ps = makePlayerStats({
      automation: { passives: [] },
    })
    expect(resolveHealingBonuses(ps)).toBe(0)
  })

  it('skips bonusExpression that is null or undefined', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing' },
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '4' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(4)
  })

  it('adds extra healing from max_hp_increase alsoSelfHealing', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          {
            type: 'passive_rule',
            effect: 'max_hp_increase',
            alsoSelfHealing: { extraHealingExpression: '2' },
          },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(2)
  })

  it('combines bonus_healing and max_hp_increase extra healing', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' },
          {
            type: 'passive_rule',
            effect: 'max_hp_increase',
            alsoSelfHealing: { extraHealingExpression: '7' },
          },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(10)
  })

  it('uses playerStats proficiency when expression references proficiency_bonus', () => {
    const ps = makePlayerStats({
      proficiency: 6,
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'proficiency_bonus' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(6)
  })

  it('skips non-passive_rule types even with bonus_healing effect', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', effect: 'bonus_healing', bonusExpression: '10' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(0)
  })
})

// ── hasHealingMaximization ───────────────────────────────────────
describe('hasHealingMaximization', () => {
  it('returns false when no automation passives exist', () => {
    const ps = makePlayerStats()
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('returns true when a passive_rule has maximize_healing_dice effect', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'maximize_healing_dice' },
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(true)
  })

  it('returns false when passive_rule has other effects', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'superior_dice' },
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('returns false when passive is not a passive_rule', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', effect: 'maximize_healing_dice' },
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('handles missing automation gracefully', () => {
    const ps = makePlayerStats()
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('returns false when passives array is empty', () => {
    const ps = makePlayerStats({
      automation: { passives: [] },
    })
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('returns true when multiple passives include maximize_healing_dice', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'superior_dice' },
          { type: 'passive_rule', effect: 'maximize_healing_dice' },
          { type: 'passive_buff', effect: 'blindsight' },
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(true)
  })
})
