// @maintained-by-ai
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

import {
  getConditionImmunities,
  getConditionalImmunities,
  playerIsImmuneToCondition,
  hasSelfRestoration,
} from './automationImmunities.js'

// The Protection from Evil and Good handler is scripted here (its own logic
// lives in protectionFromEvilAndGoodHandler.test.js) — we only pin how
// automationImmunities consumes it on the ward branch.
vi.mock('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isProtectionFromEvilAndGoodActive: vi.fn(() => false),
  isCreatureWarded: vi.fn(() => false),
}))

let pfeg
beforeAll(async () => {
  pfeg = await import('../../automation/handlers/buffs/protectionFromEvilAndGoodHandler.js')
})

function makeFeature(automation, name = 'Test Feature') {
  return { name, automation }
}

// Defaults off every test; the ward tests opt in explicitly.
beforeEach(() => {
  vi.resetAllMocks()
  pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(false)
  pfeg.isCreatureWarded.mockReturnValue(false)
})

// ── Collector guards (both feature-scan collectors share this contract) ──

describe('collector guards', () => {
  it('returns empty arrays for absent features, empty arrays, and automation-less features', () => {
    for (const input of [null, undefined, [], [{ name: 'Test' }]]) {
      expect(getConditionImmunities(input)).toEqual([])
      expect(getConditionalImmunities(input)).toEqual([])
    }
  })
})

// ── getConditionImmunities ────────────────────────────────────────

describe('getConditionImmunities', () => {
  it('maps each automation type to its immunity entries (exact envelopes)', () => {
    const rows = [
      ['passive_immunity conditions + damage types',
        { type: 'passive_immunity', conditionImmunity: 'charmed petrified', damageResistance: ['fire', 'cold'] },
        ['charmed petrified', 'damage:fire', 'damage:cold']],
      ['passive_immunity pushes empty conditionImmunity unfiltered (quirk pinned)',
        { type: 'passive_immunity', conditionImmunity: '', damageResistance: [] },
        ['']],
      ['passive_immunity pushes missing conditionImmunity as undefined (quirk pinned)',
        { type: 'passive_immunity' },
        [undefined]],
      ['condition_immunity_while_active',
        { type: 'condition_immunity_while_active', immunities: ['frightened', 'paralyzed'] },
        ['frightened', 'paralyzed']],
      ['land_resistance',
        { type: 'land_resistance', conditionImmunity: 'charmed' },
        ['charmed']],
      ['land_resistance without conditionImmunity is skipped',
        { type: 'land_resistance' },
        []],
      ['unknown automation types ignored',
        { type: 'attack', conditionImmunity: 'charmed' },
        []],
    ]
    for (const [, automation, expected] of rows) {
      expect(getConditionImmunities([makeFeature(automation)])).toEqual(expected)
    }
  })

  it('combines multiple features and array automations in stable order', () => {
    const features = [
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'A'),
      makeFeature([
        { type: 'passive_immunity', conditionImmunity: 'petrified' },
        { type: 'other' },
      ], 'Mixed'),
      makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'] }, 'B'),
      makeFeature({ type: 'land_resistance', conditionImmunity: 'paralyzed' }, 'C'),
    ]
    expect(getConditionImmunities(features)).toEqual(['charmed', 'petrified', 'frightened', 'paralyzed'])
  })
})

// ── getConditionalImmunities ──────────────────────────────────────

describe('getConditionalImmunities', () => {
  it('emits one exactly-shaped entry per condition_immunity_while_active automation, ignoring all other types', () => {
    const features = [
      makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Passive'),
      makeFeature({ type: 'land_resistance', conditionImmunity: 'charmed' }, 'Land'),
      makeFeature({ type: 'condition_immunity_while_active', immunities: ['poisoned'], requiresActive: 'toxic_form' }, 'Toxic'),
      makeFeature([
        { type: 'condition_immunity_while_active', immunities: ['frightened'], requiresActive: 'blessing' },
        { type: 'passive_immunity', conditionImmunity: 'charmed' },
      ], 'Mixed'),
    ]
    expect(getConditionalImmunities(features)).toEqual([
      { name: 'Toxic', immunities: ['poisoned'], requiresActive: 'toxic_form' },
      { name: 'Mixed', immunities: ['frightened'], requiresActive: 'blessing' },
    ])
  })

  it('defaults missing immunities and requiresActive to empty values', () => {
    expect(getConditionalImmunities([makeFeature({ type: 'condition_immunity_while_active' })]))
      .toEqual([{ name: 'Test Feature', immunities: [], requiresActive: '' }])
    expect(getConditionalImmunities([makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })]))
      .toEqual([])
  })
})

// ── playerIsImmuneToCondition ─────────────────────────────────────

describe('playerIsImmuneToCondition', () => {
  let playerStats, mockGetRuntimeValue

  beforeEach(() => {
    mockGetRuntimeValue = vi.fn()
    playerStats = { name: 'TestCharacter', allFeatures: [] }
  })

  it('returns false for falsy conditionKey or playerStats without consulting the ward check', () => {
    for (const conditionKey of [null, undefined, '', 0]) {
      expect(playerIsImmuneToCondition({ conditionKey, playerStats })).toBe(false)
    }
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: null })).toBe(false)
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: undefined })).toBe(false)
    expect(pfeg.isProtectionFromEvilAndGoodActive).not.toHaveBeenCalled()

    // Bare stats pass the guards and reach the (inactive) ward gate — still no immunity
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats: { name: 'Test' } })).toBe(false)
    expect(pfeg.isProtectionFromEvilAndGoodActive).toHaveBeenCalledWith('Test', undefined)
  })

  it('matches playerStats.immunities case-insensitively; non-array immunities never match', () => {
    playerStats.immunities = ['charmed', 'frightened']
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'Frightened', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'poisoned', playerStats })).toBe(false)

    // Static hit returns before any runtime lookup
    expect(mockGetRuntimeValue).not.toHaveBeenCalled()

    playerStats.immunities = 'charmed'
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
    playerStats.immunities = 42
    expect(playerIsImmuneToCondition({ conditionKey: 'charmed', playerStats })).toBe(false)
  })

  it('resolves feature automations per immunity type (exact, delimited, case, and negative rows)', () => {
    const rows = [
      ['passive_immunity exact', makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }), 'charmed', true],
      ['passive_immunity space-delimited', makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed petrified' }), 'petrified', true],
      ['passive_immunity comma-delimited', makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed, frightened' }), 'frightened', true],
      ['passive_immunity stored mixed-case', makeFeature({ type: 'passive_immunity', conditionImmunity: 'Charmed' }), 'charmed', true],
      ['passive_immunity substring fallback (quirk pinned)', makeFeature({ type: 'passive_immunity', conditionImmunity: 'noncharmed' }), 'charmed', true],
      ['land_resistance stored mixed-case', makeFeature({ type: 'land_resistance', conditionImmunity: 'Charmed' }), 'charmed', true],
      ['land_resistance without conditionImmunity', makeFeature({ type: 'land_resistance' }), 'charmed', false],
      ['near-miss: immunity covers another condition', makeFeature({ type: 'passive_immunity', conditionImmunity: 'frightened' }), 'charmed', false],
      ['non-immunity automation types ignored', makeFeature({ type: 'passive_rule', effect: 'end_of_turn_condition_removal' }), 'charmed', false],
    ]
    for (const [, feature, conditionKey, expected] of rows) {
      playerStats.allFeatures = [feature]
      expect(playerIsImmuneToCondition({ conditionKey, playerStats })).toBe(expected)
    }
  })

  it('matches damageResistance under the damage: prefix, case-insensitively', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'passive_immunity',
      damageResistance: ['Fire', 'cold'],
    })]
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:fire', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:COLD', playerStats })).toBe(true)
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:lightning', playerStats })).toBe(false)
    expect(playerIsImmuneToCondition({ conditionKey: 'damage:', playerStats })).toBe(false)
    // quirk pinned: a bare damage type (no prefix) strips to itself and still matches
    expect(playerIsImmuneToCondition({ conditionKey: 'fire', playerStats })).toBe(true)
  })

  it('gates condition_immunity_while_active on requiresActive via the runtime buff list', () => {
    playerStats.allFeatures = [makeFeature({
      type: 'condition_immunity_while_active',
      immunities: ['frightened'],
      requiresActive: 'bravery',
    })]

    // Buff active → immune
    mockGetRuntimeValue.mockReturnValue([{ name: 'bravery' }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(true)

    // Buff not active → not immune
    mockGetRuntimeValue.mockReturnValue([{ name: 'other_buff' }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(false)

    // Gate requires BOTH getRuntimeValue and campaignName — neither alone consults the runtime
    mockGetRuntimeValue.mockClear()
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, getRuntimeValue: mockGetRuntimeValue,
    })).toBe(false)
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, campaignName: 'TestCampaign',
    })).toBe(false)
    expect(mockGetRuntimeValue).not.toHaveBeenCalled()
  })

  it('grants immunity from activeBuffs conditionImmunity arrays only (e.g., Feign Death)', () => {
    mockGetRuntimeValue.mockReturnValue([{ name: 'feign_death', conditionImmunity: ['dead', 'poisoned'] }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'poisoned', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(true)
    expect(playerIsImmuneToCondition({
      conditionKey: 'Poisoned', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(true)
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(false)

    // Non-array conditionImmunity on a buff entry never matches
    mockGetRuntimeValue.mockReturnValue([{ name: 'feign_death', conditionImmunity: 'poisoned' }])
    expect(playerIsImmuneToCondition({
      conditionKey: 'poisoned', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(false)

    // Null / non-array runtime payloads pass through harmlessly
    mockGetRuntimeValue.mockReturnValue(null)
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(false)
    mockGetRuntimeValue.mockReturnValue('not-an-array')
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed', playerStats, getRuntimeValue: mockGetRuntimeValue, campaignName: 'TestCampaign',
    })).toBe(false)
  })

  it('matches the auraImmunities channel case-insensitively when supplied (CLA-019)', () => {
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, auraImmunities: ['Frightened'],
    })).toBe(true)
    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed', playerStats, auraImmunities: ['Frightened'],
    })).toBe(false)
    // Non-array channel value falls through the gate
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, auraImmunities: 'frightened',
    })).toBe(false)
  })

  it('blocks charmed/frightened from warded creature types while Protection from Evil and Good is active', () => {
    pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(true)
    pfeg.isCreatureWarded.mockReturnValue(true)

    expect(playerIsImmuneToCondition({
      conditionKey: 'charmed', playerStats, campaignName: 'TestCampaign', sourceCreatureType: 'fiend',
    })).toBe(true)
    expect(playerIsImmuneToCondition({
      conditionKey: 'frightened', playerStats, campaignName: 'TestCampaign', sourceCreatureType: 'aberration',
    })).toBe(true)
    expect(pfeg.isCreatureWarded).toHaveBeenCalledWith('fiend', 'TestCharacter', 'TestCampaign')
  })

  it('does not apply the ward when its guard conditions fail', () => {
    const rows = [
      ['ward membership check fails', true, false, 'charmed', 'aberration'],
      ['condition is not wardable (poisoned)', true, true, 'poisoned', 'fiend'],
      ['no sourceCreatureType', true, true, 'charmed', undefined],
      ['empty sourceCreatureType', true, true, 'charmed', ''],
      ['spell not active', false, true, 'charmed', 'fiend'],
    ]
    for (const [, spellActive, warded, conditionKey, sourceCreatureType] of rows) {
      pfeg.isProtectionFromEvilAndGoodActive.mockReturnValue(spellActive)
      pfeg.isCreatureWarded.mockReturnValue(warded)
      expect(playerIsImmuneToCondition({
        conditionKey, playerStats, campaignName: 'TestCampaign', sourceCreatureType,
      })).toBe(false)
    }
  })
})

// ── hasSelfRestoration ────────────────────────────────────────────

describe('hasSelfRestoration', () => {
  it('returns false without playerStats, without features, or without a matching automation', () => {
    expect(hasSelfRestoration(null)).toBe(false)
    expect(hasSelfRestoration({ name: 'Test' })).toBe(false)
    expect(hasSelfRestoration({ name: 'Test', allFeatures: [] })).toBe(false)
    expect(hasSelfRestoration({
      name: 'Test',
      allFeatures: [
        makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Magic Resistance'),
        makeFeature({ type: 'passive_rule', effect: 'some_other_effect' }, 'Wrong Effect'),
      ],
    })).toBe(false)
  })

  it('returns true when any automation declares end_of_turn_condition_removal (single, mixed, or array)', () => {
    const removal = { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['charmed'] }
    expect(hasSelfRestoration({
      name: 'Test', allFeatures: [makeFeature(removal, 'Self-Restoration')],
    })).toBe(true)
    expect(hasSelfRestoration({
      name: 'Test',
      allFeatures: [
        makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Magic Resistance'),
        makeFeature(removal, 'Self-Restoration'),
      ],
    })).toBe(true)
    expect(hasSelfRestoration({
      name: 'Test',
      allFeatures: [makeFeature([
        removal,
        { type: 'passive_immunity', conditionImmunity: 'charmed' },
      ], 'Dual Feature')],
    })).toBe(true)
  })
})
