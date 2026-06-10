import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

// Mock the dataLoader module
vi.mock('../ui/dataLoader.js', () => ({
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
} from './languagesFightingstylesValidation.js';

describe('languagesFightingstylesValidation', () => {
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

        it('should parse language count from feature description with "gain"', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 3, features: [{ name: 'Extra Language', description: 'You gain 2 languages of your choice' }] }
                   ]
                 });

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Rogue' },
                level: 3
               });

            expect(result.allowed).toBe(4); // 2 base + 2 from feature
           });

        it('should parse language count from feature description with "learn"', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 3, features: [{ name: 'Language Feature', description: 'You learn 1 new language' }] }
                   ]
                 });

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Rogue' },
                level: 3
               });

            expect(result.allowed).toBe(3); // 2 base + 1 from feature
           });

        it('should handle subrace language_options in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common']
               });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({
                languages: ['Sylvan'],
                language_options: { choose: 1 }
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf', subrace: { name: 'Wood Elf' } },
                class: { name: 'Rogue' }
               });

            expect(result.allowed).toBe(3); // 2 base + 1 from subrace language_options
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

        it('should handle 2024 ruleset with no background', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Wizard' }
               });

            expect(result.allowed).toBe(3); // 1 race + 2 default background
           });

        it('should handle 2024 ruleset with no race data', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Unknown' },
                class: { name: 'Wizard' }
               });

            expect(result.allowed).toBe(2); // Default background only
           });

        it('should handle 5e ruleset with no race data', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Unknown' },
                class: { name: 'Wizard' }
               });

            expect(result.allowed).toBe(2); // Default background only
           });

        it('should handle 5e ruleset with no class data', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                languages: ['Common']
               });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Unknown' }
               });

            expect(result.allowed).toBe(3); // 1 race + 2 background
           });

        it('should handle fighting style feature with missing count', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style' }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter' },
                level: 1
               });

            expect(result.allowed).toBe(0); // No feature_specific, so no count
           });

        it('should handle fighting style feature with count 0', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 0 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 fighting style with default count of 1', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style' }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1
               });

            // Fighting Style feature without feature_specific → count defaults to 1
            expect(result.allowed).toBe(1);
           });

        it('should handle 2024 additional fighting styles from class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                       { level: 9, features: [{ name: 'Additional Fighting Style' }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 9
               });

            expect(result.allowed).toBe(2); // 1 from Fighting Style + 1 from Additional
           });

        it('should handle 2024 fighting styles from top-level class features', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                features: [
                       { name: 'Fighting Style', level: 1, feature_specific: { fighting_style: { count: 1 } } },
                       { name: 'Additional Fighting Style', level: 6 }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 6
               });

            expect(result.allowed).toBe(2);
           });

        it('should handle 5e subclass Additional Fighting Style from top-level features', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                subclasses: [
                       { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 6 }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter', subclass: { name: 'Champion' } },
                level: 6
               });

            expect(result.allowed).toBe(1);
           });

        it('should handle 2024 fighting style feats pre-selection', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                       { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
                       { name: 'Tough', prerequisites: {} }
                   ]);

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: ['War Caster']
               });

            expect(result.allowed).toBe(1);
            expect(result.preSelected).toContain('War Caster');
           });

        it('should handle 2024 fighting style feats with no matching feats', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: ['War Caster']
               });

            expect(result.allowed).toBe(1);
            expect(result.preSelected).toEqual([]);
           });

        it('should handle 2024 fighting style feats with empty feats array', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: []
               });

            expect(result.allowed).toBe(1);
            expect(result.preSelected).toEqual([]);
           });

        it('should handle 2024 fighting style feats with undefined feats', async () => {
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

        it('should handle 5e ruleset with no class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                features: [{ name: 'Martial Training' }]
               });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Rogue' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with no class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                features: [{ name: 'Training' }]
               });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Rogue' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with no features at all', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Wizard' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with no features at all', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Wizard' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with no class selected', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with no class selected', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with no level', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' }
               });

            expect(result.allowed).toBe(0); // level is undefined, so level <= 1 check fails
           });

        it('should handle 5e ruleset with no level', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter' }
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with level 0', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 0
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with level 0', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter' },
                level: 0
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: {},
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: {},
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined class', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined class', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined formData', async () => {
            // formData.class?.name returns undefined → className = ''
            const result = await getFightingStyleLimits(undefined);

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined formData', async () => {
            const result = await getFightingStyleLimits(undefined);

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with null formData', async () => {
            const result = await getFightingStyleLimits(null);

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with null formData', async () => {
            const result = await getFightingStyleLimits(null);

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with empty string class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: '' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with empty string class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: '' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined level', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' }
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined level', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                       { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] }
                   ]
                });

            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter' }
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: {},
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: {},
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined class', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined class', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with undefined formData', async () => {
            const result = await getFightingStyleLimits(undefined);

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with undefined formData', async () => {
            const result = await getFightingStyleLimits(undefined);

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with null formData', async () => {
            const result = await getFightingStyleLimits(null);

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with null formData', async () => {
            const result = await getFightingStyleLimits(null);

            expect(result.allowed).toBe(0);
           });

        it('should handle 2024 ruleset with empty string class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: '' },
                level: 1
               });

            expect(result.allowed).toBe(0);
           });

        it('should handle 5e ruleset with empty string class name', async () => {
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: '' },
                level: 1
               });

            expect(result.allowed).toBe(0);
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
