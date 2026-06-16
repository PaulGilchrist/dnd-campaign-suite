import { describe, it, expect } from 'vitest'
import { combatStanceHandlers } from './combatStance.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('combatStanceHandlers – combat_stance', () => {
    it('returns combat_stance info with defaults', () => {
        const feature = makeFeature({ type: 'combat_stance' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.type).toBe('combat_stance')
        expect(result.name).toBe('Test Feature')
        expect(result.effect).toBe('')
        expect(result.damageBonusExpression).toBe('')
        expect(result.resistanceTypes).toEqual([])
        expect(result.advantages).toEqual([])
        expect(result.options).toEqual([])
        expect(result.duration).toBe('')
        expect(result.resourceKey).toBe('ragePoints')
        expect(result.uses).toBe(0)
        expect(result.flySpeed).toBeNull()
        expect(result.reactionSave).toBeNull()
        expect(result.blocksSpellcasting).toBe(false)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'combat_stance',
            effect: 'rage',
            damageBonusExpression: '2d6',
            resistanceTypes: ['fire', 'cold'],
            advantages: ['STR checks'],
            duration: '1_minute',
            resourceKey: 'staminaPoints',
            uses: 3,
            flySpeed: 30,
            reactionSave: 'WIS',
            blocksSpellcasting: true
        })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.effect).toBe('rage')
        expect(result.damageBonusExpression).toBe('2d6')
        expect(result.resistanceTypes).toEqual(['fire', 'cold'])
        expect(result.duration).toBe('1_minute')
        expect(result.resourceKey).toBe('staminaPoints')
        expect(result.uses).toBe(3)
        expect(result.flySpeed).toBe(30)
        expect(result.reactionSave).toBe('WIS')
        expect(result.blocksSpellcasting).toBe(true)
    })
})
