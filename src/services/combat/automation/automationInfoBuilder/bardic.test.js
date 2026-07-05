// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest'
import { bardicHandlers } from './bardic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('bardicHandlers – bardic_inspiration', () => {
    it('returns correct info with defaults', () => {
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'bardic_inspiration',
            name: 'Test Feature',
            range: '60_ft',
            action: 'bonus_action',
            usesRecharge: 'long_rest',
            dieSize: 6,
            usesMax: 0,
            hasAutomation: true,
        })
    })

    it('resolves uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({
            type: 'bardic_inspiration',
            uses_expression: 'proficiency_bonus',
        })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)
        expect(result.usesMax).toBe(3)
    })

    it('reads dieSize from matching class_levels entry', () => {
        const stats = {
            ...BASE_STATS,
            class: {
                ...BASE_STATS.class,
                class_levels: [{ level: 5, bardic_die: 8 }],
            },
        }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = bardicHandlers.bardic_inspiration(feature, stats)
        expect(result.dieSize).toBe(8)
    })

    it('defaults dieSize to 6 when class_levels is empty or missing', () => {
        const stats1 = { ...BASE_STATS, class: { ...BASE_STATS.class, class_levels: [] } }
        const stats2 = { ...BASE_STATS, class: undefined }
        const feature = makeFeature({ type: 'bardic_inspiration' })

        expect(bardicHandlers.bardic_inspiration(feature, stats1).dieSize).toBe(6)
        expect(bardicHandlers.bardic_inspiration(feature, stats2).dieSize).toBe(6)
    })

    it('uses explicit fields from automation over defaults', () => {
        const feature = makeFeature({
            type: 'bardic_inspiration',
            range: '30_ft',
            action: 'action',
            recharge: 'short_rest',
        })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})

describe('bardicHandlers – bardic_inspiration_defense', () => {
    it('returns correct info with defaults', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_defense' })
        const result = bardicHandlers.bardic_inspiration_defense(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'bardic_inspiration_defense',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })
})

describe('bardicHandlers – bardic_inspiration_offense', () => {
    it('returns correct info with defaults', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_offense' })
        const result = bardicHandlers.bardic_inspiration_offense(feature, BASE_STATS)

        expect(result).toMatchObject({
            type: 'bardic_inspiration_offense',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })
})
