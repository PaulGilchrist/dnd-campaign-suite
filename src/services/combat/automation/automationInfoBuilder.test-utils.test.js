// ── automationInfoBuilder.fixtures.test.js ───────────────────────────
// Tests for automationInfoBuilder.test-utils.js — the utility functions
// that support the handler tests.

import { describe, it, expect } from 'vitest'
import {
    normalizeAbilityName,
    createMockAutomationExpressions,
    BASE_STATS,
    makeFeature,
    BASE_FEATURE,
} from './automationInfoBuilder.test-utils.js'

// ── normalizeAbilityName ─────────────────────────────────────────────

describe('normalizeAbilityName', () => {
    const abilityPairs = [
        ['str', 'Strength'],
        ['STR', 'Strength'],
        ['Str', 'Strength'],
        ['dex', 'Dexterity'],
        ['DEX', 'Dexterity'],
        ['DeX', 'Dexterity'],
        ['con', 'Constitution'],
        ['CON', 'Constitution'],
        ['CoN', 'Constitution'],
        ['int', 'Intelligence'],
        ['INT', 'Intelligence'],
        ['wis', 'Wisdom'],
        ['WIS', 'Wisdom'],
        ['cha', 'Charisma'],
        ['CHA', 'Charisma'],
        ['strength', 'Strength'],
        ['STRENGTH', 'Strength'],
        ['dexterity', 'Dexterity'],
        ['DEXTERITY', 'Dexterity'],
        ['constitution', 'Constitution'],
        ['CONSTITUTION', 'Constitution'],
        ['intelligence', 'Intelligence'],
        ['INTELLIGENCE', 'Intelligence'],
        ['wisdom', 'Wisdom'],
        ['WISDOM', 'Wisdom'],
        ['charisma', 'Charisma'],
        ['CHARISMA', 'Charisma'],
    ]

    it.each(abilityPairs)('normalizes %p to %p', (input, expected) => {
        expect(normalizeAbilityName(input)).toBe(expected)
    })

    it.each([null, undefined, ''])('returns null for falsy input: %p', (input) => {
        expect(normalizeAbilityName(input)).toBeNull()
    })

    it('returns null for unknown ability names', () => {
        expect(normalizeAbilityName('foo')).toBeNull()
        expect(normalizeAbilityName('bar')).toBeNull()
        expect(normalizeAbilityName('123')).toBeNull()
    })

    it('returns null for names with extra words that produce non-matching keys', () => {
        expect(normalizeAbilityName('strength ability')).toBeNull()
        expect(normalizeAbilityName('dexterity saving throw')).toBeNull()
        expect(normalizeAbilityName('charisma check')).toBeNull()
    })
})

// ── createMockAutomationExpressions ──────────────────────────────────

describe('createMockAutomationExpressions', () => {
    let mockExprs

    beforeEach(() => {
        mockExprs = createMockAutomationExpressions()
    })

    describe('evaluateAutoExpression', () => {
        it('returns 0 for null/undefined expression', () => {
            expect(mockExprs.evaluateAutoExpression(null, BASE_STATS)).toBe(0)
            expect(mockExprs.evaluateAutoExpression(undefined, BASE_STATS)).toBe(0)
        })

        it('returns 2 for any truthy expression', () => {
            expect(mockExprs.evaluateAutoExpression('proficiency_bonus', BASE_STATS)).toBe(2)
            expect(mockExprs.evaluateAutoExpression('level', BASE_STATS)).toBe(2)
            expect(mockExprs.evaluateAutoExpression('1 + 2', BASE_STATS)).toBe(2)
        })
    })

    describe('resolveHealingPoolExpression', () => {
        it('returns base when no scaling provided', () => {
            expect(mockExprs.resolveHealingPoolExpression('2d8', null, BASE_STATS)).toBe('2d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', undefined, BASE_STATS)).toBe('2d8')
        })

        it('returns base when stats is null/undefined', () => {
            expect(mockExprs.resolveHealingPoolExpression('2d8', { '5': '3d8' }, null)).toBe('2d8')
            expect(mockExprs.resolveHealingPoolExpression('2d8', { '5': '3d8' }, undefined)).toBe('2d8')
        })

        it('resolves scaling by level', () => {
            const stats = { ...BASE_STATS, level: 5 }
            expect(mockExprs.resolveHealingPoolExpression('2d8', { '5': '3d8', '11': '4d8' }, stats)).toBe('3d8')
        })

        it('uses highest applicable level tier', () => {
            const stats = { ...BASE_STATS, level: 15 }
            expect(mockExprs.resolveHealingPoolExpression('2d8', { '5': '3d8', '11': '4d8' }, stats)).toBe('4d8')
        })

        it('skips non-numeric scaling keys', () => {
            const stats = { ...BASE_STATS, level: 5 }
            expect(mockExprs.resolveHealingPoolExpression('2d8', { 'abc': '3d8', '11': '4d8' }, stats)).toBe('2d8')
        })
    })

    describe('getSaveDc', () => {
        it('computes DC from ability bonus and proficiency', () => {
            // WIS bonus=5, proficiency=3 => 8 + 5 + 3 = 16
            expect(mockExprs.getSaveDc(BASE_STATS, 'WIS', 3)).toBe(16)
            // CON bonus=3, proficiency=3 => 8 + 3 + 3 = 14
            expect(mockExprs.getSaveDc(BASE_STATS, 'CON', 3)).toBe(14)
        })

        it('normalizes ability name internally', () => {
            expect(mockExprs.getSaveDc(BASE_STATS, 'wis', 3)).toBe(16)
            expect(mockExprs.getSaveDc(BASE_STATS, 'WIS', 3)).toBe(16)
            expect(mockExprs.getSaveDc(BASE_STATS, 'wisdom', 3)).toBe(16)
        })

        it('uses 0 ability bonus when ability is not found', () => {
            expect(mockExprs.getSaveDc(BASE_STATS, 'Unknown', 3)).toBe(11)
        })

        it('defaults proficiency to 0 when not provided', () => {
            expect(mockExprs.getSaveDc(BASE_STATS, 'WIS')).toBe(13)
        })

        it('handles stats with missing abilities gracefully', () => {
            expect(mockExprs.getSaveDc({ abilities: null }, 'WIS', 3)).toBe(11)
        })
    })

    describe('resolveUses', () => {
        it('returns a number directly', () => {
            expect(mockExprs.resolveUses(BASE_STATS, 5)).toBe(5)
            expect(mockExprs.resolveUses(BASE_STATS, 0)).toBe(0)
        })

        it('returns proficiency for "proficiency_bonus" string', () => {
            expect(mockExprs.resolveUses(BASE_STATS, 'proficiency_bonus')).toBe(3)
        })

        it('returns stats level for any other string value', () => {
            expect(mockExprs.resolveUses(BASE_STATS, 'level')).toBe(5)
            expect(mockExprs.resolveUses(BASE_STATS, 'anything')).toBe(5)
        })

        it('returns stats level for null/undefined', () => {
            expect(mockExprs.resolveUses(BASE_STATS, null)).toBe(5)
            expect(mockExprs.resolveUses(BASE_STATS, undefined)).toBe(5)
        })
    })

    describe('resolveDiceExpression', () => {
        it('returns the expression as-is', () => {
            expect(mockExprs.resolveDiceExpression('2d8+4')).toBe('2d8+4')
            expect(mockExprs.resolveDiceExpression('1d6')).toBe('1d6')
        })
    })

    describe('resolveScaling', () => {
        it('returns null for null/undefined scaling', () => {
            expect(mockExprs.resolveScaling(BASE_STATS, null)).toBeNull()
            expect(mockExprs.resolveScaling(BASE_STATS, undefined)).toBeNull()
        })

        it('returns highest applicable scaling entry', () => {
            const scaling = [
                { level: 1, damage: '1d6' },
                { level: 5, damage: '2d6' },
                { level: 11, damage: '3d6' },
            ]
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 3 }, scaling)).toEqual({ level: 1, damage: '1d6' })
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 7 }, scaling)).toEqual({ level: 5, damage: '2d6' })
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 15 }, scaling)).toEqual({ level: 11, damage: '3d6' })
        })

        it('returns null when stats level is below all scaling entries', () => {
            const scaling = [
                { level: 5, damage: '2d6' },
                { level: 11, damage: '3d6' },
            ]
            expect(mockExprs.resolveScaling({ ...BASE_STATS, level: 3 }, scaling)).toBeNull()
        })

        it('returns null for empty scaling array', () => {
            expect(mockExprs.resolveScaling(BASE_STATS, [])).toBeNull()
        })
    })
})

// ── BASE_STATS ───────────────────────────────────────────────────────

describe('BASE_STATS', () => {
    it('has correct level, proficiency, and six ability scores', () => {
        expect(BASE_STATS.level).toBe(5)
        expect(BASE_STATS.proficiency).toBe(3)
        expect(BASE_STATS.abilities).toHaveLength(6)

        const abilityMap = {}
        for (const ab of BASE_STATS.abilities) {
            abilityMap[ab.name] = ab.bonus
        }

        expect(abilityMap).toEqual({
            Strength: 4,
            Dexterity: 2,
            Constitution: 3,
            Intelligence: 1,
            Wisdom: 5,
            Charisma: 2,
        })
    })
})

// ── BASE_FEATURE ─────────────────────────────────────────────────────

describe('BASE_FEATURE', () => {
    it('is an object with a name property', () => {
        expect(BASE_FEATURE).toEqual({ name: 'Test Feature' })
    })
})

// ── makeFeature ──────────────────────────────────────────────────────

describe('makeFeature', () => {
    it('creates a feature with name and automation', () => {
        const feature = makeFeature({ type: 'test' })
        expect(feature).toEqual({ name: 'Test Feature', automation: { type: 'test' } })
    })

    it('uses custom name when provided', () => {
        const feature = makeFeature({ type: 'test' }, 'Custom Name')
        expect(feature.name).toBe('Custom Name')
        expect(feature.automation).toEqual({ type: 'test' })
    })

    it('preserves all automation properties', () => {
        const auto = { type: 'test', foo: 'bar', baz: 42 }
        const feature = makeFeature(auto)
        expect(feature.automation).toEqual(auto)
    })
})
