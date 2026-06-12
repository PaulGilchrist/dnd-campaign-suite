import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'

describe('collectAutomationFromFeatures', () => {
  it('returns empty result when features is null', () => {
    const result = collectAutomationFromFeatures(null, {})
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.autoEffects).toEqual([])
    expect(result.saveModifiers).toEqual([])
    expect(result.primalKnowledge).toEqual([])
  })

  it('returns empty result when features is undefined', () => {
    const result = collectAutomationFromFeatures(undefined, {})
    expect(result.actions).toEqual([])
  })

  it('returns empty result when features is empty array', () => {
    const result = collectAutomationFromFeatures([], {})
    expect(result.actions).toEqual([])
    expect(result.bonusActions).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.specialActions).toEqual([])
    expect(result.passives).toEqual([])
    expect(result.autoEffects).toEqual([])
    expect(result.saveModifiers).toEqual([])
    expect(result.primalKnowledge).toEqual([])
  })

  it('skips features without automation', () => {
    const features = [{ name: 'No Automation' }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions).toEqual([])
  })

  it('skips features with null automation', () => {
    const features = [{ name: 'Null Auto', automation: null }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions).toEqual([])
  })

  it('skips features with undefined automation', () => {
    const features = [{ name: 'Undefined Auto', automation: undefined }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions).toEqual([])
  })

  it('skips features that are null', () => {
    const features = [null, { name: 'Valid', automation: { type: 'auto_effect', effect: 'test' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes save_attack as action by default', () => {
    const features = [{ name: 'Fire Bolt', automation: { type: 'save_attack', action: 'action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
    expect(result.actions[0].name).toBe('Fire Bolt')
  })

  it('categorizes save_attack as bonus action when specified', () => {
    const features = [{ name: 'Misty Step', automation: { type: 'save_attack', action: 'bonus_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.bonusActions.length).toBe(1)
    expect(result.bonusActions[0].name).toBe('Misty Step')
  })

  it('categorizes save_only as action', () => {
    const features = [{ name: 'Petrify', automation: { type: 'save_only' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes healing as action', () => {
    const features = [{ name: 'Cure Wounds', automation: { type: 'healing' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes healing_pool as action', () => {
    const features = [{ name: 'Lay on Hands', automation: { type: 'healing_pool' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes self_healing as action', () => {
    const features = [{ name: 'Second Wind', automation: { type: 'self_healing' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes damage_bonus as action', () => {
    const features = [{ name: 'Sneak Attack', automation: { type: 'damage_bonus' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes extra_action as action', () => {
    const features = [{ name: 'Extra Attack', automation: { type: 'extra_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes buff_ally as bonus action (defaults to bonus_action)', () => {
    const features = [{ name: 'Heal Word', automation: { type: 'buff_ally' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.bonusActions.length).toBe(1)
    expect(result.bonusActions[0].name).toBe('Heal Word')
  })

  it('categorizes bardic_inspiration as bonus action', () => {
    const features = [{ name: 'Bardic Inspiration', automation: { type: 'bardic_inspiration', action: 'bonus_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.bonusActions.length).toBe(1)
  })

  it('categorizes bonus_attacks as action', () => {
    const features = [{ name: 'Extra Attack', automation: { type: 'bonus_attacks' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes bonus_action_attack as bonus action', () => {
    const features = [{ name: 'War Priest', automation: { type: 'bonus_action_attack', action: 'bonus_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.bonusActions.length).toBe(1)
  })

  it('categorizes reaction_bonus as action (falls through default for action type)', () => {
    const features = [{ name: 'Reaction Bonus', automation: { type: 'reaction_bonus' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes free_spell as action', () => {
    const features = [{ name: 'Free Spell', automation: { type: 'free_spell' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes divine_intervention as action', () => {
    const features = [{ name: 'Divine Intervention', automation: { type: 'divine_intervention' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes resource_pool as action', () => {
    const features = [{ name: 'Resource Pool', automation: { type: 'resource_pool' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes attack_rider as action', () => {
    const features = [{ name: 'Smite', automation: { type: 'attack_rider' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes open_hand_technique as action', () => {
    const features = [{ name: 'Open Hand Technique', automation: { type: 'open_hand_technique' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes initiative_action as action', () => {
    const features = [{ name: 'Initiative Action', automation: { type: 'initiative_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes spell_modifier as action', () => {
    const features = [{ name: 'Spell Modifier', automation: { type: 'spell_modifier' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes font_of_magic as action', () => {
    const features = [{ name: 'Font of Magic', automation: { type: 'font_of_magic' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes set_condition as action', () => {
    const features = [{ name: 'Set Condition', automation: { type: 'set_condition' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes sorcery_aura as action', () => {
    const features = [{ name: 'Sorcery Aura', automation: { type: 'sorcery_aura' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes sorcery_incarnate as action', () => {
    const features = [{ name: 'Sorcery Incarnate', automation: { type: 'sorcery_incarnate' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes reaction_damage as reaction', () => {
    const features = [{ name: 'Opportunity Attack', automation: { type: 'reaction_damage' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })

  it('categorizes countercharm as reaction', () => {
    const features = [{ name: 'Countercharm', automation: { type: 'countercharm' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })

  it('categorizes damage_reduction as reaction', () => {
    const features = [{ name: 'Armor of Agathys', automation: { type: 'damage_reduction' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })

  it('categorizes reaction_debuff as reaction', () => {
    const features = [{ name: 'Reaction Debuff', automation: { type: 'reaction_debuff' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })

  it('categorizes bardic_inspiration_defense as reaction', () => {
    const features = [{ name: 'Bardic Inspiration Defense', automation: { type: 'bardic_inspiration_defense' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })

  it('categorizes reaction_save_heal as reaction', () => {
    const features = [{ name: 'Reaction Save Heal', automation: { type: 'reaction_save_heal' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })

  it('categorizes auto_reroll as action when casting_time is "1 action"', () => {
    const features = [{ name: 'Auto Reroll Action', automation: { type: 'auto_reroll', casting_time: '1 action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
    expect(result.reactions.length).toBe(0)
  })

  it('categorizes auto_reroll as reaction when casting_time is not "1 action"', () => {
    const features = [{ name: 'Auto Reroll Reaction', automation: { type: 'auto_reroll', casting_time: '1 reaction' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
    expect(result.actions.length).toBe(0)
  })

  it('categorizes temp_buff as special action', () => {
    const features = [{ name: 'Temp Buff', automation: { type: 'temp_buff' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(1)
  })

  it('categorizes temp_hp_buff as special action', () => {
    const features = [{ name: 'Temp HP Buff', automation: { type: 'temp_hp_buff' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(1)
  })

  it('categorizes damage_aura as special action', () => {
    const features = [{ name: 'Damage Aura', automation: { type: 'damage_aura' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(1)
  })

  it('categorizes combat_stance as special action', () => {
    const features = [{ name: 'Combat Stance', automation: { type: 'combat_stance' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(1)
  })

  it('categorizes passive_buff as passive', () => {
    const features = [{ name: 'Passive Buff', automation: { type: 'passive_buff' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes passive_immunity as passive', () => {
    const features = [{ name: 'Passive Immunity', automation: { type: 'passive_immunity' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes condition_immunity_while_active as passive', () => {
    const features = [{ name: 'Condition Immunity', automation: { type: 'condition_immunity_while_active' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes passive_rule as passive', () => {
    const features = [{ name: 'Passive Rule', automation: { type: 'passive_rule' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes resistance as passive', () => {
    const features = [{ name: 'Resistance', automation: { type: 'resistance' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes auto_effect as passive', () => {
    const features = [{ name: 'Auto Effect', automation: { type: 'auto_effect' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes resource_restoration as passive', () => {
    const features = [{ name: 'Resource Restoration', automation: { type: 'resource_restoration' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes font_of_inspiration as passive', () => {
    const features = [{ name: 'Font of Inspiration', automation: { type: 'font_of_inspiration' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes conditional_advantage as passive', () => {
    const features = [{ name: 'Conditional Advantage', automation: { type: 'conditional_advantage' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes conditional_disadvantage as passive', () => {
    const features = [{ name: 'Conditional Disadvantage', automation: { type: 'conditional_disadvantage' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes evasion as passive', () => {
    const features = [{ name: 'Evasion', automation: { type: 'evasion' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes mastery_rider as passive', () => {
    const features = [{ name: 'Mastery Rider', automation: { type: 'mastery_rider' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes post_cast_rider as passive', () => {
    const features = [{ name: 'Post Cast Rider', automation: { type: 'post_cast_rider' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes post_cast_self_heal as passive', () => {
    const features = [{ name: 'Post Cast Self Heal', automation: { type: 'post_cast_self_heal' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes multi_target_spread as passive', () => {
    const features = [{ name: 'Multi Target Spread', automation: { type: 'multi_target_spread' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes jack_of_all_trades as passive', () => {
    const features = [{ name: 'Jack of All Trades', automation: { type: 'jack_of_all_trades' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes divine_order as passive', () => {
    const features = [{ name: 'Divine Order', automation: { type: 'divine_order' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('skips unknown types that buildAttackInfo returns null for', () => {
    const features = [{ name: 'Unknown Type', automation: { type: 'unknown_type' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(0)
  })

  it('collects primalKnowledge from passive_rule with primal_knowledge effect (uses auto.skills)', () => {
    const features = [{
      name: 'Primal Knowledge',
      automation: {
        type: 'passive_rule',
        effect: 'primal_knowledge',
        skills: [{ skill: 'arcana' }, { skill: 'nature' }]
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.primalKnowledge.length).toBe(2)
    expect(result.primalKnowledge[0].skill).toBe('arcana')
    expect(result.primalKnowledge[1].skill).toBe('nature')
  })

  it('does not collect primalKnowledge when effect is not primal_knowledge', () => {
    const features = [{
      name: 'Passive Rule',
      automation: {
        type: 'passive_rule',
        effect: 'something_else',
        primalKnowledge: [{ skill: 'arcana' }]
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.primalKnowledge.length).toBe(0)
  })

  it('does not collect primalKnowledge when primalKnowledge array is empty', () => {
    const features = [{
      name: 'Passive Rule',
      automation: {
        type: 'passive_rule',
        effect: 'primal_knowledge',
        primalKnowledge: []
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.primalKnowledge.length).toBe(0)
  })

  it('adds cantrip_range_bonus passive when damage_bonus has rangeBonusCantrip with digits', () => {
    const features = [{
      name: 'Range Cantrip',
      automation: {
        type: 'damage_bonus',
        rangeBonusCantrip: '+10 ft'
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    const rangeBonus = result.passives.find(p => p.type === 'cantrip_range_bonus')
    expect(rangeBonus).toBeDefined()
    expect(rangeBonus.name).toBe('Range Cantrip')
    expect(rangeBonus.effect).toBe('cantrip_range_bonus')
    expect(rangeBonus.bonusExpression).toBe('10')
    expect(rangeBonus.hasAutomation).toBe(true)
  })

  it('adds cantrip_range_bonus with multi-digit value', () => {
    const features = [{
      name: 'Range Cantrip',
      automation: {
        type: 'damage_bonus',
        rangeBonusCantrip: '+30 ft'
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    const rangeBonus = result.passives.find(p => p.type === 'cantrip_range_bonus')
    expect(rangeBonus).toBeDefined()
    expect(rangeBonus.bonusExpression).toBe('30')
  })

  it('does not add cantrip_range_bonus when rangeBonusCantrip has no digits', () => {
    const features = [{
      name: 'Range Cantrip',
      automation: {
        type: 'damage_bonus',
        rangeBonusCantrip: 'extended'
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    const rangeBonus = result.passives.find(p => p.type === 'cantrip_range_bonus')
    expect(rangeBonus).toBeUndefined()
  })

  it('does not add cantrip_range_bonus when type is not damage_bonus', () => {
    const features = [{
      name: 'Other',
      automation: {
        type: 'save_attack',
        rangeBonusCantrip: '+10 ft'
      }
    }]
    const result = collectAutomationFromFeatures(features, {})
    const rangeBonus = result.passives.find(p => p.type === 'cantrip_range_bonus')
    expect(rangeBonus).toBeUndefined()
  })

  it('handles multiple features of different types', () => {
    const features = [
      { name: 'Fire Bolt', automation: { type: 'save_attack', action: 'action' } },
      { name: 'Reaction Attack', automation: { type: 'reaction_damage' } },
      { name: 'Passive Resistance', automation: { type: 'resistance' } },
      { name: 'Stance', automation: { type: 'combat_stance' } }
    ]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
    expect(result.reactions.length).toBe(1)
    expect(result.passives.length).toBe(1)
    expect(result.specialActions.length).toBe(1)
  })

  it('handles multiple features of the same type', () => {
    const features = [
      { name: 'Fire Bolt', automation: { type: 'save_attack', action: 'action' } },
      { name: 'Thunderwave', automation: { type: 'save_attack', action: 'action' } }
    ]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(2)
    expect(result.actions[0].name).toBe('Fire Bolt')
    expect(result.actions[1].name).toBe('Thunderwave')
  })

  it('handles mixed valid and invalid features', () => {
    const features = [
      null,
      { name: 'No Automation' },
      { name: 'Null Auto', automation: null },
      { name: 'Valid', automation: { type: 'auto_effect', effect: 'test' } }
    ]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
    expect(result.passives[0].name).toBe('Valid')
  })

  it('preserves info properties from buildAttackInfo', () => {
    const features = [{
      name: 'Test Feature',
      automation: { type: 'auto_effect', effect: 'test_effect', trigger: 'test_trigger' }
    }]
    const result = collectAutomationFromFeatures(features, {})
    const passive = result.passives[0]
    expect(passive.type).toBe('auto_effect')
    expect(passive.name).toBe('Test Feature')
    expect(passive.hasAutomation).toBe(true)
  })

  it('handles bardic_inspiration_offense as action', () => {
    const features = [{ name: 'Bardic Offense', automation: { type: 'bardic_inspiration_offense' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('handles divine_spark as action', () => {
    const features = [{ name: 'Divine Spark', automation: { type: 'divine_spark' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('handles conditional_replacement as passive', () => {
    const features = [{ name: 'Conditional Replacement', automation: { type: 'conditional_replacement' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('handles bardic_inspiration_defense as reaction', () => {
    const features = [{ name: 'Bardic Defense', automation: { type: 'bardic_inspiration_defense' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
  })
})

describe('processFeatureAutomation', () => {
  it('returns empty result when all inputs are null', () => {
    const automation = processFeatureAutomation(null, null, null, null, {})
    expect(automation.actions).toEqual([])
    expect(automation.bonusActions).toEqual([])
    expect(automation.reactions).toEqual([])
    expect(automation.specialActions).toEqual([])
    expect(automation.passives).toEqual([])
    expect(automation.autoEffects).toEqual([])
    expect(automation.saveModifiers).toEqual([])
    expect(automation.primalKnowledge).toEqual([])
  })

  it('combines features from all categories', () => {
    const actions = [{ name: 'Action Feature', automation: { type: 'auto_effect', effect: 'test' } }]
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'auto_effect', effect: 'test' } }]
    const reactions = [{ name: 'Reaction Feature', automation: { type: 'auto_effect', effect: 'test' } }]
    const specialActions = [{ name: 'Special Feature', automation: { type: 'auto_effect', effect: 'test' } }]

    const automation = processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(automation.passives.length).toBe(4)
    const names = automation.passives.map(p => p.name)
    expect(names).toContain('Action Feature')
    expect(names).toContain('Bonus Feature')
    expect(names).toContain('Reaction Feature')
    expect(names).toContain('Special Feature')
  })

  it('adds feature wrappers to allActions for features categorized as actions', () => {
    const actions = [{ name: 'Existing', automation: { type: 'auto_effect', effect: 'existing' } }]
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'save_attack', action: 'action' } }]
    const reactions = []
    const specialActions = []

    processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(actions.length).toBe(2)
    expect(actions[1].name).toBe('Bonus Feature')
    expect(actions[1].description).toBe('')
    expect(actions[1].hasAutomation).toBe(true)
    expect(actions[1].automation.type).toBe('save_attack')
  })

  it('does not add duplicate wrappers when feature already exists in allActions', () => {
    const actions = [{ name: 'Existing Feature', description: 'desc', automation: { type: 'auto_effect', effect: 'test' } }]
    const bonusActions = [{ name: 'Existing Feature', automation: { type: 'auto_effect', effect: 'test' } }]

    processFeatureAutomation(actions, bonusActions, [], [], {})

    expect(actions.length).toBe(1)
    expect(actions[0].description).toBe('desc')
  })

  it('adds wrappers from allBonusActions to allActions for action-categorized features', () => {
    const actions = []
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'save_attack', action: 'bonus_action' } }]
    const reactions = []
    const specialActions = []

    processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(actions.length).toBe(0) // bonus_action type goes to bonusActions, not actions
    expect(bonusActions.length).toBe(1) // original unchanged
  })

  it('adds wrappers from allSpecialActions to allActions for action-categorized features', () => {
    const actions = []
    const bonusActions = []
    const reactions = []
    const specialActions = [{ name: 'Special Feature', automation: { type: 'attack_rider' } }]

    processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(actions.length).toBe(1)
    expect(actions[0].name).toBe('Special Feature')
    expect(specialActions.length).toBe(1) // original unchanged
  })

  it('handles null individual arrays', () => {
    const automation = processFeatureAutomation(null, [], [], [], {})
    expect(automation.passives.length).toBe(0)
  })

  it('handles undefined individual arrays', () => {
    const automation = processFeatureAutomation(undefined, undefined, undefined, undefined, {})
    expect(automation.passives.length).toBe(0)
  })

  it('collects primalKnowledge from combined features using auto.skills', () => {
    const actions = []
    const bonusActions = []
    const reactions = []
    const specialActions = [{
      name: 'Primal Knowledge',
      automation: {
        type: 'passive_rule',
        effect: 'primal_knowledge',
        skills: [{ skill: 'arcana' }]
      }
    }]

    const automation = processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(automation.primalKnowledge.length).toBe(1)
    expect(automation.primalKnowledge[0].skill).toBe('arcana')
  })

  it('returns the automation object (not the modified arrays)', () => {
    const actions = []
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'auto_effect', effect: 'test' } }]
    const reactions = []
    const specialActions = []

    const automation = processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(automation.actions).toEqual([])
    expect(automation.bonusActions).toEqual([])
    expect(automation.passives.length).toBe(1)
  })

  it('handles empty arrays for all inputs', () => {
    const automation = processFeatureAutomation([], [], [], [], {})
    expect(automation.actions).toEqual([])
    expect(automation.bonusActions).toEqual([])
    expect(automation.reactions).toEqual([])
    expect(automation.specialActions).toEqual([])
    expect(automation.passives).toEqual([])
    expect(automation.autoEffects).toEqual([])
    expect(automation.saveModifiers).toEqual([])
    expect(automation.primalKnowledge).toEqual([])
  })

  it('adds wrappers for action-categorized features from all input arrays to allActions', () => {
    const actions = []
    const bonusActions = [{ name: 'Action Bonus', automation: { type: 'save_attack', action: 'action' } }]
    const reactions = [{ name: 'Action Reaction', automation: { type: 'save_attack', action: 'action' } }]
    const specialActions = [{ name: 'Action Special', automation: { type: 'attack_rider' } }]

    processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    // Features categorized as 'actions' by collectAutomationFromFeatures get wrapped
    expect(actions.length).toBe(3)
    const actionNames = actions.map(a => a.name)
    expect(actionNames).toContain('Action Bonus')
    expect(actionNames).toContain('Action Reaction')
    expect(actionNames).toContain('Action Special')
  })
})

describe('collectAutomationFromFeatures – nature_sanctuary types', () => {
    it('categorizes nature_sanctuary as an action', () => {
        const features = [{ name: "Nature's Sanctuary", automation: { type: 'nature_sanctuary' } }]
        const result = collectAutomationFromFeatures(features, {})
        expect(result.actions.length).toBe(1)
        expect(result.actions[0].name).toBe("Nature's Sanctuary")
        expect(result.actions[0].type).toBe('nature_sanctuary')
    })

    it('categorizes nature_sanctuary_move as a bonus action', () => {
        const features = [{ name: "Nature's Sanctuary (Move)", automation: { type: 'nature_sanctuary_move' } }]
        const result = collectAutomationFromFeatures(features, {})
        expect(result.bonusActions.length).toBe(1)
        expect(result.bonusActions[0].name).toBe("Nature's Sanctuary (Move)")
        expect(result.bonusActions[0].type).toBe('nature_sanctuary_move')
    })
})

describe('collectTurnStartEffects', () => {
    it('returns empty array when features is null', () => {
        const result = collectTurnStartEffects(null)
        expect(result).toEqual([])
    })

    it('returns empty array when features is undefined', () => {
        const result = collectTurnStartEffects(undefined)
        expect(result).toEqual([])
    })

    it('returns empty array when features is empty', () => {
        const result = collectTurnStartEffects([])
        expect(result).toEqual([])
    })

    it('returns empty array when features have no automation', () => {
        const features = [{ name: 'Test Feature', description: 'test' }]
        const result = collectTurnStartEffects(features)
        expect(result).toEqual([])
    })

    it('collects heroic_inspiration_turn_start effect', () => {
        const features = [
            {
                name: 'Heroic Warrior',
                automation: {
                    type: 'passive_rule',
                    effect: 'heroic_inspiration_turn_start',
                    casting_time: 'passive'
                }
            }
        ]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
            type: 'heroic_inspiration',
            name: 'Heroic Warrior'
        })
    })

    it('ignores other passive_rule effects', () => {
        const features = [
            {
                name: 'Superior Critical',
                automation: {
                    type: 'passive_rule',
                    effect: 'critical_range',
                    criticalRange: '18-20'
                }
            },
            {
                name: 'Heroic Warrior',
                automation: {
                    type: 'passive_rule',
                    effect: 'heroic_inspiration_turn_start'
                }
            }
        ]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('heroic_inspiration')
    })

    it('handles array of automations', () => {
        const features = [
            {
                name: 'Mixed Feature',
                automation: [
                    {
                        type: 'passive_rule',
                        effect: 'heroic_inspiration_turn_start'
                    },
                    {
                        type: 'passive_rule',
                        effect: 'critical_range',
                        criticalRange: '19-20'
                    }
                ]
            }
        ]
        const result = collectTurnStartEffects(features)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('heroic_inspiration')
    })
})
