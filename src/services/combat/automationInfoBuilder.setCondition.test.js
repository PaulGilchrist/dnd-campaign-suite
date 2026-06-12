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

describe('buildAttackInfo – self_healing', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'self_healing' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'self_healing',
            name: 'Test Feature',
            healAmount: 0,
            healExpression: '',
            action: 'action',
            uses: 1,
            usesMax: 1,
            recharge: 'short_rest',
            bloodiedOnly: false,
            hasAutomation: true,
        })
    })

    it('evaluates healExpression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'self_healing',
                healExpression: '2d8',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.healAmount).toBe(2)
        expect(evaluateAutoExpression).toHaveBeenCalledWith('2d8', BASE_STATS, 3, 5)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'self_healing',
                healExpression: '3d6',
                action: 'bonus_action',
                uses: 5,
                recharge: 'long_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.healExpression).toBe('3d6')
        expect(result.action).toBe('bonus_action')
        expect(result.uses).toBe(5)
        expect(result.usesMax).toBe(5)
        expect(result.recharge).toBe('long_rest')
    })
})

describe('buildAttackInfo – divine_spark', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'divine_spark' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'divine_spark',
            name: 'Test Feature',
            range: '30 ft',
            healExpression: '',
            damageExpression: '',
            damageTypes: [],
            saveType: 'CON',
            resourceCost: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'divine_spark',
                range: '60 ft',
                healExpression: '2d8',
                damageExpression: '3d6',
                damageTypes: ['fire', 'radiant'],
                saveType: 'DEX',
                resourceCost: 'spell_slot',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.range).toBe('60 ft')
        expect(result.healExpression).toBe('2d8')
        expect(result.damageExpression).toBe('3d6')
        expect(result.damageTypes).toEqual(['fire', 'radiant'])
        expect(result.saveType).toBe('DEX')
        expect(result.resourceCost).toBe('spell_slot')
    })
})

describe('buildAttackInfo – set_condition', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'set_condition' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'set_condition',
            name: 'Test Feature',
            target: undefined,
            condition: undefined,
            additionalCondition: null,
            cost: '',
            range: '60 ft',
            saveType: 'STR',
            effect: '',
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'set_condition',
                target: 'enemy',
                condition: 'prone',
                additionalCondition: 'restrained',
                cost: '1 resource',
                range: '30 ft',
                saveType: 'DEX',
                effect: 'condition_effect',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.target).toBe('enemy')
        expect(result.condition).toBe('prone')
        expect(result.additionalCondition).toBe('restrained')
        expect(result.cost).toBe('1 resource')
        expect(result.range).toBe('30 ft')
        expect(result.saveType).toBe('DEX')
        expect(result.effect).toBe('condition_effect')
    })
})
