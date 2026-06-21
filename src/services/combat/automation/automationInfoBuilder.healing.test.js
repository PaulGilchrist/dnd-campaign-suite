// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { buildAttackInfo } from './automationInfoBuilder.js'
import { BASE_STATS, makeFeature } from './automationInfoBuilder.fixtures.js'

// Mock automationExpressions with simple, controlled return values.
// We intentionally keep mocks minimal — just enough to isolate the handler under test.
vi.mock('./automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (!expr) return 0
        return 2
    }),
    resolveHealingPoolExpression: vi.fn((base) => base),
    getSaveDc: vi.fn((_stats, _ability, _proficiency) => 15),
    resolveUses: vi.fn((_stats, usesSpec) => {
        if (typeof usesSpec === 'number') return usesSpec
        if (usesSpec === 'proficiency_bonus') return BASE_STATS.proficiency
        return BASE_STATS.level
    }),
    resolveDiceExpression: vi.fn((expr) => expr),
    resolveScaling: vi.fn((_stats, scaling) => {
        if (!scaling) return null
        let result = null
        for (const entry of scaling) {
            if (BASE_STATS.level >= entry.level) result = entry
        }
        return result
    }),
}))

import { evaluateAutoExpression, resolveHealingPoolExpression } from './automationExpressions.js'

describe('buildAttackInfo – free_spell', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'free_spell' })
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

    it('passes through all optional automation fields', () => {
        const feature = makeFeature({
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
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result).toEqual({
            type: 'free_spell',
            name: 'Test Feature',
            spell: 'fireball',
            uses: 3,
            uses_expression: '',
            usesMax: 3,
            recharge: 'short_rest',
            action: 'bonus_action',
            duration: '1 minute',
            concentration: true,
            noConcentration: true,
            resourceCost: 'spell_slot',
            freeCasts: '2',
            casting_time: '1 reaction',
            perSpellTracking: true,
            hasAutomation: true,
        })
    })
})

describe('buildAttackInfo – healing', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'healing' })
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
            casting_time: '',
            hasAutomation: true,
        })
    })

    it('evaluates healExpression and calls evaluateAutoExpression with correct args', () => {
        const feature = makeFeature({
            type: 'healing',
            healExpression: '2d8',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.healAmount).toBe(2)
        expect(result.healExpression).toBe('2d8')
        expect(evaluateAutoExpression).toHaveBeenCalledWith(
            '2d8',
            BASE_STATS,
            BASE_STATS.proficiency,
            BASE_STATS.level,
        )
    })

    it('returns null for uses when not specified, explicit number when provided', () => {
        const noUses = buildAttackInfo(makeFeature({ type: 'healing' }), BASE_STATS)
        expect(noUses.uses).toBeNull()
        expect(noUses.usesMax).toBeNull()

        const withUses = buildAttackInfo(
            makeFeature({ type: 'healing', uses: 5 }),
            BASE_STATS,
        )
        expect(withUses.uses).toBe(5)
        expect(withUses.usesMax).toBe(5)
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'healing',
            healExpression: '3d6',
            action: 'bonus_action',
            uses: 5,
            recharge: 'short_rest',
            casting_time: '1 reaction',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.healExpression).toBe('3d6')
        expect(result.action).toBe('bonus_action')
        expect(result.uses).toBe(5)
        expect(result.usesMax).toBe(5)
        expect(result.recharge).toBe('short_rest')
        expect(result.casting_time).toBe('1 reaction')
    })
})

describe('buildAttackInfo – healing_pool', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns correct structure with defaults', () => {
        const feature = makeFeature({ type: 'healing_pool' })
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
            maxDicePerUse: '',
            hasAutomation: true,
        })
    })

    it('generates resourceKey from feature name (lowercase name + Pool suffix)', () => {
        const feature = makeFeature({ type: 'healing_pool' }, 'Lay on Hands')
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.resourceKey).toBe('layonhandsPool')
    })

    it('calls resolveHealingPoolExpression with base expression and scaling', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '2d8',
            scaling: { 5: '3d8' },
        })
        buildAttackInfo(feature, BASE_STATS)

        expect(resolveHealingPoolExpression).toHaveBeenCalledWith(
            '2d8',
            { 5: '3d8' },
            BASE_STATS,
        )
    })

    it('detects dice pool from resolved expression pattern (N dM format)', () => {
        resolveHealingPoolExpression.mockReturnValue('4d8')

        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '4d8',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.isDicePool).toBe(true)
        expect(result.pool).toBe(4)
        expect(result.dieType).toBe(8)
        // When dice pattern detected, pool is the count (not evaluated), dieType is extracted
        expect(evaluateAutoExpression).not.toHaveBeenCalled()

        // Restore default mock to prevent bleeding into subsequent tests
        resolveHealingPoolExpression.mockRestore()
    })

    it('evaluates numeric (non-dice) expressions as a single value', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '10',
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.isDicePool).toBe(false)
        expect(result.pool).toBe(2) // evaluateAutoExpression mock returns 2
        expect(result.dieType).toBeNull()
        expect(evaluateAutoExpression).toHaveBeenCalledWith(
            '10',
            BASE_STATS,
            BASE_STATS.proficiency,
            BASE_STATS.level,
        )
    })

    it('uses explicit isDicePool flag when expression is not a dice pattern', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '10',
            isDicePool: true,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.isDicePool).toBe(true)
        expect(result.dieType).toBe(6) // default dieType when not specified
        // When explicit isDicePool with non-dice expression, evaluateAutoExpression is called
        expect(evaluateAutoExpression).toHaveBeenCalledWith(
            '10',
            BASE_STATS,
            BASE_STATS.proficiency,
            BASE_STATS.level,
        )
    })

    it('uses explicit dieType when isDicePool is set', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '10',
            isDicePool: true,
            dieType: 10,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.dieType).toBe(10)
    })

    it('passes through optional fields', () => {
        const feature = makeFeature({
            type: 'healing_pool',
            poolExpression: '3d6',
            action: 'bonus_action',
            recharge: 'short_rest',
            alsoCures: ['poisoned'],
            cureCost: 10,
            range: '30 ft',
            resourceCost: 'spell_slot',
            maxDicePerUse: 3,
        })
        const result = buildAttackInfo(feature, BASE_STATS)

        expect(result.action).toBe('bonus_action')
        expect(result.recharge).toBe('short_rest')
        expect(result.alsoCures).toEqual(['poisoned'])
        expect(result.cureCost).toBe(10)
        expect(result.range).toBe('30 ft')
        expect(result.resourceCost).toBe('spell_slot')
        expect(result.maxDicePerUse).toBe(3)
    })
})

describe('buildAttackInfo – null/unknown handling', () => {
    it('returns null when feature has no automation', () => {
        const result = buildAttackInfo({ name: 'No Automation' }, BASE_STATS)
        expect(result).toBeNull()
    })

    it('returns null when automation type is unknown', () => {
        const feature = makeFeature({ type: 'unknown_type' })
        const result = buildAttackInfo(feature, BASE_STATS)
        expect(result).toBeNull()
    })
})
