import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE } from './automationInfoBuilder.fixtures.js'

describe('buildAttackInfo – post_cast_self_heal', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'post_cast_self_heal' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'post_cast_self_heal',
            name: 'Test Feature',
            healExpression: '0',
            othersOnly: true,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'post_cast_self_heal',
                healExpression: '2d8',
                othersOnly: false,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.healExpression).toBe('2d8')
        expect(result.othersOnly).toBe(false)
    })
})

describe('buildAttackInfo – multi_target_spread', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'multi_target_spread' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'multi_target_spread',
            name: 'Test Feature',
            spellFilter: [],
            range: '10 ft',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'multi_target_spread',
                spellFilter: ['fireball', 'lightning_bolt'],
                range: '30 ft',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.spellFilter).toEqual(['fireball', 'lightning_bolt'])
        expect(result.range).toBe('30 ft')
    })
})

describe('buildAttackInfo – jack_of_all_trades', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'jack_of_all_trades' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'jack_of_all_trades',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })
})

describe('buildAttackInfo – divine_order', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'divine_order' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'divine_order',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })
})
