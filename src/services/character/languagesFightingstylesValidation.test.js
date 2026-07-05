// @cleaned-by-ai
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

        it('should return 0 when class name is empty string or undefined', async () => {
            expect(await getFightingStyleLimits({ rules: '5e', class: {}, level: 1 })).toEqual({ allowed: 0, preSelected: [], details: 'No class selected' });
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: undefined }, level: 1 })).toEqual({ allowed: 0, preSelected: [], details: 'No class selected' });
        });

        it('should return 0 when class data is null', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Unknown' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should default level to 1 when undefined or 0', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' } })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 0 })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
        });

        it('should return 0 when class has no fighting style feature', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
            });
            const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Wizard' }, level: 1 });
            expect(result.allowed).toBe(0);
        });

        it('should return 0 when class has no class_levels or features', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ features: [{ name: 'Martial Training' }] });
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Rogue' }, level: 1 })).toEqual({ allowed: 0, preSelected: [], details: expect.any(String) });

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Wizard' }, level: 1 })).toEqual({ allowed: 0, preSelected: [], details: expect.any(String) });
        });

        it('should count fighting style with explicit count from class_levels (5e and 2024)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 1 })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
            expect(await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1 })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
        });

        it('should default count to 1 when feature_specific is missing (5e and 2024)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Fighting Style' }] }],
            });
            expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 1 })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
            expect(await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1 })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
        });

        it('should count Additional Fighting Style from subclass (5e class_levels and top-level)', async () => {
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
                rules: '5e', class: { name: 'Fighter', subclass: { name: 'Battle Master' } }, level: 7,
            });
            expect(result.allowed).toBe(2);

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                subclasses: [
                    { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 6 }] },
                ],
            });
            const result2 = await getFightingStyleLimits({
                rules: '5e', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 6,
            });
            expect(result2.allowed).toBe(1);
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
                rules: '2024', class: { name: 'Fighter', subclass: { name: 'Battle Master' } }, level: 7,
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
                rules: '2024', class: { name: 'Fighter' }, level: 9,
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
                rules: '2024', class: { name: 'Fighter' }, level: 6,
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
                rules: '2024', class: { name: 'Fighter' }, level: 1, feats: ['War Caster'],
            });
            expect(result.allowed).toBe(1);
            expect(result.preSelected).toContain('War Caster');
            expect(result.preSelected).not.toContain('Tough');
        });

        it('should handle empty or undefined feats without error', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            expect(await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1, feats: [] })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
            expect(await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1 })).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
        });

        it('should not count Additional Fighting Style when below level threshold (5e and 2024)', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
                subclasses: [
                    { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 10 }] },
                ],
            });
            const result5e = await getFightingStyleLimits({
                rules: '5e', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 5,
            });
            expect(result5e.allowed).toBe(1);

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
                majors: [
                    { name: 'Battle Master', features: [{ level: 10, name: 'Additional Fighting Style' }] },
                ],
            });
            const result2024 = await getFightingStyleLimits({
                rules: '2024', class: { name: 'Fighter', subclass: { name: 'Battle Master' } }, level: 5,
            });
            expect(result2024.allowed).toBe(1);
        });
    });

    describe('getLanguageLimits', () => {
        it('should return default 2 background languages when no race/class/background data', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

            const result5e = await getLanguageLimits({ rules: '5e', race: { name: 'Unknown' }, class: { name: 'Unknown' } });
            expect(result5e.allowed).toBe(2);
            expect(result5e.preSelected).toEqual([]);

            const result2024 = await getLanguageLimits({ rules: '2024', race: { name: 'Unknown' }, class: { name: 'Unknown' } });
            expect(result2024.allowed).toBe(2);
        });

        it('should add race languages to preSelected and allowed (5e)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(4);
            expect(result.preSelected).toContain('Common');
            expect(result.preSelected).toContain('Elvish');
        });

        it('should add race and class languages (2024)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Dwarvish'] });
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ languages: ['Gnomish'] });
            const result = await getLanguageLimits({
                rules: '2024', race: { name: 'Elf' }, class: { name: 'Wizard' }, background: 'Sage',
            });
            expect(result.allowed).toBe(4);
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
                rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(3);
        });

        it('should handle race language_options and subrace languages (5e)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'], language_options: { choose: 1 } });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(4);

            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result2 = await getLanguageLimits({
                rules: '5e', race: { name: 'Elf', subrace: { name: 'High Elf' } }, class: { name: 'Wizard' },
            });
            expect(result2.allowed).toBe(3);
            expect(result2.preSelected).toContain('Sylvan');
        });

        it('should parse language count from feature description', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 3, features: [{ name: 'Extra Language', description: 'You gain 2 languages of your choice' }] },
                ],
            });
            const resultGain = await getLanguageLimits({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3,
            });
            expect(resultGain.allowed).toBe(4);

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 3, features: [{ name: 'Language Feature', description: 'You learn 1 language' }] },
                ],
            });
            const resultLearn = await getLanguageLimits({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3,
            });
            expect(resultLearn.allowed).toBe(3);
        });

        it('should not parse language count from feature without description', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 3, features: [{ name: 'Extra Language', desc: ['You gain 1 language'] }] }],
            });
            const result = await getLanguageLimits({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3,
            });
            expect(result.allowed).toBe(2);
        });

        it('should deduplicate preSelected languages', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Common'] });
            const result = await getLanguageLimits({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
            });
            expect(result.preSelected).toEqual(['Common']);
            expect(result.allowed).toBe(4);
        });

        it('should handle missing data gracefully (5e and 2024)', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            expect(await getLanguageLimits({ rules: '5e', race: { name: 'Unknown' }, class: { name: 'Wizard' } })).toEqual({ allowed: 2, preSelected: [], details: expect.any(String) });

            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            const result5e = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Unknown' } });
            expect(result5e.allowed).toBe(3);
            expect(result5e.preSelected).toEqual(['Common']);

            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            expect(await getLanguageLimits({ rules: '2024', race: { name: 'Unknown' }, class: { name: 'Wizard' } })).toEqual({ allowed: 2, preSelected: [], details: expect.any(String) });

            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result2024 = await getLanguageLimits({ rules: '2024', race: { name: 'Human' }, class: { name: 'Unknown' } });
            expect(result2024.allowed).toBe(3);
            expect(result2024.preSelected).toEqual(['Common']);
        });

        it('should not include subrace languages in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
            const result = await getLanguageLimits({
                rules: '2024', race: { name: 'Elf', subrace: { name: 'High Elf' } }, class: { name: 'Wizard' },
            });
            expect(result.preSelected).not.toContain('Sylvan');
        });

        it('should handle undefined subrace and empty background languages', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const result = await getLanguageLimits({
                rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
            });
            expect(result.allowed).toBe(3);

            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ languages: [] });
            const result2 = await getLanguageLimits({
                rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' }, background: 'Acolyte',
            });
            expect(result2.allowed).toBe(0);
        });
    });

    describe('validateLanguagesAndFightingStyles', () => {
        it('should return no warnings when selections are within limits', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' }, languages: ['Common'],
            });
            expect(warnings).toEqual([]);
        });

        it('should warn when too many languages or fighting styles selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
                languages: ['Common', 'Elvish', 'Dwarvish', 'Gnomish'],
            });
            expect(warnings.some((w) => w.message.includes('language'))).toBe(true);
            expect(warnings.some((w) => w.type === 'warning')).toBe(true);

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const styleWarnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: ['Defense', 'Dueling'] }, level: 1,
            });
            expect(styleWarnings.some((w) => w.message.includes('fighting style'))).toBe(true);
            expect(styleWarnings.some((w) => w.type === 'warning')).toBe(true);
        });

        it('should warn when pre-selected items are not chosen', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' }, languages: [],
            });
            expect(warnings.some((w) => w.type === 'info' && w.message.includes('grant you these languages'))).toBe(true);

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const styleWarnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: [] }, level: 1,
            });
            expect(styleWarnings.some((w) => w.type === 'info' && w.message.includes('fighting style'))).toBe(true);
        });

        it('should not warn when pre-selected items are all chosen', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' }, languages: ['Common', 'Elvish'],
            });
            expect(warnings).toEqual([]);
        });

        it('should not warn when fighting style is selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const styleWarnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: ['Defense'] }, level: 1,
            });
            expect(styleWarnings).toEqual([]);
        });

        it('should warn when fighting style is available but not selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: [] }, level: 1,
            });
            expect(warnings.some((w) => w.type === 'info' && w.message.includes('fighting style'))).toBe(true);
        });

        it('should not warn when fighting style is not available and none selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
            });
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Wizard' }, class: { name: 'Wizard', fightingStyles: [] }, level: 1,
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
                rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: [] }, level: 1, feats: ['War Caster'],
            });
            expect(warnings.some((w) => w.type === 'info' && w.message.includes('fighting style feats'))).toBe(true);

            const noWarnings = await validateLanguagesAndFightingStyles({
                rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: ['War Caster'] }, level: 1, feats: ['War Caster'],
            });
            expect(noWarnings).toEqual([]);
        });

        it('should handle undefined languages and fightingStyles gracefully', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            const langWarnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
            });
            expect(langWarnings.some((w) => w.type === 'info')).toBe(true);

            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
                ],
            });
            const styleWarnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter' }, level: 1,
            });
            expect(styleWarnings.some((w) => w.type === 'info' && w.message.includes('fighting style'))).toBe(true);
        });

        it('should catch and suppress validation errors without throwing', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockRejectedValue(new Error('network error'));
            const warnings = await validateLanguagesAndFightingStyles({
                rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' }, languages: ['Common'],
            });
            expect(Array.isArray(warnings)).toBe(true);
            expect(warnings).toEqual([]);
        });
    });
});
