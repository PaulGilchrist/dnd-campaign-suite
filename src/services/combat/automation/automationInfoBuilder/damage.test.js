import { describe, it, expect } from 'vitest'
import { damageHandlers } from './damage.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('damageHandlers – damage_bonus', () => {
    it('returns damage_bonus info with defaults', () => {
        const feature = makeFeature({ type: 'damage_bonus' })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.name).toBe('Test Feature')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
        expect(result.usesMax).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves scaling for damageExpression', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = damageHandlers.damage_bonus(feature, { ...BASE_STATS, level: 5 })
        expect(result.damageExpression).toBe('2d6')
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            uses_expression: 'proficiency_bonus'
        })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('uses uses when no uses_expression', () => {
        const feature = makeFeature({ type: 'damage_bonus', uses: 5 })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.usesMax).toBe(5)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            trigger: 'hit',
            damageType: 'Fire',
            maxDamage: '20',
            extraVs: 'undead',
            extraDamage: '1d6',
            resourceType: 'spell_slot',
            oncePerTurn: true,
            tempHpExpression: '2d8',
            recharge: 'short_rest'
        })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.trigger).toBe('hit')
        expect(result.damageType).toBe('Fire')
        expect(result.maxDamage).toBe('20')
        expect(result.extraVs).toBe('undead')
        expect(result.extraDamage).toBe('1d6')
        expect(result.resourceType).toBe('spell_slot')
        expect(result.oncePerTurn).toBe(true)
        expect(result.tempHpExpression).toBe('2d8')
        expect(result.recharge).toBe('short_rest')
    })
})

describe('damageHandlers – damage_modifier', () => {
    it('returns damage_modifier info with defaults', () => {
        const feature = makeFeature({ type: 'damage_modifier' })
        const result = damageHandlers.damage_modifier(feature, BASE_STATS)
        expect(result.type).toBe('damage_modifier')
        expect(result.trigger).toBe('')
        expect(result.modifierExpression).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_modifier',
            trigger: 'after_spell_cast',
            modifierExpression: '+2d6'
        })
        const result = damageHandlers.damage_modifier(feature, BASE_STATS)
        expect(result.trigger).toBe('after_spell_cast')
        expect(result.modifierExpression).toBe('+2d6')
    })
})

describe('damageHandlers – damage_type_modifier', () => {
    it('returns damage_type_modifier info with defaults', () => {
        const feature = makeFeature({ type: 'damage_type_modifier' })
        const result = damageHandlers.damage_type_modifier(feature, BASE_STATS)
        expect(result.type).toBe('damage_type_modifier')
        expect(result.trigger).toBe('')
        expect(result.weaponTypes).toEqual([])
        expect(result.options).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_type_modifier',
            trigger: 'on_hit',
            weaponTypes: ['melee', 'ranged'],
            options: ['fire', 'cold']
        })
        const result = damageHandlers.damage_type_modifier(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.weaponTypes).toEqual(['melee', 'ranged'])
        expect(result.options).toEqual(['fire', 'cold'])
    })
})

describe('damageHandlers – damage_type_choice', () => {
    it('returns damage_type_choice info with defaults', () => {
        const feature = makeFeature({ type: 'damage_type_choice' })
        const result = damageHandlers.damage_type_choice(feature, BASE_STATS)
        expect(result.type).toBe('damage_type_choice')
        expect(result.damageTypes).toEqual([])
        expect(result.effect).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.minDamage).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            damageTypes: ['fire', 'cold', 'lightning'],
            effect: 'elemental_adept',
            casting_time: '1 bonus action',
            minDamage: true
        })
        const result = damageHandlers.damage_type_choice(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['fire', 'cold', 'lightning'])
        expect(result.effect).toBe('elemental_adept')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.minDamage).toBe(true)
    })
})

describe('damageHandlers – weapon_mastery_choice', () => {
    it('returns weapon_mastery_choice info with defaults', () => {
        const feature = makeFeature({ type: 'weapon_mastery_choice' })
        const result = damageHandlers.weapon_mastery_choice(feature, BASE_STATS)
        expect(result.type).toBe('weapon_mastery_choice')
        expect(result.masteryProperties).toEqual([])
        expect(result.effect).toBe('extra_mastery')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'weapon_mastery_choice',
            masteryProperties: ['push', 'topple'],
            effect: 'extra_damage',
            casting_time: '1 action'
        })
        const result = damageHandlers.weapon_mastery_choice(feature, BASE_STATS)
        expect(result.masteryProperties).toEqual(['push', 'topple'])
        expect(result.effect).toBe('extra_damage')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('damageHandlers – damage_reduction', () => {
    it('returns damage_reduction info with defaults', () => {
        const feature = makeFeature({ type: 'damage_reduction' })
        const result = damageHandlers.damage_reduction(feature, BASE_STATS)
        expect(result.type).toBe('damage_reduction')
        expect(result.reductionExpression).toBe('')
        expect(result.trigger).toBe('')
        expect(result.reaction).toBe(false)
        expect(result.redirect).toBe(false)
        expect(result.damageTypes).toEqual([])
        expect(result.condition).toBe('')
        expect(result.requiresShield).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_reduction',
            reductionExpression: '2d8',
            trigger: 'damage_taken',
            reaction: true,
            redirect: true,
            redirectCost: 1,
            redirectDamage: '1d6',
            redirectSave: 'DEX',
            cost: 2,
            damageTypes: ['fire', 'cold'],
            condition: 'wearing_heavy_armor'
        })
        const result = damageHandlers.damage_reduction(feature, BASE_STATS)
        expect(result.reductionExpression).toBe('2d8')
        expect(result.trigger).toBe('damage_taken')
        expect(result.reaction).toBe(true)
        expect(result.redirect).toBe(true)
        expect(result.redirectCost).toBe(1)
        expect(result.redirectDamage).toBe('1d6')
        expect(result.redirectSave).toBe('DEX')
        expect(result.cost).toBe(2)
        expect(result.damageTypes).toEqual(['fire', 'cold'])
        expect(result.condition).toBe('wearing_heavy_armor')
    })
})

describe('damageHandlers – damage_aura', () => {
    it('returns damage_aura info with defaults', () => {
        const feature = makeFeature({ type: 'damage_aura' })
        const result = damageHandlers.damage_aura(feature, BASE_STATS)
        expect(result.type).toBe('damage_aura')
        expect(result.damageType).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.range).toBe('10_ft')
        expect(result.duration).toBe('1_minute')
        expect(result.recharge).toBe('long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_aura',
            damageType: 'Radiant',
            damageExpression: '2d6',
            range: '15_ft',
            duration: '10_minutes',
            recharge: 'short_rest'
        })
        const result = damageHandlers.damage_aura(feature, BASE_STATS)
        expect(result.damageType).toBe('Radiant')
        expect(result.damageExpression).toBe('2d6')
        expect(result.range).toBe('15_ft')
        expect(result.duration).toBe('10_minutes')
        expect(result.recharge).toBe('short_rest')
    })
})

describe('damageHandlers – psionic_strike', () => {
    it('returns psionic_strike info with defaults', () => {
        const feature = makeFeature({ type: 'psionic_strike' })
        const result = damageHandlers.psionic_strike(feature, BASE_STATS)
        expect(result.type).toBe('psionic_strike')
        expect(result.resource).toBe('psionicEnergy')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('Force')
        expect(result.oncePerTurn).toBe(false)
        expect(result.trigger).toBe('after_attack_hit')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'psionic_strike',
            resource: 'psionicPoints',
            damageExpression: '2d8',
            damageType: 'Psychic',
            oncePerTurn: true
        })
        const result = damageHandlers.psionic_strike(feature, BASE_STATS)
        expect(result.resource).toBe('psionicPoints')
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('Psychic')
        expect(result.oncePerTurn).toBe(true)
    })
})

describe('damageHandlers – primal_companion_double_strike_damage', () => {
    it('returns damage_bonus type for primal_companion_double_strike_damage', () => {
        const feature = makeFeature({
            type: 'primal_companion_double_strike_damage',
            damageExpression: '1d6',
            damageType: 'Thunder'
        })
        const result = damageHandlers.primal_companion_double_strike_damage(feature, BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.trigger).toBe('companion_beasts_strike_hit')
        expect(result.damageExpression).toBe('1d6')
        expect(result.damageType).toBe('Thunder')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – great_weapon_fighting', () => {
    it('returns passive_rule with great_weapon_fighting effect', () => {
        const feature = makeFeature({ type: 'great_weapon_fighting' })
        const result = damageHandlers.great_weapon_fighting(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('great_weapon_fighting')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – grapple_damage', () => {
    it('returns passive_rule with grapple_damage effect', () => {
        const feature = makeFeature({ type: 'grapple_damage' })
        const result = damageHandlers.grapple_damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('grapple_damage')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – two_weapon_fighting', () => {
    it('returns passive_rule with two_weapon_fighting effect', () => {
        const feature = makeFeature({ type: 'two_weapon_fighting' })
        const result = damageHandlers.two_weapon_fighting(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('two_weapon_fighting')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – reroll_damage_once_per_turn', () => {
    it('returns passive_rule with reroll_damage_once_per_turn effect', () => {
        const feature = makeFeature({ type: 'reroll_damage_once_per_turn' })
        const result = damageHandlers.reroll_damage_once_per_turn(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('reroll_damage_once_per_turn')
        expect(result.name).toBe('Test Feature')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – damage', () => {
    it('returns null for generic damage', () => {
        const feature = makeFeature({ type: 'damage' })
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns great_weapon_fighting passive for specific feat feature', () => {
        const feature = {
            type: 'damage',
            source: 'feat',
            name: 'Great Weapon Fighting',
            automation: { type: 'great_weapon_fighting' }
        }
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('great_weapon_fighting')
    })

    it('returns two_weapon_fighting passive for specific feat feature', () => {
        const feature = {
            type: 'two_weapon_fighting',
            source: 'feat',
            name: 'Two-Weapon Fighting',
            automation: { type: 'two_weapon_fighting' }
        }
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('two_weapon_fighting')
    })
})
