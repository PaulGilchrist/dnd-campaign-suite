import { describe, it, expect } from 'vitest'
import { bardicHandlers } from './bardic.js'
import { BASE_STATS, makeFeature } from '../automationInfoBuilder.fixtures.js'

describe('bardicHandlers – bardic_inspiration', () => {
    it('returns bardic_inspiration info with defaults', () => {
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)
        expect(result.type).toBe('bardic_inspiration')
        expect(result.name).toBe('Test Feature')
        expect(result.range).toBe('60_ft')
        expect(result.action).toBe('bonus_action')
        expect(result.usesMax).toBe(0)
        expect(result.dieSize).toBe(6)
        expect(result.hasAutomation).toBe(true)
    })

    it('resolves uses_expression', () => {
        const feature = makeFeature({
            type: 'bardic_inspiration',
            uses_expression: 'proficiency_bonus'
        })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)
        expect(result.usesMax).toBe(3) // mocked value
    })

    it('reads bardic_die from class_levels', () => {
        const stats = {
            ...BASE_STATS,
            class: {
                ...BASE_STATS.class,
                class_levels: [{ level: 5, bardic_die: 8 }]
            }
        }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = bardicHandlers.bardic_inspiration(feature, stats)
        expect(result.dieSize).toBe(8)
    })

    it('passes through custom fields', () => {
        const feature = makeFeature({
            type: 'bardic_inspiration',
            range: '30_ft',
            action: 'action',
            uses: 3,
            recharge: 'short_rest'
        })
        const result = bardicHandlers.bardic_inspiration(feature, BASE_STATS)
        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})

describe('bardicHandlers – bardic_inspiration_defense', () => {
    it('returns bardic_inspiration_defense info', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_defense' })
        const result = bardicHandlers.bardic_inspiration_defense(feature, BASE_STATS)
        expect(result.type).toBe('bardic_inspiration_defense')
        expect(result.hasAutomation).toBe(true)
    })
})

describe('bardicHandlers – bardic_inspiration_offense', () => {
    it('returns bardic_inspiration_offense info', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_offense' })
        const result = bardicHandlers.bardic_inspiration_offense(feature, BASE_STATS)
        expect(result.type).toBe('bardic_inspiration_offense')
        expect(result.hasAutomation).toBe(true)
    })
})
