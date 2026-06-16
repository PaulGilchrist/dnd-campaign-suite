import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, BASE_FEATURE, normalizeAbilityName } from './automationInfoBuilder.fixtures.js'

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
        const canonical = normalizeAbilityName(ability)
        const bonus = stats.abilities?.find(a => a.name === canonical)?.bonus ?? 0
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

import { evaluateAutoExpression } from './automationExpressions.js'

describe('buildAttackInfo – sorcery_aura', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'sorcery_aura' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'sorcery_aura',
            name: 'Test Feature',
            uses_max: 2,
            recharge: 'long_rest',
            casting_time: '1 bonus action',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'sorcery_aura',
                recharge: 'short_rest',
                casting_time: '1 action',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 action')
    })
})

describe('buildAttackInfo – resource_restoration', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'resource_restoration' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'resource_restoration',
            name: 'Test Feature',
            trigger: 'short_rest',
            casting_time: 'passive',
            restore_amount: 0,
            restore_expression: '',
            resourceKey: '',
            uses_max: 1,
            recharge: 'long_rest',
            hasAutomation: true,
        })
    })

    it('evaluates restore_expression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'resource_restoration',
                restore_expression: '2d6',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.restore_amount).toBe(2)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('2d6', BASE_STATS)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'resource_restoration',
                trigger: 'long_rest',
                casting_time: '1 bonus action',
                restore_expression: '3d6',
                resourceKey: 'customKey',
                uses_max: 3,
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.trigger).toBe('long_rest')
        expect(result.casting_time).toBe('1 bonus action')
        expect(result.restore_expression).toBe('3d6')
        expect(result.resourceKey).toBe('customKey')
        expect(result.uses_max).toBe(3)
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – sorcery_incarnate', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'sorcery_incarnate' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'sorcery_incarnate',
            name: 'Test Feature',
            casting_time: '1 bonus action',
            cost: 2,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'sorcery_incarnate',
                casting_time: '1 action',
                cost: 5,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.casting_time).toBe('1 action')
        expect(result.cost).toBe(5)
    })
})
