// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – signature_spells', () => {
    it('returns null when automation is absent', () => {
        const feature = makeFeature(null)
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation type has no handler', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'signature_spells' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.type).toBe('signature_spells')
        expect(result.name).toBe('Test Feature')
        expect(result.action).toBe('action')
        expect(result.casting_time).toBe('passive')
        expect(result.hasAutomation).toBe(true)
    })

    it('passes through custom action', () => {
        const feature = makeFeature({
            type: 'signature_spells',
            action: 'bonus_action',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })

    it('passes through custom casting_time', () => {
        const feature = makeFeature({
            type: 'signature_spells',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 reaction')
    })

    it('respects feature name from feature object', () => {
        const feature = makeFeature({ type: 'signature_spells' }, 'Custom Name')
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.name).toBe('Custom Name')
    })
})
