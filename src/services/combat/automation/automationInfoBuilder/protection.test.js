// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { reactionHandlers } from './reaction.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('reactionHandlers – protection', () => {
    it('returns type protection with correct defaults', () => {
        const feature = makeFeature({ type: 'protection' })
        const result = reactionHandlers.protection(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'protection',
            name: 'Test Feature',
            trigger: 'ally_within_5ft_attacked',
            range: '5_ft',
            requiresShield: true,
            casting_time: '1 reaction',
            hasAutomation: true,
        })
    })

    it('uses feature name when provided', () => {
        const feature = makeFeature({ type: 'protection' }, 'Shield Protection')
        const result = reactionHandlers.protection(feature, BASE_STATS)
        expect(result.name).toBe('Shield Protection')
    })

    it('always sets requiresShield to true regardless of automation value', () => {
        const feature = makeFeature({ type: 'protection', requiresShield: false })
        const result = reactionHandlers.protection(feature, BASE_STATS)
        expect(result.requiresShield).toBe(true)
    })
})
