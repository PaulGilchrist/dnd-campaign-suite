// @maintained-by-ai
// ── automationInfoBuilder.test-utils.test.js ─────────────────────────
// Pins the contract of the shared fixtures consumed by ~30 automationInfoBuilder
// test files (BASE_STATS, makeFeature) plus the mock-expressions factory's
// defaults and per-call isolation semantics.

import { describe, it, expect, vi } from 'vitest'
import {
    normalizeAbilityName,
    createMockAutomationExpressions,
    BASE_STATS,
    makeFeature,
} from './automationInfoBuilder.test-utils.js'

// ── normalizeAbilityName ─────────────────────────────────────────────

describe('normalizeAbilityName', () => {
    it.each([
        ['str', 'Strength'],
        ['STR', 'Strength'],
        ['dex', 'Dexterity'],
        ['con', 'Constitution'],
        ['int', 'Intelligence'],
        ['wis', 'Wisdom'],
        ['cha', 'Charisma'],
        ['dexterity', 'Dexterity'],
        ['Wisdom', 'Wisdom'],
        ['CHARISMA', 'Charisma'],
    ])('normalizes %p to %p', (input, expected) => {
        expect(normalizeAbilityName(input)).toBe(expected)
    })

    it('collapses internal whitespace before matching', () => {
        expect(normalizeAbilityName(' str ')).toBe('Strength')
        // whitespace collapse must still produce a non-matching key, not a hit
        expect(normalizeAbilityName('dexterity saving throw')).toBeNull()
    })

    it.each([null, undefined, '', 'foo', '123', 'strength ability'])(
        'returns null for %p',
        (input) => {
            expect(normalizeAbilityName(input)).toBeNull()
        },
    )
})

// ── createMockAutomationExpressions ──────────────────────────────────

describe('createMockAutomationExpressions', () => {
    let mockExprs

    beforeEach(() => {
        mockExprs = createMockAutomationExpressions()
    })

    it('returns the full expressions API envelope as vi.fn mocks', () => {
        expect(Object.keys(mockExprs).sort()).toEqual([
            'evaluateAutoExpression',
            'getSaveDc',
            'resolveDiceExpression',
            'resolveHealingPoolExpression',
            'resolveScaling',
            'resolveUses',
        ])
        for (const fn of Object.values(mockExprs)) {
            expect(vi.isMockFunction(fn)).toBe(true)
        }
    })

    it('each call returns an independent object with fresh mocks (no shared state)', () => {
        const a = createMockAutomationExpressions()
        const b = createMockAutomationExpressions()
        expect(a).not.toBe(b)
        a.resolveDiceExpression('1d6')
        expect(a.resolveDiceExpression.mock.calls).toHaveLength(1)
        expect(b.resolveDiceExpression.mock.calls).toHaveLength(0)
    })

    describe('evaluateAutoExpression', () => {
        it('returns 0 for falsy expressions and a constant 2 for any truthy expression', () => {
            expect(mockExprs.evaluateAutoExpression(null, BASE_STATS)).toBe(0)
            expect(mockExprs.evaluateAutoExpression(undefined, BASE_STATS)).toBe(0)
            expect(mockExprs.evaluateAutoExpression('proficiency_bonus', BASE_STATS)).toBe(2)
            expect(mockExprs.evaluateAutoExpression('1 + 2', BASE_STATS)).toBe(2)
        })
    })

    describe('resolveHealingPoolExpression', () => {
        it('returns base when scaling or stats is missing', () => {
            expect(mockExprs.resolveHealingPoolExpression('2d8', null, BASE_STATS)).toBe('2d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', undefined, BASE_STATS)).toBe('2d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', { '5': '3d8' }, null)).toBe('2d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', { '5': '3d8' }, undefined)).toBe('2d8')
        })

        it('resolves the highest applicable level tier, skipping non-numeric keys', () => {
            const scaling = { '5': '3d8', 'abc': '9d8', '11': '4d8' }
            expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { ...BASE_STATS, level: 4 })).toBe('2d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { ...BASE_STATS, level: 5 })).toBe('3d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { ...BASE_STATS, level: 15 })).toBe('4d8')
        })
    })

    describe('getSaveDc', () => {
        it('computes 8 + ability bonus + proficiency for any ability-name casing', () => {
            // WIS bonus=5, proficiency=3 => 8 + 5 + 3 = 16
            for (const ability of ['WIS', 'wis', 'wisdom']) {
                expect(mockExprs.getSaveDc(BASE_STATS, ability, 3)).toBe(16)
            }
            // CON bonus=3, proficiency=3 => 8 + 3 + 3 = 14
            expect(mockExprs.getSaveDc(BASE_STATS, 'CON', 3)).toBe(14)
        })

        it('treats unknown ability, missing abilities, and omitted proficiency as 0', () => {
            expect(mockExprs.getSaveDc(BASE_STATS, 'Unknown', 3)).toBe(11)
            expect(mockExprs.getSaveDc({ abilities: null }, 'WIS', 3)).toBe(11)
            expect(mockExprs.getSaveDc(BASE_STATS, 'WIS')).toBe(13)
        })
    })

    describe('resolveUses', () => {
        it.each([
            [5, 5],
            [0, 0],
            ['proficiency_bonus', 3],
            ['level', 5],
            ['anything', 5],
            [null, 5],
            [undefined, 5],
        ])('resolveUses(%p) => %p', (spec, expected) => {
            expect(mockExprs.resolveUses(BASE_STATS, spec)).toBe(expected)
        })
    })

    describe('resolveDiceExpression', () => {
        it('passes the expression through unchanged', () => {
            expect(mockExprs.resolveDiceExpression('2d8+4')).toBe('2d8+4')
            expect(mockExprs.resolveDiceExpression('')).toBe('')
        })
    })

    describe('resolveScaling', () => {
        it('returns the highest applicable entry and null for below-tier, empty, or missing scaling', () => {
            const scaling = [
                { level: 1, damage: '1d6' },
                { level: 5, damage: '2d6' },
                { level: 11, damage: '3d6' },
            ]
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 3 }, scaling)).toEqual({ level: 1, damage: '1d6' })
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 7 }, scaling)).toEqual({ level: 5, damage: '2d6' })
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 15 }, scaling)).toEqual({ level: 11, damage: '3d6' })
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 3 }, [{ level: 5, damage: '2d6' }])).toBeNull()
            expect(mockExprs.resolveScaling(BASE_STATS, [])).toBeNull()
            expect(mockExprs.resolveScaling(BASE_STATS, null)).toBeNull()
            expect(mockExprs.resolveScaling(BASE_STATS, undefined)).toBeNull()
        })
    })
})

// ── BASE_STATS / makeFeature ─────────────────────────────────────────

describe('BASE_STATS', () => {
    it('is the exact five-level fixture every consumer test depends on', () => {
        expect(BASE_STATS).toEqual({
            level: 5,
            proficiency: 3,
            abilities: [
                { name: 'Strength', bonus: 4 },
                { name: 'Dexterity', bonus: 2 },
                { name: 'Constitution', bonus: 3 },
                { name: 'Intelligence', bonus: 1 },
                { name: 'Wisdom', bonus: 5 },
                { name: 'Charisma', bonus: 2 },
            ],
        })
    })
})

describe('makeFeature', () => {
    it('wraps automation by reference with the default name', () => {
        const auto = { type: 'test', foo: 'bar', baz: 42 }
        const feature = makeFeature(auto)
        expect(feature).toEqual({ name: 'Test Feature', automation: auto })
        // automation is passed through by reference — consumers may mutate it
        expect(feature.automation).toBe(auto)
    })

    it('accepts a custom name', () => {
        expect(makeFeature({ type: 'test' }, 'Custom Name')).toEqual({
            name: 'Custom Name',
            automation: { type: 'test' },
        })
    })
})
