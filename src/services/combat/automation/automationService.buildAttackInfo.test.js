// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { getAutomationInfo } from './automationService.js'
import { makePlayerStats, makeFeature } from './automationService.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Assert that a returned info object has the structural shape every handler
 * produces: type, name, hasAutomation.  This catches the common mistake of a
 * handler returning null or an object missing those fields.
 */
function expectHasStructure(info, expectedType) {
  expect(info).not.toBeNull()
  expect(info).not.toBeUndefined()
  expect(info.type).toBe(expectedType)
  expect(info.name).toBeDefined()
  expect(info.hasAutomation).toBe(true)
}

// ── getAutomationInfo – input validation & edge paths ────────────────────────

describe('getAutomationInfo – input validation', () => {
  const ps = makePlayerStats()

  it('returns null when feature is null', () => {
    expect(getAutomationInfo(null, ps)).toBeNull()
  })

  it('returns null when feature is an empty object', () => {
    expect(getAutomationInfo({}, ps)).toBeNull()
  })

  it('returns null when feature has no automation property', () => {
    expect(getAutomationInfo({ name: 'Test' }, ps)).toBeNull()
  })

  it('returns null when automation is null', () => {
    expect(getAutomationInfo({ automation: null }, ps)).toBeNull()
  })

  it('returns null when feature.automation is an array but no handler matches', () => {
    const info = getAutomationInfo(makeFeature([{ type: 'nonexistent' }, { type: 'also_nonexistent' }]), ps)
    expect(info).toBeNull()
  })

  it('returns the first matching automation when feature.automation is an array', () => {
    const info = getAutomationInfo(makeFeature([{ type: 'attack_rider' }, { type: 'auto_effect' }]), ps)
    expect(info.type).toBe('attack_rider')
  })

  it('returns null for unsupported automation type', () => {
    const info = getAutomationInfo(makeFeature({ type: 'nonexistent_type' }), ps)
    expect(info).toBeNull()
  })
})

// ── attack_rider ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – attack_rider', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'attack_rider' }), ps)
    expectHasStructure(info, 'attack_rider')
    expect(info.options).toEqual([])
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('')
    expect(info.trigger).toBe('')
    expect(info.cost).toBeNull()
    expect(info.oncePerTurn).toBe(false)
    expect(info.chooseOne).toBe(false)
    expect(info.maxEffects).toBe(1)
    expect(info.saveType).toBeNull()
    expect(info.saveDc).toBeNull()
    expect(info.saveAbility).toBeNull()
    expect(info.damageDoubled).toBe(false)
    expect(info.restoreCost).toBeNull()
    expect(info.uses).toBeNull()
    expect(info.recharge).toBe('long_rest')
    expect(info.casting_time).toBe('passive')
  })

  it('returns attack_rider with custom options and damageExpression', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'attack_rider',
      options: ['extra_crit'],
      damageExpression: '1d8',
      trigger: 'hit',
    }), ps)
    expect(info.options).toEqual(['extra_crit'])
    expect(info.damageExpression).toBe('1d8')
    expect(info.trigger).toBe('hit')
  })

  it('applies scaling to damageExpression at higher level', () => {
    const ps2 = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({
      type: 'attack_rider',
      scaling: { 3: '2d6', 5: '3d6' },
    }), ps2)
    expect(info.damageExpression).toBe('3d6')
  })

  it('derives push option from effect + distance', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'attack_rider',
      effect: 'push',
      distance: '15 ft',
      sizeLimit: 'Huge',
    }), ps)
    expect(info.options).toEqual([{
      name: 'Push',
      effect: 'push',
      value: 15,
      sizeLimit: 'Huge',
    }])
  })

  it('derives push_or_prone option from effect', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'attack_rider',
      effect: 'push_or_prone',
      distance: '10 ft',
    }), ps)
    expect(info.options.length).toBe(2)
    expect(info.options[0].effect).toBe('push')
    expect(info.options[0].value).toBe(10)
    expect(info.options[1].effect).toBe('prone')
  })

  it('handles effects array with damage_bonus option', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'attack_rider',
      effects: [{ option: 'damage_bonus', dice: '2d4', damageType: 'fire', name: 'Fire Boost' }],
    }), ps)
    expect(info.options).toEqual([{
      name: 'Fire Boost',
      effect: 'damage_bonus',
      damageExpression: '2d4',
      damageType: 'fire',
    }])
  })
})

// ── mastery_rider ────────────────────────────────────────────────────────────

describe('buildAttackInfo – mastery_rider', () => {
  const ps = makePlayerStats()

  it('returns mastery_rider info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'mastery_rider' }), ps)
    expectHasStructure(info, 'mastery_rider')
    expect(info.masteries).toEqual([])
    expect(info.extraMastery).toEqual([])
    expect(info.trigger).toBe('hit')
  })

  it('returns mastery_rider with masteries', () => {
    const info = getAutomationInfo(makeFeature({ type: 'mastery_rider', masteries: ['trip', 'shove'] }), ps)
    expect(info.masteries).toEqual(['trip', 'shove'])
  })
})

// ── bonus_action_attack ──────────────────────────────────────────────────────

describe('buildAttackInfo – bonus_action_attack', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_action_attack' }), ps)
    expectHasStructure(info, 'bonus_action_attack')
    expect(info.action).toBe('bonus_action')
    expect(info.usesMax).toBe(0)
    expect(info.recharge).toBe('long_rest')
    expect(info.resourceKey).toBe('warPriestUses')
    expect(info.weaponAttack).toBe(false)
    expect(info.extraDamageExpression).toBe('')
    expect(info.weaponRequirement).toBeNull()
    expect(info.trigger).toBe('')
  })

  it('evaluates uses_expression via evaluateAutoExpression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_action_attack', uses_expression: 'WIS modifier_min_1' }), ps)
    expect(info.usesMax).toBe(1)
  })

  it('honors weaponAttack and extraDamageExpression', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'bonus_action_attack',
      weaponAttack: true,
      extraDamageExpression: '1d4',
      weaponRequirement: 'melee',
    }), ps)
    expect(info.weaponAttack).toBe(true)
    expect(info.extraDamageExpression).toBe('1d4')
    expect(info.weaponRequirement).toBe('melee')
  })
})

// ── bonus_attacks ────────────────────────────────────────────────────────────

describe('buildAttackInfo – bonus_attacks', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_attacks' }), ps)
    expectHasStructure(info, 'bonus_attacks')
    expect(info.attacks).toBe(2)
    expect(info.attackType).toBe('unarmed_strike')
    expect(info.action).toBeNull()
    expect(info.cost).toBeNull()
    expect(info.trigger).toBe('after_attack_action')
    expect(info.weaponRequirements).toBeNull()
    expect(info.weaponRestriction).toBeNull()
    expect(info.casting_time).toBeNull()
  })

  it('derives action from casting_time', () => {
    const info1 = getAutomationInfo(makeFeature({ type: 'bonus_attacks', casting_time: '1 bonus action' }), ps)
    expect(info1.action).toBe('bonus_action')

    const info2 = getAutomationInfo(makeFeature({ type: 'bonus_attacks', casting_time: 'reaction' }), ps)
    expect(info2.action).toBe('reaction')

    const info3 = getAutomationInfo(makeFeature({ type: 'bonus_attacks', casting_time: '1 action' }), ps)
    expect(info3.action).toBe('action')
  })

  it('uses extraAttacks fallback', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_attacks', extraAttacks: 3 }), ps)
    expect(info.attacks).toBe(3)
  })
})

// ── auto_effect ──────────────────────────────────────────────────────────────

describe('buildAttackInfo – auto_effect', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_effect' }), ps)
    expectHasStructure(info, 'auto_effect')
    expect(info.trigger).toBe('')
    expect(info.effect).toBe('')
    expect(info.value).toBeNull()
    expect(info.uses).toBeNull()
    expect(info.recharge).toBe('long_rest')
  })

  it('returns auto_effect with effect and trigger', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_effect', effect: '+2d6', trigger: 'hit' }), ps)
    expect(info.effect).toBe('+2d6')
    expect(info.trigger).toBe('hit')
  })
})

// ── auto_reroll ──────────────────────────────────────────────────────────────

describe('buildAttackInfo – auto_reroll', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_reroll' }), ps)
    expectHasStructure(info, 'auto_reroll')
    expect(info.target).toBe('d20')
    expect(info.effect).toBe('reroll')
    expect(info.condition).toBe('')
    expect(info.trigger).toBe('')
    expect(info.bonus).toBeNull()
    expect(info.range).toBe('')
    expect(info.resourceCost).toBe('')
    expect(info.casting_time).toBe('')
    expect(info.bonusExpression).toBe('')
    expect(info.oncePerRage).toBe(false)
    expect(info.oncePerTurn).toBe(false)
    expect(info.oncePer).toBe('')
  })

  it('returns auto_reroll with target saving_throw', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_reroll', target: 'saving_throw' }), ps)
    expect(info.target).toBe('saving_throw')
  })

  it('honors custom bonus and bonusExpression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'auto_reroll', bonus: 5, bonusExpression: 'proficiency_bonus' }), ps)
    expect(info.bonus).toBe(5)
    expect(info.bonusExpression).toBe('proficiency_bonus')
  })
})

// ── bardic_inspiration ───────────────────────────────────────────────────────

describe('buildAttackInfo – bardic_inspiration', () => {
  it('returns dieSize from class_levels and usesMax from expression', () => {
    const ps = makePlayerStats({
      level: 3,
      class: { name: 'Bard', levels: 5, class_levels: [{ level: 1 }, { level: 2 }, { level: 3, bardic_die: 8 }] },
    })
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration', uses_expression: 'proficiency_bonus' }), ps)
    expectHasStructure(info, 'bardic_inspiration')
    expect(info.dieSize).toBe(8)
    expect(info.usesMax).toBe(ps.proficiency)
    expect(info.range).toBe('60_ft')
    expect(info.action).toBe('bonus_action')
    expect(info.usesRecharge).toBe('long_rest')
  })

  it('defaults dieSize to 6 when not in class_levels', () => {
    const ps = makePlayerStats()
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration' }), ps)
    expect(info.dieSize).toBe(6)
  })

  it('defaults usesMax to 0 when no uses_expression', () => {
    const ps = makePlayerStats()
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration' }), ps)
    expect(info.usesMax).toBe(0)
  })
})

// ── bardic_inspiration_defense / offense ─────────────────────────────────────

describe('buildAttackInfo – bardic inspiration variants', () => {
  const ps = makePlayerStats()

  it('returns bardic_inspiration_defense', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration_defense' }), ps)
    expectHasStructure(info, 'bardic_inspiration_defense')
  })

  it('returns bardic_inspiration_offense', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bardic_inspiration_offense' }), ps)
    expectHasStructure(info, 'bardic_inspiration_offense')
  })
})

// ── combat_stance ────────────────────────────────────────────────────────────

describe('buildAttackInfo – combat_stance', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'combat_stance' }), ps)
    expectHasStructure(info, 'combat_stance')
    expect(info.resourceKey).toBe('ragePoints')
    expect(info.uses).toBe(0)
  })
})

// ── conditional_advantage / disadvantage ─────────────────────────────────────

describe('buildAttackInfo – conditional_advantage', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'conditional_advantage' }), ps)
    expectHasStructure(info, 'conditional_advantage')
    expect(info.target).toBe('saving_throw')
    expect(info.condition).toBe('')
    expect(info.effect).toBe('advantage')
    expect(info.abilities).toEqual([])
    expect(info.uses).toBeNull()
    expect(info.recharge).toBe('long_rest')
    expect(info.casting_time).toBe('passive')
    expect(info.trigger).toBe('')
  })
})

describe('buildAttackInfo – conditional_disadvantage', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'conditional_disadvantage' }), ps)
    expectHasStructure(info, 'conditional_disadvantage')
    expect(info.target).toBe('attack_roll')
    expect(info.condition).toBe('')
    expect(info.effect).toBe('disadvantage')
    expect(info.abilities).toEqual([])
  })
})

// ── evasion ──────────────────────────────────────────────────────────────────

describe('buildAttackInfo – evasion', () => {
  const ps = makePlayerStats()

  it('returns info with default saveType DEX', () => {
    const info = getAutomationInfo(makeFeature({ type: 'evasion' }), ps)
    expectHasStructure(info, 'evasion')
    expect(info.saveType).toBe('DEX')
    expect(info.shareable).toBe(false)
    expect(info.shareRange).toBe(0)
  })

  it('returns info with custom saveType', () => {
    const info = getAutomationInfo(makeFeature({ type: 'evasion', saveType: 'CON' }), ps)
    expect(info.saveType).toBe('CON')
  })

  it('returns info with shareable and shareRange', () => {
    const info = getAutomationInfo(makeFeature({ type: 'evasion', shareable: true, shareRange: 5 }), ps)
    expect(info.shareable).toBe(true)
    expect(info.shareRange).toBe(5)
  })
})

// ── save_proficiency ─────────────────────────────────────────────────────────

describe('buildAttackInfo – save_proficiency', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'save_proficiency' }), ps)
    expectHasStructure(info, 'save_proficiency')
    expect(info.saveType).toBe('')
    expect(info.fallbackTypes).toEqual([])
  })
})

// ── condition_immunity_while_active ──────────────────────────────────────────

describe('buildAttackInfo – condition_immunity_while_active', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'condition_immunity_while_active', immunities: ['frightened'], requiresActive: 'aura' }), ps)
    expectHasStructure(info, 'condition_immunity_while_active')
    expect(info.target).toBe('self')
    expect(info.immunities).toEqual(['frightened'])
    expect(info.requiresActive).toBe('aura')
  })
})

// ── conditional_replacement ──────────────────────────────────────────────────

describe('buildAttackInfo – conditional_replacement', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'conditional_replacement' }), ps)
    expectHasStructure(info, 'conditional_replacement')
    expect(info.target).toBe('saving_throw')
    expect(info.saveType).toBe('')
    expect(info.condition).toBe('')
    expect(info.effect).toBe('')
    expect(info.replacementAbility).toBe('')
  })
})

// ── damage_aura ──────────────────────────────────────────────────────────────

describe('buildAttackInfo – damage_aura', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_aura' }), ps)
    expectHasStructure(info, 'damage_aura')
    expect(info.damageType).toBe('')
    expect(info.damageExpression).toBe('')
    expect(info.range).toBe('10_ft')
    expect(info.duration).toBe('1_minute')
    expect(info.recharge).toBe('long_rest')
  })

  it('returns info with custom values', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_aura', damageType: 'lightning', damageExpression: '1d8' }), ps)
    expect(info.damageType).toBe('lightning')
    expect(info.damageExpression).toBe('1d8')
  })
})

// ── damage_bonus ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – damage_bonus', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_bonus' }), ps)
    expectHasStructure(info, 'damage_bonus')
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('')
    expect(info.maxDamage).toBe('')
    expect(info.extraVs).toBeNull()
    expect(info.extraDamage).toBe('')
    expect(info.extraDamageExpression).toBe('')
    expect(info.extraDamageType).toBe('')
    expect(info.resourceType).toBe('spell_slot')
    expect(info.oncePerTurn).toBe(false)
    expect(info.options).toEqual([])
    expect(info.tempHpExpression).toBe('')
    expect(info.upgrades).toBe('')
    expect(info.rangeBonusCantrip).toBe('')
    expect(info.uses_expression).toBe('')
    expect(info.usesMax).toBe(0)
    expect(info.recharge).toBe('')
    expect(info.abilityIncreased).toBe('')
    expect(info.trigger).toBe('')
  })

  it('returns info with custom options and damageExpression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_bonus', damageExpression: '1d8', options: ['fire'] }), ps)
    expect(info.options).toEqual(['fire'])
    expect(info.damageExpression).toBe('1d8')
  })

  it('evaluates uses_expression or uses', () => {
    const infoWithExpr = getAutomationInfo(makeFeature({ type: 'damage_bonus', uses_expression: 'proficiency_bonus' }), ps)
    expect(infoWithExpr.usesMax).toBe(2)

    const infoWithUses = getAutomationInfo(makeFeature({ type: 'damage_bonus', uses: 3 }), ps)
    expect(infoWithUses.usesMax).toBe(3)
  })

  it('applies scaling to damageExpression at higher level', () => {
    const ps2 = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({ type: 'damage_bonus', damageExpression: '1d6', scaling: { 3: '2d6' } }), ps2)
    expect(info.damageExpression).toBe('2d6')
  })
})

// ── damage_modifier ──────────────────────────────────────────────────────────

describe('buildAttackInfo – damage_modifier', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_modifier' }), ps)
    expectHasStructure(info, 'damage_modifier')
    expect(info.trigger).toBe('')
    expect(info.modifierExpression).toBe('')
  })
})

// ── damage_type_modifier ─────────────────────────────────────────────────────

describe('buildAttackInfo – damage_type_modifier', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_type_modifier' }), ps)
    expectHasStructure(info, 'damage_type_modifier')
    expect(info.weaponTypes).toEqual([])
    expect(info.options).toEqual([])
    expect(info.trigger).toBe('')
  })
})

// ── damage_type_choice ───────────────────────────────────────────────────────

describe('buildAttackInfo – damage_type_choice', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_type_choice' }), ps)
    expectHasStructure(info, 'damage_type_choice')
    expect(info.damageTypes).toEqual([])
    expect(info.effect).toBe('')
    expect(info.casting_time).toBe('passive')
    expect(info.minDamage).toBe(false)
  })
})

// ── weapon_mastery_choice ────────────────────────────────────────────────────

describe('buildAttackInfo – weapon_mastery_choice', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'weapon_mastery_choice' }), ps)
    expectHasStructure(info, 'weapon_mastery_choice')
    expect(info.masteryProperties).toEqual([])
    expect(info.effect).toBe('extra_mastery')
    expect(info.casting_time).toBe('passive')
  })
})

// ── damage_reduction ─────────────────────────────────────────────────────────

describe('buildAttackInfo – damage_reduction', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_reduction' }), ps)
    expectHasStructure(info, 'damage_reduction')
    expect(info.reductionExpression).toBe('')
    expect(info.trigger).toBe('')
    expect(info.reaction).toBe(false)
    expect(info.redirect).toBe(false)
    expect(info.redirectCost).toBeNull()
    expect(info.redirectDamage).toBe('')
    expect(info.redirectSave).toBe('DEX')
    expect(info.cost).toBeNull()
    expect(info.damageTypes).toEqual([])
    expect(info.condition).toBe('')
    expect(info.effect).toBe('')
    expect(info.requiresShield).toBe(false)
  })

  it('returns info with custom values', () => {
    const info = getAutomationInfo(makeFeature({ type: 'damage_reduction', reductionExpression: 'level + con_mod' }), ps)
    expect(info.reductionExpression).toBe('level + con_mod')
  })
})

// ── great_weapon_fighting / grapple_damage / two_weapon_fighting / reroll_damage_once_per_turn ──

describe('buildAttackInfo – passive_rule damage handlers', () => {
  const ps = makePlayerStats()

  it('returns great_weapon_fighting as passive_rule', () => {
    const info = getAutomationInfo(makeFeature({ type: 'great_weapon_fighting' }), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('great_weapon_fighting')
    expectHasStructure(info, 'passive_rule')
  })

  it('returns grapple_damage as passive_rule', () => {
    const info = getAutomationInfo(makeFeature({ type: 'grapple_damage' }), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('grapple_damage')
    expectHasStructure(info, 'passive_rule')
  })

  it('returns two_weapon_fighting as passive_rule', () => {
    const info = getAutomationInfo(makeFeature({ type: 'two_weapon_fighting' }), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('two_weapon_fighting')
    expectHasStructure(info, 'passive_rule')
  })

  it('returns reroll_damage_once_per_turn as passive_rule', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reroll_damage_once_per_turn' }), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('reroll_damage_once_per_turn')
    expectHasStructure(info, 'passive_rule')
  })
})

// ── psionic_strike ───────────────────────────────────────────────────────────

describe('buildAttackInfo – psionic_strike', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'psionic_strike' }), ps)
    expectHasStructure(info, 'psionic_strike')
    expect(info.resource).toBe('psionicEnergy')
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('Force')
    expect(info.oncePerTurn).toBe(false)
    expect(info.trigger).toBe('after_attack_hit')
  })
})

// ── primal_companion_double_strike_damage ────────────────────────────────────

describe('buildAttackInfo – primal_companion_double_strike_damage', () => {
  const ps = makePlayerStats()

  it('returns damage_bonus with fixed trigger', () => {
    const info = getAutomationInfo(makeFeature({ type: 'primal_companion_double_strike_damage', damageExpression: '1d6' }), ps)
    expect(info.type).toBe('damage_bonus')
    expect(info.trigger).toBe('companion_beasts_strike_hit')
  })
})

// ── damage handler (feature.type === 'damage') ──────────────────────────────

describe('buildAttackInfo – damage (feature-level dispatch)', () => {
  const ps = makePlayerStats()

  it('returns passive_rule for great_weapon_fighting when feature.type is damage', () => {
    const feature = {
      type: 'damage',
      source: 'feat',
      name: 'GWF',
      automation: { type: 'great_weapon_fighting' },
    }
    const info = getAutomationInfo(feature, ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('great_weapon_fighting')
  })

  it('returns passive_rule for two_weapon_fighting when feature.type is two_weapon_fighting', () => {
    const feature = {
      type: 'two_weapon_fighting',
      source: 'feat',
      name: 'TWF',
      automation: { type: 'two_weapon_fighting' },
    }
    const info = getAutomationInfo(feature, ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('two_weapon_fighting')
  })

  it('returns null for unsupported feature.type + automation combination', () => {
    const feature = {
      type: 'damage',
      source: 'feat',
      name: 'Unknown',
      automation: { type: 'nonexistent' },
    }
    const info = getAutomationInfo(feature, ps)
    expect(info).toBeNull()
  })
})

// ── extra_action ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – extra_action', () => {
  const ps = makePlayerStats()

  it('returns info with resourceKey derived from feature name', () => {
    const info = getAutomationInfo(makeFeature({ type: 'extra_action' }, 'Extra Strike'), ps)
    expectHasStructure(info, 'extra_action')
    expect(info.resourceKey).toBe('extrastrikeUses')
  })
})

// ── open_hand_technique ──────────────────────────────────────────────────────

describe('buildAttackInfo – open_hand_technique', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'open_hand_technique' }, 'Open Hand'), ps)
    expectHasStructure(info, 'open_hand_technique')
    expect(info.options).toEqual([])
    expect(info.saveType).toBe('STR')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('WIS')
  })
})

// ── concentration_bonus_attack ───────────────────────────────────────────────

describe('buildAttackInfo – concentration_bonus_attack', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'concentration_bonus_attack' }), ps)
    expectHasStructure(info, 'concentration_bonus_attack')
    expect(info.trigger).toBe('each_turn')
    expect(info.action).toBe('bonus_action')
    expect(info.weaponAttack).toBe(false)
    expect(info.concentrationSpell).toBe('')
    expect(info.casting_time).toBe('1 bonus action')
    expect(info.attacks).toBe(2)
    expect(info.weaponRequirement).toBeNull()
    expect(info.attack_type).toBe('ranged')
  })
})

// ── stealth_attack ───────────────────────────────────────────────────────────

describe('buildAttackInfo – stealth_attack', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'stealth_attack' }), ps)
    expectHasStructure(info, 'stealth_attack')
    expect(info.cost).toBe('1d6')
    expect(info.casting_time).toBe('passive')
  })
})

// ── war_bond_summon ──────────────────────────────────────────────────────────

describe('buildAttackInfo – war_bond_summon', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'war_bond_summon' }), ps)
    expectHasStructure(info, 'war_bond_summon')
    expect(info.action).toBe('bonus_action')
    expect(info.bondedWeaponCount).toBe(2)
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── divine_intervention / font_of_magic ──────────────────────────────────────

describe('buildAttackInfo – divine_intervention', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'divine_intervention' }, 'DI'), ps)
    expectHasStructure(info, 'divine_intervention')
    expect(info.recharge).toBe('long_rest')
  })
})

describe('buildAttackInfo – font_of_magic', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'font_of_magic' }, 'Font'), ps)
    expectHasStructure(info, 'font_of_magic')
  })
})

// ── free_spell ───────────────────────────────────────────────────────────────

describe('buildAttackInfo – free_spell', () => {
  const ps = makePlayerStats()

  it('returns info with single spell string', () => {
    const info = getAutomationInfo(makeFeature({ type: 'free_spell', spell: 'misty_step', concentration: true }, 'Free Spell'), ps)
    expectHasStructure(info, 'free_spell')
    expect(info.spell).toBe('misty_step')
    expect(info.concentration).toBe(true)
  })

  it('returns info with array spell and resourceCost', () => {
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
})

// ── healing ──────────────────────────────────────────────────────────────────

describe('buildAttackInfo – healing', () => {
  it('returns info with healAmount resolved from expression', () => {
    const ps = makePlayerStats({ level: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'healing', healExpression: 'level + 5' }, 'Heal'), ps)
    expectHasStructure(info, 'healing')
    expect(info.healAmount).toBe(8)
    expect(info.healExpression).toBe('level + 5')
    expect(info.action).toBe('action')
    expect(info.uses).toBeNull()
    expect(info.usesMax).toBeNull()
    expect(info.recharge).toBe('long_rest')
    expect(info.casting_time).toBe('')
  })

  it('defaults healAmount to 0 when no expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'healing' }, 'Heal'), makePlayerStats())
    expect(info.healAmount).toBe(0)
  })
})

// ── healing_pool ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – healing_pool', () => {
  const ps = makePlayerStats()

  it('returns info with dice expression parsing', () => {
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '3d6' }, 'Pool'), ps)
    expectHasStructure(info, 'healing_pool')
    expect(info.pool).toBe(3)
    expect(info.isDicePool).toBe(true)
    expect(info.dieType).toBe(6)
    expect(info.poolExpression).toBe('3d6')
    expect(info.action).toBe('action')
    expect(info.recharge).toBe('long_rest')
    expect(info.alsoCures).toEqual([])
    expect(info.cureCost).toBe(5)
    expect(info.range).toBe('')
    expect(info.resourceCost).toBe('')
    expect(info.maxDicePerUse).toBe('')
  })

  it('applies scaling to pool expression at higher level', () => {
    const ps2 = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '1d6', scaling: { 3: '2d6' } }, 'Pool'), ps2)
    expect(info.pool).toBe(2)
  })

  it('evaluates numeric scaling expression', () => {
    const ps2 = makePlayerStats({ level: 10 })
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '0', scaling: { 5: 'level * 3' } }, 'Pool'), ps2)
    expect(info.pool).toBe(30)
    expect(info.isDicePool).toBe(false)
  })

  it('honors explicit isDicePool flag', () => {
    const info = getAutomationInfo(makeFeature({ type: 'healing_pool', poolExpression: '5', isDicePool: true, dieType: 8 }, 'Pool'), ps)
    expect(info.isDicePool).toBe(true)
    expect(info.dieType).toBe(8)
  })
})

// ── self_healing ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – self_healing', () => {
  it('returns info with healAmount resolved from expression', () => {
    const ps = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({ type: 'self_healing', healExpression: 'level + 2' }, 'Regen'), ps)
    expectHasStructure(info, 'self_healing')
    expect(info.healAmount).toBe(7)
    expect(info.healExpression).toBe('level + 2')
    expect(info.action).toBe('action')
    expect(info.uses).toBe(1)
    expect(info.usesMax).toBe(1)
    expect(info.recharge).toBe('short_rest')
    expect(info.bloodiedOnly).toBe(false)
    expect(info.hitDiceCost).toBe(0)
  })

  it('defaults healAmount to 0 when no expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'self_healing' }, 'Regen'), makePlayerStats())
    expect(info.healAmount).toBe(0)
  })

  it('uses hit_die_roll special expression to get hit die size', () => {
    const ps = makePlayerStats({
      level: 5,
      class: { name: 'Barbarian', levels: 5, hit_point_die: 12 },
    })
    const info = getAutomationInfo(makeFeature({ type: 'self_healing', healExpression: 'hit_die_roll' }, 'Regen'), ps)
    expect(info.healAmount).toBe(12)
  })
})

// ── buff_ally ────────────────────────────────────────────────────────────────

describe('buildAttackInfo – buff_ally', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'buff_ally' }), ps)
    expectHasStructure(info, 'buff_ally')
    expect(info.buffExpression).toBe('')
    expect(info.range).toBe('60_ft')
    expect(info.action).toBe('bonus_action')
    expect(info.usesMax).toBe(0)
    expect(info.usesRecharge).toBe('long_rest')
  })

  it('evaluates uses_expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'buff_ally', uses_expression: 'proficiency_bonus' }), ps)
    expect(info.usesMax).toBe(ps.proficiency)
  })
})

// ── heroic_inspiration_buff ──────────────────────────────────────────────────

describe('buildAttackInfo – heroic_inspiration_buff', () => {
  const ps = makePlayerStats()

  it('returns buff_ally with short_or_long_rest recharge', () => {
    const info = getAutomationInfo(makeFeature({ type: 'heroic_inspiration_buff', uses_expression: 'proficiency_bonus' }), ps)
    expect(info.type).toBe('buff_ally')
    expect(info.usesRecharge).toBe('short_or_long_rest')
    expect(info.action).toBe('action')
    expect(info.targetsExpression).toBe('')
  })
})

// ── divine_spark ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – divine_spark', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'divine_spark' }, 'Spark'), ps)
    expectHasStructure(info, 'divine_spark')
    expect(info.range).toBe('30 ft')
    expect(info.healExpression).toBe('')
    expect(info.damageExpression).toBe('')
    expect(info.damageTypes).toEqual([])
    expect(info.saveType).toBe('CON')
    expect(info.resourceCost).toBe('')
  })
})

// ── reaction_save_heal ───────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_save_heal', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_save_heal' }, 'SaveHeal'), ps)
    expectHasStructure(info, 'reaction_save_heal')
    expect(info.saveType).toBe('CON')
    expect(info.saveDc).toBe(10)
    expect(info.dcScaling).toBe(0)
    expect(info.healExpression).toBe('')
    expect(info.recharge).toBe('short_or_long_rest')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── post_cast_self_heal / post_cast_ally_heal ────────────────────────────────

describe('buildAttackInfo – post_cast_self_heal', () => {
  const ps = makePlayerStats()

  it('returns info with defaults (othersOnly=true)', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_self_heal', healExpression: '1d4+1' }, 'Heal'), ps)
    expectHasStructure(info, 'post_cast_self_heal')
    expect(info.othersOnly).toBe(true)
  })

  it('honors othersOnly=false', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_self_heal', othersOnly: false }, 'Heal'), ps)
    expect(info.othersOnly).toBe(false)
  })
})

describe('buildAttackInfo – post_cast_ally_heal', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_ally_heal', healExpression: '2d8' }, 'AllyHeal'), ps)
    expectHasStructure(info, 'post_cast_ally_heal')
    expect(info.othersOnly).toBe(true)
    expect(info.range).toBe('30_ft')
  })
})

// ── heroes_feast ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – heroes_feast', () => {
  it('returns info with hpMaxIncrease resolved', () => {
    const ps = makePlayerStats({ level: 4 })
    const info = getAutomationInfo(makeFeature({ type: 'heroes_feast', hpMaxIncreaseExpression: 'level * 3' }, 'Feast'), ps)
    expectHasStructure(info, 'heroes_feast')
    expect(info.hpMaxIncrease).toBe(12)
    expect(info.hpMaxIncreaseExpression).toBe('level * 3')
    expect(info.slotLevel).toBe(6)
    expect(info.range).toBe('Self')
    expect(info.maxTargets).toBe(12)
    expect(info.duration).toBe('24 hours')
    expect(info.action).toBe('action')
  })

  it('defaults hpMaxIncrease to 11 when no expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'heroes_feast' }, 'Feast'), makePlayerStats())
    expect(info.hpMaxIncrease).toBe(11)
  })
})

// ── healing_bonus ────────────────────────────────────────────────────────────

describe('buildAttackInfo – healing_bonus', () => {
  const ps = makePlayerStats()

  it('returns passive_rule with bonus_healing effect', () => {
    const info = getAutomationInfo(makeFeature({ type: 'healing_bonus', extraHealing: '2d4+1' }, 'Healing Bonus'), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('bonus_healing')
    expect(info.bonusExpression).toBe('2d4+1')
  })
})

// ── initiative_action ────────────────────────────────────────────────────────

describe('buildAttackInfo – initiative_action', () => {
  const ps = makePlayerStats()

  it('returns info with name-derived resourceKey', () => {
    const info = getAutomationInfo(makeFeature({ type: 'initiative_action' }, 'Scout'), ps)
    expectHasStructure(info, 'initiative_action')
    expect(info.resourceKey).toBe('scoutUses')
  })
})

// ── meta ─────────────────────────────────────────────────────────────────────

describe('buildAttackInfo – meta', () => {
  const ps = makePlayerStats()

  it('returns info', () => {
    const info = getAutomationInfo(makeFeature({ type: 'meta', effect: '+1d4' }, 'Metamagic'), ps)
    expectHasStructure(info, 'meta')
  })
})

// ── passive_buff ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – passive_buff', () => {
  const ps = makePlayerStats()

  it('returns info with bonus and options', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_buff', bonusExpression: '+2', options: ['while_raging'] }, 'Aura'), ps)
    expectHasStructure(info, 'passive_buff')
    expect(info.bonusExpression).toBe('+2')
  })
})

// ── passive_immunity ─────────────────────────────────────────────────────────

describe('buildAttackInfo – passive_immunity', () => {
  const ps = makePlayerStats()

  it('returns info with conditionImmunity', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_immunity', conditionImmunity: 'charmed' }, 'Imm'), ps)
    expectHasStructure(info, 'passive_immunity')
    expect(info.conditionImmunity).toBe('charmed')
  })
})

// ── passive_rule ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – passive_rule', () => {
  const ps = makePlayerStats()

  it('returns info with generic effect', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_rule', effect: 'bonus_healing' }, 'Rule'), ps)
    expectHasStructure(info, 'passive_rule')
    expect(info.effect).toBe('bonus_healing')
    expect(info.bonusExpression).toBe('')
    expect(info.criticalRange).toBe('')
    expect(info.spells).toEqual([])
    expect(info.riderSave).toBeNull()
    expect(info.primalKnowledge).toEqual([])
    expect(info.casting_time).toBe('')
    expect(info.cost).toBe(0)
    expect(info.resource).toBe('')
    expect(info.resistanceTypes).toEqual([])
    expect(info.duration).toBe('')
    expect(info.endsOnCondition).toBe('')
  })

  it('returns info with ignore_resistance effect', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_rule', effect: 'ignore_resistance', damageTypes: ['fire'] }, 'Ignore Resist'), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('ignore_resistance')
    expect(info.damageTypes).toEqual(['fire'])
  })

  it('returns info with primalKnowledge skills', () => {
    const info = getAutomationInfo(makeFeature({ type: 'passive_rule', effect: 'primal_knowledge', skills: ['Acrobatics', 'Stealth'] }, 'Primal Knowledge'), ps)
    expect(info.primalKnowledge).toEqual(['Acrobatics', 'Stealth'])
  })
})

// ── post_cast_rider ──────────────────────────────────────────────────────────

describe('buildAttackInfo – post_cast_rider', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_rider' }, 'Rider'), ps)
    expectHasStructure(info, 'post_cast_rider')
    expect(info.saveType).toBe('WIS')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('CHA')
    expect(info.condition).toBe('')
    expect(info.duration).toBe('1_minute')
    expect(info.range).toBe('60 ft')
    expect(info.spellSchools).toEqual([])
    expect(info.recharge).toBe('long_rest')
  })
})

// ── post_cast_smite_cover / post_cast_inspiring_smite ────────────────────────

describe('buildAttackInfo – post_cast smite handlers', () => {
  const ps = makePlayerStats()

  it('returns post_cast_smite_cover with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_smite_cover' }, 'Smite Cover'), ps)
    expectHasStructure(info, 'post_cast_smite_cover')
    expect(info.casting_time).toBe('passive')
  })

  it('returns post_cast_inspiring_smite with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'post_cast_inspiring_smite' }, 'Inspiring Smite'), ps)
    expectHasStructure(info, 'post_cast_inspiring_smite')
    expect(info.range).toBe('30 ft')
    expect(info.casting_time).toBe('passive')
  })
})

// ── reaction_bonus ───────────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_bonus', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_bonus' }, 'Shield'), ps)
    expectHasStructure(info, 'reaction_bonus')
    expect(info.trigger).toBe('')
    expect(info.bonusExpression).toBe('')
    expect(info.condition).toBe('')
    expect(info.selfMovement).toBe('')
    expect(info.allyMovement).toBe('')
    expect(info.allyRange).toBe('30 ft')
    expect(info.noOAs).toBe(false)
    expect(info.resourceCost).toBe('')
    expect(info.effect).toBe('')
    expect(info.saveType).toBe('')
    expect(info.saveDc).toBe('')
    expect(info.duration).toBe('')
    expect(info.casting_time).toBe('1 reaction')
  })

  it('honors noOAs flag', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_bonus', noOAs: true }, 'Shield'), ps)
    expect(info.noOAs).toBe(true)
  })
})

// ── reaction_damage ──────────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_damage', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_damage' }, 'Spark'), ps)
    expectHasStructure(info, 'reaction_damage')
    expect(info.trigger).toBe('')
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('')
    expect(info.saveType).toBeNull()
    expect(info.saveDc).toBeNull()
    expect(info.saveAbility).toBe('WIS')
    expect(info.alsoInflicts).toBeNull()
    expect(info.resourceCost).toBeNull()
    expect(info.range).toBe('5_ft')
    expect(info.casting_time).toBe('1 reaction')
    expect(info.effect).toBeNull()
  })

  it('evaluates saveDcExpression when saveDc not set', () => {
    const ps2 = makePlayerStats({ proficiency: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'reaction_damage', saveDcExpression: '8 + 3 + proficiency_bonus' }, 'Spark'), ps2)
    // 8 + 3 + 3 = 14
    expect(info.saveDc).toBe(14)
  })

  it('applies scaling to damageExpression', () => {
    const ps2 = makePlayerStats({ level: 5 })
    const info = getAutomationInfo(makeFeature({ type: 'reaction_damage', damageExpression: '1d6', scaling: { 3: '2d6' } }, 'Spark'), ps2)
    expect(info.damageExpression).toBe('2d6')
  })
})

// ── reaction_debuff ──────────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_debuff', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_debuff' }, 'Debuff'), ps)
    expectHasStructure(info, 'reaction_debuff')
    expect(info.trigger).toBe('')
    expect(info.debuffExpression).toBe('')
    expect(info.subtractive).toBe(false)
    expect(info.effect).toBe('')
    expect(info.uses_expression).toBe('')
    expect(info.usesMax).toBe(0)
    expect(info.recharge).toBe('long_rest')
    expect(info.range).toBe('60_ft')
    expect(info.casting_time).toBe('1 reaction')
    expect(info.triggerTypes).toEqual(['attack_roll', 'damage_roll', 'ability_check'])
  })

  it('evaluates uses_expression', () => {
    const ps2 = makePlayerStats({ proficiency: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'reaction_debuff', uses_expression: 'proficiency_bonus' }, 'Debuff'), ps2)
    expect(info.usesMax).toBe(3)
  })
})

// ── reaction_save ────────────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_save', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_save' }, 'Reaction Save'), ps)
    expectHasStructure(info, 'reaction_save')
    expect(info.trigger).toBe('')
    expect(info.saveType).toBe('WIS')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('CHA')
    expect(info.condition).toBe('')
    expect(info.duration).toBe('')
    expect(info.range).toBe('120_ft')
    expect(info.casting_time).toBe('1 reaction')
    expect(info.target).toBe('different_creature')
  })
})

// ── shadowy_dodge ────────────────────────────────────────────────────────────

describe('buildAttackInfo – shadowy_dodge', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'shadowy_dodge' }, 'Shadow Dodge'), ps)
    expectHasStructure(info, 'shadowy_dodge')
    expect(info.range).toBe('30_ft')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── glorious_defense ─────────────────────────────────────────────────────────

describe('buildAttackInfo – glorious_defense', () => {
  const ps = makePlayerStats()

  it('computes acBonus and usesMax from CHA modifier', () => {
    const info = getAutomationInfo(makeFeature({ type: 'glorious_defense' }, 'Glorious Defense'), ps)
    expectHasStructure(info, 'glorious_defense')
    // CHA bonus = 1 → Math.max(1, 1) = 1
    expect(info.acBonus).toBe(1)
    expect(info.usesMax).toBe(1)
    expect(info.acBonusExpression).toBe('Math.max(1, CHA modifier)')
    expect(info.range).toBe('10_ft')
    expect(info.trigger).toBe('')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── beguiling_defenses ───────────────────────────────────────────────────────

describe('buildAttackInfo – beguiling_defenses', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'beguiling_defenses' }, 'Beguiling'), ps)
    expectHasStructure(info, 'beguiling_defenses')
    expect(info.saveType).toBe('WIS')
    expect(info.saveAbility).toBe('CHA')
    expect(info.damageType).toBe('Psychic')
    expect(info.uses).toBe(1)
    expect(info.recharge).toBe('long_rest')
    expect(info.pactMagicRecharge).toBe(false)
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── searing_vengeance ────────────────────────────────────────────────────────

describe('buildAttackInfo – searing_vengeance', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'searing_vengeance' }, 'Searing Vengeance'), ps)
    expectHasStructure(info, 'searing_vengeance')
    expect(info.healExpression).toBe('')
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('Radiant')
    expect(info.range).toBe('30_ft')
    expect(info.condition).toBe('blinded')
    expect(info.conditionDuration).toBe('until_end_of_current_turn')
    expect(info.trigger).toBe('death_save_by_ally_or_self')
    expect(info.allyRange).toBe('60_ft')
    expect(info.uses).toBe(1)
    expect(info.usesMax).toBe(1)
    expect(info.recharge).toBe('long_rest')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── illusory_self ────────────────────────────────────────────────────────────

describe('buildAttackInfo – illusory_self', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'illusory_self' }, 'Illusory Self'), ps)
    expectHasStructure(info, 'illusory_self')
    expect(info.trigger).toBe('attack_hit')
    expect(info.uses).toBe(1)
    expect(info.recharge).toBe('short_or_long_rest')
    expect(info.spellSlotRestore).toBeNull()
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── reaction_counterspell ────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_counterspell', () => {
  const ps = makePlayerStats()

  it('computes saveBonus from CHA + proficiency', () => {
    // CHA bonus=1, prof=2 → 8+1+2 = 11
    const info = getAutomationInfo(makeFeature({ type: 'reaction_counterspell' }, 'Counterspell'), ps)
    expectHasStructure(info, 'reaction_counterspell')
    expect(info.saveBonus).toBe(11)
    expect(info.trigger).toBe('creature_casting_spell')
    expect(info.saveType).toBe('CON')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('CHA')
    expect(info.range).toBe('60 ft')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── lucky_point ──────────────────────────────────────────────────────────────

describe('buildAttackInfo – lucky_point', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'lucky_point' }, 'Lucky Point'), ps)
    expectHasStructure(info, 'lucky_point')
    expect(info.effect).toBe('advantage')
    expect(info.target).toBe('d20')
    expect(info.cost).toBe(1)
    expect(info.casting_time).toBe('reaction')
  })
})

// ── reaction_spell ───────────────────────────────────────────────────────────

describe('buildAttackInfo – reaction_spell', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'reaction_spell' }, 'Reaction Spell'), ps)
    expectHasStructure(info, 'reaction_spell')
    expect(info.trigger).toBe('')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── sentinel_guardian ────────────────────────────────────────────────────────

describe('buildAttackInfo – sentinel_guardian', () => {
  const ps = makePlayerStats()

  it('returns info with attack from playerStats.attacks', () => {
    const psWithAttacks = makePlayerStats({ attacks: [{ type: 'Action', range: 'melee', name: 'Longsword' }] })
    const info = getAutomationInfo(makeFeature({ type: 'sentinel_guardian' }, 'Sentinel Guardian'), psWithAttacks)
    expectHasStructure(info, 'sentinel_guardian')
    expect(info.attack).toEqual({ type: 'Action', range: 'melee', name: 'Longsword' })
    expect(info.trigger).toBe('creature_disengages_or_hits_other_within_5ft')
    expect(info.range).toBe('5_ft')
    expect(info.oaType).toBe('any_attack_miss_or_disengage')
    expect(info.casting_time).toBe('1 reaction')
  })

  it('returns attack=null when no attacks available', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sentinel_guardian' }, 'Sentinel Guardian'), ps)
    expect(info.attack).toBeNull()
  })
})

// ── resistance ───────────────────────────────────────────────────────────────

describe('buildAttackInfo – resistance', () => {
  const ps = makePlayerStats()

  it('returns info with damageTypes', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resistance', damageTypes: ['fire', 'cold'] }, 'Resist'), ps)
    expectHasStructure(info, 'resistance')
    expect(info.damageTypes).toEqual(['fire', 'cold'])
  })
})

// ── land_resistance ──────────────────────────────────────────────────────────

describe('buildAttackInfo – land_resistance', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'land_resistance' }, 'Land Resist'), ps)
    expectHasStructure(info, 'land_resistance')
    expect(info.conditionImmunity).toBe('')
    expect(info.landMappings).toEqual({})
  })
})

// ── save_attack ──────────────────────────────────────────────────────────────

describe('buildAttackInfo – save_attack', () => {
  it('computes saveDc from ability when saveDc is "ability"', () => {
    // CON mod=3, prof=2 → DC = 8 + 3 + 2 = 13
    const info = getAutomationInfo(makeFeature({ type: 'save_attack', saveDc: 'ability' }, 'Radiance'), makePlayerStats())
    expectHasStructure(info, 'save_attack')
    expect(info.saveDc).toBe(13)
  })

  it('falls back to numeric default when saveDc not specified', () => {
    const info = getAutomationInfo(makeFeature({ type: 'save_attack' }, 'Radiance'), makePlayerStats())
    expect(info.saveDc).toBe(10)
  })

  it('uses custom saveAbility with ability saveDc', () => {
    // WIS mod=0, prof=2 → DC = 8 + 0 + 2 = 10
    const info = getAutomationInfo(makeFeature({ type: 'save_attack', saveDc: 'ability', saveAbility: 'WIS' }, 'Radiance'), makePlayerStats())
    expect(info.saveDc).toBe(10)
  })

  it('honors all save_attack fields', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'save_attack',
      saveDc: 'ability',
      shape: 'cone',
      range: '15 ft',
      conditionInflicted: 'prone',
      duration: '1 round',
      resourceCost: 'wild_shape',
      hasOptions: true,
      options: ['option1'],
      optionDetails: { option1: { value: 5 } },
      dcSuccess: 'partial',
      casting_time: '1 action',
    }, 'Radiance'), makePlayerStats())
    expect(info.shape).toBe('cone')
    expect(info.range).toBe('15 ft')
    expect(info.conditionInflicted).toBe('prone')
    expect(info.duration).toBe('1 round')
    expect(info.resourceCost).toBe('wild_shape')
    expect(info.hasOptions).toBe(true)
    expect(info.options).toEqual(['option1'])
    expect(info.optionDetails).toEqual({ option1: { value: 5 } })
    expect(info.dcSuccess).toBe('partial')
    expect(info.casting_time).toBe('1 action')
    expect(info.action).toBe('action')
  })

  it('derives action from casting_time when action not set', () => {
    const info1 = getAutomationInfo(makeFeature({ type: 'save_attack', casting_time: '1 bonus action' }, 'Radiance'), makePlayerStats())
    expect(info1.action).toBe('bonus_action')

    const info2 = getAutomationInfo(makeFeature({ type: 'save_attack', casting_time: '1 reaction' }, 'Radiance'), makePlayerStats())
    expect(info2.action).toBe('reaction')
  })
})

// ── save_only ────────────────────────────────────────────────────────────────

describe('buildAttackInfo – save_only', () => {
  it('computes ability saveDc by default', () => {
    const info = getAutomationInfo(makeFeature({ type: 'save_only', saveDc: 'ability' }, 'Petrify'), makePlayerStats())
    expectHasStructure(info, 'save_only')
    expect(info.saveDc).toBe(13)
  })

  it('falls back to numeric default when saveDc not specified', () => {
    const info = getAutomationInfo(makeFeature({ type: 'save_only' }, 'Petrify'), makePlayerStats())
    expect(info.saveDc).toBe(10)
  })

  it('honors numeric saveDc override', () => {
    const info = getAutomationInfo(makeFeature({ type: 'save_only', saveDc: 15 }, 'Petrify'), makePlayerStats())
    expect(info.saveDc).toBe(15)
  })

  it('honors all save_only fields', () => {
    const info = getAutomationInfo(makeFeature({
      type: 'save_only',
      saveType: 'CON',
      conditionInflicted: 'paralyzed',
      duration: '1 minute',
      successEffect: 'no_effect',
    }, 'Petrify'), makePlayerStats())
    expect(info.saveType).toBe('CON')
    expect(info.conditionInflicted).toBe('paralyzed')
    expect(info.duration).toBe('1 minute')
    expect(info.successEffect).toBe('no_effect')
  })
})

// ── flesh_to_stone / hold_monster / resilient_sphere / ottos_dance ──────────

describe('buildAttackInfo – save_only spell variants', () => {
  const ps = makePlayerStats()

  it('returns flesh_to_stone with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'flesh_to_stone' }, 'Stone'), ps)
    expectHasStructure(info, 'flesh_to_stone')
    expect(info.saveType).toBe('CON')
    expect(info.conditionInflicted).toBe('restrained')
    expect(info.duration).toBe('Concentration, up to 1 minute')
  })

  it('returns hold_monster with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'hold_monster' }, 'Hold'), ps)
    expectHasStructure(info, 'hold_monster')
    expect(info.saveType).toBe('WIS')
    expect(info.conditionInflicted).toBe('paralyzed')
    expect(info.duration).toBe('Concentration, up to 1 minute')
  })

  it('returns resilient_sphere with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resilient_sphere' }, 'Sphere'), ps)
    expectHasStructure(info, 'resilient_sphere')
    expect(info.saveType).toBe('DEX')
    expect(info.duration).toBe('Concentration, up to 1 minute')
  })

  it('returns ottos_dance with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'ottos_dance' }, 'Otto'), ps)
    expectHasStructure(info, 'ottos_dance')
    expect(info.saveType).toBe('WIS')
    expect(info.duration).toBe('Concentration, up to 1 minute')
  })
})

// ── power_word_stun / sleep / stinking_cloud / tashas_laughter ───────────────

describe('buildAttackInfo – additional save spell handlers', () => {
  const ps = makePlayerStats()

  it('returns power_word_stun with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'power_word_stun' }, 'Stun'), ps)
    expectHasStructure(info, 'power_word_stun')
    expect(info.saveType).toBe('CON')
  })

  it('returns sleep with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sleep' }, 'Sleep'), ps)
    expectHasStructure(info, 'sleep')
    expect(info.saveType).toBe('WIS')
    expect(info.conditionInflicted).toBe('incapacitated')
    expect(info.duration).toBe('')
  })

  it('returns stinking_cloud with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'stinking_cloud' }, 'Cloud'), ps)
    expectHasStructure(info, 'stinking_cloud')
    expect(info.saveType).toBe('CON')
    expect(info.conditionInflicted).toBe('poisoned')
  })

  it('returns tashas_laughter with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'tashas_laughter' }, 'Laughter'), ps)
    expectHasStructure(info, 'tashas_laughter')
    expect(info.saveType).toBe('WIS')
    expect(info.conditionInflicted).toEqual(['prone', 'incapacitated'])
  })
})

// ── resource_pool ────────────────────────────────────────────────────────────

describe('buildAttackInfo – resource_pool', () => {
  const ps = makePlayerStats()

  it('returns info with resource', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resource_pool', resource: 'qi' }, 'Qi'), ps)
    expectHasStructure(info, 'resource_pool')
    expect(info.resource).toBe('qi')
  })
})

// ── resource_restoration ─────────────────────────────────────────────────────

describe('buildAttackInfo – resource_restoration', () => {
  it('returns info with restore_amount evaluated', () => {
    const ps = makePlayerStats({ level: 3 })
    const info = getAutomationInfo(makeFeature({ type: 'resource_restoration', restore_expression: 'level * 2' }, 'Restore'), ps)
    expectHasStructure(info, 'resource_restoration')
    expect(info.restore_amount).toBe(6)
  })

  it('defaults restore_amount to 0 when no expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'resource_restoration' }, 'Restore'), makePlayerStats())
    expect(info.restore_amount).toBe(0)
  })
})

// ── sorcery_aura ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – sorcery_aura', () => {
  const ps = makePlayerStats()

  it('returns info with fixed uses_max of 2', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sorcery_aura' }, 'Aura'), ps)
    expectHasStructure(info, 'sorcery_aura')
    expect(info.uses_max).toBe(2)
  })
})

// ── sorcery_incarnate ────────────────────────────────────────────────────────

describe('buildAttackInfo – sorcery_incarnate', () => {
  const ps = makePlayerStats()

  it('returns info with cost', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sorcery_incarnate' }, 'Incarnate'), ps)
    expectHasStructure(info, 'sorcery_incarnate')
    expect(info.cost).toBe(2)
  })
})

// ── spell_modifier ───────────────────────────────────────────────────────────

describe('buildAttackInfo – spell_modifier', () => {
  const ps = makePlayerStats()

  it('returns info with default resource', () => {
    const info = getAutomationInfo(makeFeature({ type: 'spell_modifier' }, 'Metamagic'), ps)
    expectHasStructure(info, 'spell_modifier')
    expect(info.resource).toBe('sorcery_points')
  })
})

// ── temp_buff ────────────────────────────────────────────────────────────────

describe('buildAttackInfo – temp_buff', () => {
  const ps = makePlayerStats()

  it('returns info with oncePerRage boolean', () => {
    const info = getAutomationInfo(makeFeature({ type: 'temp_buff', oncePerRage: true }, 'Buff'), ps)
    expectHasStructure(info, 'temp_buff')
    expect(info.oncePerRage).toBe(true)
  })
})

// ── temp_hp_buff ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – temp_hp_buff', () => {
  const ps = makePlayerStats()

  it('returns info with triggerOnRage boolean', () => {
    const info = getAutomationInfo(makeFeature({ type: 'temp_hp_buff', trigger_on_rage: true }, 'TempHP'), ps)
    expectHasStructure(info, 'temp_hp_buff')
    expect(info.triggerOnRage).toBe(true)
  })
})

// ── shadow_step_rider / moonlight_step_rider ─────────────────────────────────

describe('buildAttackInfo – step riders', () => {
  const ps = makePlayerStats()

  it('returns shadow_step_rider', () => {
    const info = getAutomationInfo(makeFeature({ type: 'shadow_step_rider' }, 'Shadow Step'), ps)
    expectHasStructure(info, 'shadow_step_rider')
  })

  it('returns moonlight_step_rider', () => {
    const info = getAutomationInfo(makeFeature({ type: 'moonlight_step_rider' }, 'Moonlight Step'), ps)
    expectHasStructure(info, 'moonlight_step_rider')
  })
})

// ── set_condition ────────────────────────────────────────────────────────────

describe('buildAttackInfo – set_condition', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'set_condition', condition: 'charmed', target: 'one_creature' }, 'Charm'), ps)
    expectHasStructure(info, 'set_condition')
    expect(info.target).toBe('one_creature')
    expect(info.condition).toBe('charmed')
    expect(info.additionalCondition).toBeNull()
    expect(info.cost).toBe('')
    expect(info.range).toBe('60 ft')
    expect(info.saveType).toBe('STR')
    expect(info.effect).toBe('')
  })
})

// ── survive_and_heal ─────────────────────────────────────────────────────────

describe('buildAttackInfo – survive_and_heal', () => {
  it('returns info with defaults (half max HP)', () => {
    const ps2 = makePlayerStats({ hitPoints: { max: 20 } })
    const info = getAutomationInfo(makeFeature({ type: 'survive_and_heal' }, 'Survive'), ps2)
    expectHasStructure(info, 'survive_and_heal')
    expect(info.healAmount).toBe(10)
    expect(info.trigger).toBe('reduced_to_0_hp')
    expect(info.effect).toBe('survive_and_heal')
    expect(info.minHp).toBe(1)
    expect(info.recharge).toBe('long_rest')
  })

  it('uses half_max_hp special expression', () => {
    const ps2 = makePlayerStats({ hitPoints: { max: 30 } })
    const info = getAutomationInfo(makeFeature({ type: 'survive_and_heal', healExpression: 'half_max_hp' }, 'Survive'), ps2)
    expect(info.healAmount).toBe(15)
  })
})

// ── restore_balance ──────────────────────────────────────────────────────────

describe('buildAttackInfo – restore_balance', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'restore_balance' }, 'Restore Balance'), ps)
    expectHasStructure(info, 'restore_balance')
    expect(info.target).toBe('d20')
    expect(info.range).toBe('60_ft')
  })
})

// ── countercharm ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – countercharm', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'countercharm' }, 'Countercharm'), ps)
    expectHasStructure(info, 'countercharm')
    expect(info.trigger).toBe('')
    expect(info.range).toBe('')
    expect(info.conditions).toEqual([])
    expect(info.effect).toBe('')
    expect(info.uses).toBe(1)
    expect(info.recharge).toBe('long_rest')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── misty_wanderer / misty_escape ────────────────────────────────────────────

describe('buildAttackInfo – misty handlers', () => {
  const ps = makePlayerStats()

  it('returns misty_wanderer with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'misty_wanderer' }, 'Misty Wanderer'), ps)
    expectHasStructure(info, 'misty_wanderer')
    expect(info.trigger).toBe('')
    expect(info.range).toBe('5_ft')
    expect(info.casting_time).toBe('passive')
  })

  it('returns misty_escape with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'misty_escape' }, 'Misty Escape'), ps)
    expectHasStructure(info, 'misty_escape')
    expect(info.spell).toBe('Misty Step')
    expect(info.saveType).toBe('WIS')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('CHA')
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('')
    expect(info.condition).toBe('invisible')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── steps_of_the_fey ─────────────────────────────────────────────────────────

describe('buildAttackInfo – steps_of_the_fey', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'steps_of_the_fey' }, 'Steps'), ps)
    expectHasStructure(info, 'steps_of_the_fey')
    expect(info.spell).toBe('Misty Step')
    expect(info.uses).toBe(1)
    expect(info.uses_expression).toBe('')
    expect(info.usesMax).toBe(1)
    expect(info.recharge).toBe('long_rest')
    expect(info.casting_time).toBe('1 bonus action')
    expect(info.saveAbility).toBe('CHA')
    expect(info.saveDc).toBe('ability')
  })

  it('evaluates uses_expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'steps_of_the_fey', uses_expression: 'proficiency_bonus' }, 'Steps'), ps)
    expect(info.usesMax).toBe(ps.proficiency)
  })
})

// ── radiant_soul ─────────────────────────────────────────────────────────────

describe('buildAttackInfo – radiant_soul', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'radiant_soul' }, 'Radiant Soul'), ps)
    expectHasStructure(info, 'radiant_soul')
    expect(info.damageTypes).toEqual([])
    expect(info.damageExpression).toBe('')
    expect(info.oncePerTurn).toBe(false)
  })
})

// ── celestial_resilience ─────────────────────────────────────────────────────

describe('buildAttackInfo – celestial_resilience', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'celestial_resilience' }, 'Celestial'), ps)
    expectHasStructure(info, 'celestial_resilience')
    expect(info.tempHpExpression).toBe('')
    expect(info.allyTempHpExpression).toBe('')
    expect(info.maxAllies).toBe(5)
    expect(info.range).toBe('60_ft')
    expect(info.casting_time).toBe('passive')
  })
})

// ── dark_ones_look ───────────────────────────────────────────────────────────

describe('buildAttackInfo – dark_ones_look', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'dark_ones_look' }, 'Dark Look'), ps)
    expectHasStructure(info, 'dark_ones_look')
    expect(info.diceExpression).toBe('1d10')
  })
})

// ── hurl_through_hell ────────────────────────────────────────────────────────

describe('buildAttackInfo – hurl_through_hell', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'hurl_through_hell' }, 'Hurl'), ps)
    expectHasStructure(info, 'hurl_through_hell')
    expect(info.damageExpression).toBe('')
    expect(info.damageType).toBe('')
    expect(info.saveType).toBe('CHA')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('CHA')
    expect(info.oncePerTurn).toBe(false)
    expect(info.uses).toBe(1)
    expect(info.pactMagicRecharge).toBe(false)
    expect(info.casting_time).toBe('passive')
  })
})

// ── clairvoyant_combatant ────────────────────────────────────────────────────

describe('buildAttackInfo – clairvoyant_combatant', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'clairvoyant_combatant' }, 'Clairvoyant'), ps)
    expectHasStructure(info, 'clairvoyant_combatant')
    expect(info.saveType).toBe('WIS')
    expect(info.saveDc).toBe('ability')
    expect(info.saveAbility).toBe('CHA')
    expect(info.duration).toBe('1_minute')
    expect(info.uses).toBe(1)
    expect(info.pactMagicRecharge).toBe(false)
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── memorize_spell ───────────────────────────────────────────────────────────

describe('buildAttackInfo – memorize_spell', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'memorize_spell' }, 'Memorize'), ps)
    expectHasStructure(info, 'memorize_spell')
    expect(info.casting_time).toBe('passive')
  })
})

// ── spell_breaker ────────────────────────────────────────────────────────────

describe('buildAttackInfo – spell_breaker', () => {
  const ps = makePlayerStats()

  it('returns passive_rule with spell_breaker effect', () => {
    const info = getAutomationInfo(makeFeature({ type: 'spell_breaker' }, 'Spell Breaker'), ps)
    expect(info.type).toBe('passive_rule')
    expect(info.effect).toBe('spell_breaker')
    expect(info.alwaysPreparedSpells).toEqual([])
    expect(info.bonusActionSpells).toEqual([])
    expect(info.dispelAbilityCheckBonus).toBe('')
    expect(info.slotRetentionSpells).toEqual([])
    expect(info.casting_time).toBe('passive')
  })
})

// ── create_thrall ────────────────────────────────────────────────────────────

describe('buildAttackInfo – create_thrall', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'create_thrall' }, 'Thrall'), ps)
    expectHasStructure(info, 'create_thrall')
    expect(info.spell).toBe('')
    expect(info.uses).toBe(1)
    expect(info.uses_expression).toBe('')
    expect(info.usesMax).toBe(1)
    expect(info.recharge).toBe('long_rest')
    expect(info.action).toBe('action')
    expect(info.casting_time).toBe('1 action')
  })

  it('evaluates uses_expression', () => {
    const info = getAutomationInfo(makeFeature({ type: 'create_thrall', uses_expression: 'proficiency_bonus' }, 'Thrall'), ps)
    expect(info.usesMax).toBe(ps.proficiency)
  })
})

// ── portent ──────────────────────────────────────────────────────────────────

describe('buildAttackInfo – portent', () => {
  it('returns maxDice=3 at level 14+, otherwise 2', () => {
    const psLow = makePlayerStats({ level: 8 })
    const infoLow = getAutomationInfo(makeFeature({ type: 'portent' }, 'Portent'), psLow)
    expectHasStructure(infoLow, 'portent')
    expect(infoLow.maxDice).toBe(2)

    const psHigh = makePlayerStats({ level: 14 })
    const infoHigh = getAutomationInfo(makeFeature({ type: 'portent' }, 'Portent'), psHigh)
    expect(infoHigh.maxDice).toBe(3)
  })
})

// ── third_eye ────────────────────────────────────────────────────────────────

describe('buildAttackInfo – third_eye', () => {
  const ps = makePlayerStats()

  it('returns bonus_action_choice with fixed options', () => {
    const info = getAutomationInfo(makeFeature({ type: 'third_eye', duration: '1_hour' }, 'Third Eye'), ps)
    expectHasStructure(info, 'bonus_action_choice')
    expect(info.options.length).toBe(3)
    expect(info.options[0].name).toBe('Darkvision (120 feet)')
    expect(info.action).toBe('bonus_action')
    expect(info.casting_time).toBe('1 bonus action')
    expect(info.duration).toBe('1_hour')
  })
})

// ── improved_illusions / phantasmal_creatures / illusory_reality ─────────────

describe('buildAttackInfo – illusion handlers', () => {
  const ps = makePlayerStats()

  it('returns improved_illusions', () => {
    const info = getAutomationInfo(makeFeature({ type: 'improved_illusions' }, 'Illusions'), ps)
    expectHasStructure(info, 'improved_illusions')
    expect(info.effect).toBe('improved_illusions')
    expect(info.casting_time).toBe('passive')
  })

  it('returns phantasmal_creatures with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'phantasmal_creatures' }, 'Phantasmal'), ps)
    expectHasStructure(info, 'phantasmal_creatures')
    expect(info.effect).toBe('phantasmal_creatures')
    expect(info.alwaysPreparedSpells).toEqual([])
    expect(info.freeCastSpells).toEqual([])
    expect(info.usesMax).toBe(1)
    expect(info.recharge).toBe('long_rest')
    expect(info.halvesHp).toBe(false)
  })

  it('returns illusory_reality with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'illusory_reality' }, 'Illusory'), ps)
    expectHasStructure(info, 'illusory_reality')
    expect(info.effect).toBe('illusory_reality')
    expect(info.casting_time).toBe('1 bonus_action')
    expect(info.objectDuration).toBe('1 minute')
  })
})

// ── celestial_revelation ─────────────────────────────────────────────────────

describe('buildAttackInfo – celestial_revelation', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'celestial_revelation' }, 'Revelation'), ps)
    expectHasStructure(info, 'celestial_revelation')
    expect(info.options).toEqual([])
    expect(info.chooseOne).toBe(false)
    expect(info.duration).toBe('1_minute')
    expect(info.action).toBe('bonus_action')
    expect(info.casting_time).toBe('1 bonus action')
    expect(info.recharge).toBe('long_rest')
    expect(info.minLevel).toBe(3)
  })
})

// ── elfish_lineage / gnomish_lineage / fiendish_legacy ──────────────────────

describe('buildAttackInfo – lineage handlers', () => {
  const ps = makePlayerStats()

  it('returns elfish_lineage with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'elfish_lineage' }, 'Elf'), ps)
    expectHasStructure(info, 'elfish_lineage')
    expect(info.options).toEqual([])
    expect(info.chooseOne).toBe(false)
  })

  it('returns gnomish_lineage with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'gnomish_lineage' }, 'Gnome'), ps)
    expectHasStructure(info, 'gnomish_lineage')
    expect(info.options).toEqual([])
    expect(info.chooseOne).toBe(false)
  })

  it('returns fiendish_legacy with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'fiendish_legacy' }, 'Fiend'), ps)
    expectHasStructure(info, 'fiendish_legacy')
    expect(info.options).toEqual([])
    expect(info.chooseOne).toBe(false)
  })
})

// ── lesser_restoration / remove_curse / protection_from_poison ───────────────

describe('buildAttackInfo – restoration handlers', () => {
  const ps = makePlayerStats()

  it('returns lesser_restoration with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'lesser_restoration' }, 'Lesser Restoration'), ps)
    expectHasStructure(info, 'lesser_restoration')
    expect(info.range).toBe('Touch')
    expect(info.conditions).toEqual(['blinded', 'deafened', 'paralyzed', 'poisoned'])
    expect(info.casting_time).toBe('bonus_action')
  })

  it('returns remove_curse with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'remove_curse' }, 'Remove Curse'), ps)
    expectHasStructure(info, 'remove_curse')
    expect(info.range).toBe('Touch')
    expect(info.casting_time).toBe('1 action')
  })

  it('returns protection_from_poison with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'protection_from_poison' }, 'Protection'), ps)
    expectHasStructure(info, 'protection_from_poison')
    expect(info.range).toBe('Touch')
    expect(info.duration).toBe('1 hour')
    expect(info.casting_time).toBe('1 action')
  })
})

// ── sentinel ─────────────────────────────────────────────────────────────────

describe('buildAttackInfo – sentinel', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'sentinel' }, 'Sentinel'), ps)
    expectHasStructure(info, 'sentinel')
    expect(info.effect).toBe('speed_0_on_oa_hit')
    expect(info.duration).toBe('end_of_turn')
    expect(info.casting_time).toBe('1 action')
  })
})

// ── telekinetic_shove ────────────────────────────────────────────────────────

describe('buildAttackInfo – telekinetic_shove', () => {
  const ps = makePlayerStats()

  it('computes saveDc from INT when ability', () => {
    // INT mod=-1, prof=2 → 8 + (-1) + 2 = 9
    const info = getAutomationInfo(makeFeature({ type: 'telekinetic_shove', saveDc: 'ability' }, 'Shove'), ps)
    expectHasStructure(info, 'telekinetic_shove')
    expect(info.saveDc).toBe(9)
    expect(info.saveType).toBe('STR')
    expect(info.saveAbility).toBe('INT')
    expect(info.range).toBe('30')
    expect(info.pushDistance).toBe(5)
    expect(info.action).toBe('bonus_action')
    expect(info.casting_time).toBe('1 bonus action')
  })

  it('honors numeric saveDc override', () => {
    const info = getAutomationInfo(makeFeature({ type: 'telekinetic_shove', saveDc: 15 }, 'Shove'), ps)
    expect(info.saveDc).toBe(15)
  })

  it('derives action from casting_time', () => {
    const info = getAutomationInfo(makeFeature({ type: 'telekinetic_shove', casting_time: '1 action' }, 'Shove'), ps)
    expect(info.action).toBe('action')
  })
})

// ── feats_of_chaos ───────────────────────────────────────────────────────────

describe('buildAttackInfo – feats_of_chaos', () => {
  const ps = makePlayerStats()

  it('returns conditional_advantage with feats_of_chaos_active condition', () => {
    const info = getAutomationInfo(makeFeature({ type: 'feats_of_chaos' }, 'Feats'), ps)
    expect(info.type).toBe('conditional_advantage')
    expect(info.target).toBe('d20')
    expect(info.condition).toBe('feats_of_chaos_active')
    expect(info.effect).toBe('advantage')
    expect(info.abilities).toEqual([])
  })
})

// ── multi_target_spread ──────────────────────────────────────────────────────

describe('buildAttackInfo – multi_target_spread', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'multi_target_spread' }, 'Spread'), ps)
    expectHasStructure(info, 'multi_target_spread')
    expect(info.spellFilter).toEqual([])
    expect(info.range).toBe('10 ft')
  })
})

// ── bewitching_magic ─────────────────────────────────────────────────────────

describe('buildAttackInfo – bewitching_magic', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bewitching_magic' }, 'Bewitching'), ps)
    expectHasStructure(info, 'bewitching_magic')
    expect(info.casting_time).toBe('passive')
  })
})

// ── bonus_action_choice ──────────────────────────────────────────────────────

describe('buildAttackInfo – bonus_action_choice', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'bonus_action_choice' }, 'Choice'), ps)
    expectHasStructure(info, 'bonus_action_choice')
    expect(info.options).toEqual([])
    expect(info.action).toBe('bonus_action')
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── steady_aim ───────────────────────────────────────────────────────────────

describe('buildAttackInfo – steady_aim', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'steady_aim' }, 'Steady Aim'), ps)
    expectHasStructure(info, 'steady_aim')
    expect(info.duration).toBe('until_end_of_turn')
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── mage_hand_control ────────────────────────────────────────────────────────

describe('buildAttackInfo – mage_hand_control', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'mage_hand_control' }, 'Mage Hand'), ps)
    expectHasStructure(info, 'mage_hand_control')
    expect(info.range).toBe('30_ft')
    expect(info.action).toBe('bonus_action')
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── stroke_of_luck ───────────────────────────────────────────────────────────

describe('buildAttackInfo – stroke_of_luck', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'stroke_of_luck' }, 'Stroke'), ps)
    expectHasStructure(info, 'stroke_of_luck')
    expect(info.target).toBe('d20')
    expect(info.recharge).toBe('short_or_long_rest')
  })
})

// ── modify_d20_roll ──────────────────────────────────────────────────────────

describe('buildAttackInfo – modify_d20_roll', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'modify_d20_roll' }, 'Modify'), ps)
    expectHasStructure(info, 'modify_d20_roll')
    expect(info.modifier).toBe('2d4')
    expect(info.range).toBe('60 ft')
    expect(info.canBeBonusOrPenalty).toBe(false)
    expect(info.recharge).toBe('initiative_or_short_or_long_rest')
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── fast_hands ───────────────────────────────────────────────────────────────

describe('buildAttackInfo – fast_hands', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'fast_hands' }, 'Fast Hands'), ps)
    expectHasStructure(info, 'fast_hands')
    expect(info.options).toEqual([])
    expect(info.casting_time).toBe('1 bonus action')
  })
})

// ── use_magic_device ─────────────────────────────────────────────────────────

describe('buildAttackInfo – use_magic_device', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'use_magic_device' }, 'Use Magic'), ps)
    expectHasStructure(info, 'use_magic_device')
    expect(info.attunementLimit).toBe(4)
    expect(info.chargeReroll).toBe('1d6')
    expect(info.chargeRerollSuccess).toBe(6)
    expect(info.scrollAbility).toBe('INT')
    expect(info.scrollCheckDC).toBe('10 + spell_level')
    expect(info.scrollDisintegratesOnFail).toBe(false)
    expect(info.casting_time).toBe('passive')
  })
})

// ── wild_magic_surge / wild_magic_tamed ──────────────────────────────────────

describe('buildAttackInfo – wild magic handlers', () => {
  const ps = makePlayerStats()

  it('returns wild_magic_surge with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'wild_magic_surge' }, 'Surge'), ps)
    expectHasStructure(info, 'wild_magic_surge')
    expect(info.trigger).toBe('')
    expect(info.oncePerTurn).toBe(false)
  })

  it('returns wild_magic_tamed with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'wild_magic_tamed' }, 'Tamed'), ps)
    expectHasStructure(info, 'wild_magic_tamed')
    expect(info.trigger).toBe('')
    expect(info.recharge).toBe('long_rest')
    expect(info.uses).toBe(1)
  })
})

// ── relentless_avenger / soul_of_vengeance ───────────────────────────────────

describe('buildAttackInfo – avenger handlers', () => {
  const ps = makePlayerStats()

  it('returns relentless_avenger with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'relentless_avenger' }, 'Avenger'), ps)
    expectHasStructure(info, 'relentless_avenger')
    expect(info.trigger).toBe('after_opportunity_attack_hit')
    expect(info.duration).toBe('until_end_of_current_turn')
  })

  it('returns soul_of_vengeance with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'soul_of_vengeance' }, 'Vengeance'), ps)
    expectHasStructure(info, 'soul_of_vengeance')
    expect(info.trigger).toBe('after_vow_of_enmity_target_attacks')
  })
})

// ── hunter_prey / superior_hunter_prey / superior_hunter_defense ────────────

describe('buildAttackInfo – hunter handlers', () => {
  const ps = makePlayerStats()

  it('returns hunter_prey with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'hunter_prey' }, 'Hunter'), ps)
    expectHasStructure(info, 'hunter_prey')
    expect(info.casting_time).toBe('passive')
  })

  it('returns superior_hunter_prey with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'superior_hunter_prey' }, 'Superior Hunter'), ps)
    expectHasStructure(info, 'superior_hunter_prey')
    expect(info.casting_time).toBe('passive')
  })

  it('returns superior_hunter_defense with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'superior_hunter_defense' }, 'Superior Defense'), ps)
    expectHasStructure(info, 'superior_hunter_defense')
    expect(info.casting_time).toBe('1 reaction')
  })
})

// ── defensive_tactics ────────────────────────────────────────────────────────

describe('buildAttackInfo – defensive_tactics', () => {
  const ps = makePlayerStats()

  it('returns info with defaults', () => {
    const info = getAutomationInfo(makeFeature({ type: 'defensive_tactics' }, 'Defensive'), ps)
    expectHasStructure(info, 'defensive_tactics')
    expect(info.casting_time).toBe('passive')
  })
})
