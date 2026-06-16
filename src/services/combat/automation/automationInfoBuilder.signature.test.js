import { describe, it, expect } from 'vitest'
import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – signature_spells', () => {
    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, name: 'Signature Spells', automation: { type: 'signature_spells' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'signature_spells',
            name: 'Signature Spells',
            action: 'action',
            casting_time: 'passive',
            hasAutomation: true,
        })
    })

    it('includes action when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            name: 'Signature Spells',
            automation: { type: 'signature_spells', action: 'bonus_action' },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
    })
})
