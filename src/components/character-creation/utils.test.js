import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    calculateTotalScore,
    validateFinalFormData
} from './utils.js';

// Mock fetch for the async functions
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('character-creation/utils', () => {
    describe('calculateTotalScore', () => {
        it('should calculate total score correctly', () => {
            const ability = {
                baseScore: '10',
                abilityImprovements: '2',
                miscBonus: '1'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(13);
           });

        it('should handle string values', () => {
            const ability = {
                baseScore: '15',
                abilityImprovements: '5',
                miscBonus: '0'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(20);
           });

        it('should default to 8 for missing baseScore', () => {
            const ability = {
                abilityImprovements: '2',
                miscBonus: '1'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(11);
           });

        it('should default to 0 for missing abilityImprovements', () => {
            const ability = {
                baseScore: '10',
                miscBonus: '1'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(11);
           });

        it('should default to 0 for missing miscBonus', () => {
            const ability = {
                baseScore: '10',
                abilityImprovements: '2'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(12);
           });

        it('should handle empty object', () => {
            const result = calculateTotalScore({});

            expect(result).toBe(8);
           });

        it('should handle negative values', () => {
            const ability = {
                baseScore: '10',
                abilityImprovements: '-1',
                miscBonus: '-1'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(8);
           });

        it('should handle invalid values', () => {
            const ability = {
                baseScore: 'invalid',
                abilityImprovements: 'invalid',
                miscBonus: 'invalid'
                };

            const result = calculateTotalScore(ability);

            expect(result).toBe(8);
       });
        });

    describe('validateFinalFormData', () => {
        it('should return no errors for valid form data', () => {
            const formData = {
                name: 'Test Character',
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                expertSkills: []
                 };

            const result = validateFinalFormData(formData);

            expect(result).toEqual({});
           });

        it('should not validate abilities, inventory, or skillProficiencies', () => {
            const formData = {
                name: 'Test Character',
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                abilities: [],
                inventory: [],
                skillProficiencies: [],
                expertSkills: []
                 };

            const result = validateFinalFormData(formData);

            expect(result).toEqual({});
           });

        it('should return error for missing name', () => {
            const formData = {
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                expertSkills: []
                 };

            const result = validateFinalFormData(formData);

            expect(result.name).toBe('name is required');
           });

        it('should return error for empty name', () => {
            const formData = {
                name: '   ',
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                expertSkills: []
                 };

            const result = validateFinalFormData(formData);

            expect(result.name).toBe('name is required');
           });

        it('should return multiple errors for multiple missing fields', () => {
            const formData = {};

            const result = validateFinalFormData(formData);

            expect(Object.keys(result).length).toBeGreaterThan(0);
       });
        });
});
