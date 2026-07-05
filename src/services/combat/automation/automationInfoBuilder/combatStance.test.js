// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { combatStanceHandlers } from './combatStance.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('combatStanceHandlers – combat_stance', () => {
    it('returns combat_stance info with defaults when automation is empty', () => {
        const feature = makeFeature({ type: 'combat_stance' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'combat_stance',
            name: 'Test Feature',
            effect: '',
            damageBonusExpression: '',
            resistanceTypes: [],
            advantages: [],
            options: [],
            duration: '',
            resourceKey: 'ragePoints',
            uses: 0,
            flySpeed: null,
            reactionSave: null,
            blocksSpellcasting: false,
            hasAutomation: true,
        })
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
        expect(result.advantages).toEqual(['STR checks'])
        expect(result.duration).toBe('1_minute')
        expect(result.resourceKey).toBe('staminaPoints')
        expect(result.uses).toBe(3)
        expect(result.flySpeed).toBe(30)
        expect(result.reactionSave).toBe('WIS')
        expect(result.blocksSpellcasting).toBe(true)
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom name', () => {
        const feature = makeFeature({ type: 'combat_stance' }, 'Rage')
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.name).toBe('Rage')
    })

    it('uses ragePoints default when resourceKey is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', resourceKey: '' })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.resourceKey).toBe('ragePoints')
    })

    it('uses 0 default when uses is falsy', () => {
        const feature = makeFeature({ type: 'combat_stance', uses: 0 })
        const result = combatStanceHandlers.combat_stance(feature, BASE_STATS)
        expect(result.uses).toBe(0)
    })
})
