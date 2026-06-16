import { describe, it, expect } from 'vitest'
import { resourceHandlers } from './resource.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('resourceHandlers – resource_pool', () => {
    it('returns resource_pool info with defaults', () => {
        const feature = makeFeature({ type: 'resource_pool' })
        const result = resourceHandlers.resource_pool(feature, BASE_STATS)
        expect(result.type).toBe('resource_pool')
        expect(result.resource).toBe('')
        expect(result.uses_expression).toBe('')
        expect(result.recharge_short_rest).toBe('')
        expect(result.recharge_long_rest).toBe('')
        expect(result.conversion).toBe('')
        expect(result.reverseConversion).toBe('')
        expect(result.reverseRecharge).toBe('')
        expect(result.conversionRate).toBe('')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'resource_pool',
            resource: 'sorcery_points',
            uses_expression: 'proficiency_bonus',
            recharge_short_rest: '1',
            recharge_long_rest: '1',
            conversion: 'spell_slot_to_sp',
            reverseConversion: 'sp_to_spell_slot',
            reverseRecharge: 'short_rest',
            conversionRate: '1:1'
        })
        const result = resourceHandlers.resource_pool(feature, BASE_STATS)
        expect(result.resource).toBe('sorcery_points')
        expect(result.uses_expression).toBe('proficiency_bonus')
        expect(result.recharge_short_rest).toBe('1')
        expect(result.recharge_long_rest).toBe('1')
        expect(result.conversion).toBe('spell_slot_to_sp')
        expect(result.reverseConversion).toBe('sp_to_spell_slot')
        expect(result.reverseRecharge).toBe('short_rest')
        expect(result.conversionRate).toBe('1:1')
    })
})

describe('resourceHandlers – resource_restoration', () => {
    it('returns resource_restoration info with defaults', () => {
        const feature = makeFeature({ type: 'resource_restoration' })
        const result = resourceHandlers.resource_restoration(feature, BASE_STATS)
        expect(result.type).toBe('resource_restoration')
        expect(result.trigger).toBe('short_rest')
        expect(result.casting_time).toBe('passive')
        expect(result.restore_amount).toBe(0)
        expect(result.restore_expression).toBe('')
        expect(result.resourceKey).toBe('')
        expect(result.uses_max).toBe(1)
        expect(result.recharge).toBe('long_rest')
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves restore_expression', () => {
        const feature = makeFeature({
            type: 'resource_restoration',
            restore_expression: 'proficiency_bonus'
        })
        const result = resourceHandlers.resource_restoration(feature, BASE_STATS)
        expect(result.restore_amount).toBe(3)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'resource_restoration',
            trigger: 'long_rest',
            resourceKey: 'sorcery_points',
            uses_max: 3,
            recharge: 'short_rest'
        })
        const result = resourceHandlers.resource_restoration(feature, BASE_STATS)
        expect(result.trigger).toBe('long_rest')
        expect(result.resourceKey).toBe('sorcery_points')
        expect(result.uses_max).toBe(3)
        expect(result.recharge).toBe('short_rest')
    })
})
