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
        it('returns canonical name for lowercase abbreviations', () => {
            expect(normalizeAbilityName('str')).toBe('Strength');
            expect(normalizeAbilityName('dex')).toBe('Dexterity');
            expect(normalizeAbilityName('con')).toBe('Constitution');
            expect(normalizeAbilityName('int')).toBe('Intelligence');
            expect(normalizeAbilityName('wis')).toBe('Wisdom');
            expect(normalizeAbilityName('cha')).toBe('Charisma');
        });

        it('returns canonical name for uppercase abbreviations', () => {
            expect(normalizeAbilityName('STR')).toBe('Strength');
            expect(normalizeAbilityName('DEX')).toBe('Dexterity');
            expect(normalizeAbilityName('CON')).toBe('Constitution');
            expect(normalizeAbilityName('INT')).toBe('Intelligence');
            expect(normalizeAbilityName('WIS')).toBe('Wisdom');
            expect(normalizeAbilityName('CHA')).toBe('Charisma');
        });

        it('returns canonical name for full ability names', () => {
            expect(normalizeAbilityName('Strength')).toBe('Strength');
            expect(normalizeAbilityName('Dexterity')).toBe('Dexterity');
            expect(normalizeAbilityName('Constitution')).toBe('Constitution');
            expect(normalizeAbilityName('Intelligence')).toBe('Intelligence');
            expect(normalizeAbilityName('Wisdom')).toBe('Wisdom');
            expect(normalizeAbilityName('Charisma')).toBe('Charisma');
        });

        it('returns null for names with extra words', () => {
            expect(normalizeAbilityName('Strength Modifier')).toBeNull();
            expect(normalizeAbilityName('Dexterity Bonus')).toBeNull();
        });

        it('returns null for empty input', () => {
            expect(normalizeAbilityName('')).toBeNull();
            expect(normalizeAbilityName(null)).toBeNull();
            expect(normalizeAbilityName(undefined)).toBeNull();
        });

        it('returns null for unrecognized ability names', () => {
            expect(normalizeAbilityName('Unknown')).toBeNull();
            expect(normalizeAbilityName('Foo')).toBeNull();
        });

        it('handles mixed case', () => {
            expect(normalizeAbilityName('StReNgTh')).toBe('Strength');
            expect(normalizeAbilityName('InTeLlIgEnCe')).toBe('Intelligence');
        });
    });

    describe('createMockAutomationExpressions', () => {
        it('returns an object with all expected methods', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(mockExprs.evaluateAutoExpression).toBeDefined();
            expect(mockExprs.resolveHealingPoolExpression).toBeDefined();
            expect(mockExprs.getSaveDc).toBeDefined();
            expect(mockExprs.resolveUses).toBeDefined();
            expect(mockExprs.resolveDiceExpression).toBeDefined();
            expect(mockExprs.resolveScaling).toBeDefined();
        });

        it('evaluateAutoExpression returns 2 for non-empty expression', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(mockExprs.evaluateAutoExpression('1d20+5', {})).toBe(2);
        });

        it('evaluateAutoExpression returns 0 for empty expression', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(mockExprs.evaluateAutoExpression(null, {})).toBe(0);
            expect(mockExprs.evaluateAutoExpression(undefined, {})).toBe(0);
            expect(mockExprs.evaluateAutoExpression('', {})).toBe(0);
        });

        it('resolveHealingPoolExpression returns base when no scaling', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(mockExprs.resolveHealingPoolExpression('2d8', null, {})).toBe('2d8');
            expect(mockExprs.resolveHealingPoolExpression('2d8', null, undefined)).toBe('2d8');
        });

        it('resolveHealingPoolExpression returns base when no stats', () => {
            const mockExprs = createMockAutomationExpressions();

            const scaling = [{ level: 5, expression: '4d8' }];
            expect(mockExprs.resolveHealingPoolExpression('2d8', scaling, null)).toBe('2d8');
        });

        it('getSaveDc returns 8 + ability bonus + proficiency', () => {
            const mockExprs = createMockAutomationExpressions();

            const stats = {
                abilities: [{ name: 'Strength', bonus: 4 }],
                proficiency: 3,
            };

            expect(mockExprs.getSaveDc(stats, 'STR', 3)).toBe(15);
        });

        it('getSaveDc returns 8 + ability bonus when no proficiency provided', () => {
            const mockExprs = createMockAutomationExpressions();

            const stats = {
                abilities: [{ name: 'Wisdom', bonus: 5 }],
            };

            expect(mockExprs.getSaveDc(stats, 'WIS')).toBe(13);
        });

        it('resolveUses returns number when usesSpec is a number', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(mockExprs.resolveUses({}, 3)).toBe(3);
        });

        it('resolveUses returns proficiency_bonus when usesSpec is that string', () => {
            const mockExprs = createMockAutomationExpressions();

            const stats = { proficiency: 4 };
            expect(mockExprs.resolveUses(stats, 'proficiency_bonus')).toBe(4);
        });

        it('resolveUses returns level as fallback', () => {
            const mockExprs = createMockAutomationExpressions();

            const stats = { level: 5 };
            expect(mockExprs.resolveUses(stats, 'unknown')).toBe(5);
        });

        it('resolveDiceExpression returns expression unchanged', () => {
            const mockExprs = createMockAutomationExpressions();

            expect(mockExprs.resolveDiceExpression('2d8+3')).toBe('2d8+3');
        });

        it('resolveScaling returns matching entry or null', () => {
            const mockExprs = createMockAutomationExpressions();

            const scaling = [
                { level: 1, expression: '1d4' },
                { level: 5, expression: '2d4' },
                { level: 11, expression: '3d4' },
            ];

            expect(mockExprs.resolveScaling({ level: 3 }, scaling)).toEqual({ level: 1, expression: '1d4' });
            expect(mockExprs.resolveScaling({ level: 7 }, scaling)).toEqual({ level: 5, expression: '2d4' });
            expect(mockExprs.resolveScaling({ level: 15 }, scaling)).toEqual({ level: 11, expression: '3d4' });
            expect(mockExprs.resolveScaling({ level: 0 }, scaling)).toBeNull();
            expect(mockExprs.resolveScaling({}, null)).toBeNull();
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
            expect(bonuses.Strength).toBe(4);
            expect(bonuses.Dexterity).toBe(2);
            expect(bonuses.Constitution).toBe(3);
            expect(bonuses.Intelligence).toBe(1);
            expect(bonuses.Wisdom).toBe(5);
            expect(bonuses.Charisma).toBe(2);
        });
    });

    describe('BASE_FEATURE', () => {
        it('has a name property', () => {
            expect(BASE_FEATURE.name).toBe('Test Feature');
        });
    });

    describe('makeFeature', () => {
        it('creates a feature with name and automation', () => {
            const automation = { type: 'test' };
            const feature = makeFeature(automation);

            expect(feature.name).toBe('Test Feature');
            expect(feature.automation).toBe(automation);
        });

        it('accepts custom name', () => {
            const feature = makeFeature({ type: 'test' }, 'Custom Feature');

            expect(feature.name).toBe('Custom Feature');
        });

        it('accepts custom automation', () => {
            const automation = { type: 'custom', value: 42 };
            const feature = makeFeature(automation);

            expect(feature.automation).toBe(automation);
        });
    });
});
