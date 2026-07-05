// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest'
import { damageHandlers } from './damage.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

vi.mock('../automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr, stats) => {
        if (!expr) return 0
        if (expr === 'proficiency_bonus') return stats.proficiency || 0
        return 1
    })
}))

describe('damageHandlers – damage_bonus', () => {
    it('returns damage_bonus info with defaults', () => {
        const feature = makeFeature({ type: 'damage_bonus' })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('')
        expect(result.maxDamage).toBe('')
        expect(result.extraVs).toBeNull()
        expect(result.extraDamage).toBe('')
        expect(result.extraDamageExpression).toBe('')
        expect(result.extraDamageType).toBe('')
        expect(result.resourceType).toBe('spell_slot')
        expect(result.oncePerTurn).toBe(false)
        expect(result.options).toEqual([])
        expect(result.tempHpExpression).toBe('')
        expect(result.upgrades).toBe('')
        expect(result.rangeBonusCantrip).toBe('')
        expect(result.uses_expression).toBe('')
        expect(result.usesMax).toBe(0)
        expect(result.recharge).toBe('')
        expect(result.abilityIncreased).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves scaling for damageExpression at level 5', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = damageHandlers.damage_bonus(feature, { ...BASE_STATS, level: 5 })
        expect(result.damageExpression).toBe('2d6')
    })

    it('resolves scaling for damageExpression at level 11', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = damageHandlers.damage_bonus(feature, { ...BASE_STATS, level: 11 })
        expect(result.damageExpression).toBe('3d6')
    })

    it('keeps base expression when level is below first scaling tier', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { 5: '2d6', 11: '3d6' }
        })
        const result = damageHandlers.damage_bonus(feature, { ...BASE_STATS, level: 1 })
        expect(result.damageExpression).toBe('1d6')
    })

    it('resolves uses_expression to proficiency_bonus value', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            uses_expression: 'proficiency_bonus'
        })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('uses uses when no uses_expression', () => {
        const feature = makeFeature({ type: 'damage_bonus', uses: 5 })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.usesMax).toBe(5)
    })

    it('defaults usesMax to 1 when uses_expression returns falsy', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            uses_expression: 'unknown_expr'
        })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.usesMax).toBe(1)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            trigger: 'hit',
            damageType: 'Fire',
            maxDamage: '20',
            extraVs: 'undead',
            extraDamage: '1d6',
            extraDamageExpression: '2d6',
            extraDamageType: 'Thunder',
            resourceType: 'spell_slot',
            oncePerTurn: true,
            options: ['option1'],
            tempHpExpression: '2d8',
            upgrades: 'upgrade_v2',
            rangeBonusCantrip: '+10ft',
            recharge: 'short_rest',
            abilityIncreased: 'STR'
        })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.trigger).toBe('hit')
        expect(result.damageType).toBe('Fire')
        expect(result.maxDamage).toBe('20')
        expect(result.extraVs).toBe('undead')
        expect(result.extraDamage).toBe('1d6')
        expect(result.extraDamageExpression).toBe('2d6')
        expect(result.extraDamageType).toBe('Thunder')
        expect(result.resourceType).toBe('spell_slot')
        expect(result.oncePerTurn).toBe(true)
        expect(result.options).toEqual(['option1'])
        expect(result.tempHpExpression).toBe('2d8')
        expect(result.upgrades).toBe('upgrade_v2')
        expect(result.rangeBonusCantrip).toBe('+10ft')
        expect(result.recharge).toBe('short_rest')
        expect(result.abilityIncreased).toBe('STR')
    })

    it('coerces oncePerTurn to boolean', () => {
        const feature = makeFeature({ type: 'damage_bonus', oncePerTurn: 'yes' })
        const result = damageHandlers.damage_bonus(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
    })
})

describe('damageHandlers – damage_modifier', () => {
    it('returns damage_modifier info with defaults and passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_modifier',
            trigger: 'after_spell_cast',
            modifierExpression: '+2d6'
        })
        const result = damageHandlers.damage_modifier(feature, BASE_STATS)
        expect(result.type).toBe('damage_modifier')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('after_spell_cast')
        expect(result.modifierExpression).toBe('+2d6')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – damage_type_modifier', () => {
    it('returns damage_type_modifier info with defaults and passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_type_modifier',
            trigger: 'on_hit',
            weaponTypes: ['melee', 'ranged'],
            options: ['fire', 'cold']
        })
        const result = damageHandlers.damage_type_modifier(feature, BASE_STATS)
        expect(result.type).toBe('damage_type_modifier')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('on_hit')
        expect(result.weaponTypes).toEqual(['melee', 'ranged'])
        expect(result.options).toEqual(['fire', 'cold'])
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – damage_type_choice', () => {
    it('returns damage_type_choice info with defaults', () => {
        const feature = makeFeature({ type: 'damage_type_choice' })
        const result = damageHandlers.damage_type_choice(feature, BASE_STATS)
        expect(result.type).toBe('damage_type_choice')
        expect(result.name).toBe('Test Feature')
        expect(result.damageTypes).toEqual([])
        expect(result.effect).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.minDamage).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields and coerces minDamage to boolean', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            damageTypes: ['fire', 'cold', 'lightning'],
            effect: 'elemental_adept',
            casting_time: '1 bonus action',
            minDamage: 'yes'
        })
        const result = damageHandlers.damage_type_choice(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['fire', 'cold', 'lightning'])
        expect(result.effect).toBe('elemental_adept')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.minDamage).toBe(true)
    })
})

describe('damageHandlers – weapon_mastery_choice', () => {
    it('returns weapon_mastery_choice info with defaults and passes through custom fields', () => {
        const feature = makeFeature({
            type: 'weapon_mastery_choice',
            masteryProperties: ['push', 'topple'],
            effect: 'extra_damage',
            casting_time: '1 action'
        })
        const result = damageHandlers.weapon_mastery_choice(feature, BASE_STATS)
        expect(result.type).toBe('weapon_mastery_choice')
        expect(result.name).toBe('Test Feature')
        expect(result.masteryProperties).toEqual(['push', 'topple'])
        expect(result.effect).toBe('extra_damage')
        expect(result.casting_time).toBe('1 action')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – damage_reduction', () => {
    it('returns damage_reduction info with defaults', () => {
        const feature = makeFeature({ type: 'damage_reduction' })
        const result = damageHandlers.damage_reduction(feature, BASE_STATS)
        expect(result.type).toBe('damage_reduction')
        expect(result.name).toBe('Test Feature')
        expect(result.reductionExpression).toBe('')
        expect(result.trigger).toBe('')
        expect(result.reaction).toBe(false)
        expect(result.redirect).toBe(false)
        expect(result.redirectCost).toBeNull()
        expect(result.redirectDamage).toBe('')
        expect(result.redirectSave).toBe('DEX')
        expect(result.cost).toBeNull()
        expect(result.damageTypes).toEqual([])
        expect(result.condition).toBe('')
        expect(result.effect).toBe('')
        expect(result.requiresShield).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields and coerces requiresShield to boolean', () => {
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
            condition: 'wearing_heavy_armor',
            effect: 'shield_wall',
            requiresShield: 'yes'
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
        expect(result.effect).toBe('shield_wall')
        expect(result.requiresShield).toBe(true)
    })
})

describe('damageHandlers – damage_aura', () => {
    it('returns damage_aura info with defaults and passes through custom fields', () => {
        const feature = makeFeature({
            type: 'damage_aura',
            damageType: 'Radiant',
            damageExpression: '2d6',
            range: '15_ft',
            duration: '10_minutes',
            recharge: 'short_rest'
        })
        const result = damageHandlers.damage_aura(feature, BASE_STATS)
        expect(result.type).toBe('damage_aura')
        expect(result.name).toBe('Test Feature')
        expect(result.damageType).toBe('Radiant')
        expect(result.damageExpression).toBe('2d6')
        expect(result.range).toBe('15_ft')
        expect(result.duration).toBe('10_minutes')
        expect(result.recharge).toBe('short_rest')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('damageHandlers – psionic_strike', () => {
    it('returns psionic_strike info with defaults', () => {
        const feature = makeFeature({ type: 'psionic_strike' })
        const result = damageHandlers.psionic_strike(feature, BASE_STATS)
        expect(result.type).toBe('psionic_strike')
        expect(result.name).toBe('Test Feature')
        expect(result.resource).toBe('psionicEnergy')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('Force')
        expect(result.oncePerTurn).toBe(false)
        expect(result.trigger).toBe('after_attack_hit')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields and coerces oncePerTurn to boolean', () => {
        const feature = makeFeature({
            type: 'psionic_strike',
            resource: 'psionicPoints',
            damageExpression: '2d8',
            damageType: 'Psychic',
            oncePerTurn: 'yes',
            trigger: 'on_kill'
        })
        const result = damageHandlers.psionic_strike(feature, BASE_STATS)
        expect(result.resource).toBe('psionicPoints')
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('Psychic')
        expect(result.oncePerTurn).toBe(true)
        expect(result.trigger).toBe('on_kill')
    })
})

describe('damageHandlers – primal_companion_double_strike_damage', () => {
    it('returns damage_bonus type for primal_companion_double_strike_damage with defaults and custom fields', () => {
        const feature = makeFeature({
            type: 'primal_companion_double_strike_damage',
            damageExpression: '1d6',
            damageType: 'Thunder',
            oncePerTurn: true
        })
        const result = damageHandlers.primal_companion_double_strike_damage(feature, BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('companion_beasts_strike_hit')
        expect(result.damageExpression).toBe('1d6')
        expect(result.damageType).toBe('Thunder')
        expect(result.oncePerTurn).toBe(true)
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
    it('returns null for generic damage feature', () => {
        const feature = makeFeature({ type: 'damage' })
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when source is not feat', () => {
        const feature = {
            type: 'damage',
            source: 'class',
            name: 'Some Feature',
            automation: { type: 'great_weapon_fighting' }
        }
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation type does not match', () => {
        const feature = {
            type: 'damage',
            source: 'feat',
            name: 'Some Feature',
            automation: { type: 'other_type' }
        }
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns great_weapon_fighting passive for feat feature with matching automation', () => {
        const feature = {
            type: 'damage',
            source: 'feat',
            name: 'Great Weapon Fighting',
            automation: { type: 'great_weapon_fighting' }
        }
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('great_weapon_fighting')
        expect(result.name).toBe('Great Weapon Fighting')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns two_weapon_fighting passive for feat feature with matching automation', () => {
        const feature = {
            type: 'two_weapon_fighting',
            source: 'feat',
            name: 'Two-Weapon Fighting',
            automation: { type: 'two_weapon_fighting' }
        }
        const result = damageHandlers.damage(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('two_weapon_fighting')
        expect(result.name).toBe('Two-Weapon Fighting')
        expect(result.hasAutomation).toBe(true)
    })
})
