import { describe, it, expect } from 'vitest'
import { coreHandlers } from './core-handlers.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.test-utils.js'

// ── cantrip_spellcasting_ability ─────────────────────────────────────

describe('coreHandlers – cantrip_spellcasting_ability', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'cantrip_spellcasting_ability' })
        const result = coreHandlers.cantrip_spellcasting_ability(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'cantrip_spellcasting_ability',
            cantripName: '',
            spellcastingAbility: '',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── auto_effect ──────────────────────────────────────────────────────

describe('coreHandlers – auto_effect', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'auto_effect' })
        const result = coreHandlers.auto_effect(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'auto_effect',
            trigger: '',
            effect: '',
            value: null,
            uses: null,
            recharge: 'long_rest',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── survive_and_heal ─────────────────────────────────────────────────

describe('coreHandlers – survive_and_heal', () => {
    it('returns half max hp when expression is half_max_hp', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 20 } }
        const feature = makeFeature({ type: 'survive_and_heal', healExpression: 'half_max_hp' })
        const result = coreHandlers.survive_and_heal(feature, stats)
        expect(result).toMatchObject({
            type: 'survive_and_heal',
            trigger: 'reduced_to_0_hp',
            effect: 'survive_and_heal',
            minHp: 1,
            healAmount: 10,
            recharge: 'long_rest',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })

    it('parses numeric healExpression string', () => {
        const feature = makeFeature({ type: 'survive_and_heal', healExpression: '15' })
        const result = coreHandlers.survive_and_heal(feature, BASE_STATS)
        expect(result.healAmount).toBe(15)
    })

    it('defaults to half max hp when no expression', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 30 } }
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = coreHandlers.survive_and_heal(feature, stats)
        expect(result.healAmount).toBe(15)
    })

    it('falls back to level when hitPoints.max is missing', () => {
        const stats = { ...BASE_STATS }
        const feature = makeFeature({ type: 'survive_and_heal' })
        const result = coreHandlers.survive_and_heal(feature, stats)
        expect(result.healAmount).toBe(2)
    })
})

// ── auto_reroll ──────────────────────────────────────────────────────

describe('coreHandlers – auto_reroll', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = coreHandlers.auto_reroll(feature, BASE_STATS)
        expect(result).toMatchObject({
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
            oncePer: '',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── restore_balance ──────────────────────────────────────────────────

describe('coreHandlers – restore_balance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'restore_balance' })
        const result = coreHandlers.restore_balance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'restore_balance',
            target: 'd20',
            range: '60_ft',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── countercharm ─────────────────────────────────────────────────────

describe('coreHandlers – countercharm', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = coreHandlers.countercharm(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'countercharm',
            trigger: '',
            range: '',
            conditions: [],
            effect: '',
            uses: 1,
            recharge: 'long_rest',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── misty_wanderer ───────────────────────────────────────────────────

describe('coreHandlers – misty_wanderer', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'misty_wanderer' })
        const result = coreHandlers.misty_wanderer(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'misty_wanderer',
            trigger: '',
            range: '5_ft',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── misty_escape ─────────────────────────────────────────────────────

describe('coreHandlers – misty_escape', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = coreHandlers.misty_escape(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'misty_escape',
            spell: 'Misty Step',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            damageExpression: '',
            damageType: '',
            condition: 'invisible',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── steps_of_the_fey ─────────────────────────────────────────────────

describe('coreHandlers – steps_of_the_fey', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = coreHandlers.steps_of_the_fey(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'steps_of_the_fey',
            spell: 'Misty Step',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            saveAbility: 'CHA',
            saveDc: 'ability',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })

    it('resolves uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'steps_of_the_fey',
            uses_expression: 'proficiency_bonus'
        })
        const result = coreHandlers.steps_of_the_fey(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })
})

// ── post_cast_rider ──────────────────────────────────────────────────

describe('coreHandlers – post_cast_rider', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = coreHandlers.post_cast_rider(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'post_cast_rider',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            condition: '',
            duration: '1_minute',
            range: '60 ft',
            spellSchools: [],
            recharge: 'long_rest',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── post_cast_smite_cover ────────────────────────────────────────────

describe('coreHandlers – post_cast_smite_cover', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'post_cast_smite_cover' })
        const result = coreHandlers.post_cast_smite_cover(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'post_cast_smite_cover',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── post_cast_inspiring_smite ────────────────────────────────────────

describe('coreHandlers – post_cast_inspiring_smite', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'post_cast_inspiring_smite' })
        const result = coreHandlers.post_cast_inspiring_smite(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'post_cast_inspiring_smite',
            range: '30 ft',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── resistance ───────────────────────────────────────────────────────

describe('coreHandlers – resistance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'resistance' })
        const result = coreHandlers.resistance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'resistance',
            damageTypes: [],
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── land_resistance ──────────────────────────────────────────────────

describe('coreHandlers – land_resistance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'land_resistance' })
        const result = coreHandlers.land_resistance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'land_resistance',
            conditionImmunity: '',
            landMappings: {},
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── set_condition ────────────────────────────────────────────────────

describe('coreHandlers – set_condition', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = coreHandlers.set_condition(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'set_condition',
            target: undefined,
            condition: undefined,
            additionalCondition: null,
            cost: '',
            range: '60 ft',
            saveType: 'STR',
            effect: '',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── relentless_avenger ───────────────────────────────────────────────

describe('coreHandlers – relentless_avenger', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'relentless_avenger' })
        const result = coreHandlers.relentless_avenger(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'relentless_avenger',
            trigger: 'after_opportunity_attack_hit',
            duration: 'until_end_of_current_turn',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── soul_of_vengeance ────────────────────────────────────────────────

describe('coreHandlers – soul_of_vengeance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'soul_of_vengeance' })
        const result = coreHandlers.soul_of_vengeance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'soul_of_vengeance',
            trigger: 'after_vow_of_enmity_target_attacks',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── hunter_prey ──────────────────────────────────────────────────────

describe('coreHandlers – hunter_prey', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'hunter_prey' })
        const result = coreHandlers.hunter_prey(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'hunter_prey',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── superior_hunter_defense ──────────────────────────────────────────

describe('coreHandlers – superior_hunter_defense', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'superior_hunter_defense' })
        const result = coreHandlers.superior_hunter_defense(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'superior_hunter_defense',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── bonus_action_choice ──────────────────────────────────────────────

describe('coreHandlers – bonus_action_choice', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = coreHandlers.bonus_action_choice(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'bonus_action_choice',
            options: [],
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── steady_aim ───────────────────────────────────────────────────────

describe('coreHandlers – steady_aim', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'steady_aim' })
        const result = coreHandlers.steady_aim(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'steady_aim',
            duration: 'until_end_of_turn',
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── mage_hand_control ────────────────────────────────────────────────

describe('coreHandlers – mage_hand_control', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = coreHandlers.mage_hand_control(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'mage_hand_control',
            range: '30_ft',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── stroke_of_luck ───────────────────────────────────────────────────

describe('coreHandlers – stroke_of_luck', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'stroke_of_luck' })
        const result = coreHandlers.stroke_of_luck(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'stroke_of_luck',
            target: 'd20',
            recharge: 'short_or_long_rest',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})
