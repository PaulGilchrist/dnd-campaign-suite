import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadValidationRules: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchRaceData: vi.fn(),
}));

import {
    getFeatLimits,
    validateFeats,
    getFeatTypeInfo,
    getPreSelectedFeats,
    normalizeFeatDescription,
    normalizeBackgroundFeatName,
    getRaceFeatChoices,
} from './featValidation.js';

// Shared mock setup helper to reduce repetition
function mockValidationRules(rules) {
    dataLoader.loadValidationRules.mockResolvedValue(rules ?? {});
}

describe('featValidation', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getFeatLimits', () => {
        it('should return correct feat limits for 5e at level 4', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e', level: 4 });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(false);
            expect(result.originFeatLevel).toBe(1);
            expect(result.details).toContain('levels 4, 8, 12, 16, 19');
        });

        it('should return correct feat limits for 5e at level 8', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e', level: 8 });

            expect(result.allowed).toBe(2);
        });

        it('should count all feat levels at level 19', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e', level: 19 });

            expect(result.allowed).toBe(5);
        });

        it('should return 0 feats for level below first feat level', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e', level: 3 });

            expect(result.allowed).toBe(0);
        });

        it('should default to level 1 when undefined', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e' });

            expect(result.allowed).toBe(0);
        });

        it('should use default 5e levels when feats config is missing', async () => {
            mockValidationRules({});

            const result = await getFeatLimits({ rules: '5e', level: 4 });

            expect(result.allowed).toBe(1);
        });

        it('should use default 5e levels when rules is undefined', async () => {
            mockValidationRules({});

            const result = await getFeatLimits({ level: 4 });

            expect(result.allowed).toBe(1);
        });

        it('should use default 2024 levels at level 1 (no feats)', async () => {
            mockValidationRules({});

            const result = await getFeatLimits({ rules: '2024', level: 1 });

            expect(result.allowed).toBe(0);
            expect(result.originRequired).toBe(false);
        });

        it('should use default 2024 levels at level 4', async () => {
            mockValidationRules({});

            const result = await getFeatLimits({ rules: '2024', level: 4 });

            expect(result.allowed).toBe(1);
        });

        it('should return origin feat info from rules when present', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: true,
                    origin_feat_level: 1,
                },
            });

            const result = await getFeatLimits({ rules: '2024', level: 1 });

            expect(result.allowed).toBe(0);
            expect(result.originRequired).toBe(true);
            expect(result.originFeatLevel).toBe(1);
        });

        it('should add 1 to allowed count for Human Versatile trait in 2024', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: true,
                    origin_feat_level: 1,
                },
            });
            dataLoader.fetchRaceData.mockResolvedValue({
                name: 'Human',
                traits: [
                    { name: 'Resourceful' },
                    { name: 'Skillful' },
                    { name: 'Versatile', proficiency_choices: { from: ['Skilled', 'Lucky', 'Tough'] } },
                ],
            });

            const result = await getFeatLimits({ rules: '2024', level: 1, race: { name: 'Human' } });

            expect(result.allowed).toBe(1);
            expect(result.details).toContain('1 Origin feat from their background');
            expect(result.details).toContain('levels 4, 8, 12, 16, 19');
        });

        it('should not add Versatile bonus when race does not have Versatile trait', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: true,
                    origin_feat_level: 1,
                },
            });
            dataLoader.fetchRaceData.mockResolvedValue({
                name: 'Elf',
                traits: [{ name: 'Fey Ancestry' }],
            });

            const result = await getFeatLimits({ rules: '2024', level: 1, race: { name: 'Elf' } });

            expect(result.allowed).toBe(0);
        });

        it('should not crash when race is null in 2024', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: true,
                },
            });

            const result = await getFeatLimits({ rules: '2024', level: 1, race: null });

            expect(result.allowed).toBe(0);
        });

        it('should use custom available_levels from rules', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [3, 6, 9],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e', level: 6 });

            expect(result.allowed).toBe(2);
            expect(result.details).toContain('levels 3, 6, 9');
        });

        it('should return correct details string for 5e', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });

            const result = await getFeatLimits({ rules: '5e', level: 4 });

            expect(result.details).toContain('5e');
            expect(result.details).toContain('feats are optional');
        });
    });

    describe('validateFeats', () => {
        function mockDefaultRules() {
            mockValidationRules({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false,
                },
            });
        }

        it('should return empty warnings when no feats selected', async () => {
            mockDefaultRules();

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: [] }, []);

            expect(warnings).toEqual([]);
        });

        it('should return empty warnings when formData has no feats property', async () => {
            mockDefaultRules();

            const warnings = await validateFeats({ rules: '5e', level: 4 }, []);

            expect(warnings).toEqual([]);
        });

        it('should warn when too many feats selected', async () => {
            mockDefaultRules();

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Tough', 'Resilient'] }, []);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('warning');
            expect(warnings[0].message).toContain('Rules allow 1 feat');
            expect(warnings[0].message).toContain('selected 2');
        });

        it('should not warn when exactly the allowed number of feats selected', async () => {
            mockDefaultRules();

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Tough'] }, []);

            expect(warnings).toEqual([]);
        });

        it('should warn about origin feat requirement in 2024 at level 1', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true,
                },
            });

            const allFeats = [
                { name: 'Observer', type: 'Origin Feat' },
                { name: 'Tough', type: 'General' },
            ];

            const warnings = await validateFeats({ rules: '2024', level: 1, feats: ['Tough'] }, allFeats);

            const originWarning = warnings.find((w) => w.message.includes('Origin feat'));
            expect(originWarning).toBeDefined();
            expect(originWarning.type).toBe('warning');
        });

        it('should not warn about origin feat when origin feat is selected', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true,
                },
            });

            const allFeats = [
                { name: 'Observer', type: 'Origin Feat' },
                { name: 'Tough', type: 'General' },
            ];

            const warnings = await validateFeats({ rules: '2024', level: 1, feats: ['Observer'] }, allFeats);

            const originWarning = warnings.find((w) => w.message.includes('Origin feat'));
            expect(originWarning).toBeUndefined();
        });

        it('should warn when non-origin feats are selected at 2024 level 1 without Versatile trait', async () => {
            mockValidationRules({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true,
                },
            });

            const allFeats = [{ name: 'Observer', type: 'Origin Feat' }];

            const warnings = await validateFeats(
                { rules: '2024', level: 1, feats: ['Observer', 'Tough'], race: { name: 'Human' } },
                allFeats,
            );

            // Should warn about non-origin feats
            const nonOriginWarning = warnings.find((w) => w.message.includes('not Origin'));
            expect(nonOriginWarning).toBeDefined();
        });

        it('should warn about Epic Boon feats at low levels', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Master of Reality', type: 'Epic Boon' }];

            const warnings = await validateFeats({ rules: '5e', level: 10, feats: ['Master of Reality'] }, allFeats);

            const epicWarning = warnings.find((w) => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeDefined();
            expect(epicWarning.type).toBe('warning');
            expect(epicWarning.message).toContain('level 19');
            expect(epicWarning.message).toContain('level 10');
        });

        it('should not warn about Epic Boon feats at level 19', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Master of Reality', type: 'Epic Boon' }];

            const warnings = await validateFeats({ rules: '5e', level: 19, feats: ['Master of Reality'] }, allFeats);

            const epicWarning = warnings.find((w) => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeUndefined();
        });

        it('should warn about Epic Boon Feat type at low levels', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Awakened Mind', type: 'Epic Boon Feat' }];

            const warnings = await validateFeats({ rules: '5e', level: 10, feats: ['Awakened Mind'] }, allFeats);

            const epicWarning = warnings.find((w) => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeDefined();
        });

        it('should warn about level prerequisites', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Ability Score Improvement', prerequisites: ['4th level'] }];

            const warnings = await validateFeats({ rules: '5e', level: 2, feats: ['Ability Score Improvement'] }, allFeats);

            const prereqWarning = warnings.find((w) => w.message.includes('Ability Score Improvement'));
            expect(prereqWarning).toBeDefined();
            expect(prereqWarning.type).toBe('warning');
            expect(prereqWarning.message).toContain('4th level');
        });

        it('should not warn about level prerequisites when level is sufficient', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Ability Score Improvement', prerequisites: ['4th level'] }];

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Ability Score Improvement'] }, allFeats);

            const prereqWarning = warnings.find((w) => w.message.includes('Ability Score Improvement'));
            expect(prereqWarning).toBeUndefined();
        });

        it('should warn about ability score prerequisites', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Crusher', prerequisites: ['Strength 13'] }];

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Crusher'] }, allFeats);

            const abilityWarning = warnings.find((w) => w.message.includes('Crusher'));
            expect(abilityWarning).toBeDefined();
            expect(abilityWarning.type).toBe('info');
            expect(abilityWarning.message).toContain('Strength');
        });

        it('should handle multiple prerequisites on a single feat', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Heavy Armor Master', prerequisites: ['4th level', 'Strength 13'] }];

            const warnings = await validateFeats({ rules: '5e', level: 2, feats: ['Heavy Armor Master'] }, allFeats);

            const levelWarning = warnings.find((w) => w.message.includes('4th level'));
            const abilityWarning = warnings.find((w) => w.message.includes('Strength'));
            expect(levelWarning).toBeDefined();
            expect(abilityWarning).toBeDefined();
        });

        it('should handle prereq as object with name property', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Some Feat', prerequisites: [{ name: 'Level 4' }] }];

            const warnings = await validateFeats({ rules: '5e', level: 2, feats: ['Some Feat'] }, allFeats);

            expect(Array.isArray(warnings)).toBe(true);
        });

        it('should handle prereq as object with no name property', async () => {
            mockDefaultRules();

            const allFeats = [{ name: 'Some Feat', prerequisites: [{ foo: 'bar' }] }];

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Some Feat'] }, allFeats);

            expect(Array.isArray(warnings)).toBe(true);
        });

        it('should not duplicate warnings for the same feat', async () => {
            mockDefaultRules();

            const allFeats = [
                { name: 'Crusher', prerequisites: ['Strength 13'] },
                { name: 'Crusher', prerequisites: ['Strength 13'] },
            ];

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Crusher', 'Crusher'] }, allFeats);

            const crusherWarnings = warnings.filter((w) => w.message.includes('Crusher'));
            expect(crusherWarnings).toHaveLength(1);
        });

        it('should throw when allFeats is undefined', async () => {
            mockDefaultRules();

            await expect(
                validateFeats({ rules: '5e', level: 4, feats: ['Tough'] }, undefined),
            ).rejects.toThrow();
        });

        it('should handle allFeats being empty', async () => {
            mockDefaultRules();

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Tough'] }, []);

            expect(Array.isArray(warnings)).toBe(true);
        });

        it('should not warn about Epic Boon when allFeats does not contain the feat type', async () => {
            mockDefaultRules();

            // allFeats doesn't include the Epic Boon feat, so no type matching
            const warnings = await validateFeats({ rules: '5e', level: 10, feats: ['Master of Reality'] }, []);

            const epicWarning = warnings.find((w) => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeUndefined();
        });
    });

    describe('getFeatTypeInfo', () => {
        it('should return type info for a known Origin Feat', () => {
            const allFeats = [{ name: 'Observer', type: 'Origin Feat' }];

            const result = getFeatTypeInfo('Observer', allFeats);

            expect(result.type).toBe('Origin Feat');
            expect(result.isOrigin).toBe(true);
            expect(result.isEpicBoon).toBe(false);
        });

        it('should return type info for an Epic Boon feat', () => {
            const allFeats = [{ name: 'Master of Reality', type: 'Epic Boon' }];

            const result = getFeatTypeInfo('Master of Reality', allFeats);

            expect(result.type).toBe('Epic Boon');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(true);
        });

        it('should return type info for Epic Boon Feat type', () => {
            const allFeats = [{ name: 'Awakened Mind', type: 'Epic Boon Feat' }];

            const result = getFeatTypeInfo('Awakened Mind', allFeats);

            expect(result.isEpicBoon).toBe(true);
            expect(result.type).toBe('Epic Boon Feat');
        });

        it('should return default info for unknown feat', () => {
            const result = getFeatTypeInfo('Unknown Feat', []);

            expect(result.type).toBe('Unknown');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(false);
        });

        it('should return General type when feat has no type', () => {
            const allFeats = [{ name: 'Tough' }];

            const result = getFeatTypeInfo('Tough', allFeats);

            expect(result.type).toBe('General');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(false);
        });

        it('should throw when allFeats is undefined', () => {
            expect(() => getFeatTypeInfo('Tough', undefined)).toThrow();
        });
    });

    describe('getPreSelectedFeats', () => {
        it('should return pre-selected feats from background in 2024', async () => {
            dataLoader.fetchBackgroundData.mockResolvedValue({ feat: 'Observer' });

            const result = await getPreSelectedFeats({ rules: '2024', background: 'Acolyte' });

            expect(result).toEqual(['Observer']);
        });

        it('should strip parenthetical from background feat names', async () => {
            dataLoader.fetchBackgroundData.mockResolvedValue({ feat: 'Magic Initiate (Druid)' });

            const result = await getPreSelectedFeats({ rules: '2024', background: 'Acolyte' });

            expect(result).toEqual(['Magic Initiate']);
        });

        it('should return empty array for 5e backgrounds', async () => {
            const result = await getPreSelectedFeats({ rules: '5e', background: 'Acolyte' });

            expect(result).toEqual([]);
        });

        it('should return empty array when no background specified', async () => {
            const result = await getPreSelectedFeats({ rules: '2024' });

            expect(result).toEqual([]);
        });

        it('should return empty array when background has no feat', async () => {
            dataLoader.fetchBackgroundData.mockResolvedValue({});

            const result = await getPreSelectedFeats({ rules: '2024', background: 'Charlatan' });

            expect(result).toEqual([]);
        });

        it('should return empty array when background data is null', async () => {
            dataLoader.fetchBackgroundData.mockResolvedValue(null);

            const result = await getPreSelectedFeats({ rules: '2024', background: 'Charlatan' });

            expect(result).toEqual([]);
        });

        it('should return empty array when background data has no feat property', async () => {
            dataLoader.fetchBackgroundData.mockResolvedValue({ description: 'Some background' });

            const result = await getPreSelectedFeats({ rules: '2024', background: 'Charlatan' });

            expect(result).toEqual([]);
        });

    });

    describe('normalizeBackgroundFeatName', () => {
        it('should strip parenthetical from feat name', () => {
            expect(normalizeBackgroundFeatName('Magic Initiate (Druid)')).toBe('Magic Initiate');
        });

        it('should return the name unchanged when no parenthetical', () => {
            expect(normalizeBackgroundFeatName('Tough')).toBe('Tough');
        });

        it('should handle multiple parenthetical-like segments (strips only the last)', () => {
            expect(normalizeBackgroundFeatName('Feat Name (Extra) (More)')).toBe('Feat Name (Extra)');
        });

        it('should handle empty string', () => {
            expect(normalizeBackgroundFeatName('')).toBe('');
        });
    });

    describe('getRaceFeatChoices', () => {
        it('should return feat choices from Versatile trait in 2024', async () => {
            dataLoader.fetchRaceData.mockResolvedValue({
                name: 'Human',
                traits: [
                    { name: 'Versatile', proficiency_choices: { from: ['Skilled', 'Lucky', 'Tough'] } },
                ],
            });

            const result = await getRaceFeatChoices({ rules: '2024', race: { name: 'Human' } });

            expect(result).toEqual(['Skilled', 'Lucky', 'Tough']);
        });

        it('should return empty array when race has no Versatile trait', async () => {
            dataLoader.fetchRaceData.mockResolvedValue({
                name: 'Elf',
                traits: [{ name: 'Fey Ancestry' }],
            });

            const result = await getRaceFeatChoices({ rules: '2024', race: { name: 'Elf' } });

            expect(result).toEqual([]);
        });

        it('should return empty array for 5e ruleset', async () => {
            const result = await getRaceFeatChoices({ rules: '5e', race: { name: 'Human' } });

            expect(result).toEqual([]);
        });

        it('should return empty array when race is null', async () => {
            const result = await getRaceFeatChoices({ rules: '2024', race: null });

            expect(result).toEqual([]);
        });

        it('should return empty array when race has no name', async () => {
            const result = await getRaceFeatChoices({ rules: '2024', race: {} });

            expect(result).toEqual([]);
        });

        it('should return empty array when Versatile has no proficiency_choices', async () => {
            dataLoader.fetchRaceData.mockResolvedValue({
                name: 'Human',
                traits: [{ name: 'Versatile' }],
            });

            const result = await getRaceFeatChoices({ rules: '2024', race: { name: 'Human' } });

            expect(result).toEqual([]);
        });

        it('should return empty array when proficiency_choices.from is empty', async () => {
            dataLoader.fetchRaceData.mockResolvedValue({
                name: 'Human',
                traits: [{ name: 'Versatile', proficiency_choices: { from: [] } }],
            });

            const result = await getRaceFeatChoices({ rules: '2024', race: { name: 'Human' } });

            expect(result).toEqual([]);
        });
    });

    describe('normalizeFeatDescription', () => {
        it('should return empty text for null/undefined/missing description', () => {
            expect(normalizeFeatDescription({})).toEqual({ text: '', isHtml: false });
            expect(normalizeFeatDescription({ description: null })).toEqual({ text: '', isHtml: false });
            expect(normalizeFeatDescription({ description: undefined })).toEqual({ text: '', isHtml: false });
        });

        it('should return empty for empty or falsy-only arrays', () => {
            expect(normalizeFeatDescription({ description: [] })).toEqual({ text: '', isHtml: false });
            expect(normalizeFeatDescription({ description: [null, undefined] })).toEqual({ text: '', isHtml: false });
        });

        it('should handle 2024 format with string description (HTML)', () => {
            const feat = { description: '<p>Gain +1 Strength</p>' };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '<p>Gain +1 Strength</p>', isHtml: true });
        });

        it('should handle 2024 format with array description containing string (HTML)', () => {
            const feat = { description: ['<p>Gain +1 Strength</p>', '<p>Additional text</p>'] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '<p>Gain +1 Strength</p>', isHtml: true });
        });

        it('should handle 2024 format with array description containing object with text/content/description', () => {
            expect(normalizeFeatDescription({ description: [{ text: '<p>Text</p>' }] }).text).toBe('<p>Text</p>');
            expect(normalizeFeatDescription({ description: [{ content: '<p>Content</p>' }] }).text).toBe('<p>Content</p>');
            expect(normalizeFeatDescription({ description: [{ description: '<p>Desc</p>' }] }).text).toBe('<p>Desc</p>');
        });

        it('should return empty when description object has level property (unexpected structure)', () => {
            const feat = { description: [{ level: 1, name: 'Some Feat' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should prioritize text over content over description in nested objects', () => {
            const feat = { description: [{ text: 'text value', content: 'content value', description: 'desc value' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: 'text value', isHtml: true });
        });

        it('should handle 5e format without description field', () => {
            const feat = { name: 'Tough', desc: ['You gain 10 HP'] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should handle array with mixed types returning only first element', () => {
            const feat = { description: [null, '<p>Second item</p>', 'Third'] };
            const result = normalizeFeatDescription(feat);
            // First item is null — source code only checks desc[0], returns empty
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should handle nested object with no recognized properties', () => {
            const feat = { description: [{ foo: 'bar', baz: 42 }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });
    });
});
