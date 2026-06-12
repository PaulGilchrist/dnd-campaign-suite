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

import { evaluateAutoExpression, resolveHealingPoolExpression } from './automationExpressions.js'

describe('buildAttackInfo – free_spell', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'free_spell' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'free_spell',
            name: 'Test Feature',
            spell: '',
            uses: 1,
            uses_expression: '',
            usesMax: 1,
            recharge: 'long_rest',
            action: 'action',
            duration: '',
            concentration: false,
            noConcentration: false,
            resourceCost: '',
            freeCasts: '',
            casting_time: '',
            perSpellTracking: false,
            hasAutomation: true,
        })
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'free_spell',
                spell: 'fireball',
                uses: 3,
                recharge: 'short_rest',
                action: 'bonus_action',
                duration: '1 minute',
                concentration: true,
                noConcentration: true,
                resourceCost: 'spell_slot',
                freeCasts: '2',
                casting_time: '1 reaction',
                perSpellTracking: true,
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.spell).toBe('fireball')
        expect(result.uses).toBe(3)
        expect(result.recharge).toBe('short_rest')
        expect(result.action).toBe('bonus_action')
        expect(result.duration).toBe('1 minute')
        expect(result.concentration).toBe(true)
        expect(result.noConcentration).toBe(true)
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.freeCasts).toBe('2')
        expect(result.casting_time).toBe('1 reaction')
        expect(result.perSpellTracking).toBe(true)
    })
})

describe('buildAttackInfo – healing', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'healing' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'healing',
            name: 'Test Feature',
            healAmount: 0,
            healExpression: '',
            action: 'action',
            uses: null,
            usesMax: null,
            recharge: 'long_rest',
            hasAutomation: true,
        })
    })

    it('evaluates healExpression when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'healing',
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
                type: 'healing',
                healExpression: '3d6',
                action: 'bonus_action',
                uses: 5,
                recharge: 'short_rest',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.healExpression).toBe('3d6')
        expect(result.action).toBe('bonus_action')
        expect(result.uses).toBe(5)
        expect(result.usesMax).toBe(5)
        expect(result.recharge).toBe('short_rest')
    })
})

describe('buildAttackInfo – healing_pool', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'healing_pool' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toEqual({
            type: 'healing_pool',
            name: 'Test Feature',
            pool: 0,
            poolExpression: '',
            isDicePool: false,
            dieType: null,
            action: 'action',
            recharge: 'long_rest',
            alsoCures: [],
            cureCost: 5,
            range: '',
            resourceCost: '',
            resourceKey: 'testfeaturePool',
            hasAutomation: true,
        })
    })

    it('generates resourceKey from feature name', () => {
        const feature = { ...BASE_FEATURE, automation: { type: 'healing_pool' } }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.resourceKey).toBe('testfeaturePool')
    })

    it('evaluates pool expression via resolveHealingPoolExpression', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'healing_pool',
                poolExpression: '2d8',
                scaling: {
                    5: '3d8',
                },
            },
        }
        buildAttackInfo(feature, BASE_STATS)
        expect(resolveHealingPoolExpression).toHaveBeenCalledWith('2d8', { 5: '3d8' }, BASE_STATS)
    })

    it('detects dice pool format and extracts values', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'healing_pool',
                poolExpression: '4d8',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.isDicePool).toBe(true)
        expect(result.pool).toBe(4)
        expect(result.dieType).toBe(8)
    })

    it('detects dice pool format in resolved expression', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'healing_pool',
                poolExpression: '2d8',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        // resolveHealingPoolExpression returns '2d8' which matches dice format
        expect(result.isDicePool).toBe(true)
        expect(result.pool).toBe(2)
        expect(result.dieType).toBe(8)
    })

    it('includes optional fields when provided', () => {
        const feature = {
            ...BASE_FEATURE,
            automation: {
                type: 'healing_pool',
                poolExpression: '3d6',
                action: 'bonus_action',
                recharge: 'short_rest',
                alsoCures: ['poisoned'],
                cureCost: 10,
                range: '30 ft',
                resourceCost: 'spell_slot',
            },
        }
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result.action).toBe('bonus_action')
        expect(result.recharge).toBe('short_rest')
        expect(result.alsoCures).toEqual(['poisoned'])
        expect(result.cureCost).toBe(10)
        expect(result.range).toBe('30 ft')
        expect(result.resourceCost).toBe('spell_slot')
    })
})
