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

  it('collects passive_buff entries', () => {
    const features = [makeFeature({ type: 'passive_buff', effect: '+2 saving throws vs frightened' }, 'Aura')]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_buff')
  })

  it('collects passive_rule entries', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'superior_dice' })]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('collects passive_immunity entries', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
  })

  it('skips non-passive automation types', () => {
    const features = [
      makeFeature({ type: 'save_attack' }, 'Spike'),
      makeFeature({ type: 'passive_rule' }, 'Passive'),
    ]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('includes hasAutomation flag on returned items', () => {
    const features = [makeFeature({ type: 'passive_rule' })]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result[0].hasAutomation).toBe(true)
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────
describe('collectWeaponMastery', () => {
  it('returns null baseMastery when weapon not in equipment', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Longsword', ps)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('returns base mastery from weapon when found in equipment', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Longsword', mastery: 'trip' }],
    })
    const result = collectWeaponMastery('Longsword', ps)
    expect(result.baseMastery).toBe('trip')
  })

  it('strips magic prefix when looking up weapon in equipment', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Greataxe', mastery: 'heave' }],
    })
    const result = collectWeaponMastery('+1 Greataxe', ps)
    expect(result.baseMastery).toBe('heave')
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
    expect(result.extraMasteries).toEqual(['push', 'topple'])
  })

  it('deduplicates extra masteries', () => {
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
    expect(result.extraMasteries).toEqual(['push', 'topple'])
  })

  it('returns empty extraMasteries when no automation passives exist', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Sword', ps)
    expect(result.extraMasteries).toEqual([])
  })

  it('handles missing equipment gracefully', () => {
    const ps = makePlayerStats() // no equipment property set explicitly
    const result = collectWeaponMastery('Sword', ps)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('handles missing automation passives gracefully', () => {
    const ps = makePlayerStats({ equipment: [] })
    // No .automation property at all
    const result = collectWeaponMastery('Sword', ps)
    expect(result.extraMasteries).toEqual([])
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
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '1d6' }, // not evaluable → string, skipped
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(3)
  })

  it('uses playerStats abilities in bonus expressions', () => {
    // "level" resolves to the number via evaluateAutoExpression → resolveDiceExpression
    const ps2 = makePlayerStats({
      level: 5,
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'level' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps2)).toBe(5)
  })

  it('handles missing automation object on playerStats', () => {
    const ps = makePlayerStats()
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
          { type: 'passive_buff', effect: 'maximize_healing_dice' }, // wrong type
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('handles missing automation gracefully', () => {
    const ps = makePlayerStats() // no .automation property
    expect(hasHealingMaximization(ps)).toBe(false)
  })
})
