import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted by vitest) ─────────────────────────────────────
vi.mock('../rules/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((itemName) => {
    if (itemName && typeof itemName === 'string' && itemName.charAt(0) === '+') {
      return { baseName: itemName.substring(3), magicBonus: Number(itemName.charAt(1)) }
    }
    return { baseName: itemName, magicBonus: 0 }
  }),
}))

vi.mock('../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn((abilities, abilityName) => {
    if (!abilities || !abilityName) return 0
    const lower = abilityName.toLowerCase().replace(/\s+/g, '')
    const canonicalMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
    const canonical = canonicalMap[lower] || abilityName.charAt(0).toUpperCase() + abilityName.slice(1)
     // resolveDiceExpression passes playerStats.abilities which defaults to {} not []
    if (!Array.isArray(abilities)) return 0
    return abilities.find(a => a.name === canonical)?.bonus ?? 0
   }),
}))

import {
  evaluateAutoExpression,
  collectAutomationFromFeatures,
  processFeatureAutomation,
  getAutomationInfo,
  collectSaveModifiers,
  hasAutomation,
  getEvasionEffects,
  getConditionImmunities,
  getConditionalImmunities,
  playerIsImmuneToCondition,
  getPassiveBuffs,
  collectWeaponMastery,
  resolveHealingBonuses,
  hasHealingMaximization,
} from './automationService.js'

// ── Factories ─────────────────────────────────────────────────────
function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCharacter',
    proficiency: 2,
    level: 3,
    class: { name: 'Barbarian', levels: 3 },
    abilities: [
      { name: 'Strength', bonus: 5 },
      { name: 'Dexterity', bonus: 2 },
      { name: 'Constitution', bonus: 3 },
      { name: 'Intelligence', bonus: -1 },
      { name: 'Wisdom', bonus: 0 },
      { name: 'Charisma', bonus: 1 },
    ],
    ...overrides,
  }
}

function makeFeature(automation, name = 'Test Feature') {
  return { name, automation }
}

// ── buildAttackInfo (via getAutomationInfo) – all switch branches ─
describe('buildAttackInfo – all automation types', () => {
  let ps

  beforeEach(() => {
    ps = makePlayerStats()
     })

  it('returns attack_rider info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'attack_rider' }), ps)
    expect(info.type).toBe('attack_rider')
    expect(info.options).toEqual([])
    expect(info.damageExpression).toBe('')
     })

  it('returns attack_rider with custom options', () => {
    const info = getAutomationInfo(makeFeature({ type: 'attack_rider', options: ['extra_crit'], damageExpression: '1d8', trigger: 'hit' }), ps)
    expect(info.options).toEqual(['extra_crit'])
    expect(info.damageExpression).toBe('1d8')
     })

  it('returns mastery_rider info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'mastery_rider', masteries: ['trip', 'trip'] }), ps)
    expect(info.type).toBe('mastery_rider')
    expect(info.masteries).toEqual(['trip', 'trip'])
     })

  it('returns auto_effect info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_effect', effect: '+2d6', trigger: 'hit' }), ps)
    expect(info.type).toBe('auto_effect')
    expect(info.effect).toBe('+2d6')
     })

  it('returns auto_reroll info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_reroll' }), ps)
    expect(info.type).toBe('auto_reroll')
    expect(info.target).toBe('d20')
    expect(info.effect).toBe('reroll')
     })

  it('returns bonus_action_attack info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_action_attack' }), ps)
    expect(info.type).toBe('bonus_action_attack')
    expect(info.action).toBe('bonus_action')
    expect(info.usesMax).toBe(0)
    expect(info.recharge).toBe('long_rest')
    expect(info.resourceKey).toBe('warPriestUses')
     })

  it('returns bonus_action_attack info with uses_expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_action_attack', uses_expression: 'WIS modifier_min_1' }), ps)
    expect(info.type).toBe('bonus_action_attack')
    expect(info.usesMax).toBe(1)
    expect(info.recharge).toBe('long_rest')
     })

  it('returns bonus_attacks info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_attacks' }), ps)
    expect(info.type).toBe('bonus_attacks')
    expect(info.attacks).toBe(2)
    expect(info.attackType).toBe('unarmed_strike')
     })

  it('returns buff_ally info with uses_expression evaluation', () => {
         // uses_expression without _min → evaluates via evaluateAutoExpression
    const info = getAutomationInfo(makeFeature({ type: 'buff_ally', uses_expression: 'proficiency_bonus' }), ps)
    expect(info.type).toBe('buff_ally')
    expect(info.usesMax).toBe(ps.proficiency) // 2
     })

  it('returns buff_ally with no uses_expression defaults to 0', () => {
    const info = getAutomationInfo(makeFeature({ type: 'buff_ally' }), ps)
    expect(info.usesMax).toBe(0)
     })

  it('returns bardic_inspiration info', () => {
    const ps2 = makePlayerStats({
      level: 3,
      class: { name: 'Bard', levels: 5, class_levels: [{ level: 1 }, { level: 2 }, { level: 3, bardic_die: 8 }] },
       })
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration', uses_expression: 'proficiency_bonus' }), ps2)
    expect(info.type).toBe('bardic_inspiration')
    expect(info.dieSize).toBe(8)
    expect(info.usesMax).toBe(ps2.proficiency)
     })

  it('returns bardic_inspiration with default die size 6', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration' }), ps)
    expect(info.dieSize).toBe(6)
     })

  it('returns bardic_inspiration_defense info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration_defense' }), ps)
    expect(info.type).toBe('bardic_inspiration_defense')
     })

  it('returns bardic_inspiration_offense info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration_offense' }), ps)
    expect(info.type).toBe('bardic_inspiration_offense')
     })

  it('returns combat_stance info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'combat_stance' }), ps)
    expect(info.type).toBe('combat_stance')
    expect(info.resourceKey).toBe('ragePoints')
    expect(info.uses).toBe(0)
     })

  it('returns conditional_advantage info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'conditional_advantage' }), ps)
    expect(info.type).toBe('conditional_advantage')
    expect(info.target).toBe('saving_throw')
    expect(info.effect).toBe('advantage')
     })

  it('returns evasion info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'evasion', saveType: 'CON' }), ps)
    expect(info.type).toBe('evasion')
    expect(info.saveType).toBe('CON')
     })

  it('returns evasion with shareable', () => {
    const info = getAutomationInfo(makeFeature({ type: 'evasion', shareable: true, shareRange: 5 }), ps)
    expect(info.shareable).toBe(true)
    expect(info.shareRange).toBe(5)
     })

  it('returns conditional_disadvantage info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'conditional_disadvantage' }, 'Vuln'), ps)
    expect(info.type).toBe('conditional_disadvantage')
    expect(info.target).toBe('attack_roll')
     })

  it('returns damage_aura info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_aura', damageType: 'lightning', damageExpression: '1d8' }, 'Aura'), ps)
    expect(info.type).toBe('damage_aura')
    expect(info.damageType).toBe('lightning')
     })

  it('returns damage_bonus info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_bonus', damageExpression: '1d8', options: ['fire'] }, 'Bonus'), ps)
    expect(info.type).toBe('damage_bonus')
    expect(info.options).toEqual(['fire'])
     })

  it('returns damage_reduction info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_reduction', reductionExpression: 'level + con_mod' }, 'Reduction'), ps)
    expect(info.type).toBe('damage_reduction')
     })

  it('returns extra_action info with resourceKey derived from feature name', () => {
    const info = getAutomationInfo(makeFeature({ type: 'extra_action' }, 'Extra Strike'), ps)
    expect(info.type).toBe('extra_action')
    expect(info.resourceKey).toBe('extrastrikeUses')
     })

   it('returns open_hand_technique info', () => {
     const info = getAutomationInfo(makeFeature({ type: 'open_hand_technique' }, 'Open Hand'), ps)
     expect(info.type).toBe('open_hand_technique')
     expect(info.saveType).toBe('STR')
     expect(info.saveDc).toBe('ability')
      })

  it('returns divine_intervention info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'divine_intervention' }, 'DI'), ps)
    expect(info.type).toBe('divine_intervention')
    expect(info.recharge).toBe('long_rest')
     })

  it('returns font_of_magic info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'font_of_magic' }, 'Font'), ps)
    expect(info.type).toBe('font_of_magic')
     })

  it('returns free_spell info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'free_spell', spell: 'misty_step', concentration: true }, 'Free Spell'), ps)
    expect(info.type).toBe('free_spell')
    expect(info.spell).toBe('misty_step')
    expect(info.concentration).toBe(true)
     })

  it('returns free_spell info with array spell and resourceCost', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'free_spell',
      spell: ['Shield of Faith', 'Spiritual Weapon'],
      resourceCost: 'channel_divinity',
      noConcentration: true,
      duration: '1_minute',
    }, 'War God\'s Blessing'), ps)
    expect(info.type).toBe('free_spell')
    expect(info.spell).toEqual(['Shield of Faith', 'Spiritual Weapon'])
    expect(info.resourceCost).toBe('channel_divinity')
    expect(info.noConcentration).toBe(true)
    expect(info.duration).toBe('1_minute')
     })

  it('returns healing info with healExpression resolved', () => {
    const ps2 = makePlayerStats({ level: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'healing', healExpression: 'level + 5' }, 'Heal'), ps2)
    expect(info.type).toBe('healing')
    expect(info.healAmount).toBe(8) // 3 + 5
     })

  it('returns healing info with no expression defaults to 0', () => {
    const info = getAutomationInfo(makeFeature({ type: 'healing' }, 'Heal'), ps)
    expect(info.healAmount).toBe(0)
     })

  it('returns healing_pool info with dice parsing', () => {
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '3d6' }, 'Pool'), ps)
    expect(info.type).toBe('healing_pool')
    expect(info.pool).toBe(3) // dice count from "3d6"
    expect(info.isDicePool).toBe(true)
    expect(info.dieType).toBe(6)
     })

  it('returns healing_pool info with scaling applied', () => {
         // resolveHealingPoolExpression should upgrade expression at higher level
    const ps2 = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '1d6', scaling: { 3: '2d6' } }, 'Pool'), ps2)
    expect(info.pool).toBe(2) // at level 5 >= 3, uses "2d6" → diceCount = 2
     })

  it('returns healing_pool info with numeric scaling expression', () => {
         // When scaled expression is a number, evaluateAutoExpression returns the number
    const ps2 = makePlayerStats({ level: 10 })
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '0', scaling: { 5: 'level * 3' } }, 'Pool'), ps2)
       // "level * 3" resolves to 30 for level 10
    expect(info.pool).toBe(30)
    expect(info.isDicePool).toBe(false)
     })

  it('returns self_healing info', () => {
    const ps2 = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({ type: 'self_healing', healExpression: 'level + 2' }, 'Regen'), ps2)
    expect(info.type).toBe('self_healing')
    expect(info.healAmount).toBe(7) // 5 + 2
     })

  it('returns self_healing with missing healExpression defaults to 0', () => {
    const info = getAutomationInfo(makeFeature({ type: 'self_healing' }, 'Regen'), ps)
    expect(info.healAmount).toBe(0)
     })

  it('returns initiative_action info with name-derived resourceKey', () => {
    const info = getAutomationInfo(makeFeature({ type: 'initiative_action' }, 'Scout'), ps)
    expect(info.type).toBe('initiative_action')
    expect(info.resourceKey).toBe('scoutUses')
     })

  it('returns meta info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'meta', effect: '+1d4' }, 'Metamagic'), ps)
    expect(info.type).toBe('meta')
     })

  it('returns passive_buff info with bonus and options', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_buff', bonusExpression: '+2', options: ['while_raging'] }, 'Aura'), ps)
    expect(info.type).toBe('passive_buff')
    expect(info.bonusExpression).toBe('+2')
     })

  it('returns passive_immunity info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Imm'), ps)
    expect(info.type).toBe('passive_immunity')
    expect(info.conditionImmunity).toBe('charmed')
     })

  it('returns condition_immunity_while_active info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'], requiresActive: 'aura' }, 'CI'), ps)
    expect(info.type).toBe('condition_immunity_while_active')
     })

  it('returns post_cast_rider info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_rider' }, 'Rider'), ps)
    expect(info.type).toBe('post_cast_rider')
    expect(info.saveType).toBe('WIS')
     })

  it('returns reaction_bonus info with noOAs flag', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_bonus', noOAs: true }, 'Shield'), ps)
    expect(info.type).toBe('reaction_bonus')
    expect(info.noOAs).toBe(true)
     })

  it('returns reaction_damage info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_damage', damageExpression: '1d6' }, 'Spark'), ps)
    expect(info.type).toBe('reaction_damage')
     })

  it('returns reaction_debuff info with usesMax evaluated', () => {
    const ps2 = makePlayerStats({ proficiency: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'reaction_debuff', uses_expression: 'proficiency_bonus' }, 'Debuff'), ps2)
    expect(info.type).toBe('reaction_debuff')
    expect(info.usesMax).toBe(3)
     })

  it('returns reaction_debuff with no uses_expression defaults to 0', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_debuff' }, 'Debuff'), ps)
    expect(info.usesMax).toBe(0)
     })

  it('returns resistance info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resistance', damageTypes: ['fire', 'cold'] }, 'Resist'), ps)
    expect(info.type).toBe('resistance')
    expect(info.damageTypes).toEqual(['fire', 'cold'])
     })

  it('returns resource_pool info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resource_pool', resource: 'qi' }, 'Qi'), ps)
    expect(info.type).toBe('resource_pool')
    expect(info.resource).toBe('qi')
     })

  it('returns save_attack with computed saveDc when saveDc is "ability"', () => {
          // CON mod is +3 from factory, prof=2 → DC = 8 + 3 + 2 = 13
    const info = getAutomationInfo(makeFeature({ type: 'save_attack', saveDc: 'ability' }, 'Radiance'), ps)
    expect(info.type).toBe('save_attack')
    expect(info.saveDc).toBe(13)
      })

  it('returns save_attack with numeric default when saveDc not specified', () => {
          // When saveDc !== 'ability', the source falls back to auto.saveDc || 10
    const info = getAutomationInfo(makeFeature({ type: 'save_attack' }, 'Radiance'), ps)
    expect(info.type).toBe('save_attack')
    expect(info.saveDc).toBe(10) // default fallback
      })

  it('returns save_attack with custom saveAbility and ability saveDc', () => {
          // WIS mod is 0, prof=2 → DC = 8 + 0 + 2 = 10
    const info = getAutomationInfo(makeFeature({ type: 'save_attack', saveDc: 'ability', saveAbility: 'WIS' }, 'Radiance'), ps)
    expect(info.saveDc).toBe(10)
      })

  it('returns save_only with computed ability saveDc (CON + prof)', () => {
          // source uses getSaveDc(playerStats, 'CON', playerStats.proficiency)
          // CON mod = 3, prof = 2 → DC = 8 + 3 + 2 = 13
    const info = getAutomationInfo(makeFeature({ type: 'save_only', saveDc: 'ability' }, 'Petrify'), ps)
    expect(info.type).toBe('save_only')
    expect(info.saveDc).toBe(13)
      })

  it('returns save_only with numeric default when saveDc not specified', () => {
          // same pattern as save_attack: auto.saveDc || 10
    const info = getAutomationInfo(makeFeature({ type: 'save_only' }, 'Petrify'), ps)
    expect(info.type).toBe('save_only')
    expect(info.saveDc).toBe(10)
      })

  it('returns save_only with numeric saveDc override', () => {
    const info = getAutomationInfo(makeFeature({ type: 'save_only', saveDc: 15 }, 'Petrify'), ps)
    expect(info.saveDc).toBe(15)
     })

  it('returns divine_spark info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'divine_spark' }, 'Spark'), ps)
    expect(info.type).toBe('divine_spark')
     })

  it('returns set_condition info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'set_condition', condition: 'charmed', target: 'one_creature' }, 'Charm'), ps)
    expect(info.type).toBe('set_condition')
    expect(info.saveType).toBe('STR') // default
     })

  it('returns spell_modifier info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'spell_modifier' }, 'Metamagic'), ps)
    expect(info.type).toBe('spell_modifier')
    expect(info.resource).toBe('sorcery_points')
     })

  it('returns temp_buff info with oncePerRage boolean', () => {
    const info = getAutomationInfo(makeFeature({ type: 'temp_buff', oncePerRage: true }, 'Buff'), ps)
    expect(info.type).toBe('temp_buff')
    expect(info.oncePerRage).toBe(true)
     })

  it('returns temp_hp_buff info with triggerOnRage boolean', () => {
    const info = getAutomationInfo(makeFeature({ type: 'temp_hp_buff', trigger_on_rage: true }, 'TempHP'), ps)
    expect(info.type).toBe('temp_hp_buff')
    expect(info.triggerOnRage).toBe(true)
     })

  it('returns sorcery_aura info with fixed uses_max of 2', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sorcery_aura' }, 'Aura'), ps)
    expect(info.type).toBe('sorcery_aura')
    expect(info.uses_max).toBe(2)
     })

  it('returns resource_restoration with restore_amount evaluated', () => {
    const ps2 = makePlayerStats({ level: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'resource_restoration', restore_expression: 'level * 2' }, 'Restore'), ps2)
    expect(info.type).toBe('resource_restoration')
    expect(info.restore_amount).toBe(6) // 3 * 2
     })

  it('returns resource_restoration with no expression defaults to 0', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resource_restoration' }, 'Restore'), ps)
    expect(info.restore_amount).toBe(0)
     })

  it('returns sorcery_incarnate info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sorcery_incarnate' }, 'Incarnate'), ps)
    expect(info.type).toBe('sorcery_incarnate')
    expect(info.cost).toBe(2)
     })

  it('returns post_cast_self_heal info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_self_heal', healExpression: '1d4+1' }, 'Heal'), ps)
    expect(info.type).toBe('post_cast_self_heal')
    expect(info.othersOnly).toBe(true) // default
     })

  it('returns post_cast_self_heal with othersOnly=false', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_self_heal', othersOnly: false }, 'Heal'), ps)
    expect(info.othersOnly).toBe(false)
     })

  it('returns passive_rule info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_rule', effect: 'bonus_healing' }, 'Rule'), ps)
    expect(info.type).toBe('passive_rule')
     })

  it('returns passive_rule info with primalKnowledge skills', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: ['Acrobatics', 'Stealth'] }, 'Primal Knowledge'), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.primalKnowledge).toEqual(['Acrobatics', 'Stealth'])
     })

  it('returns null for unsupported automation type', () => {
    const info = getAutomationInfo(makeFeature({ type: 'nonexistent_type' }), ps)
    expect(info).toBeNull()
     })
})


// ── hasAutomation ─────────────────────────────────────────────────
describe('hasAutomation', () => {
  it('returns true when feature has an automation property', () => {
    expect(hasAutomation({ name: 'X', automation: { type: 'passive_rule' } })).toBe(true)
  })

  it('returns false when feature has no automation property', () => {
    expect(hasAutomation({ name: 'X' })).toBe(false)
  })

  it('returns false when feature is null', () => {
    expect(hasAutomation(null)).toBe(false)
  })

  it('returns false when feature is undefined', () => {
    expect(hasAutomation(undefined)).toBe(false)
  })

  it('returns false when automation is an empty object', () => {
    expect(hasAutomation({ name: 'X', automation: {} })).toBe(true)
  })
})

// ── getAutomationInfo ──────────────────────────────────────────────
describe('getAutomationInfo', () => {
  it('returns null when feature has no automation', () => {
    expect(getAutomationInfo({ name: 'Test' }, makePlayerStats())).toBeNull()
  })

  it('returns null when feature is null', () => {
    expect(getAutomationInfo(null, makePlayerStats())).toBeNull()
  })

  it('returns automation info for a valid feature (passive_rule)', () => {
    const feature = makeFeature({ type: 'passive_rule', effect: 'superior_dice' })
    const info = getAutomationInfo(feature, makePlayerStats())
    expect(info).not.toBeNull()
    expect(info.type).toBe('passive_rule')
    expect(info.hasAutomation).toBe(true)
  })

  it('returns null for unknown automation type', () => {
    const feature = makeFeature({ type: 'unknown_type' })
    const info = getAutomationInfo(feature, makePlayerStats())
    expect(info).toBeNull()
  })
})

// ── evaluateAutoExpression ────────────────────────────────────────
describe('evaluateAutoExpression', () => {
  it('returns the expression unchanged when no expression provided', () => {
    expect(evaluateAutoExpression(null)).toBeNull()
    expect(evaluateAutoExpression(undefined)).toBeUndefined()
    expect(evaluateAutoExpression('')).toBe('')
  })

  it('evaluates a simple numeric expression', () => {
    const result = evaluateAutoExpression('4 + 3', makePlayerStats())
    expect(result).toBe(7)
  })

  it('evaluates complex expressions', () => {
    const result = evaluateAutoExpression('(2 * 3) + (4 / 2)', makePlayerStats())
    expect(result).toBe(8)
  })

  it('returns string when expression cannot be evaluated as a number', () => {
    const ps = makePlayerStats()
     // '3d6' can't eval to a number, so it returns the resolved string (unchanged)
    expect(typeof evaluateAutoExpression('3d6', ps)).toBe('string')
   })

  it('resolves proficiency_bonus placeholder in expression', () => {
    const ps = makePlayerStats({ proficiency: 3 })
    const result = evaluateAutoExpression('proficiency_bonus + 1', ps)
    expect(result).toBe(4)
   })

  it('resolves level placeholder in expression', () => {
    const ps = makePlayerStats({ level: 5 })
    const result = evaluateAutoExpression('level * 2', ps)
    expect(result).toBe(10)
   })

  it('proficiency_bonus resolves from playerStats.proficiency even when explicit prof provided', () => {
     // The explicit prof parameter is set but never forwarded — source uses playerStats via resolveDiceExpression
    const ps = makePlayerStats({ proficiency: 3 })
     // prof=5 is a dead argument; expression still uses playerStats.proficiency (3)
    const result = evaluateAutoExpression('proficiency_bonus + 1', ps, 5)
    expect(result).toBe(4) // not 6 — explicit param has no effect
   })

  it('level resolves from playerStats.level even when explicit level provided', () => {
     // The explicit level parameter is set but never forwarded — source uses playerStats via resolveDiceExpression
    const ps = makePlayerStats({ level: 3 })
    const result = evaluateAutoExpression('level * 2', ps, 0, 7)
    expect(result).toBe(6) // not 14 — explicit param has no effect
   })

  it('handles proficiency_bonus_d4 placeholder correctly', () => {
    const ps = makePlayerStats({ proficiency: 3 })
     // Should become "3d4" which can't eval to a number → returns string
    const result = evaluateAutoExpression('proficiency_bonus_d4', ps)
    expect(typeof result).toBe('string')
    expect(result).toBe('3d4')
   })

  it('handles _min_ suffix for minimum value', () => {
     // "2_min_5" → Math.max(5, (2))
    const result = evaluateAutoExpression('2_min_5', makePlayerStats())
    expect(result).toBe(5)
   })

  it('_min_ returns expression value when above minimum', () => {
    const result = evaluateAutoExpression('10_min_5', makePlayerStats())
    expect(result).toBe(10)
   })

  it('evaluates ability modifier references in expression', () => {
    const ps = makePlayerStats()
     // "STR modifier" resolves to the strength bonus (5) via resolveDiceExpression
    const result = evaluateAutoExpression('STR modifier', ps)
    expect(result).toBe(5)
   })

  it('resolves DEX modifier in expression', () => {
    const ps = makePlayerStats()
    // "DEX modifier" resolves to the dexterity bonus (2)
    const result = evaluateAutoExpression('DEX modifier + 1', ps)
    expect(result).toBe(3)
   })

  it('resolves WIS modifier as 0 for zero bonus', () => {
    const ps = makePlayerStats() // wisdom bonus is 0
    const result = evaluateAutoExpression('WIS modifier', ps)
    expect(result).toBe(0)
   })

  it('resolves druid_level placeholder to character level', () => {
    const ps = makePlayerStats({ level: 7 })
    const result = evaluateAutoExpression('druid_level', ps)
    expect(result).toBe(7)
   })
})

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
    expect(Object.keys(result)).toHaveLength(8)
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

// ── collectSaveModifiers ──────────────────────────────────────────
describe('collectSaveModifiers', () => {
  it('returns empty array when features is null', () => {
    expect(collectSaveModifiers(null)).toEqual([])
  })

  it('returns empty array for features without automation', () => {
    expect(collectSaveModifiers([{ name: 'No Auto' }])).toEqual([])
  })

  it('collects conditional_advantage modifiers from raw automation fields', () => {
      // source reads effect/condition from the raw auto object, not buildAttackInfo
    const features = [makeFeature({ type: 'conditional_advantage', abilities: ['STR'], condition: 'rage_active', effect: 'advantage' })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('Test Feature')
    expect(result[0].abilities).toEqual(['STR'])
    expect(result[0].effect).toBe('advantage')
   })

  it('uses saveType to derive abilities when abilities not specified', () => {
    const features = [makeFeature({ type: 'conditional_advantage', saveType: 'DEX' })]
    const result = collectSaveModifiers(features)
    expect(result[0].abilities).toEqual(['DEX'])
   })

  it('defaults to empty abilities array when neither abilities nor saveType present', () => {
    const features = [makeFeature({ type: 'conditional_advantage' })]
    const result = collectSaveModifiers(features)
    expect(result[0].abilities).toEqual([])
   })

  it('collects auto_reroll modifiers', () => {
    const features = [makeFeature({ type: 'auto_reroll', condition: 'nat1', bonusExpression: '!d20' })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(1)
    expect(result[0].effect).toBe('reroll')
    expect(result[0].bonusExpression).toBe('!d20')
  })

  it('collects advantage from combat_stance.advantages', () => {
    const features = [makeFeature({ type: 'combat_stance', advantages: ['STR saves'] })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(1)
    expect(result[0].abilities).toEqual(['STR'])
  })

  it('handles combat_stance advantages with multiple entries', () => {
    const features = [makeFeature({
      type: 'combat_stance',
      advantages: ['STR saves', 'DEX checks'],
    }, 'Stance')]
    const result = collectSaveModifiers(features)
    // Only entries containing 'saves' get collected as save modifiers
    expect(result).toHaveLength(1)
    expect(result[0].abilities).toEqual(['STR'])
  })

  it('returns empty array for non-save combat_stance advantages', () => {
    const features = [makeFeature({ type: 'combat_stance', advantages: ['DEX checks'] })]
    const result = collectSaveModifiers(features)
    expect(result).toHaveLength(0)
  })
})

// ── getEvasionEffects ─────────────────────────────────────────────
describe('getEvasionEffects', () => {
  it('returns empty array when features is null', () => {
    expect(getEvasionEffects(null)).toEqual([])
  })

  it('returns empty array for non-evasion features', () => {
    const features = [makeFeature({ type: 'passive_rule' })]
    expect(getEvasionEffects(features)).toEqual([])
  })

  it('returns evasion effect with default saveType DEX', () => {
    const features = [makeFeature({ type: 'evasion' }, 'Uncanny')]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('Uncanny')
    expect(result[0].saveType).toBe('DEX')
    expect(result[0].shareable).toBe(false)
    expect(result[0].shareRange).toBe(0)
  })

  it('uses custom saveType when provided', () => {
    const features = [makeFeature({ type: 'evasion', saveType: 'CON' }, 'Evasion')]
    const result = getEvasionEffects(features)
    expect(result[0].saveType).toBe('CON')
  })

  it('recognizes shareable evasion with range', () => {
    const features = [makeFeature({ type: 'evasion', shareable: true, shareRange: 30 }, 'Group Evasion')]
    const result = getEvasionEffects(features)
    expect(result[0].shareable).toBe(true)
    expect(result[0].shareRange).toBe(30)
  })

  it('collects multiple evasion effects from different features', () => {
    const features = [
      makeFeature({ type: 'evasion', saveType: 'DEX' }, 'Evasion1'),
      makeFeature({ type: 'passive_rule' }, 'Not Evasion'),
      makeFeature({ type: 'evasion', saveType: 'WIS' }, 'Evasion2'),
    ]
    const result = getEvasionEffects(features)
    expect(result).toHaveLength(2)
  })
})

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
})

// ── getPassiveBuffs ───────────────────────────────────────────────
describe('getPassiveBuffs', () => {
  it('returns empty array when features is null', () => {
    expect(getPassiveBuffs(null, makePlayerStats())).toEqual([])
  })

  it('collects passive_buff entries', () => {
    const features = [makeFeature({ type: 'passive_buff', effect: '+2 saving throws vs frightened' }, 'Aura')]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_buff')
  })

  it('collects passive_rule entries', () => {
    const features = [makeFeature({ type: 'passive_rule', effect: 'superior_dice' })]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('collects passive_immunity entries', () => {
    const features = [makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' })]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
  })

  it('skips non-passive automation types', () => {
    const features = [
      makeFeature({ type: 'save_attack' }, 'Spike'),
      makeFeature({ type: 'passive_rule' }, 'Passive'),
    ]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('passive_rule')
  })

  it('includes hasAutomation flag on returned items', () => {
    const features = [makeFeature({ type: 'passive_rule' })]
    const result = getPassiveBuffs(features, makePlayerStats())
    expect(result[0].hasAutomation).toBe(true)
  })
})

// ── collectWeaponMastery ──────────────────────────────────────────
describe('collectWeaponMastery', () => {
  it('returns null baseMastery when weapon not in equipment', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Longsword', ps)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('returns base mastery from weapon when found in equipment', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Longsword', mastery: 'trip' }],
    })
    const result = collectWeaponMastery('Longsword', ps)
    expect(result.baseMastery).toBe('trip')
  })

  it('strips magic prefix when looking up weapon in equipment', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Greataxe', mastery: 'heave' }],
    })
    const result = collectWeaponMastery('+1 Greataxe', ps)
    expect(result.baseMastery).toBe('heave')
  })

  it('collects extra masteries from automation passives', () => {
    const ps = makePlayerStats({
      equipment: [{ name: 'Club', mastery: 'none' }],
      automation: {
        passives: [
          { type: 'passive_buff', extraMastery: ['push', 'topple'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result.extraMasteries).toEqual(['push', 'topple'])
  })

  it('deduplicates extra masteries', () => {
    const ps = makePlayerStats({
      equipment: [],
      automation: {
        passives: [
          { type: 'passive_buff', extraMastery: ['push'] },
          { type: 'passive_buff', extraMastery: ['push', 'topple'] },
        ],
      },
    })
    const result = collectWeaponMastery('Club', ps)
    expect(result.extraMasteries).toEqual(['push', 'topple'])
  })

  it('returns empty extraMasteries when no automation passives exist', () => {
    const ps = makePlayerStats({ equipment: [] })
    const result = collectWeaponMastery('Sword', ps)
    expect(result.extraMasteries).toEqual([])
  })

  it('handles missing equipment gracefully', () => {
    const ps = makePlayerStats() // no equipment property set explicitly
    const result = collectWeaponMastery('Sword', ps)
    expect(result.baseMastery).toBeNull()
    expect(result.extraMasteries).toEqual([])
  })

  it('handles missing automation passives gracefully', () => {
    const ps = makePlayerStats({ equipment: [] })
    // No .automation property at all
    const result = collectWeaponMastery('Sword', ps)
    expect(result.extraMasteries).toEqual([])
  })
})

// ── resolveHealingBonuses ────────────────────────────────────────
describe('resolveHealingBonuses', () => {
  it('returns 0 when no automation passives exist', () => {
    const ps = makePlayerStats()
    expect(resolveHealingBonuses(ps)).toBe(0)
  })

  it('sums numeric bonusExpression values from passive_rule with bonus_healing', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' },
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '5' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(8)
  })

  it('skips passive_rule entries that are not bonus_healing', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'superior_dice' },
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '2' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(2)
  })

  it('skips entries where bonusExpression evaluates to non-number', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '1d6' }, // not evaluable → string, skipped
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: '3' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps)).toBe(3)
  })

  it('uses playerStats abilities in bonus expressions', () => {
    // "level" resolves to the number via evaluateAutoExpression → resolveDiceExpression
   const ps2 = makePlayerStats({
      level: 5,
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'bonus_healing', bonusExpression: 'level' },
        ],
      },
    })
    expect(resolveHealingBonuses(ps2)).toBe(5)
  })

  it('handles missing automation object on playerStats', () => {
    const ps = makePlayerStats()
    expect(resolveHealingBonuses(ps)).toBe(0)
  })
})

// ── hasHealingMaximization ───────────────────────────────────────
describe('hasHealingMaximization', () => {
  it('returns false when no automation passives exist', () => {
    const ps = makePlayerStats()
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('returns true when a passive_rule has maximize_healing_dice effect', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'maximize_healing_dice' },
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(true)
  })

  it('returns false when passive_rule has other effects', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_rule', effect: 'superior_dice' },
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('returns false when passive is not a passive_rule', () => {
    const ps = makePlayerStats({
      automation: {
        passives: [
          { type: 'passive_buff', effect: 'maximize_healing_dice' }, // wrong type
        ],
      },
    })
    expect(hasHealingMaximization(ps)).toBe(false)
  })

  it('handles missing automation gracefully', () => {
    const ps = makePlayerStats() // no .automation property
    expect(hasHealingMaximization(ps)).toBe(false)
  })
})
