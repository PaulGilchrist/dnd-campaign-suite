// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasPassiveEffect,
  getPassiveBuffs,
  collectWeaponMastery,
  resolveHealingBonuses,
  hasHealingMaximization,
  hasRerollHealingOnes,
  hasTacticalShift,
  hasSpeedyOpportunityDisadvantage,
  hasSpeedyDifficultTerrainIgnore,
  isResistantToDamageType,
  hasIgnoreResistance,
  hasMinDamage,
  getDamageResistances,
  isResilientSphereActive,
  getResilientSphereSource,
  hasGreatWeaponFighting,
  applyGreatWeaponFightingToDamage,
  getDamageReduction,
} from './automationPassives.js'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('../../rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}))

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((_abilities, abilityName) => {
    const map = { strength: 3, dexterity: 2, constitution: 1, intelligence: 0, wisdom: -1, charisma: 0 }
    return map[abilityName?.toLowerCase()] ?? 0
  }),
}))

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(),
}))

vi.mock('./automationInfoBuilder.js', () => ({
  buildAttackInfo: vi.fn(),
}))

vi.mock('../../rules/core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn(),
}))

// ── Imports for mocked modules ─────────────────────────────────────

import { parseMagicItemName } from '../../rules/core/attackCalc.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getChosenRuntimeValue } from '../../automation/common/choiceStorage.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { applyGreatWeaponFighting } from '../../rules/core/greatWeaponFighting.js'

// ── hasPassiveEffect ──────────────────────────────────────────────

describe('hasPassiveEffect', () => {
  it('returns true when matching passive exists', () => {
    const playerStats = {
      automation: {
        passives: [{ type: 'passive_rule', effect: 'superior_dice' }],
      },
    }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(true)
  })

  it('returns false when no automation object', () => {
    expect(hasPassiveEffect({}, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when passives is null or empty', () => {
    expect(hasPassiveEffect({ automation: { passives: null } }, 'passive_rule', 'superior_dice')).toBe(false)
    expect(hasPassiveEffect({ automation: { passives: [] } }, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when type or effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'other' }] } }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns true when multiple passives and one matches', () => {
    const playerStats = {
      automation: {
        passives: [
          { type: 'passive_buff', effect: 'blindsight' },
          { type: 'passive_rule', effect: 'superior_dice' },
          { type: 'passive_immunity', effect: 'fire' },
        ],
      },
    }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(true)
  })
})

// ── Wrapper helpers delegate to hasPassiveEffect ──────────────────

describe('wrapper helpers (haveHealingMaximization, hasRerollHealingOnes, hasTacticalShift, hasSpeedyOpportunityDisadvantage, hasSpeedyDifficultTerrainIgnore, hasGreatWeaponFighting)', () => {
  it('returns true when their respective passive exists', () => {
    const makePS = (effect) => ({ automation: { passives: [{ type: 'passive_rule', effect }] } })

    expect(hasHealingMaximization(makePS('maximize_healing_dice'))).toBe(true)
    expect(hasRerollHealingOnes(makePS('reroll_healing_ones'))).toBe(true)
    expect(hasTacticalShift(makePS('tactical_shift_no_oa'))).toBe(true)
    expect(hasSpeedyOpportunityDisadvantage(makePS('opportunity_attacks_disadvantage'))).toBe(true)
    expect(hasSpeedyDifficultTerrainIgnore(makePS('ignore_difficult_terrain_on_dash'))).toBe(true)
    expect(hasGreatWeaponFighting(makePS('great_weapon_fighting'))).toBe(true)
  })

  it('returns false when the respective passive is absent', () => {
    const ps = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasHealingMaximization(ps)).toBe(false)
    expect(hasRerollHealingOnes(ps)).toBe(false)
    expect(hasTacticalShift(ps)).toBe(false)
    expect(hasSpeedyOpportunityDisadvantage(ps)).toBe(false)
    expect(hasSpeedyDifficultTerrainIgnore(ps)).toBe(false)
    expect(hasGreatWeaponFighting(ps)).toBe(false)
  })
})

// ── getPassiveBuffs ───────────────────────────────────────────────

describe('getPassiveBuffs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when features is null, undefined, or empty', () => {
    expect(getPassiveBuffs(null, {})).toEqual([])
    expect(getPassiveBuffs(undefined, {})).toEqual([])
    expect(getPassiveBuffs([], {})).toEqual([])
  })

  it('skips features without automation or with falsy automation', () => {
    const features = [{ name: 'No Automation' }, { name: 'Test', automation: null }]
    expect(getPassiveBuffs(features, {})).toEqual([])
    expect(buildAttackInfo).not.toHaveBeenCalled()
  })

  it('collects passive_buff, passive_rule, and passive_immunity types', () => {
    buildAttackInfo.mockImplementation(({ automation }) => ({
      type: automation.type || 'passive_buff',
      effect: 'test',
    }))
    const features = [
      { name: 'Test', automation: { type: 'passive_buff' } },
      { name: 'Test', automation: { type: 'passive_rule' } },
      { name: 'Test', automation: { type: 'passive_immunity' } },
    ]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(3)
  })

  it('skips features with non-matching automation types', () => {
    buildAttackInfo.mockReturnValue({ type: 'action_attack', effect: 'test' })
    const features = [{ name: 'Test', automation: { type: 'action_attack' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(0)
  })

  it('handles array of automations on a single feature', () => {
    buildAttackInfo
      .mockReturnValueOnce({ type: 'passive_buff', effect: 'first' })
      .mockReturnValueOnce({ type: 'passive_rule', effect: 'second' })
    const features = [{ name: 'Test', automation: [{ type: 'passive_buff' }, { type: 'passive_rule' }] }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(2)
    expect(result.map(r => r.effect)).toEqual(['first', 'second'])
  })

  it('skips automation entries that return null from buildAttackInfo', () => {
    buildAttackInfo.mockReturnValue(null)
    const features = [{ name: 'Test', automation: { type: 'passive_buff' } }]
    expect(getPassiveBuffs(features, {})).toEqual([])
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────

describe('collectWeaponMastery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns baseMastery from weapon when character has weapon_kind_mastery', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Longsword'])
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ type: 'weapon_kind_mastery' }] },
    }
    const result = collectWeaponMastery('+1 Longsword', playerStats)
    expect(parseMagicItemName).toHaveBeenCalledWith('+1 Longsword')
    expect(result).toEqual({ baseMastery: 'push', extraMasteries: [], replaceMasteryOptions: null, choiceMasteries: null })
  })

  it('returns null baseMastery when weapon not found or kind mastery does not match', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Unknown Weapon', magicBonus: 0 })
    const playerStats = {
      equipment: [],
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('Unknown Weapon', playerStats)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('collects extraMasteries and deduplicates them', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Longsword'])
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: {
        passives: [
          { type: 'weapon_kind_mastery' },
          { extraMastery: ['topple', 'push'] },
          { extraMastery: ['push'] },
        ],
      },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result).toEqual({ baseMastery: 'push', extraMasteries: ['topple', 'push'], replaceMasteryOptions: null, choiceMasteries: null })
  })

  it('collects extraMastery from Battering Roots-style passive (push and topple)', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Greataxe', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Greataxe'])
    const playerStats = {
      equipment: [{ name: 'Greataxe', mastery: 'vex' }],
      automation: {
        passives: [
          { type: 'weapon_kind_mastery' },
          {
            name: 'Battering Roots',
            type: 'passive_buff',
            effect: 'extra_reach',
            extraMastery: ['Push', 'Topple'],
          },
        ],
      },
    }
    const result = collectWeaponMastery('Greataxe', playerStats)
    expect(result.baseMastery).toBe('vex')
    expect(result.choiceMasteries).toEqual(['Push', 'Topple'])
    expect(result.extraMasteries).toEqual([])
    expect(result.replaceMasteryOptions).toEqual(['Push', 'Topple'])
  })

  it('adds replaceMastery to replaceMasteryOptions without clearing baseMastery', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Longsword'])
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ replaceMastery: ['topple', 'shove'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result).toEqual({ baseMastery: 'push', extraMasteries: [], replaceMasteryOptions: ['topple', 'shove'], choiceMasteries: null })
  })

  it('handles null passives, equipment, or automation', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    expect(collectWeaponMastery('Longsword', { equipment: [{ name: 'Longsword', mastery: 'push' }], automation: { passives: null } }).baseMastery).toBeNull()
    expect(collectWeaponMastery('Longsword', { equipment: null, automation: { passives: [] } }).baseMastery).toBeNull()
    expect(collectWeaponMastery('Longsword', { equipment: [{ name: 'Longsword', mastery: 'push' }], automation: null }).baseMastery).toBeNull()
  })

  it('collects mastery from weapon_mastery_choice with matching chosen value', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    getChosenRuntimeValue.mockImplementation((_ps, name, field) => {
      if (field === 'chosenMastery') return 'push'
      return undefined
    })
    const playerStats = {
      equipment: [{ name: 'Longsword' }],
      automation: {
        passives: [{ type: 'weapon_mastery_choice', name: 'mastery_choice', masteryProperties: ['push', 'topple'] }],
      },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.extraMasteries).toContain('push')
    expect(result.baseMastery).toBeNull()
  })

  it('combines extraMastery, replaceMastery, and weapon_mastery_choice', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    getChosenRuntimeValue.mockImplementation((_ps, _name, field) => {
      if (field === 'chosenMastery') return 'topple'
      return undefined
    })
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: {
        passives: [
          { extraMastery: ['shove'] },
          { replaceMastery: ['trip'] },
          { type: 'weapon_mastery_choice', name: 'mc', masteryProperties: ['topple', 'shove'] },
        ],
      },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual(expect.arrayContaining(['shove', 'topple']))
    expect(result.replaceMasteryOptions).toEqual(['trip'])
  })

  it('returns null baseMastery when weapon_kind_mastery has meleeOnly=true and weapon is ranged or has no weapon_range', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longbow', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Longbow'])
    const playerStats = {
      equipment: [{ name: 'Longbow', mastery: 'range', weapon_range: 'Ranged' }],
      automation: { passives: [{ type: 'weapon_kind_mastery', meleeOnly: true }] },
    }
    expect(collectWeaponMastery('Longbow', playerStats).baseMastery).toBeNull()

    parseMagicItemName.mockReturnValue({ baseName: 'Dagger', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Dagger'])
    const noRangeStats = {
      equipment: [{ name: 'Dagger', mastery: 'push' }],
      automation: { passives: [{ type: 'weapon_kind_mastery', meleeOnly: true }] },
    }
    expect(collectWeaponMastery('Dagger', noRangeStats).baseMastery).toBeNull()
  })

  it('returns baseMastery when weapon_kind_mastery has meleeOnly=true and weapon is melee', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Shortsword', magicBonus: 0 })
    getRuntimeValue.mockReturnValue(['Shortsword'])
    const playerStats = {
      equipment: [{ name: 'Shortsword', mastery: 'push', weapon_range: 'Melee' }],
      automation: { passives: [{ type: 'weapon_kind_mastery', meleeOnly: true }] },
    }
    expect(collectWeaponMastery('Shortsword', playerStats).baseMastery).toBe('push')
  })
})

// ── resolveHealingBonuses ─────────────────────────────────────────

describe('resolveHealingBonuses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 0 when no passives or passives is null or automation is null', () => {
    expect(resolveHealingBonuses({ automation: { passives: [] } }, 4, 3, 1)).toBe(0)
    expect(resolveHealingBonuses({ automation: { passives: null } }, 4, 3, 1)).toBe(0)
    expect(resolveHealingBonuses({ automation: null }, 4, 3, 1)).toBe(0)
  })

  it('evaluates bonus_healing and max_hp_increase expressions', () => {
    evaluateAutoExpression.mockImplementation((expr) => (expr === '2 + 3' ? 5 : 2))
    const playerStats = {
      automation: { passives: [
        { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2 + 3' },
        { type: 'passive_rule', effect: 'max_hp_increase', alsoSelfHealing: { extraHealingExpression: '1 + 1' } },
      ] },
    }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(7)
  })

  it('skips non-matching passive types, missing expressions, and NaN/non-number results', () => {
    evaluateAutoExpression.mockReturnValue(NaN)
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'abc' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)

    evaluateAutoExpression.mockReturnValue('not a number')
    const nonNumberStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'x' }] } }
    expect(resolveHealingBonuses(nonNumberStats, 4, 3, 1)).toBe(0)

    evaluateAutoExpression.mockReturnValue(0)
    const noExprStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing' }] } }
    expect(resolveHealingBonuses(noExprStats, 4, 3, 1)).toBe(0)
  })

  it('skips non-matching passive types', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
    expect(evaluateAutoExpression).not.toHaveBeenCalled()
  })
})

// ── isResistantToDamageType ───────────────────────────────────────

describe('isResistantToDamageType', () => {
  it('returns true when damage type is in resistance list (case-insensitive)', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: ['Fire', 'COLD'] }] } }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(true)
    expect(isResistantToDamageType(playerStats, 'cOLD')).toBe(true)
  })

  it('returns false when damage type is not in resistance list', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] } }
    expect(isResistantToDamageType(playerStats, 'lightning')).toBe(false)
  })

  it('returns false when no passives, no damageResistance array, or damageResistance is not an array', () => {
    expect(isResistantToDamageType({ automation: { passives: [] } }, 'fire')).toBe(false)
    expect(isResistantToDamageType({ automation: { passives: [{ type: 'passive_immunity' }] } }, 'fire')).toBe(false)
    expect(isResistantToDamageType({ automation: { passives: [{ type: 'passive_immunity', damageResistance: 'fire' }] } }, 'fire')).toBe(false)
  })

  it('handles null automation', () => {
    expect(isResistantToDamageType({ automation: null }, 'fire')).toBe(false)
  })
})

// ── hasIgnoreResistance ───────────────────────────────────────────

describe('hasIgnoreResistance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when damageTypes array is empty (all types) or not provided', () => {
    const allTypes = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: [] }] } }
    expect(hasIgnoreResistance(allTypes, 'fire')).toBe(true)

    const noField = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance' }] } }
    expect(hasIgnoreResistance(noField, 'any')).toBe(true)
  })

  it('returns true when damage type matches (case-insensitive)', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['Fire', 'Cold'] }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
    expect(hasIgnoreResistance(playerStats, 'COLD')).toBe(true)
  })

  it('returns false when damage type does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire', 'cold'] }] } }
    expect(hasIgnoreResistance(playerStats, 'lightning')).toBe(false)
  })

  it('returns true for elemental_adept with matching chosen type (case-insensitive)', () => {
    getChosenRuntimeValue.mockReturnValue('Fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns false for elemental_adept with non-matching chosen value or no chosen value', () => {
    getChosenRuntimeValue.mockReturnValue('cold')
    const mismatch = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }
    expect(hasIgnoreResistance(mismatch, 'fire')).toBe(false)

    getChosenRuntimeValue.mockReturnValue(undefined)
    const noValue = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }
    expect(hasIgnoreResistance(noValue, 'fire')).toBe(false)
  })

  it('returns false when no matching passives', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(false)
  })

  it('handles null automation', () => {
    expect(hasIgnoreResistance({ automation: null }, 'fire')).toBe(false)
  })
})

// ── hasMinDamage ──────────────────────────────────────────────────

describe('hasMinDamage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true for elemental_adept with matching chosen type and minDamage set', () => {
    getChosenRuntimeValue.mockReturnValue('fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(true)
  })

  it('returns false when minDamage is not set, explicitly false, or chosen type does not match', () => {
    getChosenRuntimeValue.mockReturnValue('fire')
    expect(hasMinDamage({ automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }, 'fire')).toBe(false)
    expect(hasMinDamage({ automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: false }] } }, 'fire')).toBe(false)

    getChosenRuntimeValue.mockReturnValue('cold')
    expect(hasMinDamage({ automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }, 'fire')).toBe(false)
  })

  it('returns false for non-elemental_adept damage_type_choice even with minDamage', () => {
    getChosenRuntimeValue.mockReturnValue('fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_affinity', name: 'ea', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })

  it('returns false when no passives or elemental_adept has no chosen value', () => {
    expect(hasMinDamage({ automation: { passives: [] } }, 'fire')).toBe(false)

    getChosenRuntimeValue.mockReturnValue(undefined)
    expect(hasMinDamage({ automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }, 'fire')).toBe(false)
  })
})

// ── getDamageResistances ──────────────────────────────────────────

describe('getDamageResistances', () => {
  it('collects and deduplicates damage resistances from passive_immunity', () => {
    const playerStats = { automation: { passives: [
      { type: 'passive_immunity', damageResistance: ['fire', 'cold'] },
      { type: 'passive_immunity', damageResistance: ['fire', 'lightning'] },
    ] } }
    expect(getDamageResistances(playerStats)).toEqual(['fire', 'cold', 'lightning'])
  })

  it('returns empty array when no passives, no damageResistance, or non-passive_immunity types', () => {
    expect(getDamageResistances({ automation: { passives: [] } })).toEqual([])
    expect(getDamageResistances({ automation: { passives: [{ type: 'passive_immunity' }] } })).toEqual([])
    expect(getDamageResistances({ automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } })).toEqual([])
  })

  it('handles null automation', () => {
    expect(getDamageResistances({ automation: null })).toEqual([])
  })
})

// ── isResilientSphereActive / getResilientSphereSource ────────────

describe('isResilientSphereActive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when resilient_sphere buff is active for the character', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'resilient_sphere', sourceCharacter: 'Ally' }])
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(true)
  })

  it('returns false when buff is absent, empty, null, or undefined', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'other_buff' }])
    expect(isResilientSphereActive('OtherCharacter', 'test-campaign')).toBe(false)

    getRuntimeValue.mockReturnValue([])
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(false)

    getRuntimeValue.mockReturnValue(null)
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(false)

    getRuntimeValue.mockReturnValue(undefined)
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(false)
  })
})

describe('getResilientSphereSource', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the source character name', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'resilient_sphere', sourceCharacter: 'Ally' }])
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBe('Ally')
  })

  it('returns null when resilient_sphere buff is not active, has no sourceCharacter, or activeBuffs is null', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'other_buff' }])
    expect(getResilientSphereSource('OtherCharacter', 'test-campaign')).toBeNull()

    getRuntimeValue.mockReturnValue([{ effect: 'resilient_sphere' }])
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBeNull()

    getRuntimeValue.mockReturnValue(null)
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBeNull()
  })
})

// ── applyGreatWeaponFightingToDamage ──────────────────────────────

describe('applyGreatWeaponFightingToDamage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters out 1s when great_weapon_fighting is active', () => {
    applyGreatWeaponFighting.mockImplementation((rolls) => rolls.filter(r => r > 1))
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    const rolls = [1, 3, 1, 5, 2]
    const result = applyGreatWeaponFightingToDamage(rolls, playerStats)
    expect(result).toEqual([3, 5, 2])
    expect(applyGreatWeaponFighting).toHaveBeenCalledWith(rolls)
  })

  it('returns rolls unchanged when great_weapon_fighting is not active', () => {
    const playerStats = { automation: { passives: [] } }
    const rolls = [1, 3, 5]
    const result = applyGreatWeaponFightingToDamage(rolls, playerStats)
    expect(result).toEqual([1, 3, 5])
    expect(applyGreatWeaponFighting).not.toHaveBeenCalled()
  })
})

// ── getDamageReduction ────────────────────────────────────────────

describe('getDamageReduction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when playerStats is null, has no automation, or no matching passives', () => {
    expect(getDamageReduction(null, 'fire', false)).toBeNull()
    expect(getDamageReduction({ automation: {} }, 'fire', false)).toBeNull()
    expect(getDamageReduction({ automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }, 'fire', false)).toBeNull()
  })

  it('collects and sums damage_reduction from passives, reactions, and specialActions', () => {
    const playerStats = { automation: {
      passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 }],
      reactions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 }],
      specialActions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 1 }],
    }}
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(6)
  })

  it('skips damage_reduction with reaction flag, zero/negative reduction, or non-matching damage type', () => {
    expect(getDamageReduction({ automation: { passives: [{ type: 'damage_reduction', reaction: true, damageTypes: ['fire'], reduction: 5 }] } }, 'fire', false)).toBeNull()
    expect(getDamageReduction({ automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 0 }] } }, 'fire', false)).toBeNull()
    expect(getDamageReduction({ automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: -3 }] } }, 'fire', false)).toBeNull()
    expect(getDamageReduction({ automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] } }, 'cold', false)).toBeNull()
  })

  it('matches when damageTypes is empty or absent (all types)', () => {
    expect(getDamageReduction({ automation: { passives: [{ type: 'damage_reduction', damageTypes: [], reduction: 3 }] } }, 'fire', false)).toBe(3)
    expect(getDamageReduction({ automation: { passives: [{ type: 'damage_reduction', reduction: 4 }] } }, 'fire', false)).toBe(4)
  })

  it('respects wearing_heavy_armor and trigger conditions', () => {
    const withCondition = { automation: { passives: [{ type: 'damage_reduction', damageTypes: [], reduction: 5, condition: 'wearing_heavy_armor' }] } }
    expect(getDamageReduction(withCondition, 'fire', true)).toBe(5)
    expect(getDamageReduction(withCondition, 'fire', false)).toBeNull()
  })

  it('respects damage_taken_of_chosen_resistance_type trigger', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'resistanceChosenDamageType') return 'fire'
      if (key === 'resistanceUsedThisTurn') return false
      return undefined
    })
    const ps = {
      name: 'TestChar',
      campaignName: 'test-campaign',
      automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5, trigger: 'damage_taken_of_chosen_resistance_type' }] },
    }
    expect(getDamageReduction(ps, 'fire', false)).toBe(5)

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'resistanceChosenDamageType') return 'cold'
      return undefined
    })
    expect(getDamageReduction(ps, 'fire', false)).toBeNull()

    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'resistanceChosenDamageType') return 'fire'
      if (key === 'resistanceUsedThisTurn') return true
      return undefined
    })
    expect(getDamageReduction(ps, 'fire', false)).toBeNull()
  })

  it('handles reductionExpression string values', () => {
    evaluateAutoExpression.mockReturnValue(7)
    const ps = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '3 + 4' }] } }
    expect(getDamageReduction(ps, 'fire', false)).toBe(7)

    evaluateAutoExpression.mockReturnValue(100)
    const both = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5, reductionExpression: '100' }] } }
    expect(getDamageReduction(both, 'fire', false)).toBe(5)

    evaluateAutoExpression.mockReturnValue(3)
    const separate = { automation: { passives: [
      { type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 },
      { type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '1 + 2' },
    ] } }
    expect(getDamageReduction(separate, 'fire', false)).toBe(8)

    const emptyExpr = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '' }] } }
    expect(getDamageReduction(emptyExpr, 'fire', false)).toBeNull()

    const undefinedBoth = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'] }] } }
    expect(getDamageReduction(undefinedBoth, 'fire', false)).toBeNull()
  })

  it('is case-insensitive for damage types', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['Fire'], reduction: 5 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('handles null damageTypes (defaults to all types)', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', reduction: 2 }] } }
    expect(getDamageReduction(playerStats, 'any-type', false)).toBe(2)
  })
})
