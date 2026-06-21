// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { miscHandlers } from './misc.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── Helpers ──────────────────────────────────────────────────────────

const checkDefaults = (result, expected) => {
    expect(result).toMatchObject(expected)
    expect(result.hasAutomation).toBe(true)
    expect(result.name).toBe('Test Feature')
}

// ── cantrip_spellcasting_ability ─────────────────────────────────────

describe('miscHandlers – cantrip_spellcasting_ability', () => {
    it('returns cantrip info with defaults', () => {
        const feature = makeFeature({ type: 'cantrip_spellcasting_ability' })
        const result = miscHandlers.cantrip_spellcasting_ability(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'cantrip_spellcasting_ability',
            cantripName: '',
            spellcastingAbility: ''
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'cantrip_spellcasting_ability',
            cantripName: 'Fire Bolt',
            spellcastingAbility: 'INT'
        })
        const result = miscHandlers.cantrip_spellcasting_ability(feature, BASE_STATS)
        expect(result.cantripName).toBe('Fire Bolt')
        expect(result.spellcastingAbility).toBe('INT')
    })
})

// ── auto_effect ──────────────────────────────────────────────────────

describe('miscHandlers – auto_effect', () => {
    it('returns auto_effect info with defaults', () => {
        const feature = makeFeature({ type: 'auto_effect' })
        const result = miscHandlers.auto_effect(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'auto_effect',
            trigger: '',
            effect: '',
            value: null,
            uses: null,
            recharge: 'long_rest'
        })
    })

    it('coerces value 0 to null via || operator', () => {
        const feature = makeFeature({ type: 'auto_effect', value: 0 })
        const result = miscHandlers.auto_effect(feature, BASE_STATS)
        expect(result.value).toBeNull()
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'auto_effect',
            trigger: 'on_death',
            effect: 'revive',
            value: 10,
            uses: 1,
            recharge: 'long_rest'
        })
        const result = miscHandlers.auto_effect(feature, BASE_STATS)
        expect(result.trigger).toBe('on_death')
        expect(result.effect).toBe('revive')
        expect(result.value).toBe(10)
        expect(result.uses).toBe(1)
        expect(result.recharge).toBe('long_rest')
    })
})

// ── survive_and_heal ─────────────────────────────────────────────────

describe('miscHandlers – survive_and_heal', () => {
    it('returns half max hp when expression is half_max_hp', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 20 } }
        const feature = makeFeature({ type: 'survive_and_heal', healExpression: 'half_max_hp' })
        const result = miscHandlers.survive_and_heal(feature, stats)
        checkDefaults(result, {
            type: 'survive_and_heal',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healAmount: 10,
            recharge: 'long_rest'
        })
    })

    it('parses numeric healExpression string', () => {
        const feature = makeFeature({ type: 'survive_and_heal', healExpression: '15' })
        const result = miscHandlers.survive_and_heal(feature, BASE_STATS)
        expect(result.healAmount).toBe(15)
    })

    it('defaults to half max hp when no expression', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 30 } }
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = miscHandlers.survive_and_heal(feature, stats)
        expect(result.healAmount).toBe(15)
    })

    it('falls back to level when hitPoints.max is missing', () => {
        const stats = { ...BASE_STATS }
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = miscHandlers.survive_and_heal(feature, stats)
        expect(result.healAmount).toBe(2) // level 5 / 2 = 2
    })

    it('returns NaN for non-numeric expression (no fallback)', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 20 } }
        const feature = makeFeature({ type: 'survive_and_heal', healExpression: 'invalid' })
        const result = miscHandlers.survive_and_heal(feature, stats)
        expect(result.healAmount).toBeNaN()
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'survive_and_heal',
            trigger: 'below_half_hp',
            effect: 'stabilize',
            minHp: 5,
            recharge: 'short_rest'
        })
        const result = miscHandlers.survive_and_heal(feature, BASE_STATS)
        expect(result.trigger).toBe('below_half_hp')
        expect(result.effect).toBe('stabilize')
        expect(result.minHp).toBe(5)
        expect(result.recharge).toBe('short_rest')
    })
})

// ── auto_reroll ──────────────────────────────────────────────────────

describe('miscHandlers – auto_reroll', () => {
    it('returns auto_reroll info with defaults', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = miscHandlers.auto_reroll(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'auto_reroll',
            target: 'd20',
            condition: '',
            effect: 'reroll',
            trigger: '',
            bonus: null,
            range: '',
            resourceCost: '',
            casting_time: '',
            bonusExpression: '',
            oncePerRage: false,
            oncePerTurn: false,
            oncePer: ''
        })
    })

    it('coerces boolean fields with !!', () => {
        const feature = makeFeature({
            type: 'auto_reroll',
            oncePerRage: 1,
            oncePerTurn: 'yes'
        })
        const result = miscHandlers.auto_reroll(feature, BASE_STATS)
        expect(result.oncePerRage).toBe(true)
        expect(result.oncePerTurn).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'auto_reroll',
            target: 'saving_throw',
            condition: 'disadvantage',
            trigger: 'on_save',
            bonus: 2,
            range: '30 ft',
            resourceCost: 'luck_points',
            casting_time: '1 reaction',
            bonusExpression: '+2d4',
            oncePerRage: true,
            oncePerTurn: true,
            oncePer: 'short_rest'
        })
        const result = miscHandlers.auto_reroll(feature, BASE_STATS)
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('disadvantage')
        expect(result.bonus).toBe(2)
        expect(result.range).toBe('30 ft')
        expect(result.resourceCost).toBe('luck_points')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.bonusExpression).toBe('+2d4')
        expect(result.oncePerRage).toBe(true)
        expect(result.oncePerTurn).toBe(true)
        expect(result.oncePer).toBe('short_rest')
    })
})

// ── restore_balance ──────────────────────────────────────────────────

describe('miscHandlers – restore_balance', () => {
    it('returns restore_balance info with defaults', () => {
        const feature = makeFeature({ type: 'restore_balance' })
        const result = miscHandlers.restore_balance(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'restore_balance',
            target: 'd20',
            range: '60_ft'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'restore_balance',
            target: 'attack_roll',
            range: '30_ft'
        })
        const result = miscHandlers.restore_balance(feature, BASE_STATS)
        expect(result.target).toBe('attack_roll')
        expect(result.range).toBe('30_ft')
    })
})

// ── countercharm ─────────────────────────────────────────────────────

describe('miscHandlers – countercharm', () => {
    it('returns countercharm info with defaults', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = miscHandlers.countercharm(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'countercharm',
            trigger: '',
            range: '',
            conditions: [],
            effect: '',
            uses: 1,
            recharge: 'long_rest',
            casting_time: '1 reaction'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'countercharm',
            trigger: 'ally_charmed',
            range: '30_ft',
            conditions: ['charmed', 'frightened'],
            effect: 'remove_conditions',
            uses: 3,
            recharge: 'long_rest'
        })
        const result = miscHandlers.countercharm(feature, BASE_STATS)
        expect(result.trigger).toBe('ally_charmed')
        expect(result.range).toBe('30_ft')
        expect(result.conditions).toEqual(['charmed', 'frightened'])
        expect(result.effect).toBe('remove_conditions')
        expect(result.uses).toBe(3)
    })
})

// ── misty_wanderer ───────────────────────────────────────────────────

describe('miscHandlers – misty_wanderer', () => {
    it('returns misty_wanderer info with defaults', () => {
        const feature = makeFeature({ type: 'misty_wanderer' })
        const result = miscHandlers.misty_wanderer(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'misty_wanderer',
            trigger: '',
            range: '5_ft',
            casting_time: 'passive'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'misty_wanderer',
            trigger: 'hit_by_attack',
            range: '10_ft'
        })
        const result = miscHandlers.misty_wanderer(feature, BASE_STATS)
        expect(result.trigger).toBe('hit_by_attack')
        expect(result.range).toBe('10_ft')
    })
})

// ── misty_escape ─────────────────────────────────────────────────────

describe('miscHandlers – misty_escape', () => {
    it('returns misty_escape info with defaults', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = miscHandlers.misty_escape(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'misty_escape',
            spell: 'Misty Step',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            damageExpression: '',
            damageType: '',
            condition: 'invisible',
            casting_time: '1 reaction'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'misty_escape',
            spell: 'Dimension Door',
            saveType: 'CON',
            saveDc: 15,
            damageExpression: '2d8',
            damageType: 'Force',
            casting_time: '1 action'
        })
        const result = miscHandlers.misty_escape(feature, BASE_STATS)
        expect(result.spell).toBe('Dimension Door')
        expect(result.saveType).toBe('CON')
        expect(result.saveDc).toBe(15)
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('Force')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── steps_of_the_fey ─────────────────────────────────────────────────

describe('miscHandlers – steps_of_the_fey', () => {
    it('returns steps_of_the_fey info with defaults', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = miscHandlers.steps_of_the_fey(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'steps_of_the_fey',
            spell: 'Misty Step',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            saveAbility: 'CHA',
            saveDc: 'ability'
        })
    })

    it('resolves uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'steps_of_the_fey',
            uses_expression: 'proficiency_bonus'
        })
        const result = miscHandlers.steps_of_the_fey(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'steps_of_the_fey',
            spell: 'Misty Step',
            uses: 3,
            recharge: 'short_rest',
            saveType: 'WIS',
            saveDc: 15
        })
        const result = miscHandlers.steps_of_the_fey(feature, BASE_STATS)
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
    })
})

// ── moonlight_step_rider ─────────────────────────────────────────────

describe('miscHandlers – moonlight_step_rider', () => {
    it('returns moonlight_step_rider info', () => {
        const feature = makeFeature({ type: 'moonlight_step_rider' })
        const result = miscHandlers.moonlight_step_rider(feature, BASE_STATS)
        expect(result.type).toBe('moonlight_step_rider')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

// ── post_cast_rider ──────────────────────────────────────────────────

describe('miscHandlers – post_cast_rider', () => {
    it('returns post_cast_rider info with defaults', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = miscHandlers.post_cast_rider(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'post_cast_rider',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            condition: '',
            duration: '1_minute',
            range: '60 ft',
            spellSchools: [],
            recharge: 'long_rest'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'post_cast_rider',
            condition: 'blinded',
            duration: '1_round',
            spellSchools: ['evocation']
        })
        const result = miscHandlers.post_cast_rider(feature, BASE_STATS)
        expect(result.condition).toBe('blinded')
        expect(result.duration).toBe('1_round')
        expect(result.spellSchools).toEqual(['evocation'])
    })
})

// ── post_cast_smite_cover ────────────────────────────────────────────

describe('miscHandlers – post_cast_smite_cover', () => {
    it('returns post_cast_smite_cover info with defaults', () => {
        const feature = makeFeature({ type: 'post_cast_smite_cover' })
        const result = miscHandlers.post_cast_smite_cover(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'post_cast_smite_cover',
            casting_time: 'passive'
        })
    })
})

// ── post_cast_inspiring_smite ────────────────────────────────────────

describe('miscHandlers – post_cast_inspiring_smite', () => {
    it('returns post_cast_inspiring_smite info with defaults', () => {
        const feature = makeFeature({ type: 'post_cast_inspiring_smite' })
        const result = miscHandlers.post_cast_inspiring_smite(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'post_cast_inspiring_smite',
            range: '30 ft',
            casting_time: 'passive'
        })
    })
})

// ── resistance ───────────────────────────────────────────────────────

describe('miscHandlers – resistance', () => {
    it('returns resistance info with defaults', () => {
        const feature = makeFeature({ type: 'resistance' })
        const result = miscHandlers.resistance(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'resistance',
            damageTypes: []
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'resistance',
            damageTypes: ['fire', 'cold', 'lightning']
        })
        const result = miscHandlers.resistance(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['fire', 'cold', 'lightning'])
    })
})

// ── land_resistance ──────────────────────────────────────────────────

describe('miscHandlers – land_resistance', () => {
    it('returns land_resistance info with defaults', () => {
        const feature = makeFeature({ type: 'land_resistance' })
        const result = miscHandlers.land_resistance(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'land_resistance',
            conditionImmunity: '',
            landMappings: {}
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'land_resistance',
            conditionImmunity: 'charmed',
            landMappings: { forest: 'resistance', desert: 'vulnerability' }
        })
        const result = miscHandlers.land_resistance(feature, BASE_STATS)
        expect(result.conditionImmunity).toBe('charmed')
        expect(result.landMappings).toEqual({ forest: 'resistance', desert: 'vulnerability' })
    })
})

// ── set_condition ────────────────────────────────────────────────────

describe('miscHandlers – set_condition', () => {
    it('returns set_condition info with defaults', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = miscHandlers.set_condition(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'set_condition',
            target: undefined,
            condition: undefined,
            additionalCondition: null,
            cost: '',
            range: '60 ft',
            saveType: 'STR',
            effect: ''
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'set_condition',
            target: 'enemy',
            condition: 'prone',
            additionalCondition: 'slowed',
            cost: '1d6',
            range: '30 ft',
            saveType: 'CON',
            effect: 'knock_down'
        })
        const result = miscHandlers.set_condition(feature, BASE_STATS)
        expect(result.target).toBe('enemy')
        expect(result.condition).toBe('prone')
        expect(result.additionalCondition).toBe('slowed')
        expect(result.cost).toBe('1d6')
        expect(result.range).toBe('30 ft')
        expect(result.saveType).toBe('CON')
        expect(result.effect).toBe('knock_down')
    })
})

// ── shadow_step_rider ────────────────────────────────────────────────

describe('miscHandlers – shadow_step_rider', () => {
    it('returns shadow_step_rider info', () => {
        const feature = makeFeature({ type: 'shadow_step_rider' })
        const result = miscHandlers.shadow_step_rider(feature, BASE_STATS)
        expect(result.type).toBe('shadow_step_rider')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

// ── relentless_avenger ───────────────────────────────────────────────

describe('miscHandlers – relentless_avenger', () => {
    it('returns relentless_avenger info with defaults', () => {
        const feature = makeFeature({ type: 'relentless_avenger' })
        const result = miscHandlers.relentless_avenger(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'relentless_avenger',
            trigger: 'after_opportunity_attack_hit',
            duration: 'until_end_of_current_turn'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'relentless_avenger',
            trigger: 'after_hit',
            duration: '1_round'
        })
        const result = miscHandlers.relentless_avenger(feature, BASE_STATS)
        expect(result.trigger).toBe('after_hit')
        expect(result.duration).toBe('1_round')
    })
})

// ── soul_of_vengeance ────────────────────────────────────────────────

describe('miscHandlers – soul_of_vengeance', () => {
    it('returns soul_of_vengeance info with defaults', () => {
        const feature = makeFeature({ type: 'soul_of_vengeance' })
        const result = miscHandlers.soul_of_vengeance(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'soul_of_vengeance',
            trigger: 'after_vow_of_enmity_target_attacks'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'soul_of_vengeance',
            trigger: 'after_smite_hit'
        })
        const result = miscHandlers.soul_of_vengeance(feature, BASE_STATS)
        expect(result.trigger).toBe('after_smite_hit')
    })
})

// ── hunter_prey ──────────────────────────────────────────────────────

describe('miscHandlers – hunter_prey', () => {
    it('returns hunter_prey info with defaults', () => {
        const feature = makeFeature({ type: 'hunter_prey' })
        const result = miscHandlers.hunter_prey(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'hunter_prey',
            casting_time: 'passive'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'hunter_prey',
            casting_time: '1 action'
        })
        const result = miscHandlers.hunter_prey(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── defensive_tactics ────────────────────────────────────────────────

describe('miscHandlers – defensive_tactics', () => {
    it('returns defensive_tactics info with defaults', () => {
        const feature = makeFeature({ type: 'defensive_tactics' })
        const result = miscHandlers.defensive_tactics(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'defensive_tactics',
            casting_time: 'passive'
        })
    })
})

// ── superior_hunter_prey ─────────────────────────────────────────────

describe('miscHandlers – superior_hunter_prey', () => {
    it('returns superior_hunter_prey info with defaults', () => {
        const feature = makeFeature({ type: 'superior_hunter_prey' })
        const result = miscHandlers.superior_hunter_prey(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'superior_hunter_prey',
            casting_time: 'passive'
        })
    })
})

// ── superior_hunter_defense ──────────────────────────────────────────

describe('miscHandlers – superior_hunter_defense', () => {
    it('returns superior_hunter_defense info with defaults', () => {
        const feature = makeFeature({ type: 'superior_hunter_defense' })
        const result = miscHandlers.superior_hunter_defense(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'superior_hunter_defense',
            casting_time: '1 reaction'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'superior_hunter_defense',
            casting_time: '1 action'
        })
        const result = miscHandlers.superior_hunter_defense(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
    })
})

// ── bonus_action_choice ──────────────────────────────────────────────

describe('miscHandlers – bonus_action_choice', () => {
    it('returns bonus_action_choice info with defaults', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = miscHandlers.bonus_action_choice(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'bonus_action_choice',
            options: [],
            action: 'bonus_action',
            casting_time: '1 bonus action'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'bonus_action_choice',
            options: [{ name: 'Option A' }, { name: 'Option B' }],
            action: 'action',
            casting_time: '1 action'
        })
        const result = miscHandlers.bonus_action_choice(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Option A' }, { name: 'Option B' }])
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── steady_aim ───────────────────────────────────────────────────────

describe('miscHandlers – steady_aim', () => {
    it('returns steady_aim info with defaults', () => {
        const feature = makeFeature({ type: 'steady_aim' })
        const result = miscHandlers.steady_aim(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'steady_aim',
            duration: 'until_end_of_turn',
            casting_time: '1 bonus action'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'steady_aim',
            duration: '1_round',
            casting_time: '1 action'
        })
        const result = miscHandlers.steady_aim(feature, BASE_STATS)
        expect(result.duration).toBe('1_round')
        expect(result.casting_time).toBe('1 action')
    })
})

// ── mage_hand_control ────────────────────────────────────────────────

describe('miscHandlers – mage_hand_control', () => {
    it('returns mage_hand_control info with defaults', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = miscHandlers.mage_hand_control(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'mage_hand_control',
            range: '30_ft',
            action: 'bonus_action',
            casting_time: '1 bonus action'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'mage_hand_control',
            range: '60_ft',
            action: 'action'
        })
        const result = miscHandlers.mage_hand_control(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('action')
    })
})

// ── stroke_of_luck ───────────────────────────────────────────────────

describe('miscHandlers – stroke_of_luck', () => {
    it('returns stroke_of_luck info with defaults', () => {
        const feature = makeFeature({ type: 'stroke_of_luck' })
        const result = miscHandlers.stroke_of_luck(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'stroke_of_luck',
            target: 'd20',
            recharge: 'short_or_long_rest'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'stroke_of_luck',
            target: 'attack_roll',
            recharge: 'long_rest'
        })
        const result = miscHandlers.stroke_of_luck(feature, BASE_STATS)
        expect(result.target).toBe('attack_roll')
        expect(result.recharge).toBe('long_rest')
    })
})

// ── modify_d20_roll ──────────────────────────────────────────────────

describe('miscHandlers – modify_d20_roll', () => {
    it('returns modify_d20_roll info with defaults', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = miscHandlers.modify_d20_roll(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'modify_d20_roll',
            modifier: '2d4',
            range: '60 ft',
            canBeBonusOrPenalty: false,
            recharge: 'initiative_or_short_or_long_rest',
            casting_time: '1 bonus action'
        })
    })

    it('coerces canBeBonusOrPenalty with !!', () => {
        const feature = makeFeature({
            type: 'modify_d20_roll',
            canBeBonusOrPenalty: 'true'
        })
        const result = miscHandlers.modify_d20_roll(feature, BASE_STATS)
        expect(result.canBeBonusOrPenalty).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'modify_d20_roll',
            modifier: '2d6',
            range: '30 ft',
            canBeBonusOrPenalty: true
        })
        const result = miscHandlers.modify_d20_roll(feature, BASE_STATS)
        expect(result.modifier).toBe('2d6')
        expect(result.range).toBe('30 ft')
        expect(result.canBeBonusOrPenalty).toBe(true)
    })
})

// ── fast_hands ───────────────────────────────────────────────────────

describe('miscHandlers – fast_hands', () => {
    it('returns fast_hands info with defaults', () => {
        const feature = makeFeature({ type: 'fast_hands' })
        const result = miscHandlers.fast_hands(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'fast_hands',
            options: [],
            casting_time: '1 bonus action'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'fast_hands',
            options: [{ name: 'Sleight of Hand' }],
            casting_time: '1 action'
        })
        const result = miscHandlers.fast_hands(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Sleight of Hand' }])
        expect(result.casting_time).toBe('1 action')
    })
})

// ── use_magic_device ─────────────────────────────────────────────────

describe('miscHandlers – use_magic_device', () => {
    it('returns use_magic_device info with defaults', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = miscHandlers.use_magic_device(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: false,
            casting_time: 'passive'
        })
    })

    it('coerces scrollDisintegratesOnFail with !!', () => {
        const feature = makeFeature({
            type: 'use_magic_device',
            scrollDisintegratesOnFail: 'yes'
        })
        const result = miscHandlers.use_magic_device(feature, BASE_STATS)
        expect(result.scrollDisintegratesOnFail).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'use_magic_device',
            attunementLimit: 6,
            chargeReroll: '2d6',
            scrollAbility: 'CHA',
            scrollCheckDC: '15',
            scrollDisintegratesOnFail: true
        })
        const result = miscHandlers.use_magic_device(feature, BASE_STATS)
        expect(result.attunementLimit).toBe(6)
        expect(result.chargeReroll).toBe('2d6')
        expect(result.scrollAbility).toBe('CHA')
        expect(result.scrollCheckDC).toBe('15')
        expect(result.scrollDisintegratesOnFail).toBe(true)
    })
})

// ── wild_magic_surge ─────────────────────────────────────────────────

describe('miscHandlers – wild_magic_surge', () => {
    it('returns wild_magic_surge info with defaults', () => {
        const feature = makeFeature({ type: 'wild_magic_surge' })
        const result = miscHandlers.wild_magic_surge(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'wild_magic_surge',
            trigger: '',
            oncePerTurn: false
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'wild_magic_surge',
            trigger: 'on_spell_cast',
            oncePerTurn: true
        })
        const result = miscHandlers.wild_magic_surge(feature, BASE_STATS)
        expect(result.trigger).toBe('on_spell_cast')
        expect(result.oncePerTurn).toBe(true)
    })
})

// ── wild_magic_tamed ─────────────────────────────────────────────────

describe('miscHandlers – wild_magic_tamed', () => {
    it('returns wild_magic_tamed info with defaults', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = miscHandlers.wild_magic_tamed(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'wild_magic_tamed',
            trigger: '',
            recharge: 'long_rest',
            uses: 1
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'wild_magic_tamed',
            trigger: 'on_long_rest',
            recharge: 'short_rest',
            uses: 3
        })
        const result = miscHandlers.wild_magic_tamed(feature, BASE_STATS)
        expect(result.trigger).toBe('on_long_rest')
        expect(result.recharge).toBe('short_rest')
        expect(result.uses).toBe(3)
    })
})

// ── feats_of_chaos ───────────────────────────────────────────────────

describe('miscHandlers – feats_of_chaos', () => {
    it('returns conditional_advantage type for feats_of_chaos', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = miscHandlers.feats_of_chaos(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'conditional_advantage',
            target: 'd20',
            condition: 'feats_of_chaos_active',
            effect: 'advantage',
            abilities: []
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'feats_of_chaos',
            target: 'attack_roll',
            abilities: ['CHA']
        })
        const result = miscHandlers.feats_of_chaos(feature, BASE_STATS)
        expect(result.target).toBe('attack_roll')
        expect(result.abilities).toEqual(['CHA'])
    })
})

// ── multi_target_spread ──────────────────────────────────────────────

describe('miscHandlers – multi_target_spread', () => {
    it('returns multi_target_spread info with defaults', () => {
        const feature = makeFeature({ type: 'multi_target_spread' })
        const result = miscHandlers.multi_target_spread(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'multi_target_spread',
            spellFilter: [],
            range: '10 ft'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'multi_target_spread',
            spellFilter: ['fireball', 'lightning_bolt'],
            range: '20 ft'
        })
        const result = miscHandlers.multi_target_spread(feature, BASE_STATS)
        expect(result.spellFilter).toEqual(['fireball', 'lightning_bolt'])
        expect(result.range).toBe('20 ft')
    })
})

// ── bewitching_magic ─────────────────────────────────────────────────

describe('miscHandlers – bewitching_magic', () => {
    it('returns bewitching_magic info with defaults', () => {
        const feature = makeFeature({ type: 'bewitching_magic' })
        const result = miscHandlers.bewitching_magic(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'bewitching_magic',
            casting_time: 'passive'
        })
    })
})

// ── radiant_soul ─────────────────────────────────────────────────────

describe('miscHandlers – radiant_soul', () => {
    it('returns radiant_soul info with defaults', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = miscHandlers.radiant_soul(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'radiant_soul',
            damageTypes: [],
            damageExpression: '',
            oncePerTurn: false
        })
    })

    it('coerces oncePerTurn with !!', () => {
        const feature = makeFeature({
            type: 'radiant_soul',
            oncePerTurn: 'yes'
        })
        const result = miscHandlers.radiant_soul(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'radiant_soul',
            damageTypes: ['radiant'],
            damageExpression: '2d8',
            oncePerTurn: true
        })
        const result = miscHandlers.radiant_soul(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['radiant'])
        expect(result.damageExpression).toBe('2d8')
        expect(result.oncePerTurn).toBe(true)
    })
})

// ── celestial_resilience ─────────────────────────────────────────────

describe('miscHandlers – celestial_resilience', () => {
    it('returns celestial_resilience info with defaults', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = miscHandlers.celestial_resilience(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'celestial_resilience',
            tempHpExpression: '',
            allyTempHpExpression: '',
            maxAllies: 5,
            range: '60_ft',
            casting_time: 'passive'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'celestial_resilience',
            tempHpExpression: '2d8',
            allyTempHpExpression: '1d8',
            maxAllies: 10,
            range: '30_ft'
        })
        const result = miscHandlers.celestial_resilience(feature, BASE_STATS)
        expect(result.tempHpExpression).toBe('2d8')
        expect(result.allyTempHpExpression).toBe('1d8')
        expect(result.maxAllies).toBe(10)
        expect(result.range).toBe('30_ft')
    })
})

// ── dark_ones_look ───────────────────────────────────────────────────

describe('miscHandlers – dark_ones_look', () => {
    it('returns dark_ones_look info with defaults', () => {
        const feature = makeFeature({ type: 'dark_ones_look' })
        const result = miscHandlers.dark_ones_look(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'dark_ones_look',
            diceExpression: '1d10'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'dark_ones_look',
            diceExpression: '2d10'
        })
        const result = miscHandlers.dark_ones_look(feature, BASE_STATS)
        expect(result.diceExpression).toBe('2d10')
    })
})

// ── hurl_through_hell ────────────────────────────────────────────────

describe('miscHandlers – hurl_through_hell', () => {
    it('returns hurl_through_hell info with defaults', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = miscHandlers.hurl_through_hell(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'hurl_through_hell',
            damageExpression: '',
            damageType: '',
            saveType: 'CHA',
            saveDc: 'ability',
            saveAbility: 'CHA',
            oncePerTurn: false,
            uses: 1,
            pactMagicRecharge: false,
            casting_time: 'passive'
        })
    })

    it('coerces boolean fields with !!', () => {
        const feature = makeFeature({
            type: 'hurl_through_hell',
            oncePerTurn: 1,
            pactMagicRecharge: 'yes'
        })
        const result = miscHandlers.hurl_through_hell(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.pactMagicRecharge).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'hurl_through_hell',
            damageExpression: '4d10',
            damageType: 'Psychic',
            saveType: 'WIS',
            saveDc: 15,
            oncePerTurn: true,
            uses: 2,
            pactMagicRecharge: true
        })
        const result = miscHandlers.hurl_through_hell(feature, BASE_STATS)
        expect(result.damageExpression).toBe('4d10')
        expect(result.damageType).toBe('Psychic')
        expect(result.saveType).toBe('WIS')
        expect(result.saveDc).toBe(15)
        expect(result.oncePerTurn).toBe(true)
        expect(result.uses).toBe(2)
        expect(result.pactMagicRecharge).toBe(true)
    })
})

// ── clairvoyant_combatant ────────────────────────────────────────────

describe('miscHandlers – clairvoyant_combatant', () => {
    it('returns clairvoyant_combatant info with defaults', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = miscHandlers.clairvoyant_combatant(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'clairvoyant_combatant',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            duration: '1_minute',
            uses: 1,
            pactMagicRecharge: false,
            casting_time: '1 bonus action'
        })
    })

    it('coerces pactMagicRecharge with !!', () => {
        const feature = makeFeature({
            type: 'clairvoyant_combatant',
            pactMagicRecharge: 'true'
        })
        const result = miscHandlers.clairvoyant_combatant(feature, BASE_STATS)
        expect(result.pactMagicRecharge).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'clairvoyant_combatant',
            saveType: 'INT',
            saveDc: 15,
            duration: '10_minutes',
            uses: 3,
            pactMagicRecharge: true
        })
        const result = miscHandlers.clairvoyant_combatant(feature, BASE_STATS)
        expect(result.saveType).toBe('INT')
        expect(result.saveDc).toBe(15)
        expect(result.duration).toBe('10_minutes')
        expect(result.uses).toBe(3)
        expect(result.pactMagicRecharge).toBe(true)
    })
})

// ── memorize_spell ───────────────────────────────────────────────────

describe('miscHandlers – memorize_spell', () => {
    it('returns memorize_spell info with defaults', () => {
        const feature = makeFeature({ type: 'memorize_spell' })
        const result = miscHandlers.memorize_spell(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'memorize_spell',
            casting_time: 'passive'
        })
    })
})

// ── spell_breaker ────────────────────────────────────────────────────

describe('miscHandlers – spell_breaker', () => {
    it('returns passive_rule with spell_breaker effect', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = miscHandlers.spell_breaker(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        checkDefaults(result, {
            effect: 'spell_breaker',
            alwaysPreparedSpells: [],
            bonusActionSpells: [],
            dispelAbilityCheckBonus: '',
            slotRetentionSpells: [],
            casting_time: 'passive'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'spell_breaker',
            alwaysPreparedSpells: ['detect magic'],
            bonusActionSpells: ['dispel magic'],
            dispelAbilityCheckBonus: '+5',
            slotRetentionSpells: ['fireball'],
            casting_time: '1 action'
        })
        const result = miscHandlers.spell_breaker(feature, BASE_STATS)
        expect(result.alwaysPreparedSpells).toEqual(['detect magic'])
        expect(result.bonusActionSpells).toEqual(['dispel magic'])
        expect(result.dispelAbilityCheckBonus).toBe('+5')
        expect(result.slotRetentionSpells).toEqual(['fireball'])
        expect(result.casting_time).toBe('1 action')
    })
})

// ── create_thrall ────────────────────────────────────────────────────

describe('miscHandlers – create_thrall', () => {
    it('returns create_thrall info with defaults', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = miscHandlers.create_thrall(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'create_thrall',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            casting_time: '1 action'
        })
    })

    it('resolves uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            uses_expression: 'proficiency_bonus'
        })
        const result = miscHandlers.create_thrall(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'create_thrall',
            spell: 'find familiar',
            uses: 3,
            recharge: 'short_rest',
            action: 'bonus_action'
        })
        const result = miscHandlers.create_thrall(feature, BASE_STATS)
        expect(result.spell).toBe('find familiar')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.action).toBe('bonus_action')
    })
})

// ── portent ──────────────────────────────────────────────────────────

describe('miscHandlers – portent', () => {
    it('returns 2 dice for level 5', () => {
        const feature = makeFeature({ type: 'portent' })
        const result = miscHandlers.portent(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'portent',
            effect: '',
            maxDice: 2
        })
    })

    it('returns 3 dice for level 14+', () => {
        const stats = { ...BASE_STATS, level: 14 }
        const feature = makeFeature({ type: 'portent' })
        const result = miscHandlers.portent(feature, stats)
        expect(result.maxDice).toBe(3)
    })

    it('returns 2 dice for level below 14', () => {
        const stats = { ...BASE_STATS, level: 13 }
        const feature = makeFeature({ type: 'portent' })
        const result = miscHandlers.portent(feature, stats)
        expect(result.maxDice).toBe(2)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'portent',
            effect: 'replace_roll'
        })
        const result = miscHandlers.portent(feature, BASE_STATS)
        expect(result.effect).toBe('replace_roll')
    })
})

// ── third_eye ────────────────────────────────────────────────────────

describe('miscHandlers – third_eye', () => {
    it('returns bonus_action_choice type with predefined options and default duration', () => {
        const feature = makeFeature({ type: 'third_eye' })
        const result = miscHandlers.third_eye(feature, BASE_STATS)
        expect(result.type).toBe('bonus_action_choice')
        expect(result.name).toBe('Test Feature')
        expect(result.options).toHaveLength(3)
        expect(result.options[0].name).toBe('Darkvision (120 feet)')
        expect(result.options[1].name).toBe('Greater Comprehension')
        expect(result.options[2].name).toBe('See Invisibility')
        expect(result.action).toBe('bonus_action')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.duration).toBe('short_or_long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom duration field', () => {
        const feature = makeFeature({
            type: 'third_eye',
            duration: 'long_rest'
        })
        const result = miscHandlers.third_eye(feature, BASE_STATS)
        expect(result.duration).toBe('long_rest')
    })
})

// ── improved_illusions ───────────────────────────────────────────────

describe('miscHandlers – improved_illusions', () => {
    it('returns improved_illusions info with defaults', () => {
        const feature = makeFeature({ type: 'improved_illusions' })
        const result = miscHandlers.improved_illusions(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'improved_illusions',
            effect: 'improved_illusions',
            casting_time: 'passive'
        })
    })
})

// ── phantasmal_creatures ─────────────────────────────────────────────

describe('miscHandlers – phantasmal_creatures', () => {
    it('returns phantasmal_creatures info with defaults', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = miscHandlers.phantasmal_creatures(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'phantasmal_creatures',
            effect: 'phantasmal_creatures',
            casting_time: 'passive',
            alwaysPreparedSpells: [],
            freeCastSpells: [],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: false
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'phantasmal_creatures',
            alwaysPreparedSpells: ['phantasmal force'],
            freeCastSpells: ['major image'],
            usesMax: 3,
            halvesHp: true
        })
        const result = miscHandlers.phantasmal_creatures(feature, BASE_STATS)
        expect(result.alwaysPreparedSpells).toEqual(['phantasmal force'])
        expect(result.freeCastSpells).toEqual(['major image'])
        expect(result.usesMax).toBe(3)
        expect(result.halvesHp).toBe(true)
    })
})

// ── illusory_reality ─────────────────────────────────────────────────

describe('miscHandlers – illusory_reality', () => {
    it('returns illusory_reality info with defaults', () => {
        const feature = makeFeature({ type: 'illusory_reality' })
        const result = miscHandlers.illusory_reality(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'illusory_reality',
            effect: 'illusory_reality',
            casting_time: '1 bonus_action',
            objectDuration: '1 minute'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'illusory_reality',
            objectDuration: '10 minutes'
        })
        const result = miscHandlers.illusory_reality(feature, BASE_STATS)
        expect(result.objectDuration).toBe('10 minutes')
    })
})

// ── celestial_revelation ─────────────────────────────────────────────

describe('miscHandlers – celestial_revelation', () => {
    it('returns celestial_revelation info with defaults', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = miscHandlers.celestial_revelation(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'celestial_revelation',
            options: [],
            chooseOne: false,
            duration: '1_minute',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            recharge: 'long_rest',
            minLevel: 3
        })
    })

    it('coerces chooseOne with !!', () => {
        const feature = makeFeature({
            type: 'celestial_revelation',
            chooseOne: 'yes'
        })
        const result = miscHandlers.celestial_revelation(feature, BASE_STATS)
        expect(result.chooseOne).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'celestial_revelation',
            options: [{ name: 'Option A' }],
            chooseOne: true,
            duration: '10_minutes',
            minLevel: 5
        })
        const result = miscHandlers.celestial_revelation(feature, BASE_STATS)
        expect(result.options).toEqual([{ name: 'Option A' }])
        expect(result.chooseOne).toBe(true)
        expect(result.duration).toBe('10_minutes')
        expect(result.minLevel).toBe(5)
    })
})

// ── elfish_lineage ───────────────────────────────────────────────────

describe('miscHandlers – elfish_lineage', () => {
    it('returns elfish_lineage info with defaults', () => {
        const feature = makeFeature({ type: 'elfish_lineage' })
        const result = miscHandlers.elfish_lineage(feature, BASE_STATS)
        expect(result.type).toBe('elfish_lineage')
        expect(result.name).toBe('Test Feature')
        expect(result.options).toEqual([])
        expect(result.chooseOne).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })
})

// ── gnomish_lineage ──────────────────────────────────────────────────

describe('miscHandlers – gnomish_lineage', () => {
    it('returns gnomish_lineage info with defaults', () => {
        const feature = makeFeature({ type: 'gnomish_lineage' })
        const result = miscHandlers.gnomish_lineage(feature, BASE_STATS)
        expect(result.type).toBe('gnomish_lineage')
        expect(result.name).toBe('Test Feature')
        expect(result.options).toEqual([])
        expect(result.chooseOne).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })
})

// ── fiendish_legacy ──────────────────────────────────────────────────

describe('miscHandlers – fiendish_legacy', () => {
    it('returns fiendish_legacy info with defaults', () => {
        const feature = makeFeature({ type: 'fiendish_legacy' })
        const result = miscHandlers.fiendish_legacy(feature, BASE_STATS)
        expect(result.type).toBe('fiendish_legacy')
        expect(result.name).toBe('Test Feature')
        expect(result.options).toEqual([])
        expect(result.chooseOne).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })
})

// ── lesser_restoration ───────────────────────────────────────────────

describe('miscHandlers – lesser_restoration', () => {
    it('returns lesser_restoration info with defaults', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = miscHandlers.lesser_restoration(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'lesser_restoration',
            range: 'Touch',
            conditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
            casting_time: 'bonus_action'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'lesser_restoration',
            range: '30 ft',
            conditions: ['charmed'],
            casting_time: '1 action'
        })
        const result = miscHandlers.lesser_restoration(feature, BASE_STATS)
        expect(result.range).toBe('30 ft')
        expect(result.conditions).toEqual(['charmed'])
        expect(result.casting_time).toBe('1 action')
    })
})

// ── remove_curse ─────────────────────────────────────────────────────

describe('miscHandlers – remove_curse', () => {
    it('returns remove_curse info with defaults', () => {
        const feature = makeFeature({ type: 'remove_curse' })
        const result = miscHandlers.remove_curse(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'remove_curse',
            range: 'Touch',
            casting_time: '1 action'
        })
    })
})

// ── protection_from_poison ───────────────────────────────────────────

describe('miscHandlers – protection_from_poison', () => {
    it('returns protection_from_poison info with defaults', () => {
        const feature = makeFeature({ type: 'protection_from_poison' })
        const result = miscHandlers.protection_from_poison(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'protection_from_poison',
            range: 'Touch',
            duration: '1 hour',
            casting_time: '1 action'
        })
    })
})

// ── sentinel ─────────────────────────────────────────────────────────

describe('miscHandlers – sentinel', () => {
    it('returns sentinel info with defaults', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = miscHandlers.sentinel(feature, BASE_STATS)
        checkDefaults(result, {
            type: 'sentinel',
            effect: 'speed_0_on_oa_hit',
            duration: 'end_of_turn',
            casting_time: '1 action'
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'sentinel',
            effect: 'disadvantage_on_attacks',
            duration: '1_round'
        })
        const result = miscHandlers.sentinel(feature, BASE_STATS)
        expect(result.effect).toBe('disadvantage_on_attacks')
        expect(result.duration).toBe('1_round')
    })
})

// ── telekinetic_shove ────────────────────────────────────────────────

describe('miscHandlers – telekinetic_shove', () => {
    it('computes saveDc from ability modifier + proficiency when saveDc is ability', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 'ability',
            saveAbility: 'INT'
        })
        const result = miscHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.type).toBe('telekinetic_shove')
        expect(result.saveType).toBe('STR')
        expect(result.saveAbility).toBe('INT')
        // getAbilityModifier(abilities, 'INT') + proficiency = 1 + 3 = 4, so 8 + 4 = 12
        expect(result.saveDc).toBe(12)
        expect(result.range).toBe('30')
        expect(result.pushDistance).toBe(5)
        expect(result.action).toBe('bonus_action')
        expect(result.hasAutomation).toBe(true)
    })

    it('uses explicit numeric saveDc when not ability', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveDc: 15
        })
        const result = miscHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('derives action from casting_time bonus action', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: '1 bonus action'
        })
        const result = miscHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('derives action from casting_time action', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: '1 action'
        })
        const result = miscHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.action).toBe('action')
    })

    it('derives action from casting_time with underscore variant', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            casting_time: 'bonus_action'
        })
        const result = miscHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'telekinetic_shove',
            saveType: 'CON',
            range: '60',
            pushDistance: 10,
            casting_time: '1 action'
        })
        const result = miscHandlers.telekinetic_shove(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.range).toBe('60')
        expect(result.pushDistance).toBe(10)
        expect(result.casting_time).toBe('1 action')
    })
})
