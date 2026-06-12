import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – condition_immunity_while_active', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'condition_immunity_while_active' } }
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

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'condition_immunity_while_active',
                target: 'allies',
                immunities: ['poisoned', 'paralyzed'],
                requiresActive: 'stance',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('allies')
        expect(result.immunities).toEqual(['poisoned', 'paralyzed'])
        expect(result.requiresActive).toBe('stance')
    })
})

describe('buildAttackInfo – conditional_replacement', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'conditional_replacement' } }
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

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'conditional_replacement',
                target: 'attack_roll',
                saveType: 'DEX',
                condition: 'natural_1',
                effect: 'replace_with_max',
                replacementAbility: 'INT',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('attack_roll')
        expect(result.saveType).toBe('DEX')
        expect(result.condition).toBe('natural_1')
        expect(result.effect).toBe('replace_with_max')
        expect(result.replacementAbility).toBe('INT')
    })
})

describe('buildAttackInfo – passive_rule', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'passive_rule' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'passive_rule',
            name: 'Test Feature',
            effect: '',
            bonusExpression: '',
            criticalRange: '',
            spells: [],
            riderSave: null,
            primalKnowledge: [],
            casting_time: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'passive_rule',
                effect: 'rule',
                bonusExpression: '+1',
                criticalRange: '19-20',
                spells: ['fireball'],
                riderSave: 'save_expr',
                skills: ['history', 'arcana'],
                casting_time: '1 action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.effect).toBe('rule')
        expect(result.bonusExpression).toBe('+1')
        expect(result.criticalRange).toBe('19-20')
        expect(result.spells).toEqual(['fireball'])
        expect(result.riderSave).toBe('save_expr')
        expect(result.primalKnowledge).toEqual(['history', 'arcana'])
        expect(result.casting_time).toBe('1 action')
    })
})
