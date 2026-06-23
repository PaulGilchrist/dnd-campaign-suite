// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

vi.mock('./automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr, _stats) => {
        if (!expr) return 0
        return 2
    }),
    resolveHealingPoolExpression: vi.fn((base, scaling, stats) => {
        if (!scaling) return base
        if (!stats) return base
        const entries = Object.entries(scaling)
            .map(([k, v]) => ({ level: parseInt(k, 10), expression: String(v) }))
            .filter(e => !isNaN(e.level))
            .sort((a, b) => a.level - b.level)
        let resolved = base
        for (const entry of entries) {
            if (stats.level >= entry.level) resolved = entry.expression
        }
        return resolved
    }),
    getSaveDc: vi.fn((stats, ability, proficiency) => {
        const canonical = ability?.toLowerCase().replace(/\s+/g, '') || ''
        const abilityMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
        const name = abilityMap[canonical] || null
        const bonus = stats.abilities?.find(a => a.name === name)?.bonus ?? 0
        return 8 + bonus + (proficiency || 0)
    }),
    resolveUses: vi.fn((stats, usesSpec) => {
        if (typeof usesSpec === 'number') return usesSpec
        if (usesSpec === 'proficiency_bonus') return stats.proficiency || 0
        return stats.level || 1
    }),
    resolveDiceExpression: vi.fn((expr) => expr),
    resolveScaling: vi.fn((stats, scaling) => {
        if (!scaling) return null
        let result = null
        for (const entry of scaling) {
            if (stats.level >= entry.level) result = entry
        }
        return result
    }),
}))

describe('buildAttackInfo – bardic_inspiration', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct default structure', () => {
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'bardic_inspiration',
            name: 'Test Feature',
            range: '60_ft',
            action: 'bonus_action',
            usesMax: 0,
            usesRecharge: 'long_rest',
            dieSize: 6,
            hasAutomation: true,
        })
    })

    it('evaluates uses_expression via evaluateAutoExpression', () => {
        const feature = makeFeature({ type: 'bardic_inspiration', uses_expression: '2d6' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.usesMax).toBe(2)
    })

    it('defaults usesMax to 0 when no uses_expression', () => {
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.usesMax).toBe(0)
    })

    it('reads dieSize from matching class_levels entry', () => {
        const bardStats = {
            ...BASE_STATS,
            level: 2,
            class: {
                class_levels: [
                    { level: 1, bardic_die: 6 },
                    { level: 2, bardic_die: 8 },
                ],
            },
        }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, bardStats)

        expect(result.dieSize).toBe(8)
    })

    it('defaults dieSize to 6 when class_levels is empty array', () => {
        const bardStats = {
            ...BASE_STATS,
            level: 2,
            class: { class_levels: [] },
        }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, bardStats)

        expect(result.dieSize).toBe(6)
    })

    it('defaults dieSize to 6 when stats has no class property', () => {
        const stats = { ...BASE_STATS }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, stats)

        expect(result.dieSize).toBe(6)
    })

    it('defaults dieSize to 6 when no class_levels entry matches level', () => {
        const bardStats = {
            ...BASE_STATS,
            level: 10,
            class: {
                class_levels: [
                    { level: 1, bardic_die: 6 },
                    { level: 5, bardic_die: 8 },
                ],
            },
        }
        const feature = makeFeature({ type: 'bardic_inspiration' })
        const result = buildAttackInfo(feature, bardStats)

        expect(result.dieSize).toBe(6)
    })

    it('applies optional fields from automation config', () => {
        const feature = makeFeature({
            type: 'bardic_inspiration',
            range: '30_ft',
            action: 'action',
            recharge: 'short_rest',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.range).toBe('30_ft')
        expect(result.action).toBe('action')
        expect(result.usesRecharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – bardic_inspiration_defense', () => {
    it('returns minimal structure with hasAutomation true', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_defense' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'bardic_inspiration_defense',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })

    it('passes through the feature name', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_defense' }, 'Defensive Inspiration')
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.name).toBe('Defensive Inspiration')
    })
})

describe('buildAttackInfo – bardic_inspiration_offense', () => {
    it('returns minimal structure with hasAutomation true', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_offense' })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'bardic_inspiration_offense',
            name: 'Test Feature',
            hasAutomation: true,
        })
    })

    it('passes through the feature name', () => {
        const feature = makeFeature({ type: 'bardic_inspiration_offense' }, 'Offensive Inspiration')
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.name).toBe('Offensive Inspiration')
    })
})
