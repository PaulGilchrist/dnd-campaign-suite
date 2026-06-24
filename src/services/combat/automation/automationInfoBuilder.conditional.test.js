// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – dispatcher behavior', () => {
    it('returns null when feature has no automation property', () => {
        const feature = { name: 'No Automation Feature' }
        expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
    })

    it('returns null when feature automation is null', () => {
        const feature = { name: 'Null Automation Feature', automation: null }
        expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
    })

    it('returns null when automation has no type', () => {
        const feature = makeFeature({})
        expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
    })

    it('returns null for unknown automation type', () => {
        const feature = makeFeature({ type: 'nonexistent_type' })
        expect(buildAttackInfo(feature, BASE_STATS)).toBeNull()
    })

    describe('condition_immunity_while_active', () => {
        it('applies defaults when no custom fields provided', () => {
            const feature = makeFeature({ type: 'condition_immunity_while_active' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'condition_immunity_while_active',
                name: 'Test Feature',
                target: 'self',
                immunities: [],
                requiresActive: '',
                hasAutomation: true,
            })
        })

        it('passes through all custom fields', () => {
            const feature = makeFeature({
                type: 'condition_immunity_while_active',
                target: 'allies',
                immunities: ['poisoned', 'paralyzed'],
                requiresActive: 'stance',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'condition_immunity_while_active',
                name: 'Test Feature',
                target: 'allies',
                immunities: ['poisoned', 'paralyzed'],
                requiresActive: 'stance',
                hasAutomation: true,
            })
        })
    })

    describe('conditional_replacement', () => {
        it('applies defaults when no custom fields provided', () => {
            const feature = makeFeature({ type: 'conditional_replacement' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_replacement',
                name: 'Test Feature',
                target: 'saving_throw',
                saveType: '',
                condition: '',
                effect: '',
                replacementAbility: '',
                hasAutomation: true,
            })
        })

        it('passes through all custom fields', () => {
            const feature = makeFeature({
                type: 'conditional_replacement',
                target: 'attack_roll',
                saveType: 'DEX',
                condition: 'natural_1',
                effect: 'replace_with_max',
                replacementAbility: 'INT',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_replacement',
                name: 'Test Feature',
                target: 'attack_roll',
                saveType: 'DEX',
                condition: 'natural_1',
                effect: 'replace_with_max',
                replacementAbility: 'INT',
                hasAutomation: true,
            })
        })
    })

    describe('evasion', () => {
        it('applies defaults when no custom fields provided', () => {
            const feature = makeFeature({ type: 'evasion' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'evasion',
                name: 'Test Feature',
                saveType: 'DEX',
                shareable: false,
                shareRange: 0,
                hasAutomation: true,
            })
        })

        it('coerces shareable to boolean for truthy values', () => {
            const feature = makeFeature({ type: 'evasion', shareable: 1 })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.shareable).toBe(true)
        })

        it('coerces shareable to boolean for falsy values', () => {
            const feature = makeFeature({ type: 'evasion', shareable: 0 })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.shareable).toBe(false)
        })

        it('passes through custom fields including shareable coercion', () => {
            const feature = makeFeature({
                type: 'evasion',
                saveType: 'CON',
                shareable: true,
                shareRange: 30,
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'evasion',
                name: 'Test Feature',
                saveType: 'CON',
                shareable: true,
                shareRange: 30,
                hasAutomation: true,
            })
        })
    })

    describe('save_proficiency', () => {
        it('applies defaults when no custom fields provided', () => {
            const feature = makeFeature({ type: 'save_proficiency' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'save_proficiency',
                name: 'Test Feature',
                saveType: '',
                fallbackTypes: [],
                hasAutomation: true,
            })
        })

        it('passes through custom fields', () => {
            const feature = makeFeature({
                type: 'save_proficiency',
                saveType: 'WIS',
                fallbackTypes: ['INT', 'CHA'],
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'save_proficiency',
                name: 'Test Feature',
                saveType: 'WIS',
                fallbackTypes: ['INT', 'CHA'],
                hasAutomation: true,
            })
        })
    })

    describe('conditional_advantage', () => {
        it('applies defaults when no custom fields provided', () => {
            const feature = makeFeature({ type: 'conditional_advantage' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_advantage',
                name: 'Test Feature',
                target: 'saving_throw',
                condition: '',
                effect: 'advantage',
                abilities: [],
                uses: null,
                recharge: 'long_rest',
                casting_time: 'passive',
                trigger: '',
                hasAutomation: true,
            })
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
                casting_time: '1 action',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_advantage',
                name: 'Test Feature',
                target: 'ability_check',
                condition: 'adjacent_to_enemy',
                effect: 'advantage',
                abilities: ['STR', 'DEX'],
                uses: 3,
                recharge: 'short_rest',
                casting_time: '1 action',
                trigger: '',
                hasAutomation: true,
            })
        })

        it('uses empty string trigger when not provided', () => {
            const feature = makeFeature({
                type: 'conditional_advantage',
                target: 'attack_roll',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.trigger).toBe('')
        })
    })

    describe('conditional_disadvantage', () => {
        it('applies defaults when no custom fields provided', () => {
            const feature = makeFeature({ type: 'conditional_disadvantage' })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_disadvantage',
                name: 'Test Feature',
                target: 'attack_roll',
                condition: '',
                effect: 'disadvantage',
                abilities: [],
                hasAutomation: true,
            })
        })

        it('passes through custom fields', () => {
            const feature = makeFeature({
                type: 'conditional_disadvantage',
                target: 'saving_throw',
                condition: 'below_half_hp',
                abilities: ['CON'],
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'conditional_disadvantage',
                name: 'Test Feature',
                target: 'saving_throw',
                condition: 'below_half_hp',
                effect: 'disadvantage',
                abilities: ['CON'],
                hasAutomation: true,
            })
        })
    })

    describe('passive_rule – ignore_resistance', () => {
        it('returns correct structure with damageTypes', () => {
            const feature = makeFeature({
                type: 'passive_rule',
                effect: 'ignore_resistance',
                damageTypes: ['fire', 'cold'],
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'passive_rule',
                name: 'Test Feature',
                effect: 'ignore_resistance',
                damageTypes: ['fire', 'cold'],
                hasAutomation: true,
            })
        })

        it('applies defaults for damageTypes', () => {
            const feature = makeFeature({
                type: 'passive_rule',
                effect: 'ignore_resistance',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.damageTypes).toEqual([])
        })
    })

    describe('passive_rule – generic effects', () => {
        it('returns generic structure for non-ignore_resistance effects', () => {
            const feature = makeFeature({
                type: 'passive_rule',
                effect: 'critical_range',
                bonusExpression: '+1',
                criticalRange: '19-20',
                spells: ['fireball'],
                riderSave: 'save_expr',
                skills: ['history', 'arcana'],
                casting_time: '1 action',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'passive_rule',
                name: 'Test Feature',
                effect: 'critical_range',
                bonusExpression: '+1',
                criticalRange: '19-20',
                spells: ['fireball'],
                riderSave: 'save_expr',
                primalKnowledge: ['history', 'arcana'],
                casting_time: '1 action',
                cost: 0,
                resource: '',
                resistanceTypes: [],
                duration: '',
                endsOnCondition: '',
                hasAutomation: true,
            })
        })

        it('applies defaults for all generic fields', () => {
            const feature = makeFeature({
                type: 'passive_rule',
                effect: 'critical_range',
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result).toEqual({
                type: 'passive_rule',
                name: 'Test Feature',
                effect: 'critical_range',
                bonusExpression: '',
                criticalRange: '',
                spells: [],
                riderSave: null,
                primalKnowledge: [],
                casting_time: '',
                cost: 0,
                resource: '',
                resistanceTypes: [],
                duration: '',
                endsOnCondition: '',
                hasAutomation: true,
            })
        })

        it('maps skills to primalKnowledge field', () => {
            const feature = makeFeature({
                type: 'passive_rule',
                effect: 'some_effect',
                skills: ['religion'],
            })
            const result = buildAttackInfo(feature, BASE_STATS)
            expect(result.primalKnowledge).toEqual(['religion'])
        })
    })
})
