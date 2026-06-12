import { describe, it, expect } from 'vitest'
import {
  getConditionImmunities,
  getConditionalImmunities,
  playerIsImmuneToCondition,
} from './automationImmunities.js'

describe('getConditionImmunities', () => {
  it('returns empty array when features is null', () => {
    expect(getConditionImmunities(null)).toEqual([])
  })

  it('returns empty array when features is undefined', () => {
    expect(getConditionImmunities(undefined)).toEqual([])
  })

  it('returns empty array when features is empty', () => {
    expect(getConditionImmunities([])).toEqual([])
  })

  it('collects passive_immunity conditionImmunity values', () => {
    const features = [
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ]
    expect(getConditionImmunities(features)).toEqual(['poison'])
  })

  it('collects multiple passive_immunity values', () => {
    const features = [
      {
        name: 'Feature A',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
      {
        name: 'Feature B',
        automation: { type: 'passive_immunity', conditionImmunity: 'charmed' },
      },
    ]
    expect(getConditionImmunities(features)).toEqual(['poison', 'charmed'])
  })

  it('collects condition_immunity_while_active immunities array', () => {
    const features = [
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ]
    expect(getConditionImmunities(features)).toEqual(['frightened'])
  })

  it('collects multiple immunities from condition_immunity_while_active', () => {
    const features = [
      {
        name: 'Feature X',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened', 'charmed'],
          requiresActive: 'Berserker Rage',
        },
      },
    ]
    expect(getConditionImmunities(features)).toEqual(['frightened', 'charmed'])
  })

  it('collects both passive and conditional immunities together', () => {
    const features = [
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ]
    expect(getConditionImmunities(features)).toEqual(['poison', 'frightened'])
  })

  it('skips features without automation property', () => {
    const features = [
      { name: 'No Automation' },
      { name: 'Valid', automation: { type: 'passive_immunity', conditionImmunity: 'poison' } },
    ]
    expect(getConditionImmunities(features)).toEqual(['poison'])
  })

  it('skips features with null automation', () => {
    const features = [
      { name: 'Null Automation', automation: null },
      { name: 'Valid', automation: { type: 'passive_immunity', conditionImmunity: 'poison' } },
    ]
    expect(getConditionImmunities(features)).toEqual(['poison'])
  })

  it('skips features with undefined automation', () => {
    const features = [
      { name: 'Undefined Automation', automation: undefined },
    ]
    expect(getConditionImmunities(features)).toEqual([])
  })
})

describe('getConditionalImmunities', () => {
  it('returns empty array when features is null', () => {
    expect(getConditionalImmunities(null)).toEqual([])
  })

  it('returns empty array when features is undefined', () => {
    expect(getConditionalImmunities(undefined)).toEqual([])
  })

  it('returns empty array when features is empty', () => {
    expect(getConditionalImmunities([])).toEqual([])
  })

  it('returns empty array for passive_immunity features (not conditional)', () => {
    const features = [
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ]
    expect(getConditionalImmunities(features)).toEqual([])
  })

  it('collects condition_immunity_while_active entries with correct shape', () => {
    const features = [
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      name: 'Berserker Rage',
      immunities: ['frightened'],
      requiresActive: 'Rage',
    })
  })

  it('defaults immunities to empty array when not provided', () => {
    const features = [
      {
        name: 'Feature X',
        automation: {
          type: 'condition_immunity_while_active',
          requiresActive: 'Some Buff',
        },
      },
    ]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(1)
    expect(result[0].immunities).toEqual([])
  })

  it('defaults requiresActive to empty string when not provided', () => {
    const features = [
      {
        name: 'Feature X',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
        },
      },
    ]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(1)
    expect(result[0].requiresActive).toBe('')
  })

  it('collects multiple conditional immunity features', () => {
    const features = [
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
      {
        name: 'Paladin Aura',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['charmed'],
          requiresActive: 'Aura of Protection',
        },
      },
    ]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Berserker Rage')
    expect(result[1].name).toBe('Paladin Aura')
  })

  it('skips features without automation property', () => {
    const features = [
      { name: 'No Automation' },
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(1)
  })

  it('skips features with null automation', () => {
    const features = [
      { name: 'Null Automation', automation: null },
    ]
    expect(getConditionalImmunities(features)).toEqual([])
  })
})

describe('playerIsImmuneToCondition', () => {
  const createPlayerStats = (features) => ({
    name: 'Test Character',
    allFeatures: features,
  })

  it('returns false when conditionKey is null', () => {
    const stats = createPlayerStats([])
    expect(playerIsImmuneToCondition({ conditionKey: null, playerStats: stats })).toBe(false)
  })

  it('returns false when conditionKey is undefined', () => {
    const stats = createPlayerStats([])
    expect(playerIsImmuneToCondition({ conditionKey: undefined, playerStats: stats })).toBe(false)
  })

  it('returns false when playerStats is null', () => {
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: null })).toBe(false)
  })

  it('returns false when playerStats has no allFeatures', () => {
    const stats = { name: 'Test Character' }
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(false)
  })

  it('returns false when no features match', () => {
    const stats = createPlayerStats([])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(false)
  })

  it('returns true for exact passive_immunity match (lowercase)', () => {
    const stats = createPlayerStats([
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(true)
  })

  it('returns true for exact passive_immunity match (uppercase input)', () => {
    const stats = createPlayerStats([
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'POISON', playerStats: stats })).toBe(true)
  })

  it('returns true for exact passive_immunity match (mixed case input)', () => {
    const stats = createPlayerStats([
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'Poison', playerStats: stats })).toBe(true)
  })

  it('returns false for non-matching condition with passive_immunity', () => {
    const stats = createPlayerStats([
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: stats })).toBe(false)
  })

  it('handles passive_immunity with comma-separated conditions', () => {
    const stats = createPlayerStats([
      {
        name: 'Feature',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison, frightened' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats: stats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: stats })).toBe(false)
  })

  it('handles passive_immunity with space-separated conditions', () => {
    const stats = createPlayerStats([
      {
        name: 'Feature',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison frightened' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats: stats })).toBe(true)
  })

  it('returns true for condition_immunity_while_active with no requiresActive', () => {
    const stats = createPlayerStats([
      {
        name: 'Feature X',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
        },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats: stats })).toBe(true)
  })

  it('returns false for condition_immunity_while_active when buff not active', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats: stats,
      getRuntimeValue: () => [{ name: 'Some Other Buff' }],
      campaignName: 'Test Campaign',
    })
    expect(result).toBe(false)
  })

  it('returns true for condition_immunity_while_active when buff IS active', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Berserker Rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats: stats,
      getRuntimeValue: () => [{ name: 'Berserker Rage' }],
      campaignName: 'Test Campaign',
    })
    expect(result).toBe(true)
  })

  it('returns false when condition not in immunities list but buff is active', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Berserker Rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats: stats,
      getRuntimeValue: () => [{ name: 'Berserker Rage' }],
      campaignName: 'Test Campaign',
    })
    expect(result).toBe(false)
  })

  it('handles case-insensitive buff name matching', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'berserker rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats: stats,
      getRuntimeValue: () => [{ name: 'BERSERKER RAGE' }],
      campaignName: 'Test Campaign',
    })
    expect(result).toBe(true)
  })

  it('skips features without automation', () => {
    const stats = createPlayerStats([
      { name: 'No Automation' },
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(true)
  })

  it('skips features with null automation', () => {
    const stats = createPlayerStats([
      { name: 'Null Automation', automation: null },
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(true)
  })

  it('handles passive_immunity with conditionImmunity containing only whitespace', () => {
    const stats = createPlayerStats([
      {
        name: 'Feature',
        automation: { type: 'passive_immunity', conditionImmunity: '   ' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(false)
  })

  it('handles conditionKey as non-string by converting to string', () => {
    const stats = createPlayerStats([
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: '123' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 123, playerStats: stats })).toBe(true)
  })

  it('returns false when getRuntimeValue/campaignName not provided for conditional immunity with requiresActive', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats: stats,
    })
    expect(result).toBe(false)
  })

  it('handles empty activeBuffs array when buff not active', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats: stats,
      getRuntimeValue: () => [],
      campaignName: 'Test Campaign',
    })
    expect(result).toBe(false)
  })

  it('handles activeBuffs that is not an array', () => {
    const stats = createPlayerStats([
      {
        name: 'Berserker Rage',
        automation: {
          type: 'condition_immunity_while_active',
          immunities: ['frightened'],
          requiresActive: 'Rage',
        },
      },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats: stats,
      getRuntimeValue: () => 'not-an-array',
      campaignName: 'Test Campaign',
    })
    expect(result).toBe(false)
  })

  it('checks multiple features for immunity (first match wins)', () => {
    const stats = createPlayerStats([
      {
        name: 'No Match',
        automation: { type: 'passive_immunity', conditionImmunity: 'charmed' },
      },
      {
        name: 'Dwarven Resilience',
        automation: { type: 'passive_immunity', conditionImmunity: 'poison' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'poison', playerStats: stats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: stats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'blinded', playerStats: stats })).toBe(false)
  })

  it('handles passive_immunity where immunity string contains condition as substring', () => {
    const stats = createPlayerStats([
      {
        name: 'Feature',
        automation: { type: 'passive_immunity', conditionImmunity: 'death_saves' },
      },
    ])
    expect(playerIsImmuneToCondition({ conditionKey: 'death', playerStats: stats })).toBe(true)
  })
})
