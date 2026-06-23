// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

// ── multi_target_spread ────────────────────────────────────────────────
// Only handler in misc.js not tested in a dedicated test file.

describe('buildAttackInfo – multi_target_spread', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'multi_target_spread' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('multi_target_spread')
        expect(result.hasAutomation).toBe(true)
        expect(result.name).toBe('Test Feature')
    })

    it('defaults spellFilter to empty array and range to "10 ft"', () => {
        const feature = makeFeature({ type: 'multi_target_spread' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spellFilter).toEqual([])
        expect(result.range).toBe('10 ft')
    })

    it('passes through provided spellFilter and range', () => {
        const feature = makeFeature({
            type: 'multi_target_spread',
            spellFilter: ['fireball', 'lightning_bolt'],
            range: '30 ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spellFilter).toEqual(['fireball', 'lightning_bolt'])
        expect(result.range).toBe('30 ft')
    })
})

// ── memorize_spell ─────────────────────────────────────────────────────
// Only handler in misc.js not tested in a dedicated test file.

describe('buildAttackInfo – memorize_spell', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'memorize_spell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('memorize_spell')
        expect(result.hasAutomation).toBe(true)
        expect(result.name).toBe('Test Feature')
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'memorize_spell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'memorize_spell',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })
})

// ── arcane_ward ────────────────────────────────────────────────────────
// Uses playerStats to compute ward maxHp.

describe('buildAttackInfo – arcane_ward', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('arcane_ward')
        expect(result.hasAutomation).toBe(true)
    })

    it('computes maxHp from wizard level and INT modifier', () => {
        // BASE_STATS: level=5, INT bonus=1 => maxHp = 5*2 + 1 = 11
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.maxHp).toBe(11)
    })

    it('uses auto.wardHpExpression when provided', () => {
        const feature = makeFeature({
            type: 'arcane_ward',
            wardHpExpression: 'custom_expr',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardHpExpression).toBe('custom_expr')
    })

    it('defaults wardHpExpression to computed string', () => {
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardHpExpression).toBe('(2 * 5) + 1')
    })

    it('defaults wardRestoreExpression to "2 * spell_slot_level"', () => {
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardRestoreExpression).toBe('2 * spell_slot_level')
    })

    it('defaults wardTrigger to "abjuration_spell_cast"', () => {
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardTrigger).toBe('abjuration_spell_cast')
    })

    it('defaults wardDuration to "long_rest"', () => {
        const feature = makeFeature({ type: 'arcane_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardDuration).toBe('long_rest')
    })

    it('coerces bonusActionRestore to boolean', () => {
        const feature = makeFeature({
            type: 'arcane_ward',
            bonusActionRestore: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.bonusActionRestore).toBe(true)
    })

    it('passes through all provided values', () => {
        const feature = makeFeature({
            type: 'arcane_ward',
            wardTrigger: 'ally_damage',
            wardDuration: 'concentration',
            bonusActionRestore: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardTrigger).toBe('ally_damage')
        expect(result.wardDuration).toBe('concentration')
        expect(result.bonusActionRestore).toBe(true)
    })
})

// ── arcane_ward_bonus_action ───────────────────────────────────────────

describe('buildAttackInfo – arcane_ward_bonus_action', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'arcane_ward_bonus_action' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('arcane_ward_bonus_action')
        expect(result.hasAutomation).toBe(true)
    })

    it('hardcodes action to "bonus_action"', () => {
        const feature = makeFeature({ type: 'arcane_ward_bonus_action' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'arcane_ward_bonus_action' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'arcane_ward_bonus_action',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })
})

// ── projected_ward ─────────────────────────────────────────────────────
// Uses playerStats-agnostic defaults; reaction is always true.

describe('buildAttackInfo – projected_ward', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'projected_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('projected_ward')
        expect(result.hasAutomation).toBe(true)
    })

    it('hardcodes reaction to true', () => {
        const feature = makeFeature({ type: 'projected_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.reaction).toBe(true)
    })

    it('defaults range to 30 (number)', () => {
        const feature = makeFeature({ type: 'projected_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe(30)
    })

    it('defaults wardTrigger to "ally_damage_taken"', () => {
        const feature = makeFeature({ type: 'projected_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.wardTrigger).toBe('ally_damage_taken')
    })

    it('defaults casting_time to "1 reaction"', () => {
        const feature = makeFeature({ type: 'projected_ward' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 reaction')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'projected_ward',
            range: 45,
            wardTrigger: 'any_damage',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe(45)
        expect(result.wardTrigger).toBe('any_damage')
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── survive_and_heal ───────────────────────────────────────────────────
// Uses playerStats.hitPoints.max for heal calculation.

describe('buildAttackInfo – survive_and_heal', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('survive_and_heal')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger to "reduced_to_0_hp"', () => {
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('reduced_to_0_hp')
    })

    it('defaults effect to "survive_and_heal"', () => {
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('survive_and_heal')
    })

    it('defaults minHp to 1', () => {
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.minHp).toBe(1)
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('computes healAmount as half of maxHp when no expression', () => {
        // BASE_STATS.level=5, no hitPoints.max => maxHp=5, half=2
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.healAmount).toBe(2)
    })

    it('uses hitPoints.max over level when available', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 45 } }
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = buildAttackInfo(feature, stats)

        // half of 45 = 22
        expect(result.healAmount).toBe(22)
    })

    it('parses numeric healExpression', () => {
        const feature = makeFeature({
            type: 'survive_and_heal',
            healExpression: '15',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.healAmount).toBe(15)
    })

    it('uses "half_max_hp" keyword to compute half maxHp', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 50 } }
        const feature = makeFeature({
            type: 'survive_and_heal',
            healExpression: 'half_max_hp',
        })
        const result = buildAttackInfo(feature, stats)

        expect(result.healAmount).toBe(25)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'survive_and_heal',
            trigger: 'below_half_hp',
            effect: 'stabilize_heal',
            minHp: 5,
            recharge: 'short_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('below_half_hp')
        expect(result.effect).toBe('stabilize_heal')
        expect(result.minHp).toBe(5)
        expect(result.recharge).toBe('short_rest')
    })
})

// ── auto_effect ────────────────────────────────────────────────────────

describe('buildAttackInfo – auto_effect', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'auto_effect' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('auto_effect')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger, effect to empty string; value, uses to null; recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'auto_effect' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('')
        expect(result.effect).toBe('')
        expect(result.value).toBeNull()
        expect(result.uses).toBeNull()
        expect(result.recharge).toBe('long_rest')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'auto_effect',
            trigger: 'on_cast',
            effect: 'gain_buff',
            value: 5,
            uses: 3,
            recharge: 'short_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_cast')
        expect(result.effect).toBe('gain_buff')
        expect(result.value).toBe(5)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
    })
})

// ── auto_reroll ────────────────────────────────────────────────────────

describe('buildAttackInfo – auto_reroll', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('auto_reroll')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults target to "d20", effect to "reroll"', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('d20')
        expect(result.effect).toBe('reroll')
    })

    it('defaults condition, range, resourceCost, casting_time, bonusExpression to empty string', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.condition).toBe('')
        expect(result.trigger).toBe('')
        expect(result.range).toBe('')
        expect(result.resourceCost).toBe('')
        expect(result.casting_time).toBe('')
        expect(result.bonusExpression).toBe('')
    })

    it('defaults bonus to null', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.bonus).toBeNull()
    })

    it('coerces oncePerRage and oncePerTurn to boolean', () => {
        const feature = makeFeature({
            type: 'auto_reroll',
            oncePerRage: 'yes',
            oncePerTurn: 1,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerRage).toBe(true)
        expect(result.oncePerTurn).toBe(true)
    })

    it('defaults oncePerRage and oncePerTurn to false', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerRage).toBe(false)
        expect(result.oncePerTurn).toBe(false)
    })

    it('passes through oncePer when provided', () => {
        const feature = makeFeature({
            type: 'auto_reroll',
            oncePer: 'short_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePer).toBe('short_rest')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'auto_reroll',
            target: 'save',
            condition: 'below_half_hp',
            trigger: 'on_save_fail',
            bonus: '+4',
            range: '60 ft',
            resourceCost: 'spell_slot',
            casting_time: '1 reaction',
            bonusExpression: '2d6',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('save')
        expect(result.condition).toBe('below_half_hp')
        expect(result.trigger).toBe('on_save_fail')
        expect(result.bonus).toBe('+4')
        expect(result.range).toBe('60 ft')
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.bonusExpression).toBe('2d6')
    })
})

// ── restore_balance ────────────────────────────────────────────────────

describe('buildAttackInfo – restore_balance', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'restore_balance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('restore_balance')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults target to "d20"', () => {
        const feature = makeFeature({ type: 'restore_balance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('d20')
    })

    it('defaults range to "60_ft"', () => {
        const feature = makeFeature({ type: 'restore_balance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60_ft')
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'restore_balance',
            target: 'save',
            range: '30_ft',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('save')
        expect(result.range).toBe('30_ft')
    })
})

// ── countercharm ───────────────────────────────────────────────────────

describe('buildAttackInfo – countercharm', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('countercharm')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger, range, effect to empty string', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('')
        expect(result.range).toBe('')
        expect(result.effect).toBe('')
    })

    it('defaults conditions to empty array', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.conditions).toEqual([])
    })

    it('defaults uses to 1', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.uses).toBe(1)
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('defaults casting_time to "1 reaction"', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 reaction')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'countercharm',
            trigger: 'frightened_ally',
            range: '30 ft',
            conditions: ['frightened', 'charmed'],
            effect: 'remove_conditions',
            uses: 3,
            recharge: 'long_rest',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('frightened_ally')
        expect(result.range).toBe('30 ft')
        expect(result.conditions).toEqual(['frightened', 'charmed'])
        expect(result.effect).toBe('remove_conditions')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── misty_wanderer ─────────────────────────────────────────────────────

describe('buildAttackInfo – misty_wanderer', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'misty_wanderer' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('misty_wanderer')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger, range to empty/"5_ft", casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'misty_wanderer' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('')
        expect(result.range).toBe('5_ft')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'misty_wanderer',
            trigger: 'on_hit',
            range: '10_ft',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_hit')
        expect(result.range).toBe('10_ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── misty_escape ───────────────────────────────────────────────────────

describe('buildAttackInfo – misty_escape', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('misty_escape')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults spell to "Misty Step"', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spell).toBe('Misty Step')
    })

    it('defaults saveType to "WIS", saveDc to "ability", saveAbility to "CHA"', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
    })

    it('defaults damageExpression, damageType to empty string', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
    })

    it('defaults condition to "invisible"', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.condition).toBe('invisible')
    })

    it('defaults casting_time to "1 reaction"', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 reaction')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'misty_escape',
            spell: 'Dimension Door',
            saveType: 'DEX',
            saveDc: 15,
            saveAbility: 'CON',
            damageExpression: '2d8',
            damageType: 'force',
            condition: 'blinded',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spell).toBe('Dimension Door')
        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CON')
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('force')
        expect(result.condition).toBe('blinded')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── steps_of_the_fey ───────────────────────────────────────────────────
// Uses evaluateAutoExpression for usesMax.

describe('buildAttackInfo – steps_of_the_fey', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('steps_of_the_fey')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults spell to "Misty Step"', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spell).toBe('Misty Step')
    })

    it('defaults uses to 1', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.uses).toBe(1)
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('defaults saveAbility to "CHA", saveDc to "ability"', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveAbility).toBe('CHA')
        expect(result.saveDc).toBe('ability')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'steps_of_the_fey',
            spell: 'Misty Step',
            uses: 2,
            uses_expression: 'level',
            recharge: 'short_rest',
            casting_time: '1 action',
            saveAbility: 'WIS',
            saveDc: 13,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spell).toBe('Misty Step')
        expect(result.uses).toBe(2)
        expect(result.uses_expression).toBe('level')
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
        expect(result.saveAbility).toBe('WIS')
        expect(result.saveDc).toBe(13)
    })
})

// ── moonlight_step_rider ───────────────────────────────────────────────

describe('buildAttackInfo – moonlight_step_rider', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'moonlight_step_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('moonlight_step_rider')
        expect(result.hasAutomation).toBe(true)
    })

    it('has no optional fields beyond name and type', () => {
        const feature = makeFeature({ type: 'moonlight_step_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(Object.keys(result).sort()).toEqual([
            'hasAutomation',
            'name',
            'type',
        ].sort())
    })
})

// ── post_cast_rider ────────────────────────────────────────────────────

describe('buildAttackInfo – post_cast_rider', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('post_cast_rider')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults saveType to "WIS", saveDc to "ability", saveAbility to "CHA"', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
    })

    it('defaults condition to empty string', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.condition).toBe('')
    })

    it('defaults duration to "1_minute"', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
    })

    it('defaults range to "60 ft"', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60 ft')
    })

    it('defaults spellSchools to empty array', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spellSchools).toEqual([])
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'post_cast_rider',
            saveType: 'DEX',
            saveDc: 15,
            saveAbility: 'CON',
            condition: 'prone',
            duration: '1_hour',
            range: '30 ft',
            spellSchools: ['evocation'],
            recharge: 'short_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('DEX')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('CON')
        expect(result.condition).toBe('prone')
        expect(result.duration).toBe('1_hour')
        expect(result.range).toBe('30 ft')
        expect(result.spellSchools).toEqual(['evocation'])
        expect(result.recharge).toBe('short_rest')
    })
})

// ── post_cast_smite_cover ──────────────────────────────────────────────

describe('buildAttackInfo – post_cast_smite_cover', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'post_cast_smite_cover' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('post_cast_smite_cover')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'post_cast_smite_cover' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'post_cast_smite_cover',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── post_cast_inspiring_smite ──────────────────────────────────────────

describe('buildAttackInfo – post_cast_inspiring_smite', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'post_cast_inspiring_smite' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('post_cast_inspiring_smite')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults range to "30 ft"', () => {
        const feature = makeFeature({ type: 'post_cast_inspiring_smite' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('30 ft')
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'post_cast_inspiring_smite' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'post_cast_inspiring_smite',
            range: '60 ft',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60 ft')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── resistance ─────────────────────────────────────────────────────────

describe('buildAttackInfo – resistance', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'resistance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('resistance')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults damageTypes to empty array', () => {
        const feature = makeFeature({ type: 'resistance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual([])
    })

    it('passes through provided damageTypes', () => {
        const feature = makeFeature({
            type: 'resistance',
            damageTypes: ['fire', 'cold'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual(['fire', 'cold'])
    })
})

// ── land_resistance ────────────────────────────────────────────────────

describe('buildAttackInfo – land_resistance', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'land_resistance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('land_resistance')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults conditionImmunity to empty string', () => {
        const feature = makeFeature({ type: 'land_resistance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.conditionImmunity).toBe('')
    })

    it('defaults landMappings to empty object', () => {
        const feature = makeFeature({ type: 'land_resistance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.landMappings).toEqual({})
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'land_resistance',
            conditionImmunity: 'prone',
            landMappings: { swamp: 'difficult', mountain: 'normal' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.conditionImmunity).toBe('prone')
        expect(result.landMappings).toEqual({ swamp: 'difficult', mountain: 'normal' })
    })
})

// ── set_condition ──────────────────────────────────────────────────────

describe('buildAttackInfo – set_condition', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('set_condition')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults additionalCondition to null', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.additionalCondition).toBeNull()
    })

    it('defaults cost to empty string', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.cost).toBe('')
    })

    it('defaults range to "60 ft"', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60 ft')
    })

    it('defaults saveType to "STR"', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('STR')
    })

    it('defaults effect to empty string', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'set_condition',
            target: 'enemy',
            condition: 'frightened',
            additionalCondition: 'prone',
            cost: '1_point',
            range: '30 ft',
            saveType: 'CON',
            effect: 'frighten_target',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('enemy')
        expect(result.condition).toBe('frightened')
        expect(result.additionalCondition).toBe('prone')
        expect(result.cost).toBe('1_point')
        expect(result.range).toBe('30 ft')
        expect(result.saveType).toBe('CON')
        expect(result.effect).toBe('frighten_target')
    })
})

// ── shadow_step_rider ──────────────────────────────────────────────────

describe('buildAttackInfo – shadow_step_rider', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'shadow_step_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('shadow_step_rider')
        expect(result.hasAutomation).toBe(true)
    })

    it('has no optional fields beyond name and type', () => {
        const feature = makeFeature({ type: 'shadow_step_rider' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(Object.keys(result).sort()).toEqual([
            'hasAutomation',
            'name',
            'type',
        ].sort())
    })
})

// ── relentless_avenger ─────────────────────────────────────────────────

describe('buildAttackInfo – relentless_avenger', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'relentless_avenger' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('relentless_avenger')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger to "after_opportunity_attack_hit"', () => {
        const feature = makeFeature({ type: 'relentless_avenger' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('after_opportunity_attack_hit')
    })

    it('defaults duration to "until_end_of_current_turn"', () => {
        const feature = makeFeature({ type: 'relentless_avenger' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('until_end_of_current_turn')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'relentless_avenger',
            trigger: 'after_hit',
            duration: '1_round',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('after_hit')
        expect(result.duration).toBe('1_round')
    })
})

// ── soul_of_vengeance ──────────────────────────────────────────────────

describe('buildAttackInfo – soul_of_vengeance', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'soul_of_vengeance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('soul_of_vengeance')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger to "after_vow_of_enmity_target_attacks"', () => {
        const feature = makeFeature({ type: 'soul_of_vengeance' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('after_vow_of_enmity_target_attacks')
    })

    it('passes through provided trigger', () => {
        const feature = makeFeature({
            type: 'soul_of_vengeance',
            trigger: 'on_enemy_death',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_enemy_death')
    })
})

// ── hunter_prey ────────────────────────────────────────────────────────

describe('buildAttackInfo – hunter_prey', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'hunter_prey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('hunter_prey')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'hunter_prey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'hunter_prey',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })
})

// ── defensive_tactics ──────────────────────────────────────────────────

describe('buildAttackInfo – defensive_tactics', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'defensive_tactics' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('defensive_tactics')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'defensive_tactics' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'defensive_tactics',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── superior_hunter_prey ───────────────────────────────────────────────

describe('buildAttackInfo – superior_hunter_prey', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'superior_hunter_prey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('superior_hunter_prey')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'superior_hunter_prey' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'superior_hunter_prey',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── superior_hunter_defense ────────────────────────────────────────────

describe('buildAttackInfo – superior_hunter_defense', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'superior_hunter_defense' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('superior_hunter_defense')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults casting_time to "1 reaction"', () => {
        const feature = makeFeature({ type: 'superior_hunter_defense' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 reaction')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'superior_hunter_defense',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })
})

// ── bonus_action_choice ────────────────────────────────────────────────

describe('buildAttackInfo – bonus_action_choice', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('bonus_action_choice')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults options to empty array', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([])
    })

    it('defaults action to "bonus_action"', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'bonus_action_choice',
            options: ['option_a', 'option_b'],
            action: 'action',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['option_a', 'option_b'])
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── steady_aim ─────────────────────────────────────────────────────────

describe('buildAttackInfo – steady_aim', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'steady_aim' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('steady_aim')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults duration to "until_end_of_turn"', () => {
        const feature = makeFeature({ type: 'steady_aim' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('until_end_of_turn')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'steady_aim' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'steady_aim',
            duration: '1_round',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('1_round')
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── mage_hand_control ──────────────────────────────────────────────────

describe('buildAttackInfo – mage_hand_control', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('mage_hand_control')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults range to "30_ft"', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
    })

    it('defaults action to "bonus_action"', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'mage_hand_control',
            range: '60_ft',
            action: 'action',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── stroke_of_luck ─────────────────────────────────────────────────────

describe('buildAttackInfo – stroke_of_luck', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'stroke_of_luck' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('stroke_of_luck')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults target to "d20"', () => {
        const feature = makeFeature({ type: 'stroke_of_luck' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('d20')
    })

    it('defaults recharge to "short_or_long_rest"', () => {
        const feature = makeFeature({ type: 'stroke_of_luck' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('short_or_long_rest')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'stroke_of_luck',
            target: 'save',
            recharge: 'long_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('save')
        expect(result.recharge).toBe('long_rest')
    })
})

// ── modify_d20_roll ────────────────────────────────────────────────────

describe('buildAttackInfo – modify_d20_roll', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('modify_d20_roll')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults modifier to "2d4"', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.modifier).toBe('2d4')
    })

    it('defaults range to "60 ft"', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60 ft')
    })

    it('defaults recharge to "initiative_or_short_or_long_rest"', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('initiative_or_short_or_long_rest')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('coerces canBeBonusOrPenalty to boolean', () => {
        const feature = makeFeature({
            type: 'modify_d20_roll',
            canBeBonusOrPenalty: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.canBeBonusOrPenalty).toBe(true)
    })

    it('defaults canBeBonusOrPenalty to false', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.canBeBonusOrPenalty).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'modify_d20_roll',
            modifier: '1d8',
            range: '30 ft',
            canBeBonusOrPenalty: true,
            recharge: 'short_rest',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.modifier).toBe('1d8')
        expect(result.range).toBe('30 ft')
        expect(result.canBeBonusOrPenalty).toBe(true)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── fast_hands ─────────────────────────────────────────────────────────

describe('buildAttackInfo – fast_hands', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'fast_hands' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('fast_hands')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults options to empty array', () => {
        const feature = makeFeature({ type: 'fast_hands' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([])
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'fast_hands' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'fast_hands',
            options: ['pickpocket', 'sleight_of_hand'],
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['pickpocket', 'sleight_of_hand'])
        expect(result.casting_time).toBe('1 action')
    })
})

// ── use_magic_device ───────────────────────────────────────────────────

describe('buildAttackInfo – use_magic_device', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('use_magic_device')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults attunementLimit to 4', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.attunementLimit).toBe(4)
    })

    it('defaults chargeReroll to "1d6"', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chargeReroll).toBe('1d6')
    })

    it('defaults chargeRerollSuccess to 6', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chargeRerollSuccess).toBe(6)
    })

    it('defaults scrollAbility to "INT"', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.scrollAbility).toBe('INT')
    })

    it('defaults scrollCheckDC to "10 + spell_level"', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.scrollCheckDC).toBe('10 + spell_level')
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('coerces scrollDisintegratesOnFail to boolean', () => {
        const feature = makeFeature({
            type: 'use_magic_device',
            scrollDisintegratesOnFail: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.scrollDisintegratesOnFail).toBe(true)
    })

    it('defaults scrollDisintegratesOnFail to false', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.scrollDisintegratesOnFail).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'use_magic_device',
            attunementLimit: 3,
            chargeReroll: '1d8',
            chargeRerollSuccess: 8,
            scrollAbility: 'CHA',
            scrollCheckDC: 15,
            scrollDisintegratesOnFail: true,
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.attunementLimit).toBe(3)
        expect(result.chargeReroll).toBe('1d8')
        expect(result.chargeRerollSuccess).toBe(8)
        expect(result.scrollAbility).toBe('CHA')
        expect(result.scrollCheckDC).toBe(15)
        expect(result.scrollDisintegratesOnFail).toBe(true)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── wild_magic_surge ───────────────────────────────────────────────────

describe('buildAttackInfo – wild_magic_surge', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'wild_magic_surge' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('wild_magic_surge')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger to empty string', () => {
        const feature = makeFeature({ type: 'wild_magic_surge' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('')
    })

    it('defaults oncePerTurn to false', () => {
        const feature = makeFeature({ type: 'wild_magic_surge' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerTurn).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'wild_magic_surge',
            trigger: 'on_spell_cast',
            oncePerTurn: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_spell_cast')
        expect(result.oncePerTurn).toBe(true)
    })
})

// ── wild_magic_tamed ───────────────────────────────────────────────────

describe('buildAttackInfo – wild_magic_tamed', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('wild_magic_tamed')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger to empty string', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('')
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('defaults uses to 1', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.uses).toBe(1)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'wild_magic_tamed',
            trigger: 'on_spell_cast',
            recharge: 'short_rest',
            uses: 3,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.trigger).toBe('on_spell_cast')
        expect(result.recharge).toBe('short_rest')
        expect(result.uses).toBe(3)
    })
})

// ── feats_of_chaos ─────────────────────────────────────────────────────
// Returns type "conditional_advantage" (not "feats_of_chaos").

describe('buildAttackInfo – feats_of_chaos', () => {
    it('returns type conditional_advantage (not feats_of_chaos)', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('conditional_advantage')
    })

    it('returns hasAutomation and correct name', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.hasAutomation).toBe(true)
        expect(result.name).toBe('Test Feature')
    })

    it('defaults target to "d20"', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('d20')
    })

    it('defaults condition to "feats_of_chaos_active"', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.condition).toBe('feats_of_chaos_active')
    })

    it('hardcodes effect to "advantage"', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('advantage')
    })

    it('defaults abilities to empty array', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.abilities).toEqual([])
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'feats_of_chaos',
            target: 'save',
            condition: 'chaos_active',
            abilities: ['STR', 'DEX'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.target).toBe('save')
        expect(result.condition).toBe('chaos_active')
        expect(result.abilities).toEqual(['STR', 'DEX'])
    })
})

// ── bewitching_magic ───────────────────────────────────────────────────

describe('buildAttackInfo – bewitching_magic', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'bewitching_magic' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('bewitching_magic')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'bewitching_magic' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'bewitching_magic',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })
})

// ── radiant_soul ───────────────────────────────────────────────────────

describe('buildAttackInfo – radiant_soul', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('radiant_soul')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults damageTypes to empty array', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual([])
    })

    it('defaults damageExpression to empty string', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageExpression).toBe('')
    })

    it('defaults oncePerTurn to false', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerTurn).toBe(false)
    })

    it('coerces oncePerTurn to boolean', () => {
        const feature = makeFeature({
            type: 'radiant_soul',
            oncePerTurn: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerTurn).toBe(true)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'radiant_soul',
            damageTypes: ['radiant'],
            damageExpression: '2d6',
            oncePerTurn: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageTypes).toEqual(['radiant'])
        expect(result.damageExpression).toBe('2d6')
        expect(result.oncePerTurn).toBe(true)
    })
})

// ── celestial_resilience ───────────────────────────────────────────────

describe('buildAttackInfo – celestial_resilience', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('celestial_resilience')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults tempHpExpression and allyTempHpExpression to empty string', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.tempHpExpression).toBe('')
        expect(result.allyTempHpExpression).toBe('')
    })

    it('defaults maxAllies to 5', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.maxAllies).toBe(5)
    })

    it('defaults range to "60_ft"', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60_ft')
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'celestial_resilience',
            tempHpExpression: '2d4',
            allyTempHpExpression: '1d4',
            maxAllies: 3,
            range: '30_ft',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.tempHpExpression).toBe('2d4')
        expect(result.allyTempHpExpression).toBe('1d4')
        expect(result.maxAllies).toBe(3)
        expect(result.range).toBe('30_ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── dark_ones_look ─────────────────────────────────────────────────────

describe('buildAttackInfo – dark_ones_look', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'dark_ones_look' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('dark_ones_look')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults diceExpression to "1d10"', () => {
        const feature = makeFeature({ type: 'dark_ones_look' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.diceExpression).toBe('1d10')
    })

    it('passes through provided diceExpression', () => {
        const feature = makeFeature({
            type: 'dark_ones_look',
            diceExpression: '2d10',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.diceExpression).toBe('2d10')
    })
})

// ── hurl_through_hell ──────────────────────────────────────────────────

describe('buildAttackInfo – hurl_through_hell', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('hurl_through_hell')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults damageExpression and damageType to empty string', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
    })

    it('defaults saveType to "CHA", saveDc to "ability", saveAbility to "CHA"', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('CHA')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
    })

    it('defaults oncePerTurn to false', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerTurn).toBe(false)
    })

    it('defaults uses to 1', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.uses).toBe(1)
    })

    it('defaults pactMagicRecharge to false', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.pactMagicRecharge).toBe(false)
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('coerces oncePerTurn and pactMagicRecharge to boolean', () => {
        const feature = makeFeature({
            type: 'hurl_through_hell',
            oncePerTurn: 'yes',
            pactMagicRecharge: 1,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.oncePerTurn).toBe(true)
        expect(result.pactMagicRecharge).toBe(true)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'hurl_through_hell',
            damageExpression: '4d10',
            damageType: 'psychic',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'INT',
            oncePerTurn: true,
            uses: 2,
            pactMagicRecharge: true,
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.damageExpression).toBe('4d10')
        expect(result.damageType).toBe('psychic')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('INT')
        expect(result.oncePerTurn).toBe(true)
        expect(result.uses).toBe(2)
        expect(result.pactMagicRecharge).toBe(true)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── clairvoyant_combatant ──────────────────────────────────────────────

describe('buildAttackInfo – clairvoyant_combatant', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('clairvoyant_combatant')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults saveType to "WIS", saveDc to "ability", saveAbility to "CHA"', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe('ability')
        expect(result.saveAbility).toBe('CHA')
    })

    it('defaults duration to "1_minute"', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
    })

    it('defaults uses to 1', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.uses).toBe(1)
    })

    it('defaults pactMagicRecharge to false', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.pactMagicRecharge).toBe(false)
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('coerces pactMagicRecharge to boolean', () => {
        const feature = makeFeature({
            type: 'clairvoyant_combatant',
            pactMagicRecharge: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.pactMagicRecharge).toBe(true)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'clairvoyant_combatant',
            saveType: 'CON',
            saveDc: 13,
            saveAbility: 'STR',
            duration: '1_hour',
            uses: 2,
            pactMagicRecharge: true,
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(13)
        expect(result.saveAbility).toBe('STR')
        expect(result.duration).toBe('1_hour')
        expect(result.uses).toBe(2)
        expect(result.pactMagicRecharge).toBe(true)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── spell_breaker ──────────────────────────────────────────────────────
// Returns type "passive_rule" (not "spell_breaker").

describe('buildAttackInfo – spell_breaker', () => {
    it('returns type passive_rule (not spell_breaker)', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('passive_rule')
    })

    it('hardcodes effect to "spell_breaker"', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('spell_breaker')
    })

    it('returns hasAutomation and correct name', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.hasAutomation).toBe(true)
        expect(result.name).toBe('Test Feature')
    })

    it('defaults all arrays to empty, casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.alwaysPreparedSpells).toEqual([])
        expect(result.bonusActionSpells).toEqual([])
        expect(result.dispelAbilityCheckBonus).toBe('')
        expect(result.slotRetentionSpells).toEqual([])
        expect(result.casting_time).toBe('passive')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'spell_breaker',
            alwaysPreparedSpells: ['magic missile'],
            bonusActionSpells: ['shield'],
            dispelAbilityCheckBonus: '+2',
            slotRetentionSpells: ['absorb elements'],
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.alwaysPreparedSpells).toEqual(['magic missile'])
        expect(result.bonusActionSpells).toEqual(['shield'])
        expect(result.dispelAbilityCheckBonus).toBe('+2')
        expect(result.slotRetentionSpells).toEqual(['absorb elements'])
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── create_thrall ──────────────────────────────────────────────────────
// Uses evaluateAutoExpression for usesMax.

describe('buildAttackInfo – create_thrall', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('create_thrall')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults spell to empty string', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spell).toBe('')
    })

    it('defaults uses to 1', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.uses).toBe(1)
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('defaults action to "action"', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('action')
    })

    it('defaults casting_time to "1 action"', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            spell: 'find familiar',
            uses: 3,
            uses_expression: 'level',
            recharge: 'short_rest',
            action: 'bonus_action',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.spell).toBe('find familiar')
        expect(result.uses).toBe(3)
        expect(result.uses_expression).toBe('level')
        expect(result.recharge).toBe('short_rest')
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── portent ────────────────────────────────────────────────────────────
// Uses playerStats.level to determine maxDice.

describe('buildAttackInfo – portent', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'portent' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('portent')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults effect to empty string', () => {
        const feature = makeFeature({ type: 'portent' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('')
    })

    it('sets maxDice to 2 when level < 14', () => {
        // BASE_STATS.level = 5
        const feature = makeFeature({ type: 'portent' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.maxDice).toBe(2)
    })

    it('sets maxDice to 3 when level >= 14', () => {
        const stats = { ...BASE_STATS, level: 14 }
        const feature = makeFeature({ type: 'portent' })
        const result = buildAttackInfo(feature, stats)

        expect(result.maxDice).toBe(3)
    })

    it('passes through provided effect', () => {
        const feature = makeFeature({
            type: 'portent',
            effect: 'replace_roll',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('replace_roll')
    })
})

// ── third_eye ──────────────────────────────────────────────────────────

describe('buildAttackInfo – third_eye', () => {
    it('returns type bonus_action_choice (not third_eye)', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('bonus_action_choice')
    })

    it('returns hasAutomation and correct name', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.hasAutomation).toBe(true)
        expect(result.name).toBe('Test Feature')
    })

    it('hardcodes 3 options for the choice', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toHaveLength(3)
        expect(result.options[0].name).toBe('Darkvision (120 feet)')
        expect(result.options[1].name).toBe('Greater Comprehension')
        expect(result.options[2].name).toBe('See Invisibility')
    })

    it('hardcodes action to "bonus_action"', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('hardcodes casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('defaults duration to "short_or_long_rest"', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('short_or_long_rest')
    })

    it('passes through provided duration', () => {
        const feature = makeFeature({
            type: 'third_eye',
            duration: '1_hour',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('1_hour')
    })
})

// ── improved_illusions ─────────────────────────────────────────────────

describe('buildAttackInfo – improved_illusions', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'improved_illusions' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('improved_illusions')
        expect(result.hasAutomation).toBe(true)
    })

    it('hardcodes effect to "improved_illusions"', () => {
        const feature = makeFeature({ type: 'improved_illusions' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('improved_illusions')
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'improved_illusions' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided casting_time', () => {
        const feature = makeFeature({
            type: 'improved_illusions',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })
})

// ── phantasmal_creatures ───────────────────────────────────────────────

describe('buildAttackInfo – phantasmal_creatures', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('phantasmal_creatures')
        expect(result.hasAutomation).toBe(true)
    })

    it('hardcodes effect to "phantasmal_creatures"', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('phantasmal_creatures')
    })

    it('defaults casting_time to "passive"', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('passive')
    })

    it('defaults alwaysPreparedSpells, freeCastSpells to empty array', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.alwaysPreparedSpells).toEqual([])
        expect(result.freeCastSpells).toEqual([])
    })

    it('defaults usesMax to 1', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.usesMax).toBe(1)
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('defaults halvesHp to false', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.halvesHp).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'phantasmal_creatures',
            casting_time: '1 action',
            alwaysPreparedSpells: ['major image'],
            freeCastSpells: ['minor illusion'],
            usesMax: 3,
            recharge: 'short_rest',
            halvesHp: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
        expect(result.alwaysPreparedSpells).toEqual(['major image'])
        expect(result.freeCastSpells).toEqual(['minor illusion'])
        expect(result.usesMax).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.halvesHp).toBe(true)
    })
})

// ── illusory_reality ───────────────────────────────────────────────────

describe('buildAttackInfo – illusory_reality', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'illusory_reality' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('illusory_reality')
        expect(result.hasAutomation).toBe(true)
    })

    it('hardcodes effect to "illusory_reality"', () => {
        const feature = makeFeature({ type: 'illusory_reality' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('illusory_reality')
    })

    it('defaults casting_time to "1 bonus_action"', () => {
        const feature = makeFeature({ type: 'illusory_reality' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus_action')
    })

    it('defaults objectDuration to "1 minute"', () => {
        const feature = makeFeature({ type: 'illusory_reality' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.objectDuration).toBe('1 minute')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'illusory_reality',
            casting_time: '1 action',
            objectDuration: '1 hour',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
        expect(result.objectDuration).toBe('1 hour')
    })
})

// ── celestial_revelation ───────────────────────────────────────────────

describe('buildAttackInfo – celestial_revelation', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('celestial_revelation')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults options to empty array', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([])
    })

    it('coerces chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'celestial_revelation',
            chooseOne: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(true)
    })

    it('defaults chooseOne to false', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(false)
    })

    it('defaults duration to "1_minute"', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('1_minute')
    })

    it('defaults action to "bonus_action"', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('defaults recharge to "long_rest"', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.recharge).toBe('long_rest')
    })

    it('defaults minLevel to 3', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.minLevel).toBe(3)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'celestial_revelation',
            options: ['radiant_touch', 'healingHands'],
            chooseOne: true,
            duration: '1_hour',
            action: 'action',
            casting_time: '1 action',
            recharge: 'short_rest',
            minLevel: 5,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['radiant_touch', 'healingHands'])
        expect(result.chooseOne).toBe(true)
        expect(result.duration).toBe('1_hour')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
        expect(result.recharge).toBe('short_rest')
        expect(result.minLevel).toBe(5)
    })
})

// ── elfish_lineage ─────────────────────────────────────────────────────

describe('buildAttackInfo – elfish_lineage', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'elfish_lineage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('elfish_lineage')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults options to empty array', () => {
        const feature = makeFeature({ type: 'elfish_lineage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([])
    })

    it('coerces chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'elfish_lineage',
            chooseOne: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(true)
    })

    it('defaults chooseOne to false', () => {
        const feature = makeFeature({ type: 'elfish_lineage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'elfish_lineage',
            options: ['darkvision', 'keen_senses'],
            chooseOne: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['darkvision', 'keen_senses'])
        expect(result.chooseOne).toBe(true)
    })
})

// ── gnomish_lineage ────────────────────────────────────────────────────

describe('buildAttackInfo – gnomish_lineage', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'gnomish_lineage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('gnomish_lineage')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults options to empty array', () => {
        const feature = makeFeature({ type: 'gnomish_lineage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([])
    })

    it('coerces chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'gnomish_lineage',
            chooseOne: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(true)
    })

    it('defaults chooseOne to false', () => {
        const feature = makeFeature({ type: 'gnomish_lineage' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'gnomish_lineage',
            options: ['magic_Resistance', 'gnomish_finess'],
            chooseOne: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['magic_Resistance', 'gnomish_finess'])
        expect(result.chooseOne).toBe(true)
    })
})

// ── fiendish_legacy ────────────────────────────────────────────────────

describe('buildAttackInfo – fiendish_legacy', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'fiendish_legacy' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('fiendish_legacy')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults options to empty array', () => {
        const feature = makeFeature({ type: 'fiendish_legacy' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual([])
    })

    it('coerces chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'fiendish_legacy',
            chooseOne: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(true)
    })

    it('defaults chooseOne to false', () => {
        const feature = makeFeature({ type: 'fiendish_legacy' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.chooseOne).toBe(false)
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'fiendish_legacy',
            options: ['hellish_rebellion', 'warrior_of_magma'],
            chooseOne: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.options).toEqual(['hellish_rebellion', 'warrior_of_magma'])
        expect(result.chooseOne).toBe(true)
    })
})

// ── lesser_restoration ─────────────────────────────────────────────────

describe('buildAttackInfo – lesser_restoration', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('lesser_restoration')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults range to "Touch"', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('Touch')
    })

    it('defaults conditions to the four standard conditions', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.conditions).toEqual([
            'blinded',
            'deafened',
            'paralyzed',
            'poisoned',
        ])
    })

    it('defaults casting_time to "bonus_action"', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('bonus_action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'lesser_restoration',
            range: '30 ft',
            conditions: ['frightened', 'charmed'],
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('30 ft')
        expect(result.conditions).toEqual(['frightened', 'charmed'])
        expect(result.casting_time).toBe('1 action')
    })
})

// ── remove_curse ───────────────────────────────────────────────────────

describe('buildAttackInfo – remove_curse', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'remove_curse' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('remove_curse')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults range to "Touch"', () => {
        const feature = makeFeature({ type: 'remove_curse' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('Touch')
    })

    it('defaults casting_time to "1 action"', () => {
        const feature = makeFeature({ type: 'remove_curse' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'remove_curse',
            range: '60 ft',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('60 ft')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── protection_from_poison ─────────────────────────────────────────────

describe('buildAttackInfo – protection_from_poison', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'protection_from_poison' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('protection_from_poison')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults range to "Touch"', () => {
        const feature = makeFeature({ type: 'protection_from_poison' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('Touch')
    })

    it('defaults duration to "1 hour"', () => {
        const feature = makeFeature({ type: 'protection_from_poison' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('1 hour')
    })

    it('defaults casting_time to "1 action"', () => {
        const feature = makeFeature({ type: 'protection_from_poison' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'protection_from_poison',
            range: '30 ft',
            duration: '1 minute',
            casting_time: '1 bonus action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('30 ft')
        expect(result.duration).toBe('1 minute')
        expect(result.casting_time).toBe('1 bonus action')
    })
})

// ── sentinel ───────────────────────────────────────────────────────────

describe('buildAttackInfo – sentinel', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('sentinel')
        expect(result.hasAutomation).toBe(true)
    })

    it('hardcodes effect to "speed_0_on_oa_hit"', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('speed_0_on_oa_hit')
    })

    it('defaults duration to "end_of_turn"', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.duration).toBe('end_of_turn')
    })

    it('defaults casting_time to "1 action"', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'sentinel',
            effect: 'reactions_0',
            duration: 'until_end_of_turn',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.effect).toBe('reactions_0')
        expect(result.duration).toBe('until_end_of_turn')
        expect(result.casting_time).toBe('1 reaction')
    })
})

// ── telekinetic_shove ──────────────────────────────────────────────────
// Uses playerStats.proficiency and getAbilityModifier for saveDc.

describe('buildAttackInfo – telekinetic_shove', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.type).toBe('telekinetic_shove')
        expect(result.hasAutomation).toBe(true)
    })

    it('computes saveDc from ability when saveDc is "ability"', () => {
        // BASE_STATS: INT bonus=1, proficiency=3 => 8 + 1 + 3 = 12
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 'ability',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveDc).toBe(12)
    })

    it('uses explicit saveDc when not "ability"', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 15,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveDc).toBe(15)
    })

    it('defaults saveType to "STR"', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('STR')
    })

    it('defaults saveAbility to "INT"', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveAbility).toBe('INT')
    })

    it('defaults range to "30"', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('30')
    })

    it('defaults pushDistance to 5', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.pushDistance).toBe(5)
    })

    it('defaults action to "bonus_action" when casting_time is "1 bonus action"', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('derives action from casting_time "1 action"', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('action')
    })

    it('derives action from casting_time "bonus_action"', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: 'bonus_action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
    })

    it('uses explicit action when provided', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            action: 'reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('reaction')
    })

    it('defaults casting_time to "1 bonus action"', () => {
        const feature = makeFeature({ type: 'telekinetic_shove' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.casting_time).toBe('1 bonus action')
    })

    it('passes through all optional fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveType: 'CON',
            saveDc: 15,
            saveAbility: 'STR',
            range: '30',
            pushDistance: 10,
            action: 'action',
            casting_time: '1 action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('STR')
        expect(result.range).toBe('30')
        expect(result.pushDistance).toBe(10)
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
    })
})
