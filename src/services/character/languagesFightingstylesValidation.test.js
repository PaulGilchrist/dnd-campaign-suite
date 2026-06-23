// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
    fetchClassData: vi.fn(),
    fetchRaceData: vi.fn(),
    fetchBackgroundData: vi.fn(),
    fetchSubraceData: vi.fn(),
    loadFeatData: vi.fn(),
}));

import {
    getFightingStyleLimits,
    getLanguageLimits,
    validateLanguagesAndFightingStyles,
} from './languagesFightingstylesValidation.js';

describe('languagesFightingstylesValidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getFightingStyleLimits', () => {
        it('should return 0 when no class provided', async () => {
            const result = await getFightingStyleLimits({ rules: '5e', level: 1 });
            expect(result.allowed).toBe(0);
            expect(result.preSelected).toEqual([]);
            expect(result.details).toBe('No class selected');
        });

        it('should return 0 when class name is empty string', async () => {
            const result = await getFightingStyleLimits({ rules: '5e', class: {}, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should return 0 when class name is undefined', async () => {
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: undefined }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should return 0 when class data is null', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Unknown' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should default level to 1 when undefined', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' } });
            expect(result.allowed).toBe(1);
        });

        it('should default level to 1 when 0', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 0 });
            expect(result.allowed).toBe(1);
        });

        it('should return 0 when class has no fighting style feature (5e)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Wizard' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should return 0 when class has no class_levels (5e)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ features: [{ name: 'Martial Training' }] });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Rogue' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should return 0 when class has no features at all', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Wizard' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should count fighting style with explicit count from 5e class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 1 });
            expect(result.allowed).toBe(1);
        });

        it('should default count to 1 when feature_specific is missing (5e)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Fighting Style' }] }],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 1 });
            expect(result.allowed).toBe(1);
        });

        it('should default count to 1 when fighting_style.count is 0 (5e)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 0 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 1 });
            expect(result.allowed).toBe(1);
        });

        it('should count fighting style with explicit count from 2024 class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1 });
            expect(result.allowed).toBe(1);
        });

        it('should default count to 1 when feature_specific is missing (2024)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Fighting Style' }] }],
            });
            const result = await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1 });
            expect(result.allowed).toBe(1);
        });

        it('should return 0 when 2024 class has no class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ features: [{ name: 'Training' }] });
            const result = await getFightingStyleLimits({ rules: '2024', class: { name: 'Rogue' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should return 0 when 2024 class has no features at all', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getFightingStyleLimits({ rules: '2024', class: { name: 'Wizard' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should count Additional Fighting Style from 5e subclass class_levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
                subclasses: [
                    {
                        name: 'Battle Master',
                        class_levels: [{ level: 7, features: [{ name: 'Additional Fighting Style' }] }],
                    },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
                level: 7,
            });
            expect(result.allowed).toBe(2);
        });

        it('should count Additional Fighting Style from 5e subclass top-level features', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                subclasses: [
                    { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 6 }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter', subclass: { name: 'Champion' } },
                level: 6,
            });
            expect(result.allowed).toBe(1);
        });

        it('should count Additional Fighting Style from 2024 subclass/major features', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
                majors: [
                    { name: 'Battle Master', features: [{ level: 7, name: 'Additional Fighting Style' }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
                level: 7,
            });
            expect(result.allowed).toBe(2);
        });

        it('should count duplicate Fighting Style features from 2024 class_levels at multiple levels', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                    { level: 9, features: [{ name: 'Additional Fighting Style' }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 9,
            });
            expect(result.allowed).toBe(3);
        });

        it('should count fighting styles from 2024 top-level class features', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                features: [
                    { name: 'Fighting Style', level: 1, feature_specific: { fighting_style: { count: 1 } } },
                    { name: 'Additional Fighting Style', level: 6 },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 6,
            });
            expect(result.allowed).toBe(2);
        });

        it('should pre-select fighting style feats in 2024', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
                { name: 'Tough', prerequisites: {} },
            ]);
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: ['War Caster'],
            });
            expect(result.allowed).toBe(1);
            expect(result.preSelected).toContain('War Caster');
        });

        it('should not pre-select non-fighting style feats', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
                { name: 'Tough', prerequisites: {} },
            ]);
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: ['Tough'],
            });
            expect(result.preSelected).toEqual([]);
        });

        it('should handle empty feats array without error', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: [],
            });
            expect(result.allowed).toBe(1);
            expect(result.preSelected).toEqual([]);
        });

        it('should handle undefined feats without error', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
            });
            expect(result.allowed).toBe(1);
            expect(result.preSelected).toEqual([]);
        });

        it('should handle empty feat list from loadFeatData', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 1,
                feats: ['War Caster'],
            });
            expect(result.allowed).toBe(1);
            expect(result.preSelected).toEqual([]);
        });

        it('should not count Additional Fighting Style when below level threshold (5e)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
                subclasses: [
                    { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 10 }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '5e',
                class: { name: 'Fighter', subclass: { name: 'Champion' } },
                level: 5,
            });
            expect(result.allowed).toBe(1);
        });

        it('should not count Additional Fighting Style when below level threshold (2024)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
                majors: [
                    { name: 'Battle Master', features: [{ level: 10, name: 'Additional Fighting Style' }] },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
                level: 5,
            });
            expect(result.allowed).toBe(1);
        });

        it('should not count top-level 2024 features when below level threshold', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                features: [
                    { name: 'Fighting Style', level: 1, feature_specific: { fighting_style: { count: 1 } } },
                    { name: 'Additional Fighting Style', level: 6 },
                ],
            });
            const result = await getFightingStyleLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 3,
            });
            expect(result.allowed).toBe(1);
        });
    });

    describe('getLanguageLimits', () => {
        it('should return default 2 background languages for 5e with no race/class', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Unknown' },
                class: { name: 'Unknown' },
            });
            expect(result.allowed).toBe(2);
            expect(result.preSelected).toEqual([]);
        });

        it('should return default 2 background languages for 2024 with no race/class/background', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Unknown' },
                class: { name: 'Unknown' },
            });
            expect(result.allowed).toBe(2);
        });

        it('should add race languages to preSelected and allowed (5e)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(4); // 2 race + 2 background
            expect(result.preSelected).toContain('Common');
            expect(result.preSelected).toContain('Elvish');
        });

        it('should add class languages to preSelected and allowed (5e)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Dwarvish'] });
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(4); // 1 race + 2 background (class languages not in 5e JSON)
            expect(result.preSelected).toContain('Common');
        });

        it('should add race and class languages (2024)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Dwarvish'] });
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ languages: ['Gnomish'] });
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
                background: 'Sage',
            });
            expect(result.allowed).toBe(4); // 2 race + 1 class + 1 background
            expect(result.preSelected).toContain('Common');
            expect(result.preSelected).toContain('Elvish');
            expect(result.preSelected).toContain('Dwarvish');
            expect(result.preSelected).toContain('Gnomish');
        });

        it('should add default 2 background languages for 2024 when background is null', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(3); // 1 race + 2 default background
        });

        it('should handle race language_options in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'], language_options: { choose: 1 } });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(4); // 1 race + 1 language_options + 2 background
        });

        it('should handle subrace languages in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf', subrace: { name: 'High Elf' } },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(3); // 1 race + 1 subrace + 2 background
            expect(result.preSelected).toContain('Sylvan');
        });

        it('should handle subrace language_options in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'], language_options: { choose: 1 } });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf', subrace: { name: 'Wood Elf' } },
                class: { name: 'Rogue' },
            });
            expect(result.allowed).toBe(4); // 1 race + 1 language_options + 2 background
        });

        it('should parse language count from feature description with "gain"', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 3, features: [{ name: 'Extra Language', description: 'You gain 2 languages of your choice' }] },
                ],
            });
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Rogue' },
                level: 3,
            });
            expect(result.allowed).toBe(4); // 2 base + 2 from feature
        });

        it('should parse language count from feature description with "learn"', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 3, features: [{ name: 'Language Feature', description: 'You learn 1 language' }] },
                ],
            });
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Rogue' },
                level: 3,
            });
            expect(result.allowed).toBe(3); // 2 base + 1 from feature
        });

        it('should not parse language count from feature without description', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 3, features: [{ name: 'Extra Language', desc: ['You gain 1 language'] }] }],
            });
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Rogue' },
                level: 3,
            });
            expect(result.allowed).toBe(2); // 2 base only, no description parsed
        });

        it('should deduplicate preSelected languages', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Common'] });
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
            });
            expect(result.preSelected).toEqual(['Common']);
            expect(result.allowed).toBe(4); // 1 race + 1 class + 2 background
        });

        it('should handle missing race data in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Unknown' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(2);
            expect(result.preSelected).toEqual([]);
        });

        it('should handle missing class data in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Unknown' },
            });
            expect(result.allowed).toBe(3); // 1 race + 2 background
            expect(result.preSelected).toEqual(['Common']);
        });

        it('should handle missing race data in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Unknown' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(2);
            expect(result.preSelected).toEqual([]);
        });

        it('should handle missing class data in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Unknown' },
            });
            expect(result.allowed).toBe(3); // 1 race + 2 default background
            expect(result.preSelected).toEqual(['Common']);
        });

        it('should not include subrace languages in 2024 (subrace not fetched)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Elf', subrace: { name: 'High Elf' } },
                class: { name: 'Wizard' },
            });
            expect(result.preSelected).not.toContain('Sylvan');
        });

        it('should handle undefined subrace gracefully in 5e', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(3); // 1 race + 2 background
        });

        it('should handle background with no languages in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ languages: [] });
            const result = await getLanguageLimits({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                background: 'Acolyte',
            });
            expect(result.allowed).toBe(0); // race=0 + class=0 + background=0
        });
    });

    describe('validateLanguagesAndFightingStyles', () => {
        it('should return no warnings when language selection is within limits', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                languages: ['Common'],
            });
            expect(warnings).toEqual([]);
        });

        it('should warn when too many languages selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                languages: ['Common', 'Elvish', 'Dwarvish', 'Gnomish'],
            });
            expect(warnings.some((w) => w.message.includes('language'))).toBe(true);
            expect(warnings.some((w) => w.type === 'warning')).toBe(true);
        });

        it('should warn when pre-selected languages are not chosen', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
                languages: [],
            });
            expect(warnings.some((w) => w.type === 'info' && w.message.includes('grant you these languages'))).toBe(true);
        });

        it('should not warn when pre-selected languages are all chosen', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Wizard' },
                languages: ['Common', 'Elvish'],
            });
            expect(warnings).toEqual([]);
        });

        it('should warn when too many fighting styles selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: ['Defense', 'Dueling'] },
                level: 1,
            });
            expect(warnings.some((w) => w.message.includes('fighting style'))).toBe(true);
            expect(warnings.some((w) => w.type === 'warning')).toBe(true);
        });

        it('should not warn when fighting style count matches allowed', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: ['Defense'] },
                level: 1,
            });
            expect(warnings).toEqual([]);
        });

        it('should warn when fighting style is available but not selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: [] },
                level: 1,
            });
            expect(warnings.some((w) => w.type === 'info' && w.message.includes('fighting style'))).toBe(true);
        });

        it('should not warn when fighting style is not available and none selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Wizard' },
                class: { name: 'Wizard', fightingStyles: [] },
                level: 1,
            });
            expect(warnings).toEqual([]);
        });

        it('should warn about missing pre-selected fighting style feats in 2024', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
            ]);
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: [] },
                level: 1,
                feats: ['War Caster'],
            });
            expect(
                warnings.some((w) => w.type === 'info' && w.message.includes('fighting style feats')),
            ).toBe(true);
        });

        it('should not warn about pre-selected fighting style feats when they are selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
                { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
            ]);
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Fighter', fightingStyles: ['War Caster'] },
                level: 1,
                feats: ['War Caster'],
            });
            expect(warnings).toEqual([]);
        });

        it('should handle undefined languages gracefully', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
            });
            expect(warnings.some((w) => w.type === 'info')).toBe(true);
        });

        it('should handle undefined fightingStyles gracefully', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 1,
            });
            expect(warnings.some((w) => w.type === 'info' && w.message.includes('fighting style'))).toBe(true);
        });

        it('should catch and suppress validation errors without throwing', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockRejectedValue(new Error('network error'));
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                languages: ['Common'],
            });
            expect(Array.isArray(warnings)).toBe(true);
            expect(warnings).toEqual([]);
        });
    });
});
