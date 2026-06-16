import { describe, it, expect } from 'vitest'
import { conditionalHandlers } from './conditional.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('conditionalHandlers – conditional_advantage', () => {
    it('returns conditional_advantage info with defaults', () => {
        const feature = makeFeature({ type: 'conditional_advantage' })
        const result = conditionalHandlers.conditional_advantage(feature, BASE_STATS)
        expect(result.type).toBe('conditional_advantage')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('advantage')
        expect(result.abilities).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'conditional_advantage',
            target: 'ability_check',
            condition: 'adjacent_to_enemy',
            effect: 'advantage',
            abilities: ['STR', 'DEX'],
            uses: 3,
            recharge: 'short_rest',
            casting_time: '1 action'
        })
        const result = conditionalHandlers.conditional_advantage(feature, BASE_STATS)
        expect(result.target).toBe('ability_check')
        expect(result.condition).toBe('adjacent_to_enemy')
        expect(result.abilities).toEqual(['STR', 'DEX'])
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
    })
})

describe('conditionalHandlers – conditional_disadvantage', () => {
    it('returns conditional_disadvantage info with defaults', () => {
        const feature = makeFeature({ type: 'conditional_disadvantage' })
        const result = conditionalHandlers.conditional_disadvantage(feature, BASE_STATS)
        expect(result.type).toBe('conditional_disadvantage')
        expect(result.target).toBe('attack_roll')
        expect(result.effect).toBe('disadvantage')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'conditional_disadvantage',
            target: 'saving_throw',
            condition: 'below_half_hp',
            abilities: ['CON']
        })
        const result = conditionalHandlers.conditional_disadvantage(feature, BASE_STATS)
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('below_half_hp')
        expect(result.abilities).toEqual(['CON'])
    })
})

describe('conditionalHandlers – conditional_replacement', () => {
    it('returns conditional_replacement info with defaults', () => {
        const feature = makeFeature({ type: 'conditional_replacement' })
        const result = conditionalHandlers.conditional_replacement(feature, BASE_STATS)
        expect(result.type).toBe('conditional_replacement')
        expect(result.target).toBe('saving_throw')
        expect(result.saveType).toBe('')
        expect(result.condition).toBe('')
        expect(result.replacementAbility).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'conditional_replacement',
            target: 'ability_check',
            saveType: 'DEX',
            condition: 'stealthed',
            replacementAbility: 'DEX'
        })
        const result = conditionalHandlers.conditional_replacement(feature, BASE_STATS)
        expect(result.target).toBe('ability_check')
        expect(result.saveType).toBe('DEX')
        expect(result.condition).toBe('stealthed')
        expect(result.replacementAbility).toBe('DEX')
    })
})

describe('conditionalHandlers – condition_immunity_while_active', () => {
    it('returns condition_immunity_while_active info with defaults', () => {
        const feature = makeFeature({ type: 'condition_immunity_while_active' })
        const result = conditionalHandlers.condition_immunity_while_active(feature, BASE_STATS)
        expect(result.type).toBe('condition_immunity_while_active')
        expect(result.target).toBe('self')
        expect(result.immunities).toEqual([])
        expect(result.requiresActive).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'condition_immunity_while_active',
            target: 'allies_in_range',
            immunities: ['charmed', 'frightened'],
            requiresActive: 'aura_of_protection'
        })
        const result = conditionalHandlers.condition_immunity_while_active(feature, BASE_STATS)
        expect(result.target).toBe('allies_in_range')
        expect(result.immunities).toEqual(['charmed', 'frightened'])
        expect(result.requiresActive).toBe('aura_of_protection')
    })
})

describe('conditionalHandlers – evasion', () => {
    it('returns evasion info with defaults', () => {
        const feature = makeFeature({ type: 'evasion' })
        const result = conditionalHandlers.evasion(feature, BASE_STATS)
        expect(result.type).toBe('evasion')
        expect(result.saveType).toBe('DEX')
        expect(result.shareable).toBe(false)
        expect(result.shareRange).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'evasion',
            saveType: 'CON',
            shareable: true,
            shareRange: 30
        })
        const result = conditionalHandlers.evasion(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.shareable).toBe(true)
        expect(result.shareRange).toBe(30)
    })
})

describe('conditionalHandlers – save_proficiency', () => {
    it('returns save_proficiency info with defaults', () => {
        const feature = makeFeature({ type: 'save_proficiency' })
        const result = conditionalHandlers.save_proficiency(feature, BASE_STATS)
        expect(result.type).toBe('save_proficiency')
        expect(result.saveType).toBe('')
        expect(result.fallbackTypes).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'save_proficiency',
            saveType: 'WIS',
            fallbackTypes: ['INT', 'CHA']
        })
        const result = conditionalHandlers.save_proficiency(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
        expect(result.fallbackTypes).toEqual(['INT', 'CHA'])
    })
})

describe('conditionalHandlers – passive_rule', () => {
    it('returns passive_rule with ignore_resistance effect', () => {
        const feature = makeFeature({
            type: 'passive_rule',
            effect: 'ignore_resistance',
            damageTypes: ['fire', 'cold']
        })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('ignore_resistance')
        expect(result.damageTypes).toEqual(['fire', 'cold'])
        expect(result.hasAutomation).toBe(true)
    })

    it('returns generic passive_rule for other effects', () => {
        const feature = makeFeature({
            type: 'passive_rule',
            effect: 'critical_range',
            criticalRange: '18-20',
            bonusExpression: '+2d6',
            spells: ['fire bolt', 'thunderwave'],
            cost: 2,
            resource: 'sorcery_points',
            duration: '1_minute'
        })
        const result = conditionalHandlers.passive_rule(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('critical_range')
        expect(result.criticalRange).toBe('18-20')
        expect(result.bonusExpression).toBe('+2d6')
        expect(result.spells).toEqual(['fire bolt', 'thunderwave'])
        expect(result.cost).toBe(2)
        expect(result.duration).toBe('1_minute')
        expect(result.hasAutomation).toBe(true)
    })
})
