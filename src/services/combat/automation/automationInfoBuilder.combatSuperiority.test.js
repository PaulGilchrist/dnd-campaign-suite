// @improved-by-ai
import { describe, it, expect } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – combat_superiority', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveDc: 'ability',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'combat_superiority',
            name: 'Test Feature',
            saveType: 'WIS',
            saveDc: 15,
            saveAbility: 'STR',
            saveAbilities: ['STR'],
            dieExpression: 'superiority_die',
            maxOptions: 3,
            usesMax: 4,
            usesRecharge: 'short_rest',
            options: [],
            oncePerTurn: false,
            chooseOne: false,
            hasAutomation: true,
        })
    })

    it('computes save DC from DEX ability + proficiency', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveAbility: 'DEX',
            saveDc: 'ability',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        // BASE_STATS: DEX bonus=2, proficiency=3, DC = 8+2+3 = 13
        expect(result.saveDc).toBe(13)
        expect(result.saveAbility).toBe('DEX')
    })

    it('uses explicit saveDc when provided as a number', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveDc: 15,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('defaults to 10 when saveDc is not provided and not "ability"', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveDc).toBe(10)
    })

    it('respects custom saveType', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveType: 'CON',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveType).toBe('CON')
    })

    it('respects custom die expression', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            dieExpression: '2d6',
            uses_max: 5,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.dieExpression).toBe('2d6')
        expect(result.usesMax).toBe(5)
    })

    it('includes options when provided', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            options: ['option1', 'option2'],
            oncePerTurn: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.options).toEqual(['option1', 'option2'])
        expect(result.oncePerTurn).toBe(true)
    })

    it('coerces oncePerTurn and chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            oncePerTurn: 'yes',
            chooseOne: 'yes',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
    })

    it('uses custom recharge value', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            recharge: 'long_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.usesRecharge).toBe('long_rest')
    })

    it('picks the best save ability from an array of saveAbilities', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveAbility: ['STR', 'DEX'],
            saveDc: 'ability',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        // STR bonus=4 > DEX bonus=2, so STR is picked
        expect(result.saveAbility).toBe('STR')
        expect(result.saveAbilities).toEqual(['STR', 'DEX'])
        expect(result.saveDc).toBe(15) // 8 + 4 + 3
    })

    it('picks the best save ability from a multi-word array', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveAbility: ['Strength', 'Dexterity'],
            saveDc: 'ability',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.saveAbility).toBe('Strength')
        expect(result.saveAbilities).toEqual(['Strength', 'Dexterity'])
    })

    it('maxOptions uses base value and scaling', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            maxOptions: 2,
            maxOptionsScaling: { '5': 1, '11': 1, '17': 1 },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        // level 5: base 2 + 1 (level 5 applies) = 3 (level 11/17 do not apply)
        expect(result.maxOptions).toBe(3)
    })

    it('maxOptions skips inapplicable scaling tiers', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            maxOptions: 2,
            maxOptionsScaling: { '11': 1, '17': 1 },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        // level 5: base 2, no tiers apply
        expect(result.maxOptions).toBe(2)
    })

    it('maxOptions handles invalid scaling keys gracefully', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            maxOptions: 2,
            maxOptionsScaling: { 'invalid': 1, '5': 1 },
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.maxOptions).toBe(3)
    })
})

describe('buildAttackInfo – tactical_mind', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'tactical_mind' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'tactical_mind',
            name: 'Test Feature',
            bonusExpression: '',
            hasAutomation: true,
        })
    })

    it('passes through provided bonusExpression', () => {
        const feature = makeFeature({
            type: 'tactical_mind',
            bonusExpression: '1d4 + INT modifier',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('1d4 + INT modifier')
    })
})

describe('buildAttackInfo – know_enemy', () => {
    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'know_enemy' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'know_enemy',
            name: 'Test Feature',
            range: '30_ft',
            usesMax: 4,
            hasAutomation: true,
        })
    })

    it('passes through provided values', () => {
        const feature = makeFeature({
            type: 'know_enemy',
            range: '60_ft',
            uses_max: 6,
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.usesMax).toBe(6)
    })
})
