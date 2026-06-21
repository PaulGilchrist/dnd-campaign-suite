// @improved-by-ai
import { describe, it, expect, beforeEach } from 'vitest'

import {
  collectAutomationFromFeatures,
  processFeatureAutomation,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── collectAutomationFromFeatures: null/empty handling ──────────────
describe('collectAutomationFromFeatures: null and empty handling', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('returns all-empty buckets when features is null', () => {
    const result = collectAutomationFromFeatures(null, playerStats)
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.autoEffects).toEqual([])
    expect(result.saveModifiers).toEqual([])
    expect(result.primalKnowledge).toEqual([])
    expect(result.ritualSpells).toEqual([])
  })

  it('returns all-empty buckets when features is undefined', () => {
    const result = collectAutomationFromFeatures(undefined, playerStats)
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.autoEffects).toEqual([])
    expect(result.saveModifiers).toEqual([])
    expect(result.primalKnowledge).toEqual([])
    expect(result.ritualSpells).toEqual([])
  })

  it('returns all-empty buckets when features is an empty array', () => {
    const result = collectAutomationFromFeatures([], playerStats)
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.autoEffects).toEqual([])
    expect(result.saveModifiers).toEqual([])
    expect(result.primalKnowledge).toEqual([])
    expect(result.ritualSpells).toEqual([])
  })
})

// ── collectAutomationFromFeatures: features without automation ─────
describe('collectAutomationFromFeatures: features without automation', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('skips features with no automation property', () => {
    const features = [
      { name: 'No Automation' },
      { name: 'Null Automation', automation: null },
    ]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.specialActions).toEqual([])
  })

  it('skips features with empty automation array', () => {
    const features = [makeFeature([], 'Empty Automation')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toEqual([])
    expect(result.passives).toEqual([])
  })
})

// ── collectAutomationFromFeatures: action-type categorization ───────
describe('collectAutomationFromFeatures: action-type categorization', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('categorizes save_attack as a default action', () => {
    const features = [makeFeature({ type: 'save_attack', damageType: 'cold', saveType: 'CON' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0]).toMatchObject({ type: 'save_attack', damageType: 'cold', saveType: 'CON' })
  })

  it('categorizes attack_rider without options as an action', () => {
    const features = [makeFeature({ type: 'attack_rider' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('attack_rider')
  })

  it('categorizes bonus_attacks as an action', () => {
    const features = [makeFeature({ type: 'bonus_attacks' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('bonus_attacks')
  })

  it('categorizes resource_pool as an action', () => {
    const features = [makeFeature({ type: 'resource_pool', resource: 'ki' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('resource_pool')
  })

  it('categorizes font_of_magic as an action', () => {
    const features = [makeFeature({ type: 'font_of_magic' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('font_of_magic')
  })

  it('categorizes healing with explicit action as an action', () => {
    const features = [makeFeature({ type: 'healing', action: 'action' }, 'Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('healing')
    expect(result.actions[0].action).toBe('action')
  })

  it('categorizes buff_ally with action as an action', () => {
    const features = [makeFeature({ type: 'buff_ally', action: 'action' }, 'Group Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('buff_ally')
  })

  it('categorizes warding_bond as an action', () => {
    const features = [makeFeature({ type: 'warding_bond' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('warding_bond')
  })
})

// ── collectAutomationFromFeatures: bonus action categorization ──────
describe('collectAutomationFromFeatures: bonus action categorization', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('categorizes healing with bonus_action as a bonus action', () => {
    const features = [makeFeature({ type: 'healing', action: 'bonus_action' }, 'Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.bonusActions).toHaveLength(1)
    expect(result.bonusActions[0].type).toBe('healing')
    expect(result.bonusActions[0].action).toBe('bonus_action')
  })

  it('categorizes buff_ally with bonus_action as a bonus action', () => {
    const features = [makeFeature({ type: 'buff_ally', action: 'bonus_action' }, 'Group Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.bonusActions).toHaveLength(1)
    expect(result.bonusActions[0].type).toBe('buff_ally')
  })

  it('skips extra_action when buildAttackInfo returns null (no handler)', () => {
    const features = [makeFeature({ type: 'extra_action', action: 'bonus_action' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.bonusActions).toEqual([])
  })
})

// ── collectAutomationFromFeatures: reaction categorization ──────────
describe('collectAutomationFromFeatures: reaction categorization', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('categorizes damage_reduction as a reaction', () => {
    const features = [makeFeature({ type: 'damage_reduction' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('damage_reduction')
  })

  it('categorizes auto_reroll without action casting_time as a reaction', () => {
    const features = [makeFeature({ type: 'auto_reroll' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('auto_reroll')
  })

  it('categorizes reaction_debuff as a reaction', () => {
    const features = [makeFeature({ type: 'reaction_debuff' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('reaction_debuff')
  })

  it('categorizes countercharm as a reaction', () => {
    const features = [makeFeature({
      type: 'countercharm',
      trigger: 'failed_save_charmed_or_frightened',
      range: '30 ft',
      conditions: ['charmed', 'frightened'],
      effect: 'reroll_with_advantage',
      uses: 1,
      recharge: 'long_rest',
      casting_time: '1 reaction'
    }, 'Countercharm')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('countercharm')
    expect(result.reactions[0].name).toBe('Countercharm')
    expect(result.reactions[0].casting_time).toBe('1 reaction')
  })
})

// ── collectAutomationFromFeatures: passive categorization ───────────
describe('collectAutomationFromFeatures: passive categorization', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('categorizes passive_rule as a passive', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'superior_dice' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('passive_rule')
  })

  it('categorizes evasion as a passive', () => {
    const features = [makeFeature({ type: 'evasion', saveType: 'DEX' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('evasion')
  })

  it('categorizes resistance as a passive', () => {
    const features = [makeFeature({ type: 'resistance', damageTypes: ['fire', 'cold'] })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('resistance')
    expect(result.passives[0].damageTypes).toEqual(['fire', 'cold'])
  })

  it('categorizes font_of_inspiration as a passive', () => {
    const features = [makeFeature({ type: 'font_of_inspiration' }, 'Font of Inspiration')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('font_of_inspiration')
    expect(result.passives[0].name).toBe('Font of Inspiration')
    expect(result.passives[0].casting_time).toBe('passive')
  })
})

// ── collectAutomationFromFeatures: special action categorization ────
describe('collectAutomationFromFeatures: special action categorization', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('categorizes combat_stance as a special action', () => {
    const features = [makeFeature({ type: 'combat_stance' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.specialActions).toHaveLength(1)
    expect(result.specialActions[0].type).toBe('combat_stance')
  })
})

// ── collectAutomationFromFeatures: attack_rider routing logic ───────
describe('collectAutomationFromFeatures: attack_rider routing logic', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('routes attack_rider with trigger to passives', () => {
    const features = [makeFeature({ type: 'attack_rider', trigger: 'piercing_damage_hit' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('attack_rider')
  })

  it('routes attack_rider with chooseOne to passives', () => {
    const features = [makeFeature({ type: 'attack_rider', chooseOne: true })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
  })

  it('routes attack_rider with maxEffects > 1 to passives', () => {
    const features = [makeFeature({ type: 'attack_rider', maxEffects: 3 })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
  })
})

// ── collectAutomationFromFeatures: primalKnowledge extraction ───────
describe('collectAutomationFromFeatures: primalKnowledge extraction', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('extracts primalKnowledge skills from passive_rule with effect primal_knowledge', () => {
    const skills = ['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival']
    const features = [makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills }, 'Primal Knowledge')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.primalKnowledge).toEqual(skills)
  })

  it('does not populate primalKnowledge for passive_rule without skills', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' }, 'Bonus Healing')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.primalKnowledge).toEqual([])
  })

  it('does not populate primalKnowledge for passive_rule with empty skills array', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: [] }, 'Empty Primal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.primalKnowledge).toEqual([])
  })
})

// ── collectAutomationFromFeatures: great_weapon_fighting ────────────
describe('collectAutomationFromFeatures: great_weapon_fighting', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('collects great_weapon_fighting passive from features', () => {
    const features = [
      makeFeature({ type: 'great_weapon_fighting' }, 'Great Weapon Fighting'),
    ]

    const result = collectAutomationFromFeatures(features, playerStats)

    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('passive_rule')
    expect(result.passives[0].effect).toBe('great_weapon_fighting')
    expect(result.passives[0].name).toBe('Great Weapon Fighting')
  })
})

// ── collectAutomationFromFeatures: mixed features ───────────────────
describe('collectAutomationFromFeatures: mixed features', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('correctly categorizes a mixed feature array', () => {
    const features = [
      makeFeature({ type: 'passive_rule' }, 'Passive1'),
      makeFeature({ type: 'damage_reduction' }, 'Shield'),
      makeFeature({ type: 'save_attack' }, 'Radiance'),
      makeFeature({ type: 'resistance', damageTypes: ['fire'] }, 'Fire Resist'),
    ]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(2)
    expect(result.passives.map(p => p.type)).toEqual(['passive_rule', 'resistance'])
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('damage_reduction')
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('save_attack')
  })

  it('handles features with array automation by processing each item', () => {
    const features = [makeFeature([
      { type: 'save_attack', damageType: 'cold' },
      { type: 'resistance', damageTypes: ['fire'] },
    ], 'Multi-Automation')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].damageType).toBe('cold')
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].damageTypes).toEqual(['fire'])
  })
})

// ── collectAutomationFromFeatures: unknown automation types ─────────
describe('collectAutomationFromFeatures: unknown automation types', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('skips unknown automation types when buildAttackInfo returns null', () => {
    const features = [makeFeature({ type: 'some_unknown_type' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.specialActions).toEqual([])
  })
})

// ── processFeatureAutomation ────────────────────────────────────────
describe('processFeatureAutomation', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('returns an automation object with all expected buckets', () => {
    const result = processFeatureAutomation([], [], [], [], playerStats)
    expect(result).toHaveProperty('actions')
    expect(result).toHaveProperty('bonusActions')
    expect(result).toHaveProperty('reactions')
    expect(result).toHaveProperty('specialActions')
    expect(result).toHaveProperty('passives')
    expect(result).toHaveProperty('autoEffects')
    expect(result).toHaveProperty('saveModifiers')
    expect(result).toHaveProperty('primalKnowledge')
    expect(result).toHaveProperty('ritualSpells')
  })

  it('returns empty arrays in all buckets when no features are provided', () => {
    const result = processFeatureAutomation([], [], [], [], playerStats)
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
  })

  it('handles null arrays gracefully by treating them as empty', () => {
    const result = processFeatureAutomation(null, null, null, null, playerStats)
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
  })

  it('combines features from all action arrays when collecting automation', () => {
    const actionFeatures = [makeFeature({ type: 'save_attack' }, 'ActionFeature')]
    const bonusActionFeatures = [makeFeature({ type: 'evasion', saveType: 'DEX' }, 'BonusFeature')]
    const result = processFeatureAutomation(actionFeatures, bonusActionFeatures, [], [], playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.passives).toHaveLength(1)
  })

  it('adds new automation items to the allActions array without duplicating existing ones', () => {
    const allActions = [{ name: 'Existing Feature', description: '', automation: null }]
    const allBonusActions = [{ name: 'New Feature', description: 'Desc', automation: { type: 'save_attack' } }]

    processFeatureAutomation(allActions, allBonusActions, [], [], playerStats)

    expect(allActions).toHaveLength(2)
    const newEntry = allActions[1]
    expect(newEntry.name).toBe('New Feature')
    expect(newEntry.hasAutomation).toBe(true)
  })

  it('does not add a feature to allActions if a feature with the same name already exists', () => {
    const allActions = [{ name: 'Existing', description: '', automation: null }]
    const allBonusActions = [{ name: 'Existing', description: 'Desc', automation: { type: 'save_attack' } }]

    processFeatureAutomation(allActions, allBonusActions, [], [], playerStats)

    expect(allActions).toHaveLength(1)
  })

  it('adds new automation items to the allSpecialActions array', () => {
    const allActions = []
    const allSpecialActions = [{ name: 'Existing Special', description: '', automation: null }]
    const allBonusActions = [{ name: 'New Special', description: 'Desc', automation: { type: 'combat_stance' } }]

    processFeatureAutomation(allActions, allBonusActions, [], allSpecialActions, playerStats)

    expect(allSpecialActions).toHaveLength(2)
    expect(allSpecialActions[1].name).toBe('New Special')
    expect(allSpecialActions[1].hasAutomation).toBe(true)
  })

  it('does not duplicate special actions already in allSpecialActions', () => {
    const allActions = []
    const allSpecialActions = [{ name: 'Existing', description: '', automation: null }]
    const allBonusActions = [{ name: 'Existing', description: 'Desc', automation: { type: 'combat_stance' } }]

    processFeatureAutomation(allActions, allBonusActions, [], allSpecialActions, playerStats)

    expect(allSpecialActions).toHaveLength(1)
  })
})
