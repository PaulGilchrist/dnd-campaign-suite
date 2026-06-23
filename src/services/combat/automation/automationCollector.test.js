// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { collectAutomationFromFeatures, processFeatureAutomation, collectTurnStartEffects } from './automationCollector.js'

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – null/empty guards                  */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – null/empty guards', () => {
  it('returns empty collections when features is null', () => {
    const result = collectAutomationFromFeatures(null, {})
    expect(result).toStrictEqual({
      actions: [],
      bonusActions: [],
      reactions: [],
      specialActions: [],
      passives: [],
      autoEffects: [],
      saveModifiers: [],
      primalKnowledge: [],
      ritualSpells: [],
    })
  })

  it('returns empty collections when features is undefined', () => {
    const result = collectAutomationFromFeatures(undefined, {})
    expect(result.actions).toEqual([])
  })

  it('returns empty collections when features is an empty array', () => {
    const result = collectAutomationFromFeatures([], {})
    expect(result.actions).toEqual([])
  })

  it('skips features without automation', () => {
    const result = collectAutomationFromFeatures([{ name: 'No Automation' }], {})
    expect(result.actions).toEqual([])
  })

  it('skips features with null automation', () => {
    const result = collectAutomationFromFeatures([{ name: 'Null Auto', automation: null }], {})
    expect(result.actions).toEqual([])
  })

  it('skips features with undefined automation', () => {
    const result = collectAutomationFromFeatures([{ name: 'Undefined Auto', automation: undefined }], {})
    expect(result.actions).toEqual([])
  })

  it('skips null entries in the features array', () => {
    const result = collectAutomationFromFeatures([
      null,
      { name: 'Valid', automation: { type: 'auto_effect', effect: 'test' } },
    ], {})
    expect(result.passives.length).toBe(1)
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – action categorization              */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – action categorization', () => {
  const actionTypes = [
    'save_attack',
    'save_only',
    'healing',
    'healing_pool',
    'self_healing',
    'damage_bonus',
    'extra_action',
    'bonus_attacks',
    'free_spell',
    'divine_intervention',
    'resource_pool',
    'open_hand_technique',
    'initiative_action',
    'spell_modifier',
    'font_of_magic',
    'set_condition',
    'sorcery_aura',
    'sorcery_incarnate',
    'bardic_inspiration_offense',
    'divine_spark',
    'nature_sanctuary',
  ]

  for (const type of actionTypes) {
    it(`categorizes ${type} as action by default`, () => {
      const features = [{ name: `${type} Feature`, automation: { type, action: 'action' } }]
      const result = collectAutomationFromFeatures(features, {})
      expect(result.actions.length).toBe(1)
      expect(result.actions[0].name).toBe(`${type} Feature`)
    })
  }

  it('categorizes auto_reroll as reaction when casting_time is not "1 action"', () => {
    const features = [{ name: 'Auto Reroll', automation: { type: 'auto_reroll', casting_time: '1 reaction' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.reactions.length).toBe(1)
    expect(result.actions.length).toBe(0)
  })

  it('categorizes save_attack as bonus action when action is bonus_action', () => {
    const features = [{ name: 'Misty Step', automation: { type: 'save_attack', action: 'bonus_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.bonusActions.length).toBe(1)
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – bonus action categorization        */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – bonus action categorization', () => {
  const bonusActionTypes = [
    'buff_ally',
    'bardic_inspiration',
    'bonus_action_attack',
    'nature_sanctuary_move',
  ]

  for (const type of bonusActionTypes) {
    it(`categorizes ${type} as bonus action`, () => {
      const features = [{ name: `${type} Feature`, automation: { type, action: 'bonus_action' } }]
      const result = collectAutomationFromFeatures(features, {})
      expect(result.bonusActions.length).toBe(1)
    })
  }
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – reaction categorization            */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – reaction categorization', () => {
  const reactionTypes = [
    'reaction_bonus',
    'reaction_damage',
    'countercharm',
    'damage_reduction',
    'reaction_debuff',
    'bardic_inspiration_defense',
    'reaction_save_heal',
    'reaction_save',
    'reaction_spell',
    'shadowy_dodge',
    'misty_escape',
    'beguiling_defenses',
    'searing_vengeance',
    'illusory_self',
    'lucky_point',
    'spell_thief',
    'superior_hunter_defense',
    'restore_balance',
  ]

  for (const type of reactionTypes) {
    it(`categorizes ${type} as reaction`, () => {
      const features = [{ name: `${type} Feature`, automation: { type } }]
      const result = collectAutomationFromFeatures(features, {})
      expect(result.reactions.length).toBe(1)
    })
  }
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – special action categorization      */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – special action categorization', () => {
  const specialActionTypes = [
    'temp_buff',
    'temp_hp_buff',
    'damage_aura',
    'combat_stance',
    'elder_champion',
    'starry_form',
    'twinkling_constellations',
    'tactical_mind',
    'cloak_of_shadows',
    'holy_nimbus',
    'holy_aura',
    'avenging_angel',
    'celestial_resilience',
    'dragon_wings',
    'celestial_revelation',
    'elfish_lineage',
    'gnomish_lineage',
    'fiendish_legacy',
    'memorize_spell',
    'signature_spells',
    'spell_mastery',
    'clairvoyant_combatant',
    'peerless_athlete',
    'transe_of_order',
    'revelation_in_flesh',
    'portent',
  ]

  for (const type of specialActionTypes) {
    it(`categorizes ${type} as special action`, () => {
      const features = [{ name: `${type} Feature`, automation: { type } }]
      const result = collectAutomationFromFeatures(features, {})
      expect(result.specialActions.length).toBe(1)
    })
  }
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – passive categorization             */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – passive categorization', () => {
  const passiveActionTypes = [
    'passive_buff',
    'passive_immunity',
    'condition_immunity_while_active',
    'passive_rule',
    'resistance',
    'auto_effect',
    'resource_restoration',
    'font_of_inspiration',
    'conditional_advantage',
    'conditional_disadvantage',
    'conditional_replacement',
    'evasion',
    'mastery_rider',
    'post_cast_rider',
    'post_cast_self_heal',
    'multi_target_spread',
    'jack_of_all_trades',
    'reliable_talent',
    'divine_order',
    'cantrip_spellcasting_ability',
    'dark_ones_blessing',
    'dark_ones_look',
    'hunter_prey',
    'defensive_tactics',
    'superior_hunter_prey',
    'stroke_of_luck',
    'modify_d20_roll',
    'supreme_sneak',
    'save_proficiency',
    'damage_type_choice',
    'radiant_soul',
    'hurl_through_hell',
    'create_thrall_temp_hp',
    'sentinel',
    'potent_cantrip',
    'soulstitch_spells',
    'empowered_evocation',
    'improved_illusions',
    'overchannel',
    'pass_without_trace',
    'phantasmal_creatures',
    'umbral_sight',
    'naturally_stealthy',
    'shadow_step_rider',
  ]

  for (const type of passiveActionTypes) {
    it(`categorizes ${type} as passive`, () => {
      const features = [{ name: `${type} Feature`, automation: { type } }]
      const result = collectAutomationFromFeatures(features, {})
      expect(result.passives.length).toBe(1)
    })
  }
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – conditional / special logic        */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – conditional logic', () => {
  it('categorizes attack_rider as passive when it has a trigger', () => {
    const features = [{ name: 'Piercing Rider', automation: { type: 'attack_rider', trigger: 'piercing_damage_hit' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes attack_rider as action when single-option with no trigger', () => {
    const features = [{ name: 'Single Smiter', automation: { type: 'attack_rider' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes attack_rider as passive when chooseOne is set', () => {
    const features = [{ name: 'Choose One', automation: { type: 'attack_rider', chooseOne: true } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes attack_rider as passive when maxEffects > 1', () => {
    const features = [{ name: 'Multi Rider', automation: { type: 'attack_rider', maxEffects: 3 } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes reaction_damage as passive when trigger is psychic_damage_received', () => {
    const features = [{ name: 'Psychic Reflection', automation: { type: 'reaction_damage', trigger: 'psychic_damage_received' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
  })

  it('categorizes combat_superiority as action when oncePerTurn is true', () => {
    const features = [{ name: 'Rally', automation: { type: 'combat_superiority', oncePerTurn: true } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes combat_superiority as special action when oncePerTurn is false', () => {
    const features = [{ name: 'Maneuver', automation: { type: 'combat_superiority', oncePerTurn: false } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(1)
  })

  it('categorizes cosmic_omen as bonus action when casting_time is bonus_action', () => {
    const features = [{ name: 'Cosmic Omen', automation: { type: 'cosmic_omen', casting_time: '1 bonus_action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.bonusActions.length).toBe(1)
  })

  it('categorizes cosmic_omen as action otherwise', () => {
    const features = [{ name: 'Cosmic Omen', automation: { type: 'cosmic_omen', casting_time: '1 action' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(1)
  })

  it('categorizes use_magic_device in both passives and specialActions', () => {
    const features = [{ name: 'Use Magic Device', automation: { type: 'use_magic_device' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.some(p => p.type === 'use_magic_device')).toBe(true)
    expect(result.specialActions.some(s => s.type === 'use_magic_device')).toBe(true)
  })

  it('duplicates teleport_kinetic entries', () => {
    const features = [{ name: 'Arcane Charge', automation: { type: 'arcane_charge' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.actions.length).toBe(2)
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – primalKnowledge extraction         */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – primalKnowledge extraction', () => {
  it('extracts skills from passive_rule with primal_knowledge effect using auto.skills', () => {
    const features = [{
      name: 'Primal Knowledge',
      automation: {
        type: 'passive_rule',
        effect: 'primal_knowledge',
        skills: [{ skill: 'arcana' }, { skill: 'nature' }],
      },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.primalKnowledge.length).toBe(2)
    expect(result.primalKnowledge[0].skill).toBe('arcana')
    expect(result.primalKnowledge[1].skill).toBe('nature')
  })

  it('does not extract primalKnowledge when effect is not primal_knowledge', () => {
    const features = [{
      name: 'Passive Rule',
      automation: {
        type: 'passive_rule',
        effect: 'something_else',
        primalKnowledge: [{ skill: 'arcana' }],
      },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.primalKnowledge.length).toBe(0)
  })

  it('does not extract primalKnowledge when primalKnowledge array is empty', () => {
    const features = [{
      name: 'Passive Rule',
      automation: {
        type: 'passive_rule',
        effect: 'primal_knowledge',
        primalKnowledge: [],
      },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.primalKnowledge.length).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – cantrip_range_bonus                */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – cantrip_range_bonus', () => {
  it('adds cantrip_range_bonus passive when damage_bonus has rangeBonusCantrip with digits', () => {
    const features = [{
      name: 'Range Cantrip',
      automation: { type: 'damage_bonus', rangeBonusCantrip: '+10 ft' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    const rangeBonus = result.passives.find(p => p.type === 'cantrip_range_bonus')
    expect(rangeBonus).toBeDefined()
    expect(rangeBonus.name).toBe('Range Cantrip')
    expect(rangeBonus.effect).toBe('cantrip_range_bonus')
    expect(rangeBonus.bonusExpression).toBe('10')
    expect(rangeBonus.hasAutomation).toBe(true)
  })

  it('parses multi-digit rangeBonusCantrip values', () => {
    const features = [{
      name: 'Range Cantrip',
      automation: { type: 'damage_bonus', rangeBonusCantrip: '+30 ft' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    const rangeBonus = result.passives.find(p => p.type === 'cantrip_range_bonus')
    expect(rangeBonus.bonusExpression).toBe('30')
  })

  it('does not add cantrip_range_bonus when rangeBonusCantrip has no digits', () => {
    const features = [{
      name: 'Other',
      automation: { type: 'damage_bonus', rangeBonusCantrip: 'extended' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.some(p => p.type === 'cantrip_range_bonus')).toBe(false)
  })

  it('does not add cantrip_range_bonus when type is not damage_bonus', () => {
    const features = [{
      name: 'Other',
      automation: { type: 'save_attack', rangeBonusCantrip: '+10 ft' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.some(p => p.type === 'cantrip_range_bonus')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – meta type                          */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – meta type', () => {
  it('places heroic_inspiration_on_long_rest meta effect in passives', () => {
    const features = [{
      name: 'Resourceful',
      automation: { type: 'meta', effect: 'heroic_inspiration_on_long_rest', casting_time: 'passive' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives).toHaveLength(1)
    expect(result.passives[0].effect).toBe('heroic_inspiration_on_long_rest')
  })

  it('places unknown meta effects in specialActions', () => {
    const features = [{
      name: 'Unknown Meta',
      automation: { type: 'meta', effect: 'unknown_effect', casting_time: 'passive' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions).toHaveLength(1)
    expect(result.specialActions[0].effect).toBe('unknown_effect')
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – multi-automation features          */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – multi-automation features', () => {
  it('handles features with array of automations', () => {
    const features = [{
      name: 'Mixed Feature',
      automation: [
        { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' },
        { type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' },
      ],
    }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBeGreaterThan(0)
  })

  it('collects both heroic_inspiration and condition_removal from array automation for collectTurnStartEffects', () => {
    const features = [{
      name: 'Mixed Feature',
      automation: [
        { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' },
        { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['charmed', 'frightened'] },
      ],
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('heroic_inspiration')
    expect(result[1].type).toBe('condition_removal')
  })
})

/* ------------------------------------------------------------------ */
/*  collectAutomationFromFeatures – multi-feature scenarios            */
/* ------------------------------------------------------------------ */

describe('collectAutomationFromFeatures – multi-feature scenarios', () => {
  it('handles multiple features of different types', () => {
    const features = [
      { name: 'Fire Bolt', automation: { type: 'save_attack', action: 'action' } },
      { name: 'Reaction Attack', automation: { type: 'reaction_damage' } },
      { name: 'Passive Resistance', automation: { type: 'resistance' } },
      { name: 'Stance', automation: { type: 'combat_stance' } },
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
      { name: 'Thunderwave', automation: { type: 'save_attack', action: 'action' } },
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
      { name: 'Valid', automation: { type: 'auto_effect', effect: 'test' } },
    ]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.passives.length).toBe(1)
    expect(result.passives[0].name).toBe('Valid')
  })

  it('preserves info properties from buildAttackInfo', () => {
    const features = [{
      name: 'Test Feature',
      automation: { type: 'auto_effect', effect: 'test_effect', trigger: 'test_trigger' },
    }]
    const result = collectAutomationFromFeatures(features, {})
    const passive = result.passives[0]
    expect(passive.type).toBe('auto_effect')
    expect(passive.name).toBe('Test Feature')
    expect(passive.hasAutomation).toBe(true)
  })

  it('skips unknown types that buildAttackInfo returns null for', () => {
    const features = [{ name: 'Unknown Type', automation: { type: 'unknown_type' } }]
    const result = collectAutomationFromFeatures(features, {})
    expect(result.specialActions.length).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/*  processFeatureAutomation                                           */
/* ------------------------------------------------------------------ */

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

  it('returns empty result when all inputs are undefined', () => {
    const automation = processFeatureAutomation(undefined, undefined, undefined, undefined, {})
    expect(automation.passives.length).toBe(0)
  })

  it('returns empty result when all inputs are empty arrays', () => {
    const automation = processFeatureAutomation([], [], [], [], {})
    expect(automation.actions).toEqual([])
    expect(automation.passives).toEqual([])
    expect(automation.primalKnowledge).toEqual([])
  })

  it('combines features from all categories into passives', () => {
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

  it('adds feature wrappers to allActions for action-categorized features', () => {
    const actions = [{ name: 'Existing', automation: { type: 'auto_effect', effect: 'existing' } }]
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'save_attack', action: 'action' } }]

    processFeatureAutomation(actions, bonusActions, [], [], {})

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

  it('wraps special action features into allActions by name match', () => {
    const actions = []
    const specialActions = [{ name: 'Special Feature', automation: { type: 'attack_rider' } }]

    processFeatureAutomation(actions, [], [], specialActions, {})

    expect(actions.length).toBe(1)
    expect(actions[0].name).toBe('Special Feature')
    expect(specialActions.length).toBe(1)
  })

  it('does not wrap bonus_action features into allActions', () => {
    const actions = []
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'save_attack', action: 'bonus_action' } }]

    processFeatureAutomation(actions, bonusActions, [], [], {})

    expect(actions.length).toBe(0)
    expect(bonusActions.length).toBe(1)
  })

  it('collects primalKnowledge from combined features using auto.skills', () => {
    const specialActions = [{
      name: 'Primal Knowledge',
      automation: { type: 'passive_rule', effect: 'primal_knowledge', skills: [{ skill: 'arcana' }] },
    }]

    const automation = processFeatureAutomation([], [], [], specialActions, {})

    expect(automation.primalKnowledge.length).toBe(1)
    expect(automation.primalKnowledge[0].skill).toBe('arcana')
  })

  it('returns the automation object (not the modified arrays)', () => {
    const actions = []
    const bonusActions = [{ name: 'Bonus Feature', automation: { type: 'auto_effect', effect: 'test' } }]

    const automation = processFeatureAutomation(actions, bonusActions, [], [], {})

    expect(automation.actions).toEqual([])
    expect(automation.bonusActions).toEqual([])
    expect(automation.passives.length).toBe(1)
  })

  it('wraps action-categorized features from all input arrays into allActions', () => {
    const actions = []
    const bonusActions = [{ name: 'Action Bonus', automation: { type: 'save_attack', action: 'action' } }]
    const reactions = [{ name: 'Action Reaction', automation: { type: 'save_attack', action: 'action' } }]
    const specialActions = [{ name: 'Action Special', automation: { type: 'attack_rider' } }]

    processFeatureAutomation(actions, bonusActions, reactions, specialActions, {})

    expect(actions.length).toBe(3)
    const actionNames = actions.map(a => a.name)
    expect(actionNames).toContain('Action Bonus')
    expect(actionNames).toContain('Action Reaction')
    expect(actionNames).toContain('Action Special')
  })
})

/* ------------------------------------------------------------------ */
/*  collectTurnStartEffects                                            */
/* ------------------------------------------------------------------ */

describe('collectTurnStartEffects', () => {
  it('returns empty array when features is null', () => {
    expect(collectTurnStartEffects(null)).toEqual([])
  })

  it('returns empty array when features is undefined', () => {
    expect(collectTurnStartEffects(undefined)).toEqual([])
  })

  it('returns empty array when features is empty', () => {
    expect(collectTurnStartEffects([])).toEqual([])
  })

  it('returns empty array when features have no automation', () => {
    const features = [{ name: 'Test Feature', description: 'test' }]
    expect(collectTurnStartEffects(features)).toEqual([])
  })

  it('collects heroic_inspiration_turn_start effect', () => {
    const features = [{
      name: 'Heroic Warrior',
      automation: { type: 'passive_rule', effect: 'heroic_inspiration_turn_start', casting_time: 'passive' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'heroic_inspiration', name: 'Heroic Warrior' })
  })

  it('ignores other passive_rule effects', () => {
    const features = [
      {
        name: 'Superior Critical',
        automation: { type: 'passive_rule', effect: 'critical_range', criticalRange: '18-20' },
      },
      {
        name: 'Heroic Warrior',
        automation: { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' },
      },
    ]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('heroic_inspiration')
  })

  it('handles array of automations', () => {
    const features = [{
      name: 'Mixed Feature',
      automation: [
        { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' },
        { type: 'passive_rule', effect: 'critical_range', criticalRange: '19-20' },
      ],
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('heroic_inspiration')
  })

  it('collects end_of_turn_condition_removal effect', () => {
    const features = [{
      name: 'Self-Restoration',
      automation: [
        { type: 'passive_immunity', conditionImmunity: 'charmed frightened poisoned' },
        { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['charmed', 'frightened', 'poisoned'] },
      ],
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'condition_removal',
      name: 'Self-Restoration',
      conditions: ['charmed', 'frightened', 'poisoned'],
    })
  })

  it('skips end_of_turn_condition_removal when conditions array is empty', () => {
    const features = [{
      name: 'Empty Conditions',
      automation: { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: [] },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(0)
  })

  it('collects elder_champion turn start regeneration effect', () => {
    const features = [{
      name: 'Elder Champion',
      automation: { type: 'elder_champion', duration: '1_minute', casting_time: '1 bonus action' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('elder_champion_regeneration')
    expect(result[0].name).toBe('Elder Champion')
    expect(result[0].healExpression).toBe('10')
  })

  it('collects umbral_sight turn start effect', () => {
    const features = [{
      name: 'Umbral Sight',
      automation: { type: 'passive_rule', effect: 'umbral_sight', casting_time: 'passive' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('umbral_sight')
    expect(result[0].name).toBe('Umbral Sight')
  })

  it('collects superior_defense with default cost', () => {
    const features = [{
      name: 'Monk',
      automation: { type: 'passive_rule', effect: 'superior_defense' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'superior_defense', name: 'Monk', cost: 3 })
  })

  it('collects flurry_healing_harm with usesExpression', () => {
    const features = [{
      name: 'Monk',
      automation: { type: 'passive_rule', effect: 'flurry_healing_harm', usesExpression: 'WIS modifier minimum 1' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'flurry_healing_harm', name: 'Monk', usesExpression: 'WIS modifier minimum 1' })
  })

  it('collects dread_ambush_speed with bonusExpression', () => {
    const features = [{
      name: 'Rogue',
      automation: { type: 'passive_rule', effect: 'dread_ambush_speed', bonusExpression: '10' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ type: 'dread_ambush_speed', name: 'Rogue', bonusExpression: '10' })
  })

  it('collects naturally_stealthy turn start effect', () => {
    const features = [{
      name: 'Drow',
      automation: { type: 'passive_rule', effect: 'naturally_stealthy', casting_time: 'passive' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('naturally_stealthy')
  })

  it('collects create_thrall_temp_hp with default tempHpExpression', () => {
    const features = [{
      name: 'Warlock',
      automation: { type: 'passive_rule', effect: 'create_thrall_temp_hp' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('create_thrall_temp_hp')
    expect(result[0].tempHpExpression).toBe('warlock level + CHA modifier')
  })

  it('collects mage_hand_legerdemain turn start effect', () => {
    const features = [{
      name: 'Arcane Trickster',
      automation: { type: 'passive_rule', effect: 'mage_hand_legerdemain' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('mage_hand_legerdemain')
  })

  it('collects roving_aim steady_aim_clear effect', () => {
    const features = [{
      name: 'Gloom Stalker',
      automation: { type: 'passive_rule', effect: 'roving_aim' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('steady_aim_clear')
  })

  it('collects holy_nimbus_radiant_damage effect', () => {
    const features = [{
      name: 'Paladin',
      automation: { type: 'holy_nimbus' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('holy_nimbus_radiant_damage')
    expect(result[0].damageExpression).toBe('CHA modifier + proficiency_bonus')
    expect(result[0].range).toBe('10_ft')
  })

  it('collects living_legend_turn_start effect', () => {
    const features = [{
      name: 'College of Creation',
      automation: { type: 'living_legend' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('living_legend_turn_start')
  })

  it('collects radiant_soul_turn_start effect', () => {
    const features = [{
      name: 'Fiend',
      automation: { type: 'radiant_soul' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('radiant_soul_turn_start')
  })

  it('collects inner_radiance_turn_start when feature name is Inner Radiance', () => {
    const features = [{
      name: 'Inner Radiance',
      automation: { type: 'damage_aura', damageExpression: 'proficiency_bonus', damageType: 'Radiant', range: '10_ft' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('inner_radiance_turn_start')
    expect(result[0].damageType).toBe('Radiant')
  })

  it('does not collect inner_radiance_turn_start for other feature names', () => {
    const features = [{
      name: 'Other Aura',
      automation: { type: 'damage_aura' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(0)
  })

  it('collects precise_hunter effect', () => {
    const features = [{
      name: 'Hunter',
      automation: { type: 'precise_hunter' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('precise_hunter')
  })

  it('collects hunter_lore effect', () => {
    const features = [{
      name: 'Hunter',
      automation: { type: 'hunter_lore' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('hunter_lore')
  })

  it('collects use_magic_device with attunementLimit default', () => {
    const features = [{
      name: 'Rogue',
      automation: { type: 'use_magic_device' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].attunementLimit).toBe(4)
  })

  it('collects divination_savant effect', () => {
    const features = [{
      name: 'Wizard',
      automation: { type: 'passive_rule', effect: 'divination_savant' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('divination_savant')
  })

  it('collects evocation_savant effect', () => {
    const features = [{
      name: 'Evocation Wizard',
      automation: { type: 'passive_rule', effect: 'evocation_savant' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('evocation_savant')
  })

  it('collects illusion_savant and improved_illusions effects', () => {
    const features = [
      { automation: { type: 'passive_rule', effect: 'illusion_savant' } },
      { automation: { type: 'passive_rule', effect: 'improved_illusions' } },
    ]
    const result = collectTurnStartEffects(features)
    const types = result.map(e => e.type)
    expect(types).toContain('illusion_savant')
    expect(types).toContain('improved_illusions')
  })

  it('collects tavern_brawler_push effect', () => {
    const features = [{
      automation: { type: 'passive_rule', effect: 'tavern_brawler_push' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('tavern_brawler_push')
  })

  it('collects ignore_loading_crossbows with default weapons', () => {
    const features = [{
      name: 'Crossbow Expert',
      automation: { type: 'passive_rule', effect: 'ignore_loading_crossbows' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].weapons).toEqual([])
  })

  it('collects no_melee_disadvantage_crossbows effect', () => {
    const features = [{
      name: 'Crossbow Expert',
      automation: { type: 'passive_rule', effect: 'no_melee_disadvantage_crossbows' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('no_melee_disadvantage_crossbows')
  })

  it('collects grapple_damage effect', () => {
    const features = [{
      name: 'Brawler',
      automation: { type: 'passive_rule', effect: 'grapple_damage' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('grapple_damage')
  })

  it('collects regenerate_turn_start_heal with defaults', () => {
    const features = [{
      name: 'Troll',
      automation: { type: 'healing_start_of_turn' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('regenerate_turn_start_heal')
    expect(result[0].healExpression).toBe('1')
    expect(result[0].bodyPartRegrowMinutes).toBe(2)
  })

  it('collects arcane_ward with defaults', () => {
    const features = [{
      name: 'War Caster',
      automation: { type: 'passive_rule', effect: 'arcane_ward' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('arcane_ward')
    expect(result[0].bonusActionRestore).toBe(false)
  })

  it('collects projected_ward with defaults', () => {
    const features = [{
      name: 'Project Ward',
      automation: { type: 'passive_rule', effect: 'projected_ward' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('projected_ward')
    expect(result[0].range).toBe(30)
    expect(result[0].reaction).toBe(true)
  })

  it('collects spell_breaker with defaults', () => {
    const features = [{
      name: 'Spell Breaker',
      automation: { type: 'passive_rule', effect: 'spell_breaker' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('spell_breaker')
    expect(result[0].alwaysPreparedSpells).toEqual([])
  })

  it('collects phantasmal_creatures with defaults', () => {
    const features = [{
      name: 'Phantasm',
      automation: { type: 'phantasmal_creatures' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].usesMax).toBe(1)
    expect(result[0].halvesHp).toBe(false)
  })

  it('collects steady_aim_clear from steady_aim type', () => {
    const features = [{
      name: 'Ranger',
      automation: { type: 'steady_aim' },
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('steady_aim_clear')
  })

  it('handles multiple turn start effects from a single feature with array automation', () => {
    const features = [{
      name: 'Multi Effect',
      automation: [
        { type: 'passive_rule', effect: 'heroic_inspiration_turn_start' },
        { type: 'passive_rule', effect: 'end_of_turn_condition_removal', conditions: ['charmed'] },
        { type: 'passive_rule', effect: 'umbral_sight' },
        { type: 'elder_champion' },
      ],
    }]
    const result = collectTurnStartEffects(features)
    expect(result).toHaveLength(4)
    const types = result.map(e => e.type)
    expect(types).toContain('heroic_inspiration')
    expect(types).toContain('condition_removal')
    expect(types).toContain('umbral_sight')
    expect(types).toContain('elder_champion_regeneration')
  })
})
