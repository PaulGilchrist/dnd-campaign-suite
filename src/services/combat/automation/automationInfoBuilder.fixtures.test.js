// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
    normalizeAbilityName,
    createMockAutomationExpressions,
    BASE_STATS,
    BASE_FEATURE,
    makeFeature,
} from './automationInfoBuilder.fixtures.js';

describe('automationInfoBuilder.fixtures', () => {
    describe('normalizeAbilityName', () => {
        const canonicalPairs = [
            ['str', 'Strength'],
            ['dex', 'Dexterity'],
            ['con', 'Constitution'],
            ['int', 'Intelligence'],
            ['wis', 'Wisdom'],
            ['cha', 'Charisma'],
            ['STR', 'Strength'],
            ['DEX', 'Dexterity'],
            ['CON', 'Constitution'],
            ['INT', 'Intelligence'],
            ['WIS', 'Wisdom'],
            ['CHA', 'Charisma'],
            ['Strength', 'Strength'],
            ['Dexterity', 'Dexterity'],
            ['Constitution', 'Constitution'],
            ['Intelligence', 'Intelligence'],
            ['Wisdom', 'Wisdom'],
            ['Charisma', 'Charisma'],
            ['StReNgTh', 'Strength'],
            ['InTeLlIgEnCe', 'Intelligence'],
        ];

        it('returns canonical ability name for all accepted inputs', () => {
            for (const [input, expected] of canonicalPairs) {
                expect(normalizeAbilityName(input)).toBe(expected);
            }
        });

        it('returns null for falsy inputs', () => {
            expect(normalizeAbilityName('')).toBeNull();
            expect(normalizeAbilityName(null)).toBeNull();
            expect(normalizeAbilityName(undefined)).toBeNull();
        });

        it('returns null for unrecognized names', () => {
            expect(normalizeAbilityName('Unknown')).toBeNull();
            expect(normalizeAbilityName('Foo')).toBeNull();
        });

        it('returns null for names with extra content', () => {
            expect(normalizeAbilityName('Strength Modifier')).toBeNull();
            expect(normalizeAbilityName('Dexterity Bonus')).toBeNull();
        });

        it('returns null for whitespace-only input', () => {
            expect(normalizeAbilityName('   ')).toBeNull();
        });
    });

    describe('createMockAutomationExpressions', () => {
        it('returns an object with all expected methods', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(typeof mockExprs.evaluateAutoExpression).toBe('function');
            expect(typeof mockExprs.resolveHealingPoolExpression).toBe('function');
            expect(typeof mockExprs.getSaveDc).toBe('function');
            expect(typeof mockExprs.resolveUses).toBe('function');
            expect(typeof mockExprs.resolveDiceExpression).toBe('function');
            expect(typeof mockExprs.resolveScaling).toBe('function');
        });

        describe('evaluateAutoExpression', () => {
            it('returns 0 for null, undefined, and empty string', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.evaluateAutoExpression(null, {})).toBe(0);
                expect(mockExprs.evaluateAutoExpression(undefined, {})).toBe(0);
                expect(mockExprs.evaluateAutoExpression('', {})).toBe(0);
            });

            it('returns 2 for any non-empty expression', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.evaluateAutoExpression('1d20+5', {})).toBe(2);
                expect(mockExprs.evaluateAutoExpression('d6', {})).toBe(2);
            });
        });

        describe('resolveHealingPoolExpression', () => {
            it('returns base expression when no scaling is provided', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.resolveHealingPoolExpression('2d8', null, {})).toBe('2d8');
                expect(mockExprs.resolveHealingPoolExpression('2d8', null, undefined)).toBe('2d8');
            });

            it('returns base expression when stats is nullish', () => {
                const mockExprs = createMockAutomationExpressions();

                const scaling = [{ level: 5, expression: '4d8' }];
                expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, null)).toBe('2d8');
            });

            it('returns the highest matching scaled expression', () => {
                const mockExprs = createMockAutomationExpressions();

                const scaling = { 5: '3d8', 11: '4d8', 17: '5d8' };
                expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { level: 3 })).toBe('2d8');
                expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { level: 7 })).toBe('3d8');
                expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { level: 14 })).toBe('4d8');
                expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, { level: 20 })).toBe('5d8');
            });
        });

        describe('getSaveDc', () => {
            it('returns 8 + ability bonus + proficiency', () => {
                const mockExprs = createMockAutomationExpressions();

                const stats = {
                    abilities: [{ name: 'Strength', bonus: 4 }],
                };

                expect(mockExprs.getSaveDc(stats, 'STR', 3)).toBe(15);
            });

            it('returns 8 + ability bonus when proficiency is missing', () => {
                const mockExprs = createMockAutomationExpressions();

                const stats = {
                    abilities: [{ name: 'Wisdom', bonus: 5 }],
                };

                expect(mockExprs.getSaveDc(stats, 'WIS')).toBe(13);
            });

            it('returns 8 + 0 when ability is not found in stats', () => {
                const mockExprs = createMockAutomationExpressions();

                const stats = { abilities: [{ name: 'Strength', bonus: 4 }] };
                expect(mockExprs.getSaveDc(stats, 'Constitution', 2)).toBe(10);
            });
        });

        describe('resolveUses', () => {
            it('returns the number directly when usesSpec is a number', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.resolveUses({}, 3)).toBe(3);
            });

            it('returns proficiency_bonus when usesSpec is that string', () => {
                const mockExprs = createMockAutomationExpressions();

                const stats = { proficiency: 4 };
                expect(mockExprs.resolveUses(stats, 'proficiency_bonus')).toBe(4);
            });

            it('returns 0 when proficiency_bonus is requested but proficiency is missing', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.resolveUses({}, 'proficiency_bonus')).toBe(0);
            });

            it('returns level as fallback for unknown strings', () => {
                const mockExprs = createMockAutomationExpressions();

                const stats = { level: 5 };
                expect(mockExprs.resolveUses(stats, 'unknown')).toBe(5);
            });

            it('returns 1 as ultimate fallback when level is also missing', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.resolveUses({}, 'unknown')).toBe(1);
            });
        });

        describe('resolveDiceExpression', () => {
            it('returns the expression unchanged', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.resolveDiceExpression('2d8+3')).toBe('2d8+3');
                expect(mockExprs.resolveDiceExpression('4d6')).toBe('4d6');
            });
        });

        describe('resolveScaling', () => {
            it('returns the highest entry at or below the character level', () => {
                const mockExprs = createMockAutomationExpressions();

                const scaling = [
                    { level: 1, expression: '1d4' },
                    { level: 5, expression: '2d4' },
                    { level: 11, expression: '3d4' },
                ];

                expect(mockExprs.resolveScaling({ level: 1 }, scaling)).toEqual({ level: 1, expression: '1d4' });
                expect(mockExprs.resolveScaling({ level: 3 }, scaling)).toEqual({ level: 1, expression: '1d4' });
                expect(mockExprs.resolveScaling({ level: 7 }, scaling)).toEqual({ level: 5, expression: '2d4' });
                expect(mockExprs.resolveScaling({ level: 15 }, scaling)).toEqual({ level: 11, expression: '3d4' });
            });

            it('returns null when stats has no level', () => {
                const mockExprs = createMockAutomationExpressions();

                const scaling = [{ level: 1, expression: '1d4' }];
                expect(mockExprs.resolveScaling({}, scaling)).toBeNull();
            });

            it('returns null when scaling is null', () => {
                const mockExprs = createMockAutomationExpressions();

                expect(mockExprs.resolveScaling({ level: 5 }, null)).toBeNull();
            });

            it('returns null when level is below the first entry', () => {
                const mockExprs = createMockAutomationExpressions();

                const scaling = [{ level: 3, expression: '2d6' }];
                expect(mockExprs.resolveScaling({ level: 0 }, scaling)).toBeNull();
                expect(mockExprs.resolveScaling({ level: 2 }, scaling)).toBeNull();
            });
        });
    });

    describe('BASE_STATS', () => {
        it('has all six ability scores with bonuses', () => {
            expect(BASE_STATS.abilities.length).toBe(6);
            const names = BASE_STATS.abilities.map(a => a.name);
            expect(names).toContain('Strength');
            expect(names).toContain('Dexterity');
            expect(names).toContain('Constitution');
            expect(names).toContain('Intelligence');
            expect(names).toContain('Wisdom');
            expect(names).toContain('Charisma');
        });

        it('has level and proficiency', () => {
            expect(BASE_STATS.level).toBe(5);
            expect(BASE_STATS.proficiency).toBe(3);
        });

        it('has correct bonus values', () => {
            const bonuses = {};
            BASE_STATS.abilities.forEach(a => { bonuses[a.name] = a.bonus; });
            expect(bonuses).toEqual({
                Strength: 4,
                Dexterity: 2,
                Constitution: 3,
                Intelligence: 1,
                Wisdom: 5,
                Charisma: 2,
            });
        });
    });

    describe('BASE_FEATURE', () => {
        it('has name set to Test Feature', () => {
            expect(BASE_FEATURE.name).toBe('Test Feature');
        });
    });

    describe('makeFeature', () => {
        it('creates a feature with default name and provided automation', () => {
            const automation = { type: 'test' };
            const feature = makeFeature(automation);

            expect(feature.name).toBe('Test Feature');
            expect(feature.automation).toBe(automation);
        });

        it('accepts a custom name', () => {
            const feature = makeFeature({ type: 'test' }, 'Custom Feature');

            expect(feature.name).toBe('Custom Feature');
        });

        it('passes through the automation object as-is', () => {
            const automation = { type: 'custom', value: 42 };
            const feature = makeFeature(automation);

            expect(feature.automation).toBe(automation);
        });
    });
});
