import { describe, it, expect, beforeEach } from 'vitest'

import { getAutomationInfo } from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

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
