// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { combatSuperiorityHandlers } from './combatSuperiority.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('combatSuperiorityHandlers – combat_superiority', () => {
    it('returns combat_superiority info with defaults', () => {
        const feature = makeFeature({ type: 'combat_superiority' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'combat_superiority',
            name: 'Test Feature',
            saveType: 'WIS',
            saveAbility: 'STR',
            dieExpression: 'superiority_die',
            usesMax: 4,
            usesRecharge: 'short_rest',
            options: [],
            oncePerTurn: false,
            chooseOne: false,
            hasAutomation: true,
        })
        // Default saveDC when auto.saveDc is undefined: falls through to 10
        expect(result.saveDc).toBe(10)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 15 })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('computes saveDc from ability when saveDc is "ability"', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        // saveAbility defaults to 'STR' -> bonus 4, proficiency 3: 8 + 4 + 3 = 15
        expect(result.saveDc).toBe(15)
        expect(result.saveAbility).toBe('STR')
    })

    it('computes saveDc from custom saveAbility when saveDc is "ability"', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveDc: 'ability',
            saveAbility: 'WIS',
            saveType: 'WIS',
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        // WIS bonus is 5, proficiency 3: 8 + 5 + 3 = 16
        expect(result.saveDc).toBe(16)
        expect(result.saveAbility).toBe('WIS')
        expect(result.saveType).toBe('WIS')
    })

    it('defaults saveAbility to STR when not provided', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveType: 'CON' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveAbility).toBe('STR')
    })

    it('passes through custom saveAbility and saveType', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveAbility: 'CON',
            saveType: 'CON',
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveAbility).toBe('CON')
        expect(result.saveType).toBe('CON')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            dieExpression: '2d8',
            uses_max: 6,
            recharge: 'long_rest',
            oncePerTurn: true,
            chooseOne: true,
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.dieExpression).toBe('2d8')
        expect(result.usesMax).toBe(6)
        expect(result.usesRecharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
    })

    it('passes through custom options array', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            options: ['option1', 'option2'],
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.options).toEqual(['option1', 'option2'])
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'combat_superiority' }, 'Maneuvering Attack')
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.name).toBe('Maneuvering Attack')
    })

    it('coerces oncePerTurn and chooseOne to boolean', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            oncePerTurn: 1,
            chooseOne: 'yes',
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
    })

    it('handles missing proficiency in playerStats', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, { ...BASE_STATS, proficiency: undefined })
        // STR bonus 4, no proficiency: 8 + 4 + 0 = 12
        expect(result.saveDc).toBe(12)
    })

    it('handles empty abilities array in playerStats', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, { ...BASE_STATS, abilities: [] })
        // No ability modifier found: 8 + 0 + 3 = 11
        expect(result.saveDc).toBe(11)
    })
})

describe('combatSuperiorityHandlers – tactical_mind', () => {
    it('returns tactical_mind info with defaults', () => {
        const feature = makeFeature({ type: 'tactical_mind' })
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'tactical_mind',
            name: 'Test Feature',
            bonusExpression: '',
            hasAutomation: true,
        })
    })

    it('passes through bonusExpression', () => {
        const feature = makeFeature({ type: 'tactical_mind', bonusExpression: '+2d4' })
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('+2d4')
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'tactical_mind' }, 'Tactical Genius')
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)
        expect(result.name).toBe('Tactical Genius')
    })
})

describe('combatSuperiorityHandlers – know_enemy', () => {
    it('returns know_enemy info with defaults', () => {
        const feature = makeFeature({ type: 'know_enemy' })
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'know_enemy',
            name: 'Test Feature',
            range: '30_ft',
            usesMax: 4,
            hasAutomation: true,
        })
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({ type: 'know_enemy', range: '60_ft', uses_max: 6 })
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.usesMax).toBe(6)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'know_enemy' }, 'Know Foe')
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)
        expect(result.name).toBe('Know Foe')
    })
})
