import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from './data-loader.js';

// Mock the data-loader module
vi.mock('./data-loader.js', () => ({
    loadClassData: vi.fn(),
    loadRaceData: vi.fn(),
    loadBackgroundData: vi.fn(),
    loadFeatData: vi.fn(),
    fetchClassData: vi.fn(),
    fetchRaceData: vi.fn(),
    fetchBackgroundData: vi.fn(),
    fetchSubraceData: vi.fn(),
}));

// Import after mocking
import { 
    getFightingStyleLimits, 
    getLanguageLimits,
    validateLanguagesAndFightingStyles
} from './languages-fightingstyles-validation.js';

describe('languages-fightingstyles-validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
       });

    describe('getFightingStyleLimits', () => {
        it('should return fighting style limits for 2024 class with fighting style feature', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                  ]
               });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1
               });

            expect(result.allowed).toBe(1);
           });

        it('should return fighting style limits for 5e class with fighting style feature', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                  ]
               });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter' },
                level: 1
               });

            expect(result.allowed).toBe(1);
           });

        it('should return 0 when no class selected', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle class without fighting style', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Martial Training' }] }
                  ]
               });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Wizard' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle additional fighting styles from subclass in 2024', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                  ],
                majors: [
                      { name: 'Battle Master', features: [{ level: 7, name: 'Additional Fighting Style' }] }
                  ]
               });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
                level: 7
               });

            expect(result.allowed).toBe(2);
           });

        it('should handle additional fighting styles from subclass in 5e', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                  ],
                subclasses: [
                      { name: 'Battle Master', class_levels: [{ level: 7, features: [{ name: 'Additional Fighting Style' }] }] }
                  ]
               });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
                level: 7
               });

            expect(result.allowed).toBe(2);
           });
       });

    describe('getLanguageLimits', () => {
        it('should return language limits for 2024 ruleset', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common', 'Elvish']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                languages: ['Dwarvish']
               });
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
                languages: ['Gnomish']
               });

            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
                background: 'Sage'
               });

            expect(result.allowed).toBeGreaterThan(0);
            expect(result.preSelected).toContain('Common');
            expect(result.preSelected).toContain('Elvish');
           });

        it('should return language limits for 5e ruleset', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common', 'Elvish']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                languages: ['Dwarvish']
               });

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
                background: 'Sage'
               });

            expect(result.allowed).toBeGreaterThan(0);
            expect(result.preSelected).toContain('Common');
            expect(result.preSelected).toContain('Elvish');
            expect(result.preSelected).toContain('Dwarvish');
           });

        it('should handle race with language_options in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common'],
                language_options: { choose: 1 }
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' }
               });

            expect(result.allowed).toBeGreaterThan(1);
           });

        it('should handle subrace languages', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common']
               });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({
                languages: ['Sylvan']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf', subrace: { name: 'High Elf' } },
                class: { name: 'Wizard' }
               });

            expect(result.preSelected).toContain('Sylvan');
           });

        it('should handle class language features', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 3, features: [{ name: 'Extra Language', desc: ['You gain 1 language'] }] }
                   ]
                });

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Rogue' },
                level: 3
               });

            expect(result.allowed).toBeGreaterThan(0);
           });

        it('should add 2 background languages for 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' }
               });

            expect(result.allowed).toBe(2); // Default background languages
           });
       });

    describe('validateLanguagesAndFightingStyles', () => {
        it('should warn when too many languages selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                languages: ['Common', 'Elvish', 'Dwarvish', 'Gnomish']
               });

            expect(warnings.some(w => w.message.includes('language'))).toBe(true);
           });

        it('should warn when pre-selected languages not selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common', 'Elvish']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
                languages: []
               });

            expect(warnings.some(w => w.type === 'info' && w.message.includes('grant you these languages'))).toBe(true);
           });

        it('should warn when too many fighting styles selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                  ]
               });

            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: ['Defense', 'Dueling'] },
                level: 1
               });

            expect(warnings.some(w => w.message.includes('fighting style'))).toBe(true);
           });

        it('should warn when fighting style available but not selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                  ]
               });

            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: [] },
                level: 1
               });

            expect(warnings.some(w => w.type === 'info' && w.message.includes('fighting style'))).toBe(true);
           });
       });
});
