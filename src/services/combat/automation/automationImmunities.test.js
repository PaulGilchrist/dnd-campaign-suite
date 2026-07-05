// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getConditionImmunities,
  getConditionalImmunities,
  playerIsImmuneToCondition,
  hasSelfRestoration,
} from './automationImmunities.js'

// Mock the protectionFromEvilAndGoodHandler to prevent runtime state reads
vi.mock('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
}))

// ── Helpers ───────────────────────────────────────────────────────

function makeFeature(automation, name = 'Test Feature') {
  return { name, automation }
}

// ── getConditionImmunities ────────────────────────────────────────

describe('getConditionImmunities', () => {
  it.each([
    [null],
    [undefined],
    [[]],
  ])('returns empty array when features is %s', (features) => {
    expect(getConditionImmunities(features)).toEqual([])
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
    const features = [makeFeature({
      type: 'passive_immunity',
      conditionImmunity: 'poisoned',
      damageResistance: ['fire', 'cold'],
    })]
    const result = getConditionImmunities(features)
    expect(result).toContain('poisoned')
    expect(result).toContain('damage:fire')
    expect(result).toContain('damage:cold')
  })

  it('extracts immunities from condition_immunity_while_active', () => {
    const features = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['frightened', 'paralyzed'],
    })]
    const result = getConditionImmunities(features)
    expect(result).toEqual(['frightened', 'paralyzed'])
  })

  it('extracts conditionImmunity from land_resistance type', () => {
    const features = [makeFeature({ type: 'land_resistance', conditionImmunity: 'charmed' })]
    const result = getConditionImmunities(features)
    expect(result).toContain('charmed')
  })

  it('skips features without matching automation types', () => {
    const features = [makeFeature({ type: 'resistance' })]
    expect(getConditionImmunities(features)).toEqual([])
  })

  it('combines immunities from multiple features', () => {
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
  it.each([
    [null],
    [undefined],
    [[]],
  ])('returns empty array when features is %s', (features) => {
    expect(getConditionalImmunities(features)).toEqual([])
  })

  it('returns empty array when features have no automation property', () => {
    expect(getConditionalImmunities([{ name: 'Test' }])).toEqual([])
  })

  it('extracts condition_immunity_while_active entries with metadata', () => {
    const features = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['poisoned'],
      requiresActive: 'toxic_form',
    }, 'Toxic')]
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
    const features = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: [],
      requiresActive: 'form',
    })]
    const result = getConditionalImmunities(features)
    expect(result[0].immunities).toEqual([])
  })

  it('defaults requiresActive to empty string when missing', () => {
    const features = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['charmed'],
    })]
    const result = getConditionalImmunities(features)
    expect(result[0].requiresActive).toBe('')
  })

  it('defaults immunities to empty array when missing', () => {
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
    playerStats = {
      name: 'TestCharacter',
      allFeatures: [],
    }
  })

  // ── Null / missing argument guards ──

  it('returns false when conditionKey is null, undefined, or empty string', () => {
    expect(playerIsImmuneToCondition({ conditionKey: null, playerStats })).toBe(false)
    expect(playerIsImmuneToCondition({ conditionKey: undefined, playerStats })).toBe(false)
    expect(playerIsImmuneToCondition({ conditionKey: '', playerStats })).toBe(false)
  })

  it('returns false when playerStats is null or undefined', () => {
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: null })).toBe(false)
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: undefined })).toBe(false)
  })

  it('returns false when allFeatures is undefined on playerStats', () => {
    const stats = { name: 'Test' }
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: stats })).toBe(false)
  })

  // ── playerStats.immunities array ──

  it('returns true when condition is in playerStats.immunities', () => {
    playerStats.immunities = ['charmed', 'frightened']
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'poisoned', playerStats })).toBe(false)
  })

  it('matches playerStats.immunities case-insensitively', () => {
    playerStats.immunities = ['Charmed', 'Frightened']
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'FRIGHTENED', playerStats })).toBe(true)
  })

  // ── passive_immunity ──

  it('matches exact word in passive_immunity conditionImmunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
  })

  it('matches case-insensitively in passive_immunity conditionImmunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'Charmed' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
  })

  it('handles space-delimited conditions in passive_immunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed petrified' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'petrified', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
  })

  it('handles comma-delimited conditions in passive_immunity', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed, frightened' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'frightened', playerStats })).toBe(true)
  })

  it('matches damageResistance with damage: prefix', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'passive_immunity',
      damageResistance: ['fire', 'cold'],
    })]
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:fire', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:cold', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:lightning', playerStats })).toBe(false)
  })

  it('returns false when passive_immunity does not match', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
  })

  // ── land_resistance ──

  it('matches conditionImmunity from land_resistance', () => {
    playerStats.allFeatures = [makeFeature({ type: 'land_resistance', conditionImmunity: 'charmed' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
  })

  it('returns false when land_resistance conditionImmunity does not match', () => {
    playerStats.allFeatures = [makeFeature({ type: 'land_resistance', conditionImmunity: 'frightened' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
  })

  // ── condition_immunity_while_active ──

  it('returns true when condition_immunity_while_active has no requiresActive', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['poisoned'],
    })]
    expect(playerIsImmuneToCondition({ conditionKey: 'poisoned', playerStats })).toBe(true)
  })

  it('returns true when condition_immunity_while_active has requiresActive and buff is in activeBuffs', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['frightened'],
      requiresActive: 'bravery',
    })]
    mockGetRuntimeValue.mockReturnValue([{ name: 'bravery' }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(true)
  })

  it('returns false when condition_immunity_while_active has requiresActive but buff is not active', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['frightened'],
      requiresActive: 'bravery',
    })]
    mockGetRuntimeValue.mockReturnValue([{ name: 'other_buff' }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(false)
  })

  it('returns false when getRuntimeValue is not provided and requiresActive is needed', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['charmed'],
      requiresActive: 'rage',
    })]
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
    })).toBe(false)
  })

  it('returns false when campaignName is not provided and requiresActive is needed', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['charmed'],
      requiresActive: 'rage',
    })]
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
    })).toBe(false)
  })

  it('matches buff name case-insensitively in requiresActive check', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['charmed'],
      requiresActive: 'Rage',
    })]
    mockGetRuntimeValue.mockReturnValue([{ name: 'rage' }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(true)
  })

  it('does not call getRuntimeValue when no requiresActive is needed', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['charmed'],
    })]
    playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(mockGetRuntimeValue).not.toHaveBeenCalled()
  })

  it('calls getRuntimeValue with correct arguments when checking active buffs', () => {
    playerStats.name = 'Grog'
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['charmed'],
      requiresActive: 'rage',
    })]
    playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })
    expect(mockGetRuntimeValue).toHaveBeenCalledWith('Grog', 'activeBuffs', 'TestCampaign')
  })

  // ── activeBuffs conditionImmunity (e.g., Feign Death) ──

  it('returns true when activeBuffs has conditionImmunity matching the condition', () => {
    mockGetRuntimeValue.mockReturnValue([
      { name: 'feign_death', conditionImmunity: ['dead', 'poisoned'] },
    ])
    expect(playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(true)
  })

  it('returns false when activeBuffs conditionImmunity does not match', () => {
    mockGetRuntimeValue.mockReturnValue([
      { name: 'feign_death', conditionImmunity: ['dead'] },
    ])
    expect(playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(false)
  })

  it('handles null activeBuffs from getRuntimeValue gracefully', () => {
    mockGetRuntimeValue.mockReturnValue(null)
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(false)
  })

  it('handles non-array activeBuffs from getRuntimeValue gracefully', () => {
    mockGetRuntimeValue.mockReturnValue('not-an-array')
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(false)
  })

  it('matches activeBuffs conditionImmunity case-insensitively', () => {
    mockGetRuntimeValue.mockReturnValue([
      { name: 'feign_death', conditionImmunity: ['POISONED'] },
    ])
    expect(playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      getRuntimeValue: mockGetRuntimeValue,
      campaignName,
    })).toBe(true)
  })

  // ── Protection from Evil and Good ──

  it('returns true when Protection from Evil and Good blocks charmed/frightened from warded creature', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(true)

    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'fiend',
    })).toBe(true)

    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'fiend',
    })).toBe(true)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  it('returns false when Protection from Evil and Good is active but creature is not warded or condition is not charmed/frightened', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(false)

    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'aberration',
    })).toBe(false)

    pfegModule.isCreatureWarded.mockReturnValue(true)
    expect(playerIsImmuneToCondition({
      conditionKey: 'poisoned',
      playerStats,
      campaignName: 'TestCampaign',
      sourceCreatureType: 'fiend',
    })).toBe(false)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  it('returns false when sourceCreatureType is missing (Protection from Evil and Good not triggered)', async () => {
    const pfegModule = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfegModule.isCreatureWarded.mockReturnValue(true)

    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed',
      playerStats,
      campaignName: 'TestCampaign',
    })).toBe(false)

    pfegModule.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
    pfegModule.isCreatureWarded.mockReturnValue(false)
  })

  // ── Array automation ──

  it('handles array automation on allFeatures', () => {
    playerStats.allFeatures = [makeFeature([
      { type: 'passive_immunity', conditionImmunity: 'charmed' },
      { type: 'other' },
    ], 'Mixed')]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
  })

  // ── No immunity ──

  it('returns false when no features provide immunity for the condition', () => {
    playerStats.allFeatures = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
  })

  it('returns false when allFeatures has no relevant automation', () => {
    playerStats.allFeatures = [makeFeature({ type: 'resistance' })]
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
  })
})

// ── hasSelfRestoration ────────────────────────────────────────────

describe('hasSelfRestoration', () => {
  it('returns false when playerStats is null', () => {
    expect(hasSelfRestoration(null)).toBe(false)
  })

  it('returns false when playerStats has no allFeatures', () => {
    expect(hasSelfRestoration({ name: 'Test' })).toBe(false)
  })

  it('returns false when allFeatures is empty', () => {
    expect(hasSelfRestoration({ name: 'Test', allFeatures: [] })).toBe(false)
  })

  it('returns false when allFeatures has no matching automation', () => {
    const playerStats = {
      name: 'Test',
      allFeatures: [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })],
    }
    expect(hasSelfRestoration(playerStats)).toBe(false)
  })

  it('returns true when end_of_turn_condition_removal is found', () => {
    const playerStats = {
      name: 'Test',
      allFeatures: [makeFeature({
        type: 'passive_rule',
        effect: 'end_of_turn_condition_removal',
        conditions: ['charmed'],
      }, 'Self-Restoration')],
    }
    expect(hasSelfRestoration(playerStats)).toBe(true)
  })

  it('handles array automation', () => {
    const playerStats = {
      name: 'Test',
      allFeatures: [makeFeature([
        { type: 'passive_immunity', conditionImmunity: 'charmed' },
        {
          type: 'passive_rule',
          effect: 'end_of_turn_condition_removal',
          conditions: ['frightened'],
        },
      ], 'Mixed')],
    }
    expect(hasSelfRestoration(playerStats)).toBe(true)
  })

  it('returns true when any feature has end_of_turn_condition_removal', () => {
    const playerStats = {
      name: 'Test',
      allFeatures: [
        makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Magic Resistance'),
        makeFeature({
          type: 'passive_rule',
          effect: 'end_of_turn_condition_removal',
          conditions: ['charmed'],
        }, 'Self-Restoration'),
      ],
    }
    expect(hasSelfRestoration(playerStats)).toBe(true)
  })

  it('returns false when passive_rule has different effect', () => {
    const playerStats = {
      name: 'Test',
      allFeatures: [makeFeature({
        type: 'passive_rule',
        effect: 'some_other_effect',
      })],
    }
    expect(hasSelfRestoration(playerStats)).toBe(false)
  })
})
