// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getConditionImmunities,
  getConditionalImmunities,
  playerIsImmuneToCondition,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── Mock the protectionFromEvilAndGoodHandler to prevent runtime state reads ──
vi.mock('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
  handle: vi.fn(),
}))

// ── getConditionImmunities ────────────────────────────────────────
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

  it('returns empty array when features have no automation property', () => {
    expect(getConditionImmunities([{ name: 'Test' }])).toEqual([])
  })

  it('extracts passive_immunity conditionImmunity values', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed petrified' })]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['charmed petrified'])
  })

  it('extracts damageResistance as damage: prefixed strings from passive_immunity', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'poisoned', damageResistance: ['fire', 'cold'] })]
    const result = getConditionImmunities(features)
    expect(result).toContain('poisoned')
    expect(result).toContain('damage:fire')
    expect(result).toContain('damage:cold')
  })

  it('extracts immunities from condition_immunity_while_active', () => {
    const features = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened', 'paralyzed'] })]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['frightened', 'paralyzed'])
  })

  it('extracts conditionImmunity from land_resistance type', () => {
    const features = [makeFeature({ type: 'land_resistance', conditionImmunity: 'charmed' })]
    const result = getConditionImmunities(features)
    expect(result).toContain('charmed')
  })

  it('combines passive_immunity and condition_immunity_while_active from multiple features', () => {
    const features = [
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'A'),
      makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'] }, 'B'),
    ]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['charmed', 'frightened'])
  })

  it('handles array automation on a single feature', () => {
    const feature = makeFeature([
      { type: 'passive_immunity', conditionImmunity: 'charmed' },
      { type: 'other' },
    ], 'Mixed')
    const result = getConditionImmunities([feature])
    expect(result).toContain('charmed')
  })

  it('skips features without matching automation types', () => {
    const features = [makeFeature({ type: 'resistance' })]
    expect(getConditionImmunities(features)).toEqual([])
  })

  it('collects from multiple features of the same type', () => {
    const features = [
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'A'),
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' }, 'B'),
    ]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['charmed', 'frightened'])
  })
})

// ── getConditionalImmunities ──────────────────────────────────────
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

  it('returns empty array when features have no automation property', () => {
    expect(getConditionalImmunities([{ name: 'Test' }])).toEqual([])
  })

  it('extracts condition_immunity_while_active entries with metadata', () => {
    const features = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['poisoned'], requiresActive: 'toxic_form' }, 'Toxic')]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Toxic')
    expect(result[0].immunities).toEqual(['poisoned'])
    expect(result[0].requiresActive).toBe('toxic_form')
  })

  it('ignores passive_immunity (not conditional)', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })]
    expect(getConditionalImmunities(features)).toEqual([])
  })

  it('handles empty immunities array in requiresActive entry', () => {
    const features = [makeFeature({ type: 'condition_immunity_while_active', immunities: [], requiresActive: 'form' })]
    const result = getConditionalImmunities(features)
    expect(result[0].immunities).toEqual([])
  })

  it('handles missing requiresActive (defaults to empty string)', () => {
    const features = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'] })]
    const result = getConditionalImmunities(features)
    expect(result[0].requiresActive).toBe('')
  })

  it('handles missing immunities (defaults to empty array)', () => {
    const features = [makeFeature({ type: 'condition_immunity_while_active' })]
    const result = getConditionalImmunities(features)
    expect(result[0].immunities).toEqual([])
  })

  it('handles array automation on a single feature', () => {
    const feature = makeFeature([
      { type: 'condition_immunity_while_active', immunities: ['poisoned'], requiresActive: 'blessing' },
      { type: 'passive_immunity', conditionImmunity: 'charmed' },
    ], 'Mixed')
    const result = getConditionalImmunities([feature])
    expect(result).toHaveLength(1)
    expect(result[0].immunities).toEqual(['poisoned'])
    expect(result[0].requiresActive).toBe('blessing')
  })

  it('collects from multiple features with condition_immunity_while_active', () => {
    const features = [
      makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'aura' }, 'A'),
      makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'], requiresActive: 'rage' }, 'B'),
    ]
    const result = getConditionalImmunities(features)
    expect(result).toHaveLength(2)
  })
})

// ── playerIsImmuneToCondition ─────────────────────────────────────
describe('playerIsImmuneToCondition', () => {
  let playerStats, mockGetRuntimeValue, campaignName

  beforeEach(() => {
    campaignName = 'TestCampaign'
    mockGetRuntimeValue = vi.fn()
    playerStats = makePlayerStats()
    // Ensure allFeatures is available for the immunity check
    playerStats.allFeatures = []
  })

  it('returns false when conditionKey is null', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: null,
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(false)
  })

  it('returns false when conditionKey is undefined', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: undefined,
      playerStats,
      campaignName,
    })).toBe(false)
  })

  it('returns false when conditionKey is empty string', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: '',
      playerStats,
      campaignName,
    })).toBe(false)
  })

  it('returns false when playerStats is null', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats: null,
    })).toBe(false)
  })

  it('returns false when playerStats is undefined', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats: undefined,
    })).toBe(false)
  })

  it('returns true for a passive_immunity match (exact word)', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('matches case-insensitively for passive_immunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'Charmed' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('handles space-delimited conditions in passive_immunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed petrified' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'petrified',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('handles comma-delimited conditions in passive_immunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed, frightened' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false when condition is not in passive_immunity list', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('checks passive_immunity damageResistance with damage: prefix', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', damageResistance: ['fire', 'cold'] })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'damage:fire',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false for damageResistance when damage type does not match', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', damageResistance: ['fire'] })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'damage:cold',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('checks land_resistance conditionImmunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'land_resistance', conditionImmunity: 'charmed' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false for land_resistance when condition does not match', () => {
    playerStats.allFeatures = [makeFeature({ type: 'land_resistance', conditionImmunity: 'frightened' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('checks condition_immunity_while_active without requiresActive (always active)', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['poisoned'] })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns true for condition_immunity_while_active when buff is active in runtime', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'], requiresActive: 'bravery' })]
    mockGetRuntimeValue.mockReturnValue([{ name: 'bravery' }])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false for condition_immunity_while_active when buff is NOT active', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'], requiresActive: 'bravery' })]
    mockGetRuntimeValue.mockReturnValue([])
    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('calls getRuntimeValue with correct arguments when checking active buffs', () => {
    playerStats.name = 'Grog'
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'rage' })]
    playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(mockGetRuntimeValue).toHaveBeenCalledWith('Grog', 'activeBuffs', 'TestCampaign')
  })

  it('does not call getRuntimeValue when no requiresActive is needed', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'] })]
    playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(mockGetRuntimeValue).not.toHaveBeenCalled()
  })

  it('returns false when no features provide immunity for the condition', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('matches space-delimited conditions in passive_immunity (deafened from blinded deafened)', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'blinded deafened' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'deafened',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('handles null activeBuffs from getRuntimeValue gracefully', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'rage' })]
    mockGetRuntimeValue.mockReturnValue(null)
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('returns false when getRuntimeValue is not provided and requiresActive is needed', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'rage' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('returns false when campaignName is not provided and requiresActive is needed', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'rage' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
    })
    expect(mockGetRuntimeValue).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('matches buff name case-insensitively in requiresActive check', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'Rage' })]
    mockGetRuntimeValue.mockReturnValue([{ name: 'rage' }])
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns true when playerStats.immunities contains the condition', () => {
    playerStats.immunities = ['Magical Sleep']
    const result = playerIsImmuneToCondition({
      conditionKey: 'Magical Sleep',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns true for case-insensitive match in playerStats.immunities', () => {
    playerStats.immunities = ['Magical Sleep']
    const result = playerIsImmuneToCondition({
      conditionKey: 'magical sleep',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false when playerStats.immunities does not contain the condition', () => {
    playerStats.immunities = ['Magical Sleep']
    const result = playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('checks playerStats.immunities before allFeatures', () => {
    playerStats.immunities = ['charmed']
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('checks conditionImmunity on activeBuffs for temporary immunity (e.g., Feign Death)', () => {
    mockGetRuntimeValue.mockReturnValue([
      { name: 'feign_death', conditionImmunity: ['dead', 'poisoned'] },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false when activeBuffs conditionImmunity does not match', () => {
    mockGetRuntimeValue.mockReturnValue([
      { name: 'feign_death', conditionImmunity: ['dead'] },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('returns false when activeBuffs is null from getRuntimeValue', () => {
    mockGetRuntimeValue.mockReturnValue(null)
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('returns false when activeBuffs is not an array from getRuntimeValue', () => {
    mockGetRuntimeValue.mockReturnValue('not-an-array')
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('checks activeBuffs conditionImmunity case-insensitively', () => {
    mockGetRuntimeValue.mockReturnValue([
      { name: 'feign_death', conditionImmunity: ['POISONED'] },
    ])
    const result = playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns true when Protection from Evil and Good blocks frightened from warded creature', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(true)

    const result = playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'fiend',
    })
    expect(result).toBe(true)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  it('returns false when Protection from Evil and Good is active but creature is not warded', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(false)

    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'aberration',
    })
    expect(result).toBe(false)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  it('returns false when Protection from Evil and Good is active but condition is not charmed/frightened', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(true)

    const result = playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'fiend',
    })
    expect(result).toBe(false)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  it('returns false when sourceCreatureType is missing (Protection from Evil and Good not triggered)', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(true)

    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName: 'TestCampaign',
    })
    expect(result).toBe(false)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  it('handles array automation on allFeatures', () => {
    playerStats.allFeatures = [makeFeature([
      { type: 'passive_immunity', conditionImmunity: 'charmed' },
      { type: 'other' },
    ], 'Mixed')]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(true)
  })

  it('returns false when allFeatures has no relevant automation', () => {
    playerStats.allFeatures = [makeFeature({ type: 'resistance' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(result).toBe(false)
  })

  it('returns false when allFeatures is undefined on playerStats', () => {
    const stats = makePlayerStats()
    delete stats.allFeatures
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats: stats,
      campaignName,
    })
    expect(result).toBe(false)
  })
})
