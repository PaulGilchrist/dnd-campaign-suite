import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getConditionImmunities,
  getConditionalImmunities,
  playerIsImmuneToCondition,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── getConditionImmunities ────────────────────────────────────────
describe('getConditionImmunities', () => {
  it('returns empty array when features is null', () => {
    expect(getConditionImmunities(null)).toEqual([])
  })

  it('extracts passive_immunity conditionImmunity values', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed petrified' })]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['charmed petrified'])
  })

  it('extracts immunities from condition_immunity_while_active', () => {
    const features = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened', 'paralyzed'] })]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['frightened', 'paralyzed'])
  })

  it('combines both passive_immunity and condition_immunity_while_active', () => {
    const features = [
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'A'),
      makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'] }, 'B'),
    ]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['charmed', 'frightened'])
  })

  it('skips features without matching automation types', () => {
    const features = [makeFeature({ type: 'resistance' })]
    expect(getConditionImmunities(features)).toEqual([])
  })
})

// ── getConditionalImmunities ──────────────────────────────────────
describe('getConditionalImmunities', () => {
  it('returns empty array when features is null', () => {
    expect(getConditionalImmunities(null)).toEqual([])
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

  it('returns false when conditionKey is missing', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: null,
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(false)
  })

  it('returns false when playerStats is missing', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats: null,
    })).toBe(false)
  })

  it('returns true for a passive_immunity match (full word)', () => {
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

  it('handles space/comma-delimited conditions in passive_immunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed petrified' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'petrified',
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

  it('checks condition_immunity_while_active without requiresActive → returns true if matches', () => {
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

  it('does not call getRuntimeValue when no requiresActive needed', () => {
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

  it('handles substring matching in immunity string for tokens', () => {
    // The "includes" branch: when individual token doesn't match exactly but the whole string includes the condition
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

  it('does not call getRuntimeValue when getRuntimeValue is not provided', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'rage' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName,
    })
    // getRuntimeValue is undefined → activeBuffs falls back to []
    expect(result).toBe(false)
  })

  it('does not call getRuntimeValue when campaignName is not provided', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'rage' })]
    const result = playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
    })
    expect(mockGetRuntimeValue).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('buffers name is matched case-insensitively', () => {
    playerStats.allFeatures = [makeFeature({ type: 'condition_immunity_while_active', immunities: ['charmed'], requiresActive: 'Rage' })]
    mockGetRuntimeValue.mockReturnValue([{ name: 'rage' }])  // lowercase in runtime
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
})
