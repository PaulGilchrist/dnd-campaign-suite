// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { miscHandlers } from './misc.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

// ── cantrip_spellcasting_ability ─────────────────────────────────────

describe('miscHandlers – cantrip_spellcasting_ability', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'cantrip_spellcasting_ability' })
        const result = miscHandlers.cantrip_spellcasting_ability(feature, BASE_STATS)
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

describe('miscHandlers – auto_effect', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'auto_effect' })
        const result = miscHandlers.auto_effect(feature, BASE_STATS)
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

describe('miscHandlers – survive_and_heal', () => {
    it('returns half max hp when expression is half_max_hp', () => {
        const stats = { ...BASE_STATS, hitPoints: { max: 20 } }
        const feature = makeFeature({ type: 'survive_and_heal', healExpression: 'half_max_hp' })
        const result = miscHandlers.survive_and_heal(feature, stats)
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
        expect(result.healAmount).toBe(2)
    })
})

// ── auto_reroll ──────────────────────────────────────────────────────

describe('miscHandlers – auto_reroll', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'auto_reroll' })
        const result = miscHandlers.auto_reroll(feature, BASE_STATS)
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

describe('miscHandlers – restore_balance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'restore_balance' })
        const result = miscHandlers.restore_balance(feature, BASE_STATS)
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

describe('miscHandlers – countercharm', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'countercharm' })
        const result = miscHandlers.countercharm(feature, BASE_STATS)
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

describe('miscHandlers – misty_wanderer', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'misty_wanderer' })
        const result = miscHandlers.misty_wanderer(feature, BASE_STATS)
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

describe('miscHandlers – misty_escape', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'misty_escape' })
        const result = miscHandlers.misty_escape(feature, BASE_STATS)
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

describe('miscHandlers – steps_of_the_fey', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'steps_of_the_fey' })
        const result = miscHandlers.steps_of_the_fey(feature, BASE_STATS)
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
        const result = miscHandlers.steps_of_the_fey(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })
})

// ── post_cast_rider ──────────────────────────────────────────────────

describe('miscHandlers – post_cast_rider', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'post_cast_rider' })
        const result = miscHandlers.post_cast_rider(feature, BASE_STATS)
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

describe('miscHandlers – post_cast_smite_cover', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'post_cast_smite_cover' })
        const result = miscHandlers.post_cast_smite_cover(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'post_cast_smite_cover',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── post_cast_inspiring_smite ────────────────────────────────────────

describe('miscHandlers – post_cast_inspiring_smite', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'post_cast_inspiring_smite' })
        const result = miscHandlers.post_cast_inspiring_smite(feature, BASE_STATS)
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

describe('miscHandlers – resistance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'resistance' })
        const result = miscHandlers.resistance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'resistance',
            damageTypes: [],
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── land_resistance ──────────────────────────────────────────────────

describe('miscHandlers – land_resistance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'land_resistance' })
        const result = miscHandlers.land_resistance(feature, BASE_STATS)
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

describe('miscHandlers – set_condition', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'set_condition' })
        const result = miscHandlers.set_condition(feature, BASE_STATS)
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

describe('miscHandlers – relentless_avenger', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'relentless_avenger' })
        const result = miscHandlers.relentless_avenger(feature, BASE_STATS)
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

describe('miscHandlers – soul_of_vengeance', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'soul_of_vengeance' })
        const result = miscHandlers.soul_of_vengeance(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'soul_of_vengeance',
            trigger: 'after_vow_of_enmity_target_attacks',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── hunter_prey ──────────────────────────────────────────────────────

describe('miscHandlers – hunter_prey', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'hunter_prey' })
        const result = miscHandlers.hunter_prey(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'hunter_prey',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── superior_hunter_defense ──────────────────────────────────────────

describe('miscHandlers – superior_hunter_defense', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'superior_hunter_defense' })
        const result = miscHandlers.superior_hunter_defense(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'superior_hunter_defense',
            casting_time: '1 reaction',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── bonus_action_choice ──────────────────────────────────────────────

describe('miscHandlers – bonus_action_choice', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'bonus_action_choice' })
        const result = miscHandlers.bonus_action_choice(feature, BASE_STATS)
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

describe('miscHandlers – steady_aim', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'steady_aim' })
        const result = miscHandlers.steady_aim(feature, BASE_STATS)
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

describe('miscHandlers – mage_hand_control', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'mage_hand_control' })
        const result = miscHandlers.mage_hand_control(feature, BASE_STATS)
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

describe('miscHandlers – stroke_of_luck', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'stroke_of_luck' })
        const result = miscHandlers.stroke_of_luck(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'stroke_of_luck',
            target: 'd20',
            recharge: 'short_or_long_rest',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── modify_d20_roll ──────────────────────────────────────────────────

describe('miscHandlers – modify_d20_roll', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'modify_d20_roll' })
        const result = miscHandlers.modify_d20_roll(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'modify_d20_roll',
            modifier: '2d4',
            range: '60 ft',
            canBeBonusOrPenalty: false,
            recharge: 'initiative_or_short_or_long_rest',
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── fast_hands ───────────────────────────────────────────────────────

describe('miscHandlers – fast_hands', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'fast_hands' })
        const result = miscHandlers.fast_hands(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'fast_hands',
            options: [],
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── use_magic_device ─────────────────────────────────────────────────

describe('miscHandlers – use_magic_device', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'use_magic_device' })
        const result = miscHandlers.use_magic_device(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: false,
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── wild_magic_surge ─────────────────────────────────────────────────

describe('miscHandlers – wild_magic_surge', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'wild_magic_surge' })
        const result = miscHandlers.wild_magic_surge(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'wild_magic_surge',
            trigger: '',
            oncePerTurn: false,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── wild_magic_tamed ─────────────────────────────────────────────────

describe('miscHandlers – wild_magic_tamed', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'wild_magic_tamed' })
        const result = miscHandlers.wild_magic_tamed(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'wild_magic_tamed',
            trigger: '',
            recharge: 'long_rest',
            uses: 1,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── feats_of_chaos ───────────────────────────────────────────────────

describe('miscHandlers – feats_of_chaos', () => {
    it('returns conditional_advantage type with defaults', () => {
        const feature = makeFeature({ type: 'feats_of_chaos' })
        const result = miscHandlers.feats_of_chaos(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'conditional_advantage',
            target: 'd20',
            condition: 'feats_of_chaos_active',
            effect: 'advantage',
            abilities: [],
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── multi_target_spread ──────────────────────────────────────────────

describe('miscHandlers – multi_target_spread', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'multi_target_spread' })
        const result = miscHandlers.multi_target_spread(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'multi_target_spread',
            spellFilter: [],
            range: '10 ft',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── radiant_soul ─────────────────────────────────────────────────────

describe('miscHandlers – radiant_soul', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'radiant_soul' })
        const result = miscHandlers.radiant_soul(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'radiant_soul',
            damageTypes: [],
            damageExpression: '',
            oncePerTurn: false,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── celestial_resilience ─────────────────────────────────────────────

describe('miscHandlers – celestial_resilience', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'celestial_resilience' })
        const result = miscHandlers.celestial_resilience(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'celestial_resilience',
            tempHpExpression: '',
            allyTempHpExpression: '',
            maxAllies: 5,
            range: '60_ft',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── dark_ones_look ───────────────────────────────────────────────────

describe('miscHandlers – dark_ones_look', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'dark_ones_look' })
        const result = miscHandlers.dark_ones_look(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'dark_ones_look',
            diceExpression: '1d10',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── hurl_through_hell ────────────────────────────────────────────────

describe('miscHandlers – hurl_through_hell', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'hurl_through_hell' })
        const result = miscHandlers.hurl_through_hell(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'hurl_through_hell',
            damageExpression: '',
            damageType: '',
            saveType: 'CHA',
            saveDc: 'ability',
            saveAbility: 'CHA',
            oncePerTurn: false,
            uses: 1,
            pactMagicRecharge: false,
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── clairvoyant_combatant ────────────────────────────────────────────

describe('miscHandlers – clairvoyant_combatant', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'clairvoyant_combatant' })
        const result = miscHandlers.clairvoyant_combatant(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'clairvoyant_combatant',
            saveType: 'WIS',
            saveDc: 'ability',
            saveAbility: 'CHA',
            duration: '1_minute',
            uses: 1,
            pactMagicRecharge: false,
            casting_time: '1 bonus action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── spell_breaker ────────────────────────────────────────────────────

describe('miscHandlers – spell_breaker', () => {
    it('returns passive_rule with spell_breaker effect', () => {
        const feature = makeFeature({ type: 'spell_breaker' })
        const result = miscHandlers.spell_breaker(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: 'spell_breaker',
            alwaysPreparedSpells: [],
            bonusActionSpells: [],
            dispelAbilityCheckBonus: '',
            slotRetentionSpells: [],
            casting_time: 'passive',
            hasAutomation: true
        })
    })
})

// ── create_thrall ────────────────────────────────────────────────────

describe('miscHandlers – create_thrall', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'create_thrall' })
        const result = miscHandlers.create_thrall(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'create_thrall',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
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
})

// ── portent ──────────────────────────────────────────────────────────

describe('miscHandlers – portent', () => {
    it('returns 2 dice for level 5', () => {
        const feature = makeFeature({ type: 'portent' })
        const result = miscHandlers.portent(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'portent',
            effect: '',
            maxDice: 2,
            hasAutomation: true,
            name: 'Test Feature'
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

    it('respects custom duration field', () => {
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
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'improved_illusions' })
        const result = miscHandlers.improved_illusions(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'improved_illusions',
            effect: 'improved_illusions',
            casting_time: 'passive',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── phantasmal_creatures ─────────────────────────────────────────────

describe('miscHandlers – phantasmal_creatures', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'phantasmal_creatures' })
        const result = miscHandlers.phantasmal_creatures(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'phantasmal_creatures',
            effect: 'phantasmal_creatures',
            casting_time: 'passive',
            alwaysPreparedSpells: [],
            freeCastSpells: [],
            usesMax: 1,
            recharge: 'long_rest',
            halvesHp: false,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── celestial_revelation ─────────────────────────────────────────────

describe('miscHandlers – celestial_revelation', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'celestial_revelation' })
        const result = miscHandlers.celestial_revelation(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'celestial_revelation',
            options: [],
            chooseOne: false,
            duration: '1_minute',
            action: 'bonus_action',
            casting_time: '1 bonus action',
            recharge: 'long_rest',
            minLevel: 3,
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── lineage handlers (elfish, gnomish, fiendish) ─────────────────────

describe('miscHandlers – lineage handlers', () => {
    const lineageHandlers = [
        ['elfish_lineage', 'elfish_lineage'],
        ['gnomish_lineage', 'gnomish_lineage'],
        ['fiendish_legacy', 'fiendish_legacy']
    ]

    for (const [handlerName, type] of lineageHandlers) {
        it(`returns ${type} info with defaults`, () => {
            const feature = makeFeature({ type: handlerName })
            const result = miscHandlers[handlerName](feature, BASE_STATS)
            expect(result.type).toBe(type)
            expect(result.name).toBe('Test Feature')
            expect(result.options).toEqual([])
            expect(result.chooseOne).toBe(false)
            expect(result.hasAutomation).toBe(true)
        })
    }
})

// ── lesser_restoration ───────────────────────────────────────────────

describe('miscHandlers – lesser_restoration', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'lesser_restoration' })
        const result = miscHandlers.lesser_restoration(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'lesser_restoration',
            range: 'Touch',
            conditions: ['blinded', 'deafened', 'paralyzed', 'poisoned'],
            casting_time: 'bonus_action',
            hasAutomation: true,
            name: 'Test Feature'
        })
    })
})

// ── sentinel ─────────────────────────────────────────────────────────

describe('miscHandlers – sentinel', () => {
    it('returns defaults', () => {
        const feature = makeFeature({ type: 'sentinel' })
        const result = miscHandlers.sentinel(feature, BASE_STATS)
        expect(result).toMatchObject({
            type: 'sentinel',
            effect: 'speed_0_on_oa_hit',
            duration: 'end_of_turn',
            casting_time: '1 action',
            hasAutomation: true,
            name: 'Test Feature'
        })
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
})
