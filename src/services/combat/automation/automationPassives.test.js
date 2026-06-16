import { describe, it, expect } from 'vitest'
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

// Mock dependencies
vi.mock('../../rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => {
    if (name && typeof name === 'string' && name.charAt(0) === '+') {
      return { baseName: name.substring(3), magicBonus: Number(name.charAt(1)) }
    }
    return { baseName: name, magicBonus: 0 }
  }),
}))

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((name, key, campaign) => {
    const store = {
      'TestCharacter.activeBuffs.test-campaign': [
        { effect: 'resilient_sphere', sourceCharacter: 'Ally' },
        { effect: 'other_buff' },
      ],
      'TestCharacter.resistanceChosenDamageType.test-campaign': 'fire',
      'TestCharacter.resistanceUsedThisTurn.test-campaign': false,
    }
    return store[`${name}.${key}.${campaign}`]
  }),
}))

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn((playerStats, name, field) => {
    if (field === 'chosenMastery') {
      return 'push'
    }
    if (field === 'chosenType') {
      return 'fire'
    }
    return undefined
  }),
}))

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((_abilities, abilityName) => {
    const map = { strength: 3, dexterity: 2, constitution: 1, intelligence: 0, wisdom: -1, charisma: 0 }
    return map[abilityName?.toLowerCase()] ?? 0
  }),
}))

vi.mock('./automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => {
    if (expr === '2 + 3') return 5
    if (expr === '1 + 1') return 2
    return 0
  }),
}))

vi.mock('./automationInfoBuilder.js', () => ({
  buildAttackInfo: vi.fn((auto) => ({
    type: auto.automation?.type || 'passive_buff',
    effect: auto.automation?.effect || 'test_buff',
    hasAutomation: true,
  })),
}))

vi.mock('../../rules/core/greatWeaponFighting.js', () => ({
  applyGreatWeaponFighting: vi.fn((rolls) => rolls.filter(r => r > 1)),
}))

// ── hasPassiveEffect ──────────────────────────────────────────────

describe('hasPassiveEffect', () => {
  it('returns true when matching passive exists', () => {
    const playerStats = {
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'superior_dice' },
        ],
      },
    }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(true)
  })

  it('returns false when no passives array', () => {
    const playerStats = {}
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when passives array is empty', () => {
    const playerStats = { automation: { passives: [] } }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when type does not match', () => {
    const playerStats = {
      automation: {
        passives: [{ type: 'passive_buff', effect: 'superior_dice' }],
      },
    }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(false)
  })

  it('returns false when effect does not match', () => {
    const playerStats = {
      automation: {
        passives: [{ type: 'passive_rule', effect: 'other_effect' }],
      },
    }
    expect(hasPassiveEffect(playerStats, 'passive_rule', 'superior_dice')).toBe(false)
  })
})

// ── getPassiveBuffs ───────────────────────────────────────────────

describe('getPassiveBuffs', () => {
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
    const features = [{ name: 'No Auto' }]
    expect(getPassiveBuffs(features, {})).toEqual([])
  })

  it('collects passive_buff type from feature', () => {
    const features = [{ name: 'Test', automation: { type: 'passive_buff' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_buff')
  })

  it('collects passive_rule type from feature', () => {
    const features = [{ name: 'Test', automation: { type: 'passive_rule' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('collects passive_immunity type from feature', () => {
    const features = [{ name: 'Test', automation: { type: 'passive_immunity' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_immunity')
  })

  it('skips features with non-matching automation types', () => {
    const features = [{ name: 'Test', automation: { type: 'action_attack' } }]
    const result = getPassiveBuffs(features, {})
    expect(result).toHaveLength(0)
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────

describe('collectWeaponMastery', () => {
  it('returns baseMastery from weapon', () => {
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual([])
  })

  it('returns null baseMastery when weapon not found', () => {
    const playerStats = {
      equipment: [],
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('Unknown Weapon', playerStats)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('collects extraMasteries from passives', () => {
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ extraMastery: ['topple'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual(['topple'])
  })

  it('deduplicates extraMasteries', () => {
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ extraMastery: ['push', 'topple'] }, { extraMastery: ['push'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.extraMasteries).toEqual(['push', 'topple'])
  })

  it('replaces baseMastery when replaceMastery is set', () => {
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: [{ replaceMastery: ['topple', 'shove'] }] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual(['topple', 'shove'])
  })

  it('handles null passives array', () => {
    const playerStats = {
      equipment: [{ name: 'Longsword', mastery: 'push' }],
      automation: { passives: null },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBe('push')
    expect(result.extraMasteries).toEqual([])
  })

  it('handles null equipment', () => {
    const playerStats = {
      equipment: null,
      automation: { passives: [] },
    }
    const result = collectWeaponMastery('Longsword', playerStats)
    expect(result.baseMastery).toBeNull()
  })
})

// ── resolveHealingBonuses ─────────────────────────────────────────

describe('resolveHealingBonuses', () => {
  it('returns 0 when no passives', () => {
    const playerStats = { automation: { passives: [] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
  })

  it('returns 0 when passives is null', () => {
    const playerStats = { automation: { passives: null } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
  })

  it('evaluates bonus_healing expression', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2 + 3' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(5)
  })

  it('evaluates max_hp_increase self-healing expression', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', alsoSelfHealing: { extraHealingExpression: '1 + 1' } }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(2)
  })

  it('skips non-matching passive types', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
  })

  it('sums multiple healing bonuses', () => {
    const playerStats = { automation: { passives: [
      { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2 + 3' },
      { type: 'passive_rule', effect: 'max_hp_increase', alsoSelfHealing: { extraHealingExpression: '1 + 1' } },
    ] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(7)
  })

  it('skips expressions that evaluate to NaN', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'abc' }] } }
    expect(resolveHealingBonuses(playerStats, 4, 3, 1)).toBe(0)
  })
})

// ── hasHealingMaximization ────────────────────────────────────────

describe('hasHealingMaximization', () => {
  it('returns true when passive_rule maximize_healing_dice exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'maximize_healing_dice' }] } }
    expect(hasHealingMaximization(playerStats)).toBe(true)
  })

  it('returns false when effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasHealingMaximization(playerStats)).toBe(false)
  })

  it('returns false when no passives', () => {
    const playerStats = {}
    expect(hasHealingMaximization(playerStats)).toBe(false)
  })
})

// ── hasRerollHealingOnes ──────────────────────────────────────────

describe('hasRerollHealingOnes', () => {
  it('returns true when passive_rule reroll_healing_ones exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'reroll_healing_ones' }] } }
    expect(hasRerollHealingOnes(playerStats)).toBe(true)
  })

  it('returns false when effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasRerollHealingOnes(playerStats)).toBe(false)
  })
})

// ── hasTacticalShift ──────────────────────────────────────────────

describe('hasTacticalShift', () => {
  it('returns true when passive_rule tactical_shift_no_oa exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'tactical_shift_no_oa' }] } }
    expect(hasTacticalShift(playerStats)).toBe(true)
  })

  it('returns false when effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasTacticalShift(playerStats)).toBe(false)
  })
})

// ── hasSpeedyOpportunityDisadvantage ──────────────────────────────

describe('hasSpeedyOpportunityDisadvantage', () => {
  it('returns true when passive_rule opportunity_attacks_disadvantage exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'opportunity_attacks_disadvantage' }] } }
    expect(hasSpeedyOpportunityDisadvantage(playerStats)).toBe(true)
  })

  it('returns false when effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasSpeedyOpportunityDisadvantage(playerStats)).toBe(false)
  })
})

// ── hasSpeedyDifficultTerrainIgnore ───────────────────────────────

describe('hasSpeedyDifficultTerrainIgnore', () => {
  it('returns true when passive_rule ignore_difficult_terrain_on_dash exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'ignore_difficult_terrain_on_dash' }] } }
    expect(hasSpeedyDifficultTerrainIgnore(playerStats)).toBe(true)
  })

  it('returns false when effect does not match', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'other' }] } }
    expect(hasSpeedyDifficultTerrainIgnore(playerStats)).toBe(false)
  })
})

// ── isResistantToDamageType ───────────────────────────────────────

describe('isResistantToDamageType', () => {
  it('returns true when damage type is in resistance list', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] },
    }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(true)
  })

  it('returns false when damage type is not in resistance list', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] },
    }
    expect(isResistantToDamageType(playerStats, 'lightning')).toBe(false)
  })

  it('is case-insensitive', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_immunity', damageResistance: ['Fire', 'Cold'] }] },
    }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(true)
    expect(isResistantToDamageType(playerStats, 'COLD')).toBe(true)
  })

  it('returns false when no passives', () => {
    const playerStats = {}
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(false)
  })

  it('returns false when no damageResistance array', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_immunity' }] } }
    expect(isResistantToDamageType(playerStats, 'fire')).toBe(false)
  })
})

// ── hasIgnoreResistance ───────────────────────────────────────────

describe('hasIgnoreResistance', () => {
  it('returns true when damageTypes array is empty (all types)', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: [] }] },
    }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns true when damage type matches', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire', 'cold'] }] },
    }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns false when damage type does not match', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire', 'cold'] }] },
    }
    expect(hasIgnoreResistance(playerStats, 'lightning')).toBe(false)
  })

  it('returns true for elemental_adept chosen type', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'elemental_adept_choice' }] },
    }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })

  it('returns false when no matching passives', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'test' }] } }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(false)
  })

  it('is case-insensitive', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['Fire'] }] },
    }
    expect(hasIgnoreResistance(playerStats, 'fire')).toBe(true)
  })
})

// ── hasMinDamage ──────────────────────────────────────────────────

describe('hasMinDamage', () => {
  it('returns true for elemental_adept with matching chosen type', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'elemental_adept_choice', minDamage: true }] },
    }
    expect(hasMinDamage(playerStats, 'fire')).toBe(true)
  })

  it('returns false when minDamage is not set', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'elemental_adept_choice' }] },
    }
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })

  it('returns false for non-matching chosen type', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_type_choice', effect: 'elemental_adept', name: 'elemental_adept_choice', minDamage: true }] },
    }
    expect(hasMinDamage(playerStats, 'cold')).toBe(false)
  })

  it('returns false when no passives', () => {
    const playerStats = {}
    expect(hasMinDamage(playerStats, 'fire')).toBe(false)
  })
})

// ── getDamageResistances ──────────────────────────────────────────

describe('getDamageResistances', () => {
  it('collects damage resistances from passive_immunity', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_immunity', damageResistance: ['fire', 'cold'] }] },
    }
    expect(getDamageResistances(playerStats)).toEqual(['fire', 'cold'])
  })

  it('deduplicates resistances', () => {
    const playerStats = {
      automation: { passives: [
        { type: 'passive_immunity', damageResistance: ['fire', 'cold'] },
        { type: 'passive_immunity', damageResistance: ['fire', 'lightning'] },
      ] },
    }
    expect(getDamageResistances(playerStats)).toEqual(['fire', 'cold', 'lightning'])
  })

  it('returns empty array when no passives', () => {
    const playerStats = {}
    expect(getDamageResistances(playerStats)).toEqual([])
  })

  it('skips non-passive_immunity types', () => {
    const playerStats = {
      automation: { passives: [{ type: 'passive_buff', effect: 'test' }] },
    }
    expect(getDamageResistances(playerStats)).toEqual([])
  })
})

// ── isResilientSphereActive ───────────────────────────────────────

describe('isResilientSphereActive', () => {
  it('returns true when resilient_sphere buff is active', () => {
    expect(isResilientSphereActive('TestCharacter', 'test-campaign')).toBe(true)
  })

  it('returns false when resilient_sphere buff is not active', () => {
    expect(isResilientSphereActive('OtherCharacter', 'test-campaign')).toBe(false)
  })
})

// ── getResilientSphereSource ──────────────────────────────────────

describe('getResilientSphereSource', () => {
  it('returns the source character name', () => {
    expect(getResilientSphereSource('TestCharacter', 'test-campaign')).toBe('Ally')
  })

  it('returns null when resilient_sphere buff is not active', () => {
    expect(getResilientSphereSource('OtherCharacter', 'test-campaign')).toBeNull()
  })
})

// ── Passive buff checks ───────────────────────────────────────────

describe('hasBlindsight', () => {
  it('returns true when blindsight passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'blindsight' }] } }
    expect(hasBlindsight(playerStats)).toBe(true)
  })
  it('returns false when no blindsight passive', () => {
    const playerStats = {}
    expect(hasBlindsight(playerStats)).toBe(false)
  })
})

describe('hasTruesight', () => {
  it('returns true when truesight passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'truesight' }] } }
    expect(hasTruesight(playerStats)).toBe(true)
  })
  it('returns false when no truesight passive', () => {
    const playerStats = {}
    expect(hasTruesight(playerStats)).toBe(false)
  })
})

describe('hasFastWrestler', () => {
  it('returns true when fast_wrestler passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'fast_wrestler' }] } }
    expect(hasFastWrestler(playerStats)).toBe(true)
  })
  it('returns false when no fast_wrestler passive', () => {
    const playerStats = {}
    expect(hasFastWrestler(playerStats)).toBe(false)
  })
})

describe('hasGreatWeaponFighting', () => {
  it('returns true when great_weapon_fighting passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    expect(hasGreatWeaponFighting(playerStats)).toBe(true)
  })
  it('returns false when no great_weapon_fighting passive', () => {
    const playerStats = {}
    expect(hasGreatWeaponFighting(playerStats)).toBe(false)
  })
})

describe('hasTwoWeaponFighting', () => {
  it('returns true when two_weapon_fighting passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'two_weapon_fighting' }] } }
    expect(hasTwoWeaponFighting(playerStats)).toBe(true)
  })
  it('returns false when no two_weapon_fighting passive', () => {
    const playerStats = {}
    expect(hasTwoWeaponFighting(playerStats)).toBe(false)
  })
})

describe('hasSomaticComponentWaiver', () => {
  it('returns true when somatic_component_waiver passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_buff', effect: 'somatic_component_waiver' }] } }
    expect(hasSomaticComponentWaiver(playerStats)).toBe(true)
  })
  it('returns false when no somatic_component_waiver passive', () => {
    const playerStats = {}
    expect(hasSomaticComponentWaiver(playerStats)).toBe(false)
  })
})

describe('hasNaturallyStealthy', () => {
  it('returns true when naturally_stealthy passive exists', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'naturally_stealthy' }] } }
    expect(hasNaturallyStealthy(playerStats)).toBe(true)
  })
  it('returns false when no naturally_stealthy passive', () => {
    const playerStats = {}
    expect(hasNaturallyStealthy(playerStats)).toBe(false)
  })
})

// ── applyGreatWeaponFightingToDamage ──────────────────────────────

describe('applyGreatWeaponFightingToDamage', () => {
  it('filters out 1s when great_weapon_fighting is active', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    const rolls = [1, 3, 1, 5, 2]
    const result = applyGreatWeaponFightingToDamage(rolls, playerStats)
    expect(result).toEqual([3, 5, 2])
  })

  it('returns rolls unchanged when great_weapon_fighting is not active', () => {
    const playerStats = { automation: { passives: [] } }
    const rolls = [1, 3, 5]
    const result = applyGreatWeaponFightingToDamage(rolls, playerStats)
    expect(result).toEqual([1, 3, 5])
  })

  it('returns empty array when all rolls are 1s and great_weapon_fighting is active', () => {
    const playerStats = { automation: { passives: [{ type: 'passive_rule', effect: 'great_weapon_fighting' }] } }
    const rolls = [1, 1, 1]
    const result = applyGreatWeaponFightingToDamage(rolls, playerStats)
    expect(result).toEqual([])
  })
})

// ── getDamageReduction ────────────────────────────────────────────

describe('getDamageReduction', () => {
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
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('skips damage_reduction with reaction flag', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', reaction: true, damageTypes: ['fire'], reduction: 5 }] },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('returns null when damage type does not match', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] },
    }
    expect(getDamageReduction(playerStats, 'cold', false)).toBeNull()
  })

  it('matches when damageTypes is empty (all types)', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', damageTypes: [], reduction: 3 }] },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(3)
  })

  it('respects wearing_heavy_armor condition', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', damageTypes: [], reduction: 5, condition: 'wearing_heavy_armor' }] },
    }
    expect(getDamageReduction(playerStats, 'fire', true)).toBe(5)
    expect(getDamageReduction(playerStats, 'fire', false)).toBeNull()
  })

  it('collects from reactions', () => {
    const playerStats = {
      automation: { reactions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 }] },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(3)
  })

  it('collects from specialActions', () => {
    const playerStats = {
      automation: { specialActions: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 }] },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(2)
  })

  it('sums multiple damage reductions', () => {
    const playerStats = {
      automation: {
        passives: [
          { type: 'damage_reduction', damageTypes: ['fire'], reduction: 3 },
          { type: 'damage_reduction', damageTypes: ['fire'], reduction: 2 },
        ],
      },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('is case-insensitive for damage types', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', damageTypes: ['Fire'], reduction: 5 }] },
    }
    expect(getDamageReduction(playerStats, 'fire', false)).toBe(5)
  })

  it('skips damage_reduction with wrong damage type', () => {
    const playerStats = {
      automation: { passives: [{ type: 'damage_reduction', damageTypes: ['fire'], reduction: 5 }] },
    }
    expect(getDamageReduction(playerStats, 'cold', false)).toBeNull()
  })
})
