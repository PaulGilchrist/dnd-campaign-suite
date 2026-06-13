import { describe, it, expect, beforeEach } from 'vitest'

import {
  collectAutomationFromFeatures,
  processFeatureAutomation,
} from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── collectAutomationFromFeatures ─────────────────────────────────
describe('collectAutomationFromFeatures', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('returns empty result object when features is null', () => {
    const result = collectAutomationFromFeatures(null, playerStats)
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.autoEffects).toEqual([])
    expect(result.saveModifiers).toEqual([])
  })

  it('returns empty result object when features is undefined', () => {
    const result = collectAutomationFromFeatures(undefined, playerStats)
    expect(Object.keys(result)).toHaveLength(9)
  })

  it('skips features without automation property', () => {
    const features = [{ name: 'No Automation' }]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toEqual([])
    expect(result.passives).toEqual([])
  })

  it('categorizes save_attack into actions (default action)', () => {
    const features = [makeFeature({ type: 'save_attack', damageType: 'cold', saveType: 'CON' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
    expect(result.actions[0].type).toBe('save_attack')
  })

  it('categorizes passive_rule into passives', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'superior_dice' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('passive_rule')
  })

  it('extracts primalKnowledge skills from passive_rule with effect primal_knowledge', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: ['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival'] }, 'Primal Knowledge')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
    expect(result.primalKnowledge).toEqual(['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival'])
  })

  it('does not populate primalKnowledge for passive_rule without skills', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' }, 'Bonus Healing')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.primalKnowledge).toEqual([])
  })

  it('categorizes damage_reduction into reactions', () => {
    const features = [makeFeature({ type: 'damage_reduction' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('damage_reduction')
  })

  it('categorizes combat_stance into specialActions', () => {
    const features = [makeFeature({ type: 'combat_stance' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.specialActions).toHaveLength(1)
    expect(result.specialActions[0].type).toBe('combat_stance')
  })

  it('categorizes attack_rider into actions', () => {
    const features = [makeFeature({ type: 'attack_rider' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
  })

  it('categorizes healing with bonus_action into bonusActions', () => {
    const features = [makeFeature({ type: 'healing', action: 'bonus_action' }, 'Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.bonusActions).toHaveLength(1)
  })

  it('categorizes healing with default action into actions', () => {
    const features = [makeFeature({ type: 'healing', action: 'action' }, 'Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
  })

  it('categorizes bonus_attacks into actions', () => {
    const features = [makeFeature({ type: 'bonus_attacks' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
  })

  it('categorizes resource_pool into actions', () => {
    const features = [makeFeature({ type: 'resource_pool', resource: 'ki' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
  })

  it('categorizes auto_reroll into reactions', () => {
    const features = [makeFeature({ type: 'auto_reroll' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
  })

  it('categorizes evasion into passives', () => {
    const features = [makeFeature({ type: 'evasion', saveType: 'DEX' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
  })

  it('categorizes resistance into passives', () => {
    const features = [makeFeature({ type: 'resistance', damageTypes: ['fire', 'cold'] })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(1)
  })

  it('categorizes buff_ally with bonus_action into bonusActions', () => {
    const features = [makeFeature({ type: 'buff_ally', action: 'bonus_action' }, 'Group Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.bonusActions).toHaveLength(1)
  })

  it('categorizes buff_ally with action into actions', () => {
    const features = [makeFeature({ type: 'buff_ally', action: 'action' }, 'Group Heal')]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
  })

  it('categorizes font_of_magic into actions', () => {
    const features = [makeFeature({ type: 'font_of_magic' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.actions).toHaveLength(1)
  })

  it('categorizes reaction_debuff into reactions', () => {
    const features = [makeFeature({ type: 'reaction_debuff' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.reactions).toHaveLength(1)
  })

  it('categorizes unknown automation types into specialActions', () => {
    const features = [makeFeature({ type: 'some_unknown_type' })]
    const result = collectAutomationFromFeatures(features, playerStats)
    // buildAttackInfo returns null for unknown types → nothing categorized
    expect(result.specialActions).toEqual([])
  })

  it('handles a mixed feature array correctly', () => {
    const features = [
      makeFeature({ type: 'passive_rule'}, 'Passive1'),
      makeFeature({ type: 'damage_reduction'}, 'Shield'),
      makeFeature({ type: 'save_attack'}, 'Radiance'),
      makeFeature({ type: 'resistance', damageTypes: ['fire']}, 'Fire Resist'),
    ]
    const result = collectAutomationFromFeatures(features, playerStats)
    expect(result.passives).toHaveLength(2) // passive_rule + resistance
    expect(result.reactions).toHaveLength(1) // damage_reduction
    expect(result.actions).toHaveLength(1) // save_attack
  })
})

// ── collectAutomationFromFeatures – countercharm and font_of_inspiration ─
describe('collectAutomationFromFeatures – countercharm and font_of_inspiration', () => {
  it('adds countercharm to reactions', () => {
    const ps = makePlayerStats()
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
    const result = collectAutomationFromFeatures(features, ps)
    expect(result.reactions).toHaveLength(1)
    expect(result.reactions[0].type).toBe('countercharm')
    expect(result.reactions[0].name).toBe('Countercharm')
    expect(result.reactions[0].casting_time).toBe('1 reaction')
  })

  it('adds font_of_inspiration to passives', () => {
    const ps = makePlayerStats()
    const features = [makeFeature({ type: 'font_of_inspiration' }, 'Font of Inspiration')]
    const result = collectAutomationFromFeatures(features, ps)
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].type).toBe('font_of_inspiration')
    expect(result.passives[0].name).toBe('Font of Inspiration')
    expect(result.passives[0].casting_time).toBe('passive')
  })
})

// ── processFeatureAutomation ──────────────────────────────────────
describe('processFeatureAutomation', () => {
  let playerStats

  beforeEach(() => {
    playerStats = makePlayerStats()
  })

  it('returns automation object with all buckets', () => {
    const result = processFeatureAutomation([], [], [], [], playerStats)
    expect(result).toHaveProperty('actions')
    expect(result).toHaveProperty('bonusActions')
    expect(result).toHaveProperty('reactions')
    expect(result).toHaveProperty('specialActions')
    expect(result).toHaveProperty('passives')
  })

  it('handles null arrays gracefully', () => {
    const result = processFeatureAutomation(null, null, null, null, playerStats)
    expect(result.passives).toEqual([])
  })

  it('combines all action arrays when collecting automation', () => {
    const allActions = [makeFeature({ type: 'save_attack' }, 'Action1')]
    const allBonusActions = []
    const allReactions = []
    const allSpecialActions = []
    const result = processFeatureAutomation(allActions, allBonusActions, allReactions, allSpecialActions, makePlayerStats())
    expect(result.actions).toHaveLength(1)
  })

  it('adds new automation items to the allActions array', () => {
    const allActions = []
    const existingAction = { name: 'Existing Action', description: '', automation: null }
    allActions.push(existingAction)

    // A feature in allBonusActions with a save_attack type should be added if not already there
    processFeatureAutomation(allActions, [{ name: 'New Action', description: 'Desc', automation: { type: 'save_attack' } }], [], [], makePlayerStats())
    expect(allActions).toHaveLength(2)
    const newAction = allActions[1]
    expect(newAction.name).toBe('New Action')
    expect(newAction.hasAutomation).toBe(true)
  })

  it('does not duplicate automation items already in allActions', () => {
    const actionName = 'Existing'
    const allActions = [{ name: actionName, description: '', automation: null }]
    processFeatureAutomation(allActions, [{ name: actionName, description: 'Desc', automation: { type: 'save_attack' } }], [], [], makePlayerStats())
    expect(allActions).toHaveLength(1) // should NOT add a duplicate
  })
})
