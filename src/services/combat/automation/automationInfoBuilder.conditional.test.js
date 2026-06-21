import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – dispatcher behavior', () => {
    it('returns null when feature has no automation', () => {
        const feature = { name: 'Test Feature' }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation has no type', () => {
        const feature = makeFeature({})
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null for unknown automation type', () => {
        const feature = makeFeature({ type: 'nonexistent_type' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns correct structure for condition_immunity_while_active with defaults', () => {
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

    it('passes custom fields through for condition_immunity_while_active', () => {
        const feature = makeFeature({
            type: 'condition_immunity_while_active',
            target: 'allies',
            immunities: ['poisoned', 'paralyzed'],
            requiresActive: 'stance',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('allies')
        expect(result.immunities).toEqual(['poisoned', 'paralyzed'])
        expect(result.requiresActive).toBe('stance')
    })

    it('returns correct structure for conditional_replacement with defaults', () => {
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

    it('passes custom fields through for conditional_replacement', () => {
        const feature = makeFeature({
            type: 'conditional_replacement',
            target: 'attack_roll',
            saveType: 'DEX',
            condition: 'natural_1',
            effect: 'replace_with_max',
            replacementAbility: 'INT',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('attack_roll')
        expect(result.saveType).toBe('DEX')
        expect(result.condition).toBe('natural_1')
        expect(result.effect).toBe('replace_with_max')
        expect(result.replacementAbility).toBe('INT')
    })

    it('returns passive_rule with ignore_resistance effect and damageTypes', () => {
        const feature = makeFeature({
            type: 'passive_rule',
            effect: 'ignore_resistance',
            damageTypes: ['fire', 'cold'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('ignore_resistance')
        expect(result.damageTypes).toEqual(['fire', 'cold'])
        expect(result.hasAutomation).toBe(true)
    })

    it('returns generic passive_rule for non-ignore_resistance effects', () => {
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
        expect(result.type).toBe('passive_rule')
        expect(result.effect).toBe('critical_range')
        expect(result.bonusExpression).toBe('+1')
        expect(result.criticalRange).toBe('19-20')
        expect(result.spells).toEqual(['fireball'])
        expect(result.riderSave).toBe('save_expr')
        expect(result.primalKnowledge).toEqual(['history', 'arcana'])
        expect(result.casting_time).toBe('1 action')
    })

    it('returns correct structure for evasion with defaults', () => {
        const feature = makeFeature({ type: 'evasion' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('evasion')
        expect(result.name).toBe('Test Feature')
        expect(result.saveType).toBe('DEX')
        expect(result.shareable).toBe(false)
        expect(result.shareRange).toBe(0)
        expect(result.hasAutomation).toBe(true)
    })

    it('coerces shareable to boolean and passes custom fields for evasion', () => {
        const feature = makeFeature({
            type: 'evasion',
            saveType: 'CON',
            shareable: true,
            shareRange: 30,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
        expect(result.shareable).toBe(true)
        expect(result.shareRange).toBe(30)
    })

    it('returns correct structure for save_proficiency with defaults', () => {
        const feature = makeFeature({ type: 'save_proficiency' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('save_proficiency')
        expect(result.name).toBe('Test Feature')
        expect(result.saveType).toBe('')
        expect(result.fallbackTypes).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes custom fields through for save_proficiency', () => {
        const feature = makeFeature({
            type: 'save_proficiency',
            saveType: 'WIS',
            fallbackTypes: ['INT', 'CHA'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('WIS')
        expect(result.fallbackTypes).toEqual(['INT', 'CHA'])
    })

    it('returns correct structure for conditional_advantage with defaults', () => {
        const feature = makeFeature({ type: 'conditional_advantage' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('conditional_advantage')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('advantage')
        expect(result.abilities).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes custom fields through for conditional_advantage', () => {
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
        expect(result.target).toBe('ability_check')
        expect(result.condition).toBe('adjacent_to_enemy')
        expect(result.abilities).toEqual(['STR', 'DEX'])
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })

    it('returns correct structure for conditional_disadvantage with defaults', () => {
        const feature = makeFeature({ type: 'conditional_disadvantage' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('conditional_disadvantage')
        expect(result.name).toBe('Test Feature')
        expect(result.target).toBe('attack_roll')
        expect(result.condition).toBe('')
        expect(result.effect).toBe('disadvantage')
        expect(result.abilities).toEqual([])
        expect(result.hasAutomation).toBe(true)
    })

    it('passes custom fields through for conditional_disadvantage', () => {
        const feature = makeFeature({
            type: 'conditional_disadvantage',
            target: 'saving_throw',
            condition: 'below_half_hp',
            abilities: ['CON'],
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('saving_throw')
        expect(result.condition).toBe('below_half_hp')
        expect(result.abilities).toEqual(['CON'])
    })
})
