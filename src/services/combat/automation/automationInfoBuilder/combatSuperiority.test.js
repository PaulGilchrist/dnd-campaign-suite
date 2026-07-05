// @cleaned-by-ai
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
        expect(result.saveDc).toBe(16)
        expect(result.saveAbility).toBe('WIS')
        expect(result.saveType).toBe('WIS')
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
        expect(result.saveDc).toBe(12)
    })

    it('handles empty abilities array in playerStats', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 'ability' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, { ...BASE_STATS, abilities: [] })
        expect(result.saveDc).toBe(11)
    })
})

describe('combatSuperiorityHandlers – tactical_mind', () => {
    it('returns tactical_mind info with defaults and passes through custom fields', () => {
        const feature = makeFeature({ type: 'tactical_mind', bonusExpression: '+2d4' })
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)

        expect(result.type).toBe('tactical_mind')
        expect(result.name).toBe('Test Feature')
        expect(result.bonusExpression).toBe('+2d4')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'tactical_mind' }, 'Tactical Genius')
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)
        expect(result.name).toBe('Tactical Genius')
    })
})

describe('combatSuperiorityHandlers – know_enemy', () => {
    it('returns know_enemy info with defaults and passes through custom fields', () => {
        const feature = makeFeature({ type: 'know_enemy', range: '60_ft', uses_max: 6 })
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)

        expect(result.type).toBe('know_enemy')
        expect(result.name).toBe('Test Feature')
        expect(result.range).toBe('60_ft')
        expect(result.usesMax).toBe(6)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'know_enemy' }, 'Know Foe')
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)
        expect(result.name).toBe('Know Foe')
    })
})
