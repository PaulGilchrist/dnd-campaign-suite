import { describe, it, expect } from 'vitest'
import { combatSuperiorityHandlers } from './combatSuperiority.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('combatSuperiorityHandlers – combat_superiority', () => {
    it('returns combat_superiority info with defaults', () => {
        const feature = makeFeature({ type: 'combat_superiority' })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.type).toBe('combat_superiority')
        expect(result.name).toBe('Test Feature')
        expect(result.saveType).toBe('WIS')
        expect(result.saveAbility).toBe('STR')
        expect(result.saveDc).toBe(10)
        expect(result.dieExpression).toBe('superiority_die')
        expect(result.usesMax).toBe(4)
        expect(result.usesRecharge).toBe('short_rest')
        expect(result.options).toEqual([])
        expect(result.oncePerTurn).toBe(false)
        expect(result.chooseOne).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('uses explicit saveDc when not ability', () => {
        const feature = makeFeature({ type: 'combat_superiority', saveDc: 15 })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.saveDc).toBe(15)
    })

    it('uses custom saveAbility', () => {
        const feature = makeFeature({
            type: 'combat_superiority',
            saveAbility: 'CON',
            saveType: 'CON'
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
            chooseOne: true
        })
        const result = combatSuperiorityHandlers.combat_superiority(feature, BASE_STATS)
        expect(result.dieExpression).toBe('2d8')
        expect(result.usesMax).toBe(6)
        expect(result.usesRecharge).toBe('long_rest')
        expect(result.oncePerTurn).toBe(true)
        expect(result.chooseOne).toBe(true)
    })
})

describe('combatSuperiorityHandlers – tactical_mind', () => {
    it('returns tactical_mind info with defaults', () => {
        const feature = makeFeature({ type: 'tactical_mind' })
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)
        expect(result.type).toBe('tactical_mind')
        expect(result.bonusExpression).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through bonusExpression', () => {
        const feature = makeFeature({ type: 'tactical_mind', bonusExpression: '+2d4' })
        const result = combatSuperiorityHandlers.tactical_mind(feature, BASE_STATS)
        expect(result.bonusExpression).toBe('+2d4')
    })
})

describe('combatSuperiorityHandlers – know_enemy', () => {
    it('returns know_enemy info with defaults', () => {
        const feature = makeFeature({ type: 'know_enemy' })
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)
        expect(result.type).toBe('know_enemy')
        expect(result.range).toBe('30_ft')
        expect(result.usesMax).toBe(4)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({ type: 'know_enemy', range: '60_ft', uses_max: 6 })
        const result = combatSuperiorityHandlers.know_enemy(feature, BASE_STATS)
        expect(result.range).toBe('60_ft')
        expect(result.usesMax).toBe(6)
    })
})
