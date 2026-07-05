// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
    loadValidationRules: vi.fn(),
    fetchBackgroundData: vi.fn(),
}));

import {
    getFeatLimits,
    validateFeats,
    getFeatTypeInfo,
    getPreSelectedFeats,
    normalizeFeatDescription
} from './featValidation.js';

describe('featValidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getFeatLimits', () => {
        it.each([
            [4, 1],
            [8, 2],
            [19, 5],
        ])('should return correct feat limits for 5e at level %s (allowed: %s)', async (level, expected) => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const result = await getFeatLimits({ rules: '5e', level: 4 });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(false);
            expect(result).toHaveProperty('originFeatLevel');
            expect(result).toHaveProperty('details');
        });

        it('should return correct feat limits for 5e at level 8', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const result = await getFeatLimits({ rules: '5e', level: 8 });

            expect(result.allowed).toBe(2);
        });

        it('should return 0 feats for level below first feat level in 5e', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const result = await getFeatLimits({ rules: '5e', level: 3 });

            expect(result.allowed).toBe(0);
        });

        it('should count all feat levels at the highest level', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const result = await getFeatLimits({ rules: '5e', level: 19 });

            expect(result.allowed).toBe(5);
        });

        it('should use default 5e levels when feats not in rules', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({});

            const result = await getFeatLimits({ rules: '5e', level: 4 });

            expect(result.allowed).toBe(1);
        });

        it('should use default 5e levels when rules is undefined', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({});

            const result = await getFeatLimits({ level: 4 });

            expect(result.allowed).toBe(1);
        });

        it('should use default 2024 levels when feats not in rules', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({});

            const result = await getFeatLimits({ rules: '2024', level: 1 });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(false);
        });

        it('should use default 2024 levels at level 4', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({});

            const result = await getFeatLimits({ rules: '2024', level: 4 });

            expect(result.allowed).toBe(2);
        });

        it('should return origin feat info from rules when present', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true,
                    origin_feat_level: 1
                }
            });

            const result = await getFeatLimits({ rules: '2024', level: 1 });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(true);
            expect(result.originFeatLevel).toBe(1);
        });

        it('should return 0 for level 1 with 5e rules', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const result = await getFeatLimits({ rules: '5e', level: 1 });

            expect(result.allowed).toBe(0);
        });

        it('should handle undefined level defaulting to 1', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const result = await getFeatLimits({ rules: '5e' });

            expect(result.allowed).toBe(0);
        });
    });

    describe('validateFeats', () => {
        it('should return empty warnings when no feats selected', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: []
            }, []);

            expect(warnings).toEqual([]);
        });

        it('should warn when too many feats selected', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Tough', 'Resilient']
            }, []);

            expect(warnings).toHaveLength(1);
            expect(warnings[0].type).toBe('warning');
            expect(warnings[0].message).toContain('Rules allow 1 feat');
            expect(warnings[0].message).toContain('selected 2');
        });

        it('should not warn when exactly the allowed number of feats selected', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Tough']
            }, []);

            expect(warnings).toEqual([]);
        });

        it('should warn about origin feat requirement in 2024 at level 1', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true
                }
            });

            const allFeats = [
                { name: 'Observer', type: 'Origin Feat' },
                { name: 'Tough', type: 'General' }
            ];

            const warnings = await validateFeats({
                rules: '2024',
                level: 1,
                feats: ['Tough']
            }, allFeats);

            const originWarning = warnings.find(w => w.message.includes('Origin feat'));
            expect(originWarning).toBeDefined();
            expect(originWarning.type).toBe('warning');
        });

        it('should not warn about origin feat when origin feat is selected', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [1, 4, 8, 12, 16, 19],
                    origin_feat_required: true
                }
            });

            const allFeats = [
                { name: 'Observer', type: 'Origin Feat' },
                { name: 'Tough', type: 'General' }
            ];

            const warnings = await validateFeats({
                rules: '2024',
                level: 1,
                feats: ['Observer']
            }, allFeats);

            const originWarning = warnings.find(w => w.message.includes('Origin feat'));
            expect(originWarning).toBeUndefined();
        });

        it('should warn about Epic Boon feats at low levels', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Master of Reality', type: 'Epic Boon' }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 10,
                feats: ['Master of Reality']
            }, allFeats);

            const epicWarning = warnings.find(w => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeDefined();
            expect(epicWarning.type).toBe('warning');
            expect(epicWarning.message).toContain('level 19');
            expect(epicWarning.message).toContain('level 10');
        });

        it('should not warn about Epic Boon feats at level 19', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Master of Reality', type: 'Epic Boon' }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 19,
                feats: ['Master of Reality']
            }, allFeats);

            const epicWarning = warnings.find(w => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeUndefined();
        });

        it('should warn about Epic Boon Feat type at low levels', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Awakened Mind', type: 'Epic Boon Feat' }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 10,
                feats: ['Awakened Mind']
            }, allFeats);

            const epicWarning = warnings.find(w => w.message.includes('Epic Boon'));
            expect(epicWarning).toBeDefined();
        });

        it('should warn about level prerequisites', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Ability Score Improvement', prerequisites: ['4th level'] }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 2,
                feats: ['Ability Score Improvement']
            }, allFeats);

            const prereqWarning = warnings.find(w => w.message.includes('Ability Score Improvement'));
            expect(prereqWarning).toBeDefined();
            expect(prereqWarning.type).toBe('warning');
            expect(prereqWarning.message).toContain('4th level');
        });

        it('should not warn about level prerequisites when level is sufficient', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Ability Score Improvement', prerequisites: ['4th level'] }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Ability Score Improvement']
            }, allFeats);

            const prereqWarning = warnings.find(w => w.message.includes('Ability Score Improvement'));
            expect(prereqWarning).toBeUndefined();
        });

        it('should warn about ability score prerequisites', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Crusher', prerequisites: ['Strength 13'] }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Crusher']
            }, allFeats);

            const abilityWarning = warnings.find(w => w.message.includes('Crusher'));
            expect(abilityWarning).toBeDefined();
            expect(abilityWarning.type).toBe('info');
            expect(abilityWarning.message).toContain('Strength');
        });

        it('should handle missing feats in formData', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const warnings = await validateFeats({
                rules: '5e',
                level: 4
            }, []);

            expect(warnings).toEqual([]);
        });

        it('should handle multiple prerequisites on a single feat', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Heavy Armor Master', prerequisites: ['4th level', 'Strength 13'] }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 2,
                feats: ['Heavy Armor Master']
            }, allFeats);

            const levelWarning = warnings.find(w => w.message.includes('4th level'));
            const abilityWarning = warnings.find(w => w.message.includes('Strength'));
            expect(levelWarning).toBeDefined();
            expect(abilityWarning).toBeDefined();
        });

        it('should handle prereq as object with name property', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Some Feat', prerequisites: [{ name: 'Level 4' }] }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 2,
                feats: ['Some Feat']
            }, allFeats);

            expect(Array.isArray(warnings)).toBe(true);
        });

        it('should handle prereq as object with no name property', async () => {
            vi.mocked(dataLoader.loadValidationRules).mockResolvedValue({
                feats: {
                    available_levels: [4, 8, 12, 16, 19],
                    origin_feat_required: false
                }
            });

            const allFeats = [
                { name: 'Some Feat', prerequisites: [{ foo: 'bar' }] }
            ];

            const warnings = await validateFeats({
                rules: '5e',
                level: 4,
                feats: ['Some Feat']
            }, allFeats);

            expect(Array.isArray(warnings)).toBe(true);
        });
    });

    describe('getFeatTypeInfo', () => {
        it('should return type info for a known Origin Feat', () => {
            const allFeats = [
                { name: 'Observer', type: 'Origin Feat' }
            ];

            const result = getFeatTypeInfo('Observer', allFeats);

            expect(result.type).toBe('Origin Feat');
            expect(result.isOrigin).toBe(true);
            expect(result.isEpicBoon).toBe(false);
        });

        it('should return type info for an Epic Boon feat', () => {
            const allFeats = [
                { name: 'Master of Reality', type: 'Epic Boon' }
            ];

            const result = getFeatTypeInfo('Master of Reality', allFeats);

            expect(result.type).toBe('Epic Boon');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(true);
        });

        it('should return type info for Epic Boon Feat type', () => {
            const allFeats = [
                { name: 'Awakened Mind', type: 'Epic Boon Feat' }
            ];

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
            const allFeats = [
                { name: 'Tough' }
            ];

            const result = getFeatTypeInfo('Tough', allFeats);

            expect(result.type).toBe('General');
            expect(result.isOrigin).toBe(false);
            expect(result.isEpicBoon).toBe(false);
        });
    });

    describe('getPreSelectedFeats', () => {
        it('should return pre-selected feats from background in 2024', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
                feat: 'Observer'
            });

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Acolyte'
            });

            expect(result).toEqual(['Observer']);
        });

        it('should strip parenthetical from background feat names', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
                feat: 'Magic Initiate (Druid)'
            });

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Acolyte'
            });

            expect(result).toEqual(['Magic Initiate']);
        });

        it('should return empty array for 5e backgrounds', async () => {
            const result = await getPreSelectedFeats({
                rules: '5e',
                background: 'Acolyte'
            });

            expect(result).toEqual([]);
        });

        it('should return empty array when no background specified', async () => {
            const result = await getPreSelectedFeats({
                rules: '2024'
            });

            expect(result).toEqual([]);
        });

        it('should return empty array when background has no feat', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Charlatan'
            });

            expect(result).toEqual([]);
        });

        it('should return empty array when background data is null', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Charlatan'
            });

            expect(result).toEqual([]);
        });

        it('should return empty array when background data has no feat property', async () => {
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ description: 'Some background' });

            const result = await getPreSelectedFeats({
                rules: '2024',
                background: 'Charlatan'
            });

            expect(result).toEqual([]);
        });

        it('should not call fetchBackgroundData for 5e ruleset', async () => {
            await getPreSelectedFeats({
                rules: '5e',
                background: 'Acolyte'
            });

            expect(dataLoader.fetchBackgroundData).not.toHaveBeenCalled();
        });
    });

    describe('normalizeFeatDescription', () => {
        it('should return empty text and isHtml false for feat with no description', () => {
            const feat = {};
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should return empty text for feat with null description', () => {
            const feat = { description: null };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should return empty text for feat with undefined description', () => {
            const feat = { description: undefined };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
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

        it('should handle 2024 format with array description containing object with text (HTML)', () => {
            const feat = { description: [{ text: '<p>Gain +1 Strength</p>' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '<p>Gain +1 Strength</p>', isHtml: true });
        });

        it('should handle 2024 format with array description containing object with content (HTML)', () => {
            const feat = { description: [{ content: '<p>Gain +1 Strength</p>' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '<p>Gain +1 Strength</p>', isHtml: true });
        });

        it('should handle 2024 format with array description containing object with description (HTML)', () => {
            const feat = { description: [{ description: '<p>Gain +1 Strength</p>' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '<p>Gain +1 Strength</p>', isHtml: true });
        });

        it('should return empty when description is an empty array', () => {
            const feat = { description: [] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should return empty when description array has only falsy elements', () => {
            const feat = { description: [null, undefined] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should return empty when description object has level property (unexpected structure)', () => {
            const feat = { description: [{ level: 1, name: 'Some Feat' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should return empty when description array has object with no valid content fields', () => {
            const feat = { description: [{ level: 1 }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: '', isHtml: false });
        });

        it('should prioritize text over content over description in nested objects', () => {
            const feat = { description: [{ text: 'text value', content: 'content value', description: 'desc value' }] };
            const result = normalizeFeatDescription(feat);
            expect(result).toEqual({ text: 'text value', isHtml: true });
        });
    });
});
