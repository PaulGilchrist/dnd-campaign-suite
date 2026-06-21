// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – damage_bonus', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'damage_bonus' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.hasAutomation).toBe(true)
        expect(result.name).toBe('Test Feature')
    })

    it('defaults all optional fields to empty string, null, false, or 0', () => {
        const feature = makeFeature({ type: 'damage_bonus' })
        const result = buildAttackInfo(feature, BASE_STATS)
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
    })

    it('passes through provided optional fields', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            trigger: 'on_hit',
            damageExpression: '2d6',
            damageType: 'fire',
            maxDamage: 20,
            extraVs: 'giant',
            extraDamage: '1d8',
            extraDamageExpression: '1d4',
            extraDamageType: 'cold',
            resourceType: 'warlock_slot',
            oncePerTurn: true,
            options: ['option1'],
            tempHpExpression: '2d4',
            upgrades: 'upgrade_expr',
            rangeBonusCantrip: '120_ft',
            uses_expression: 'level',
            recharge: 'short_rest',
            abilityIncreased: 'STR',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.damageExpression).toBe('2d6')
        expect(result.damageType).toBe('fire')
        expect(result.maxDamage).toBe(20)
        expect(result.extraVs).toBe('giant')
        expect(result.extraDamage).toBe('1d8')
        expect(result.extraDamageExpression).toBe('1d4')
        expect(result.extraDamageType).toBe('cold')
        expect(result.resourceType).toBe('warlock_slot')
        expect(result.oncePerTurn).toBe(true)
        expect(result.options).toEqual(['option1'])
        expect(result.tempHpExpression).toBe('2d4')
        expect(result.upgrades).toBe('upgrade_expr')
        expect(result.rangeBonusCantrip).toBe('120_ft')
        expect(result.uses_expression).toBe('level')
        expect(result.recharge).toBe('short_rest')
        expect(result.abilityIncreased).toBe('STR')
    })

    it('resolves scaling expression when player level meets threshold', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { '3': '2d6', '5': '3d6' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('keeps base expression when level is below all scaling entries', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d4',
            scaling: { '11': '2d6', '17': '3d6' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('1d4')
    })

    it('resolves to the highest applicable scaling tier', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { '3': '2d6', '5': '3d6', '11': '4d6' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('coerces scaling values to strings', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d6',
            scaling: { '3': 2, '5': 3 },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3')
    })

    it('filters out non-numeric scaling keys', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            damageExpression: '1d4',
            scaling: { 'invalid': '2d6', '5': '3d6' },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('3d6')
    })

    it('evaluates uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            uses_expression: '2 + Math.floor(level / 2)',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(4)
    })

    it('uses auto.uses value when no uses_expression', () => {
        const feature = makeFeature({
            type: 'damage_bonus',
            uses: 5,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(5)
    })

    it('defaults usesMax to 0 when neither uses nor uses_expression present', () => {
        const feature = makeFeature({ type: 'damage_bonus' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesMax).toBe(0)
    })

    it('coerces oncePerTurn to boolean', () => {
        const feature = makeFeature({ type: 'damage_bonus', oncePerTurn: 'yes' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
    })
})

describe('buildAttackInfo – damage_modifier', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'damage_modifier' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_modifier')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults optional fields to empty strings', () => {
        const feature = makeFeature({ type: 'damage_modifier' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('')
        expect(result.modifierExpression).toBe('')
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'damage_modifier',
            trigger: 'on_hit',
            modifierExpression: '+2d6',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('on_hit')
        expect(result.modifierExpression).toBe('+2d6')
    })
})

describe('buildAttackInfo – damage_type_modifier', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'damage_type_modifier' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_type_modifier')
        expect(result.hasAutomation).toBe(true)
        expect(result.weaponTypes).toEqual([])
        expect(result.options).toEqual([])
        expect(result.trigger).toBe('')
    })

    it('passes through provided arrays and values', () => {
        const feature = makeFeature({
            type: 'damage_type_modifier',
            trigger: 'on_miss',
            weaponTypes: ['longsword', 'rapier'],
            options: ['slashing', 'piercing'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.weaponTypes).toEqual(['longsword', 'rapier'])
        expect(result.options).toEqual(['slashing', 'piercing'])
        expect(result.trigger).toBe('on_miss')
    })
})

describe('buildAttackInfo – damage_type_choice', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'damage_type_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_type_choice')
        expect(result.hasAutomation).toBe(true)
        expect(result.damageTypes).toEqual([])
        expect(result.effect).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.minDamage).toBe(false)
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'damage_type_choice',
            damageTypes: ['fire', 'lightning'],
            effect: 'choose_on_hit',
            casting_time: '1 action',
            minDamage: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageTypes).toEqual(['fire', 'lightning'])
        expect(result.effect).toBe('choose_on_hit')
        expect(result.casting_time).toBe('1 action')
        expect(result.minDamage).toBe(true)
    })
})

describe('buildAttackInfo – weapon_mastery_choice', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'weapon_mastery_choice' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('weapon_mastery_choice')
        expect(result.hasAutomation).toBe(true)
        expect(result.masteryProperties).toEqual([])
        expect(result.effect).toBe('extra_mastery')
        expect(result.casting_time).toBe('passive')
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'weapon_mastery_choice',
            masteryProperties: ['heavy', 'thrown'],
            effect: 'choose_mastery',
            casting_time: '1 minute',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.masteryProperties).toEqual(['heavy', 'thrown'])
        expect(result.effect).toBe('choose_mastery')
        expect(result.casting_time).toBe('1 minute')
    })
})

describe('buildAttackInfo – damage_reduction', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'damage_reduction' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_reduction')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults all optional fields correctly', () => {
        const feature = makeFeature({ type: 'damage_reduction' })
        const result = buildAttackInfo(feature, BASE_STATS)
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
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'damage_reduction',
            reductionExpression: '1d10',
            trigger: 'on_hit',
            reaction: true,
            redirect: true,
            redirectCost: 'resource',
            redirectDamage: '1d6',
            redirectSave: 'CON',
            cost: '1_point',
            damageTypes: ['bludgeoning', 'piercing'],
            condition: 'half_damage',
            effect: 'absorb',
            requiresShield: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.reductionExpression).toBe('1d10')
        expect(result.trigger).toBe('on_hit')
        expect(result.reaction).toBe(true)
        expect(result.redirect).toBe(true)
        expect(result.redirectCost).toBe('resource')
        expect(result.redirectDamage).toBe('1d6')
        expect(result.redirectSave).toBe('CON')
        expect(result.cost).toBe('1_point')
        expect(result.damageTypes).toEqual(['bludgeoning', 'piercing'])
        expect(result.condition).toBe('half_damage')
        expect(result.effect).toBe('absorb')
        expect(result.requiresShield).toBe(true)
    })

    it('coerces requiresShield to boolean', () => {
        const feature = makeFeature({ type: 'damage_reduction', requiresShield: 'yes' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.requiresShield).toBe(true)
    })
})

describe('buildAttackInfo – damage_aura', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'damage_aura' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_aura')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults to hardcoded defaults for range, duration, recharge', () => {
        const feature = makeFeature({ type: 'damage_aura' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageType).toBe('')
        expect(result.damageExpression).toBe('')
        expect(result.range).toBe('10_ft')
        expect(result.duration).toBe('1_minute')
        expect(result.recharge).toBe('long_rest')
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'damage_aura',
            damageType: 'fire',
            damageExpression: '2d6',
            range: '15_ft',
            duration: 'concentration',
            recharge: 'short_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageType).toBe('fire')
        expect(result.damageExpression).toBe('2d6')
        expect(result.range).toBe('15_ft')
        expect(result.duration).toBe('concentration')
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – psionic_strike', () => {
    it('returns hasAutomation and correct type', () => {
        const feature = makeFeature({ type: 'psionic_strike' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('psionic_strike')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults resource, damageType, and trigger to hardcoded defaults', () => {
        const feature = makeFeature({ type: 'psionic_strike' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resource).toBe('psionicEnergy')
        expect(result.damageExpression).toBe('')
        expect(result.damageType).toBe('Force')
        expect(result.oncePerTurn).toBe(false)
        expect(result.trigger).toBe('after_attack_hit')
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'psionic_strike',
            resource: 'psi_points',
            damageExpression: '2d10',
            damageType: 'psychic',
            oncePerTurn: true,
            trigger: 'on_kill',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resource).toBe('psi_points')
        expect(result.damageExpression).toBe('2d10')
        expect(result.damageType).toBe('psychic')
        expect(result.oncePerTurn).toBe(true)
        expect(result.trigger).toBe('on_kill')
    })
})

describe('buildAttackInfo – primal_companion_double_strike_damage', () => {
    it('returns type damage_bonus with hardcoded trigger', () => {
        const feature = makeFeature({ type: 'primal_companion_double_strike_damage' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('damage_bonus')
        expect(result.trigger).toBe('companion_beasts_strike_hit')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through damageExpression and damageType', () => {
        const feature = makeFeature({
            type: 'primal_companion_double_strike_damage',
            damageExpression: '2d8',
            damageType: 'radiant',
            oncePerTurn: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.damageExpression).toBe('2d8')
        expect(result.damageType).toBe('radiant')
        expect(result.oncePerTurn).toBe(true)
    })
})

describe('buildAttackInfo – great_weapon_fighting', () => {
    it('returns type passive_rule with effect great_weapon_fighting', () => {
        const feature = makeFeature({ type: 'great_weapon_fighting' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('great_weapon_fighting')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('buildAttackInfo – grapple_damage', () => {
    it('returns type passive_rule with effect grapple_damage', () => {
        const feature = makeFeature({ type: 'grapple_damage' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('grapple_damage')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('buildAttackInfo – two_weapon_fighting', () => {
    it('returns type passive_rule with effect two_weapon_fighting', () => {
        const feature = makeFeature({ type: 'two_weapon_fighting' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('two_weapon_fighting')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('buildAttackInfo – reroll_damage_once_per_turn', () => {
    it('returns type passive_rule with effect reroll_damage_once_per_turn', () => {
        const feature = makeFeature({ type: 'reroll_damage_once_per_turn' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('reroll_damage_once_per_turn')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('buildAttackInfo – damage (conditional handler)', () => {
    it('returns null when feature has no matching type and source', () => {
        const feature = makeFeature({ type: 'damage' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when feature type is damage but source is not feat', () => {
        const feature = {
            name: 'Damage from class',
            type: 'damage',
            source: 'class',
            automation: { type: 'damage' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns passive_rule for damage+feat+great_weapon_fighting', () => {
        const feature = {
            name: 'Great Weapon Fighting Feat',
            type: 'damage',
            source: 'feat',
            automation: { type: 'great_weapon_fighting' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('great_weapon_fighting')
    })

    it('returns passive_rule for two_weapon_fighting type+feat+two_weapon_fighting', () => {
        const feature = {
            name: 'Two Weapon Fighting Feat',
            type: 'two_weapon_fighting',
            source: 'feat',
            automation: { type: 'two_weapon_fighting' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('two_weapon_fighting')
    })
})
