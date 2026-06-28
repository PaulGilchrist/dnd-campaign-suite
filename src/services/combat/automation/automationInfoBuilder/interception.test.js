import { describe, it, expect } from 'vitest';
import { reactionHandlers } from './reaction.js';
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js';

describe('reactionHandlers – interception', () => {
    it('returns type interception with correct defaults', () => {
        const feature = makeFeature({ type: 'interception' })
        const result = reactionHandlers.interception(feature, BASE_STATS)

        expect(result.type).toBe('interception')
        expect(result.name).toBe('Test Feature')
        expect(result.trigger).toBe('ally_within_5ft_attacked')
        expect(result.range).toBe('5_ft')
        expect(result.damageExpression).toBe('1d10')
        expect(result.damageType).toBe('')
        expect(result.damageBonusExpression).toBe('proficiency_bonus')
        expect(result.damageBonus).toBe(3)
        expect(result.requiresShield).toBe(false)
        expect(result.casting_time).toBe('1 reaction')
        expect(result.hasAutomation).toBe(true)
    })

    it('propagates the feature name', () => {
        const feature = makeFeature({ type: 'interception' }, 'Interception')
        const result = reactionHandlers.interception(feature, BASE_STATS)
        expect(result.name).toBe('Interception')
    })

    it('resolves damageBonus from player proficiency', () => {
        const highProfStats = { ...BASE_STATS, proficiency: 6 }
        const feature = makeFeature({ type: 'interception' })
        const result = reactionHandlers.interception(feature, highProfStats)
        expect(result.damageBonus).toBe(6)
    })

    it('passes through custom automation fields', () => {
        const feature = makeFeature({
            type: 'interception',
            trigger: 'custom_trigger',
            range: '10_ft',
            damageExpression: '2d10',
            damageType: 'Force',
            damageBonusExpression: 'level',
            requiresShield: true,
            casting_time: '1 reaction',
        })
        const result = reactionHandlers.interception(feature, BASE_STATS)
        expect(result.trigger).toBe('custom_trigger')
        expect(result.range).toBe('10_ft')
        expect(result.damageExpression).toBe('2d10')
        expect(result.damageType).toBe('Force')
        expect(result.damageBonusExpression).toBe('level')
        expect(result.requiresShield).toBe(true)
    })

    it('throws when automation is undefined', () => {
        const feature = { name: 'Test', automation: undefined }
        expect(() => reactionHandlers.interception(feature, BASE_STATS))
            .toThrow(TypeError)
    })
})
