import { describe, it, expect } from 'vitest'
import { initiativeHandlers } from './initiative.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('initiativeHandlers – initiative_action', () => {
    it('returns initiative_action info with defaults', () => {
        const feature = makeFeature({ type: 'initiative_action' })
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)
        expect(result.type).toBe('initiative_action')
        expect(result.name).toBe('Test Feature')
        expect(result.effect).toBe('')
        expect(result.healExpression).toBe('')
        expect(result.trigger).toBe('roll_initiative')
        expect(result.uses).toBe(1)
        expect(result.usesMax).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.resourceCost).toBe('')
        expect(result.hasAutomation).toBe(true)
    })

    it('generates resourceKey from feature name', () => {
        const feature = makeFeature({ type: 'initiative_action' }, 'Lucky Initiative')
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)
        expect(result.resourceKey).toBe('luckyinitiativeUses')
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'initiative_action',
            effect: 'advantage',
            healExpression: '1d6',
            trigger: 'round_start',
            uses: 3,
            recharge: 'short_rest',
            resourceCost: 'luck_points'
        })
        const result = initiativeHandlers.initiative_action(feature, BASE_STATS)
        expect(result.effect).toBe('advantage')
        expect(result.healExpression).toBe('1d6')
        expect(result.trigger).toBe('round_start')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.resourceCost).toBe('luck_points')
    })
})
