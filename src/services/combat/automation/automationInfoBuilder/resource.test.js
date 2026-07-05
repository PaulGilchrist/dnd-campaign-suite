// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { resourceHandlers } from './resource.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('resourceHandlers – resource_pool', () => {
    it('returns type, name, and hasAutomation', () => {
        const feature = makeFeature({ type: 'resource_pool' }, 'My Pool')
        const result = resourceHandlers.resource_pool(feature, BASE_STATS)
        expect(result.type).toBe('resource_pool')
        expect(result.name).toBe('My Pool')
        expect(result.hasAutomation).toBe(true)
    })

    it('returns empty strings for all unresolved fields when automation is empty', () => {
        const feature = makeFeature({ type: 'resource_pool', automation: {} })
        const result = resourceHandlers.resource_pool(feature, BASE_STATS)
        expect(result.resource).toBe('')
        expect(result.uses_expression).toBe('')
        expect(result.recharge_short_rest).toBe('')
        expect(result.recharge_long_rest).toBe('')
        expect(result.conversion).toBe('')
        expect(result.reverseConversion).toBe('')
        expect(result.reverseRecharge).toBe('')
        expect(result.conversionRate).toBe('')
    })

    it('defaults casting_time to passive when not specified', () => {
        const feature = makeFeature({ type: 'resource_pool' })
        const result = resourceHandlers.resource_pool(feature, BASE_STATS)
        expect(result.casting_time).toBe('passive')
    })

    it('passes through automation values when provided', () => {
        const feature = makeFeature({
            type: 'resource_pool',
            resource: 'sorcery_points',
            uses_expression: 'proficiency_bonus',
            recharge_short_rest: '1',
            recharge_long_rest: '1',
            conversion: 'spell_slot_to_sp',
            reverseConversion: 'sp_to_spell_slot',
            reverseRecharge: 'short_rest',
            conversionRate: '1:1',
            casting_time: '1 action'
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
        expect(result.casting_time).toBe('1 action')
    })
})

describe('resourceHandlers – resource_restoration', () => {
    it('returns type, name, and hasAutomation', () => {
        const feature = makeFeature({ type: 'resource_restoration' }, 'Restore Points')
        const result = resourceHandlers.resource_restoration(feature, BASE_STATS)
        expect(result.type).toBe('resource_restoration')
        expect(result.name).toBe('Restore Points')
        expect(result.hasAutomation).toBe(true)
    })

    it('defaults trigger, recharge, casting_time, and uses_max', () => {
        const feature = makeFeature({ type: 'resource_restoration' })
        const result = resourceHandlers.resource_restoration(feature, BASE_STATS)
        expect(result.trigger).toBe('short_rest')
        expect(result.recharge).toBe('long_rest')
        expect(result.casting_time).toBe('passive')
        expect(result.uses_max).toBe(1)
    })

    it('returns 0 when restore_expression is absent or nullish', () => {
        expect(resourceHandlers.resource_restoration(makeFeature({ type: 'resource_restoration' }), BASE_STATS).restore_amount).toBe(0)
        expect(resourceHandlers.resource_restoration(makeFeature({ type: 'resource_restoration', restore_expression: null }), BASE_STATS).restore_amount).toBe(0)
    })

    it('resolves restore_expression to a numeric value', () => {
        const result = resourceHandlers.resource_restoration(makeFeature({ type: 'resource_restoration', restore_expression: 'proficiency_bonus' }), BASE_STATS)
        expect(result.restore_amount).toBe(3)
    })

    it('preserves uses_max of 0 without falling back to default', () => {
        const result = resourceHandlers.resource_restoration(makeFeature({ type: 'resource_restoration', uses_max: 0 }), BASE_STATS)
        expect(result.uses_max).toBe(0)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'resource_restoration',
            trigger: 'long_rest',
            restore_expression: 'proficiency_bonus',
            resourceKey: 'sorcery_points',
            uses_max: 3,
            recharge: 'short_rest',
            casting_time: '1 action'
        })
        const result = resourceHandlers.resource_restoration(feature, BASE_STATS)
        expect(result.trigger).toBe('long_rest')
        expect(result.restore_expression).toBe('proficiency_bonus')
        expect(result.restore_amount).toBe(3)
        expect(result.resourceKey).toBe('sorcery_points')
        expect(result.uses_max).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })
})
