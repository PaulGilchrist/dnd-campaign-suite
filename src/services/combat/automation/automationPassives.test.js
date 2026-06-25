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
  hasBlindsight,
  hasTruesight,
  hasFastWrestler,
  hasGreatWeaponFighting,
  hasTwoWeaponFighting,
  hasSomaticComponentWaiver,
  hasNaturallyStealthy,
  applyGreatWeaponFightingToDamage,
  getDamageReduction,
} from './automationPassives.js'

// ── Mocks with controllable mocks (not static closures) ───────────

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

// ── Imports for mocked modules (needed to call vi.mocked() / mockReturnValue etc.) ─

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

  it('returns false when passives is null', () => {
    expect(hasPassiveEffect({ automation: { passives: null } }, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when passives is empty', () => {
    expect(hasPassiveEffect({ automation: { passives: [] } }, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when type does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'superior_dice' }] } }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
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

// ── getPassiveBuffs ───────────────────────────────────────────────

describe('getPassiveBuffs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when features is null', () => {
    expect(getPassiveBuffs(null, {})).toEqual([])
  })

  it('returns empty array when features is undefined', () => {
    expect(getPassiveBuffs(undefined, {})).toEqual([])
  })

  it('returns empty array when features is empty', () => {
    expect(getPassiveBuffs([], {})).toEqual([])
  })

  it('skips features without automation', () => {
    buildAttackInfo.mockReturnValue({ type: 'passive_buff', effect: 'test' })
    const features = [{ name: 'No Automation' }]
    expect(getPassiveBuffs(features, {})).toEqual([])
    expect(buildAttackInfo).not.toHaveBeenCalled()
  })

  it('skips features with falsy automation', () => {
    const features = [{ name: 'Test', automation: null }]
    expect(getPassiveBuffs(features, {})).toEqual([])
  })

  it('collects passive_buff type from feature', () => {
    buildAttackInfo.mockReturnValue({ type: 'passive_buff', effect: 'test' })
    const features = [{ name: 'Test', automation: { type: 'passive_buff' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_buff')
  })

  it('collects passive_rule type from feature', () => {
    buildAttackInfo.mockReturnValue({ type: 'passive_rule', effect: 'test' })
    const features = [{ name: 'Test', automation: { type: 'passive_rule' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('collects passive_immunity type from feature', () => {
    buildAttackInfo.mockReturnValue({ type: 'passive_immunity', effect: 'test' })
    const features = [{ name: 'Test', automation: { type: 'passive_immunity' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_immunity')
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

  it('deduplicates by collecting all matching automations across features', () => {
    buildAttackInfo
      .mockReturnValueOnce({ type: 'passive_buff', effect: 'buff1' })
      .mockReturnValueOnce({ type: 'passive_buff', effect: 'buff2' })
    const features = [
      { name: 'Feature1', automation: { type: 'passive_buff' } },
      { name: 'Feature2', automation: { type: 'passive_buff' } },
    ]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(2)
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────

describe('collectWeaponMastery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns baseMastery from weapon', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('+1 Longsword', playerStats)
    expect(parseMagicItemName).toHaveBeenCalledWith('+1 Longsword')
    expect(result).toEqual({ baseMastery: 'push', extraMasteries: [] })
  })

  it('returns null baseMastery when weapon not found', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Unknown Weapon', magicBonus: 0 })
    const playerStats = {
      equipment: [],
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('Unknown Weapon', playerStats)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('collects extraMasteries from passives', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ extraMastery: ['topple'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result).toEqual({ baseMastery: 'push', extraMasteries: ['topple'] })
  })

  it('deduplicates extraMasteries', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ extraMastery: ['push', 'topple'] }, { extraMastery: ['push'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.extraMasteries).toEqual(['push', 'topple'])
  })

  it('adds replaceMastery to extraMasteries without clearing baseMastery', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ replaceMastery: ['topple', 'shove'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result).toEqual({ baseMastery: 'push', extraMasteries: ['topple', 'shove'] })
  })

  it('handles null passives array', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: null },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual([])
  })

  it('handles null equipment', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = {
      equipment: null,
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBeNull()
  })

  it('handles null automation', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    const playerStats = { equipment: [{ name: 'Longsword', mastery: 'push' }], automation: null }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual([])
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

  it('skips weapon_mastery_choice when chosen value does not match', () => {
    parseMagicItemName.mockReturnValue({ baseName: 'Longsword', magicBonus: 0 })
    getChosenRuntimeValue.mockImplementation((_ps, _name, field) => {
      if (field === 'chosenMastery') return 'shove'
      return undefined
    })
    const playerStats = {
      equipment: [{ name: 'Longsword' }],
      automation: {
        passives: [{ type: 'weapon_mastery_choice', name: 'mastery_choice', masteryProperties: ['push', 'topple'] }],
      },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.extraMasteries).toHaveLength(0)
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
    // baseMastery is preserved; extraMasteries accumulates from all sources
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual(expect.arrayContaining(['shove', 'trip', 'topple']))
  })
})

// ── resolveHealingBonuses ─────────────────────────────────────────

describe('resolveHealingBonuses', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 0 when no passives', () => {
    expect(resolveHealingBonuses({ automation: { passives: [] } }, 4, 3, 1)).toBe(0)
  })

  it('returns 0 when passives is null', () => {
    expect(resolveHealingBonuses({ automation: { passives: null } }, 4, 3, 1)).toBe(0)
  })

  it('evaluates bonus_healing expression', () => {
    evaluateAutoExpression.mockReturnValue(5)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2 + 3' }] },
    }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(5)
    expect(evaluateAutoExpression).toHaveBeenCalledWith('2 + 3', playerStats, 4, 3, 1)
  })

  it('evaluates max_hp_increase self-healing expression', () => {
    evaluateAutoExpression.mockReturnValue(2)
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', alsoSelfHealing: { extraHealingExpression: '1 + 1' } }] },
    }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(2)
  })

  it('skips non-matching passive types', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
    expect(evaluateAutoExpression).not.toHaveBeenCalled()
  })

  it('sums multiple healing bonuses', () => {
    evaluateAutoExpression.mockImplementation((expr) => (expr === '2 + 3' ? 5 : 2))
    const playerStats = {
      automation: { passives: [
        { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2 + 3' },
        { type: 'passive_rule', effect: 'max_hp_increase', alsoSelfHealing: { extraHealingExpression: '1 + 1' } },
      ] },
    }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(7)
  })

  it('skips expressions that evaluate to NaN', () => {
    evaluateAutoExpression.mockReturnValue(NaN)
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'abc' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
  })

  it('skips expressions that evaluate to non-number', () => {
    evaluateAutoExpression.mockReturnValue('not a number')
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'x' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
  })

  it('skips bonus_healing without bonusExpression', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
    expect(evaluateAutoExpression).not.toHaveBeenCalled()
  })

  it('handles null automation', () => {
    expect(resolveHealingBonuses({ automation: null }, 4, 3, 1)).toBe(0)
  })
})

// ── Boolean-check helper functions (delegate to hasPassiveEffect) ─

describe('hasHealingMaximization', () => {
  it('returns true when passive_rule maximize_healing_dice exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'maximize_healing_dice' }] } }
    expect(hasHealingMaximization(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasHealingMaximization({ automation: { passives: [] } })).toBe(false)
  })

  it('returns false when a different effect exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasHealingMaximization(playerStats)).toBe(false)
  })
})

describe('hasRerollHealingOnes', () => {
  it('returns true when passive_rule reroll_healing_ones exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'reroll_healing_ones' }] } }
    expect(hasRerollHealingOnes(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasRerollHealingOnes({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasTacticalShift', () => {
  it('returns true when passive_rule tactical_shift_no_oa exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'tactical_shift_no_oa' }] } }
    expect(hasTacticalShift(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasTacticalShift({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasSpeedyOpportunityDisadvantage', () => {
  it('returns true when passive_rule opportunity_attacks_disadvantage exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'opportunity_attacks_disadvantage' }] } }
    expect(hasSpeedyOpportunityDisadvantage(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasSpeedyOpportunityDisadvantage({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasSpeedyDifficultTerrainIgnore', () => {
  it('returns true when passive_rule ignore_difficult_terrain_on_dash exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_difficult_terrain_on_dash' }] } }
    expect(hasSpeedyDifficultTerrainIgnore(playerStats)).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(hasSpeedyDifficultTerrainIgnore({ automation: { passives: [] } })).toBe(false)
  })
})

// ── isResistantToDamageType ───────────────────────────────────────

describe('isResistantToDamageType', () => {
  it('returns true when damage type is in resistance list', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] } }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(true)
  })

  it('returns false when damage type is not in resistance list', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] } }
    expect(isResistantToDamageType(playerStats, 'lightning')).toBe(false)
  })

  it('is case-insensitive', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: ['Fire', 'Cold'] }] } }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(true)
    expect(isResistantToDamageType(playerStats, 'COLD')).toBe(true)
  })

  it('returns false when no passives', () => {
    expect(isResistantToDamageType({ automation: { passives: [] } }, 'fire')).toBe(false)
  })

  it('returns false when no damageResistance array', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity' }] } }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(false)
  })

  it('returns false when damageResistance is not an array', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: 'fire' }] } }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(false)
  })

  it('handles null automation', () => {
    expect(isResistantToDamageType({ automation: null }, 'fire')).toBe(false)
  })
})

// ── hasIgnoreResistance ───────────────────────────────────────────

describe('hasIgnoreResistance', () => {
  it('returns true when damageTypes array is empty (all types)', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: [] }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns true when damage type matches', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire', 'cold'] }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns false when damage type does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire', 'cold'] }] } }
    expect(hasIgnoreResistance(playerStats, 'lightning')).toBe(false)
  })

  it('returns true for elemental_adept with matching chosen type', () => {
    getChosenRuntimeValue.mockReturnValue('fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'elemental_adept_choice' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns false for elemental_adept with non-matching chosen type', () => {
    getChosenRuntimeValue.mockReturnValue('cold')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'elemental_adept_choice' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(false)
  })

  it('returns false when no matching passives', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(false)
  })

  it('is case-insensitive for damageTypes array', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['Fire'] }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('is case-insensitive for elemental_adept chosen type', () => {
    getChosenRuntimeValue.mockReturnValue('Fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns false when elemental_adept has no chosen value', () => {
    getChosenRuntimeValue.mockReturnValue(undefined)
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(false)
  })

  it('returns true when ignore_resistance has no damageTypes field', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance' }] } }
    expect(hasIgnoreResistance(playerStats, 'any')).toBe(true)
  })

  it('handles null automation', () => {
    expect(hasIgnoreResistance({ automation: null }, 'fire')).toBe(false)
  })
})

// ── hasMinDamage ──────────────────────────────────────────────────

describe('hasMinDamage', () => {
  it('returns true for elemental_adept with matching chosen type', () => {
    getChosenRuntimeValue.mockReturnValue('fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(true)
  })

  it('returns false when minDamage is not set', () => {
    getChosenRuntimeValue.mockReturnValue('fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec' }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })

  it('returns false for non-matching chosen type', () => {
    getChosenRuntimeValue.mockReturnValue('cold')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })

  it('returns false when no passives', () => {
    expect(hasMinDamage({ automation: { passives: [] } }, 'fire')).toBe(false)
  })

  it('returns false when elemental_adept has no chosen value', () => {
    getChosenRuntimeValue.mockReturnValue(undefined)
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })

  it('is case-insensitive for elemental_adept chosen type', () => {
    getChosenRuntimeValue.mockReturnValue('Fire')
    const playerStats = { automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'ec', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(true)
  })

  it('ignores non-elemental_adept passives', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', minDamage: true }] } }
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })
})

// ── getDamageResistances ──────────────────────────────────────────

describe('getDamageResistances', () => {
  it('collects damage resistances from passive_immunity', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] } }
    expect(getDamageResistances(playerStats)).toEqual(['fire', 'cold'])
  })

  it('deduplicates resistances', () => {
    const playerStats = { automation: { passives: [
      { type: 'passive_immunity', damageResistance: ['fire', 'cold'] },
      { type: 'passive_immunity', damageResistance: ['fire', 'lightning'] },
    ] } }
    expect(getDamageResistances(playerStats)).toEqual(['fire', 'cold', 'lightning'])
  })

  it('returns empty array when no passives', () => {
    expect(getDamageResistances({ automation: { passives: [] } })).toEqual([])
  })

  it('skips non-passive_immunity types', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(getDamageResistances(playerStats)).toEqual([])
  })

  it('skips passive_immunity without damageResistance', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity' }] } }
    expect(getDamageResistances(playerStats)).toEqual([])
  })

  it('handles null automation', () => {
    expect(getDamageResistances({ automation: null })).toEqual([])
  })
})

// ── isResilientSphereActive ───────────────────────────────────────

describe('isResilientSphereActive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when resilient_sphere buff is active', () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'resilient_sphere', sourceCharacter: 'Ally' },
      { effect: 'other_buff' },
    ])
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(true)
  })

  it('returns false when resilient_sphere buff is not active', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'other_buff' }])
    expect(isResilientSphereActive('OtherCharacter', 'test-campaign')).toBe(false)
  })

  it('returns false when activeBuffs is empty', () => {
    getRuntimeValue.mockReturnValue([])
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(false)
  })

  it('returns false when activeBuffs is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(false)
  })

  it('returns false when getRuntimeValue returns undefined', () => {
    getRuntimeValue.mockReturnValue(undefined)
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(false)
  })
})

// ── getResilientSphereSource ──────────────────────────────────────

describe('getResilientSphereSource', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the source character name', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'resilient_sphere', sourceCharacter: 'Ally' }])
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBe('Ally')
  })

  it('returns null when resilient_sphere buff is not active', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'other_buff' }])
    expect(getResilientSphereSource('OtherCharacter', 'test-campaign')).toBeNull()
  })

  it('returns null when no sourceCharacter on buff', () => {
    getRuntimeValue.mockReturnValue([{ effect: 'resilient_sphere' }])
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBeNull()
  })

  it('returns null when activeBuffs is null', () => {
    getRuntimeValue.mockReturnValue(null)
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBeNull()
  })
})

// ── Passive buff checks ───────────────────────────────────────────

describe('hasBlindsight', () => {
  it('returns true when blindsight passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'blindsight' }] } }
    expect(hasBlindsight(playerStats)).toBe(true)
  })
  it('returns false when no blindsight passive', () => {
    expect(hasBlindsight({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasTruesight', () => {
  it('returns true when truesight passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'truesight' }] } }
    expect(hasTruesight(playerStats)).toBe(true)
  })
  it('returns false when no truesight passive', () => {
    expect(hasTruesight({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasFastWrestler', () => {
  it('returns true when fast_wrestler passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'fast_wrestler' }] } }
    expect(hasFastWrestler(playerStats)).toBe(true)
  })
  it('returns false when no fast_wrestler passive', () => {
    expect(hasFastWrestler({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasGreatWeaponFighting', () => {
  it('returns true when great_weapon_fighting passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    expect(hasGreatWeaponFighting(playerStats)).toBe(true)
  })
  it('returns false when no great_weapon_fighting passive', () => {
    expect(hasGreatWeaponFighting({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasTwoWeaponFighting', () => {
  it('returns true when two_weapon_fighting passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'two_weapon_fighting' }] } }
    expect(hasTwoWeaponFighting(playerStats)).toBe(true)
  })
  it('returns false when no two_weapon_fighting passive', () => {
    expect(hasTwoWeaponFighting({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasSomaticComponentWaiver', () => {
  it('returns true when somatic_component_waiver passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'somatic_component_waiver' }] } }
    expect(hasSomaticComponentWaiver(playerStats)).toBe(true)
  })
  it('returns false when no somatic_component_waiver passive', () => {
    expect(hasSomaticComponentWaiver({ automation: { passives: [] } })).toBe(false)
  })
})

describe('hasNaturallyStealthy', () => {
  it('returns true when naturally_stealthy passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'naturally_stealthy' }] } }
    expect(hasNaturallyStealthy(playerStats)).toBe(true)
  })
  it('returns false when no naturally_stealthy passive', () => {
    expect(hasNaturallyStealthy({ automation: { passives: [] } })).toBe(false)
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

  it('returns empty array when all rolls are 1s and great_weapon_fighting is active', () => {
    applyGreatWeaponFighting.mockReturnValue([])
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    const rolls = [1, 1, 1]
    const result = applyGreatWeaponFightingToDamage(rolls, playerStats)
    expect(result).toEqual([])
  })

  it('returns the mock result from applyGreatWeaponFighting', () => {
    applyGreatWeaponFighting.mockReturnValue([4, 6])
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    const result = applyGreatWeaponFightingToDamage([1, 4, 1, 6], playerStats)
    expect(result).toEqual([4, 6])
  })
})

// ── getDamageReduction ────────────────────────────────────────────

describe('getDamageReduction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when playerStats is null', () => {
    expect(getDamageReduction(null, 'fire', false)).toBeNull()
  })

  it('returns null when no matching passives', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('returns null when no reactions or specialActions', () => {
    const playerStats = { automation: {} }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('collects damage_reduction from passives', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('skips damage_reduction with reaction flag', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', reaction: true, damageTypes: ['fire'], reduction: 5 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('returns null when damage type does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] } }
    expect(getDamageReduction(playerStats, 'cold', false)).toBeNull()
  })

  it('matches when damageTypes is empty (all types)', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: [], reduction: 3 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(3)
  })

  it('respects wearing_heavy_armor condition', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: [], reduction: 5, condition: 'wearing_heavy_armor' }] } }
    expect(getDamageReduction(playerStats, 'fire', true)).toBe(5)
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('collects from reactions', () => {
    const playerStats = { automation: { reactions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(3)
  })

  it('collects from specialActions', () => {
    const playerStats = { automation: { specialActions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(2)
  })

  it('sums multiple damage reductions', () => {
    const playerStats = { automation: { passives: [
      { type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 },
      { type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 },
    ] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('is case-insensitive for damage types', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['Fire'], reduction: 5 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('skips damage_reduction with wrong damage type', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] } }
    expect(getDamageReduction(playerStats, 'cold', false)).toBeNull()
  })

  it('handles null damageTypes (defaults to all types)', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', reduction: 4 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(4)
  })

  it('skips damage_reduction with zero reduction', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 0 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('skips damage_reduction with negative reduction', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: -3 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('uses reductionExpression string value', () => {
    evaluateAutoExpression.mockReturnValue(7)
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '3 + 4' }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(7)
    expect(evaluateAutoExpression).toHaveBeenCalledWith('3 + 4', expect.any(Object))
  })

  it('prefers reduction over reductionExpression when both are numbers', () => {
    evaluateAutoExpression.mockReturnValue(100)
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5, reductionExpression: '100' }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('sums reduction and reductionExpression from separate automations', () => {
    evaluateAutoExpression.mockReturnValue(3)
    const playerStats = { automation: { passives: [
      { type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 },
      { type: 'damage_reduction', damageTypes: ['fire'], reductionExpression: '1 + 2' },
    ] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(8)
  })

  it('handles damage_reduction without damageTypes (all types)', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', reduction: 2 }] } }
    expect(getDamageReduction(playerStats, 'any-type', false)).toBe(2)
  })

  it('skips damage_reduction with non-matching condition', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5, condition: 'wearing_heavy_armor' }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('returns null when no automation object', () => {
    const playerStats = {}
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('combines passives, reactions, and specialActions', () => {
    const playerStats = { automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 }], reactions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 }], specialActions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 1 }] } }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(6)
  })
})
