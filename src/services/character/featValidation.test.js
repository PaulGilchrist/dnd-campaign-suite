// @maintained-by-ai
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
    getRaceFeatChoices,
} from './featValidation.js';

function mockValidationRules(rules) {
    dataLoader.loadValidationRules.mockResolvedValue(rules ?? {});
}

// Re-anchored to disk: public/data/rules-validation.json and public/data/2024/rules-validation.json
const FEAT_LEVELS = [4, 8, 12, 16, 19];
const DISK_5E_RULES = { feats: { available_levels: FEAT_LEVELS, origin_feat_required: false } };
const DISK_2024_RULES = {
    feats: { available_levels: FEAT_LEVELS, origin_feat_required: true, origin_feat_level: 1 },
};

// Exact details strings produced by getFeatLimits (pinned to source output)
const DETAILS_5E = 'In 5e, feats are optional and can be taken instead of ability score increases at levels 4, 8, 12, 16, 19';
const DETAILS_2024_ORIGIN = 'Level 1 2024 characters get 1 Origin feat from their background, plus additional feats at levels 4, 8, 12, 16, 19';
const DETAILS_2024_PLAIN = 'In 2024 rules, feats are available at levels 4, 8, 12, 16, 19';

const VERSATILE_HUMAN = {
    name: 'Human',
    traits: [{ name: 'Versatile', proficiency_choices: { from: ['Skilled', 'Lucky', 'Tough'] } }],
};

describe('featValidation', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('getFeatLimits', () => {
        it('returns the full envelope for 5e level 4 from disk rules', async () => {
            mockValidationRules(DISK_5E_RULES);

            const result = await getFeatLimits({ rules: '5e', level: 4 });

            expect(result).toEqual({
                allowed: 1,
                originRequired: false,
                originFeatLevel: 1, // default when the 5e file omits origin_feat_level
                details: DETAILS_5E,
            });
        });

        it.each([
            { level: undefined, allowed: 0, why: 'level defaults to 1' },
            { level: 3, allowed: 0, why: 'just below first feat level' },
            { level: 7, allowed: 1, why: 'just below second feat level' },
            { level: 8, allowed: 2, why: 'exactly at a feat level' },
            { level: 19, allowed: 5, why: 'top feat level' },
        ])('counts allowed feats at level $level ($why)', async ({ level, allowed }) => {
            mockValidationRules(DISK_5E_RULES);

            const result = await getFeatLimits({ rules: '5e', level });

            expect(result.allowed).toBe(allowed);
        });

        it('honours custom available_levels instead of hardcoding defaults', async () => {
            mockValidationRules({ feats: { available_levels: [3, 6, 9], origin_feat_required: false } });

            const result = await getFeatLimits({ rules: '5e', level: 6 });

            expect(result.allowed).toBe(2);
            expect(result.details).toContain('levels 3, 6, 9');
        });

        it('falls back to default 5e levels when rules are empty and ruleset is unspecified', async () => {
            mockValidationRules({});

            const result = await getFeatLimits({ level: 4 });

            expect(dataLoader.loadValidationRules).toHaveBeenCalledWith('5e');
            expect(result).toEqual({
                allowed: 1,
                originRequired: false,
                originFeatLevel: 1,
                details: DETAILS_5E,
            });
        });

        it('falls back to default levels for 2024 with origin-required defaulted off', async () => {
            mockValidationRules({});

            const result = await getFeatLimits({ rules: '2024', level: 4 });

            expect(result.allowed).toBe(1);
            expect(result.originRequired).toBe(false);
            expect(result.details).toBe(DETAILS_2024_PLAIN);
        });

        it('passes 2024 disk origin metadata through at level 1', async () => {
            mockValidationRules(DISK_2024_RULES);

            const result = await getFeatLimits({ rules: '2024', level: 1 });

            expect(result).toEqual({
                allowed: 0,
                originRequired: true,
                originFeatLevel: 1,
                details: DETAILS_2024_ORIGIN,
            });
        });

        it('adds 1 to allowed for a race with the Versatile trait (2024)', async () => {
            mockValidationRules(DISK_2024_RULES);
            dataLoader.fetchRaceData.mockResolvedValue(VERSATILE_HUMAN);

            const result = await getFeatLimits({ rules: '2024', level: 1, race: { name: 'Human' } });

            expect(result.allowed).toBe(1);
            expect(dataLoader.fetchRaceData).toHaveBeenCalledWith('Human', '2024');
        });

        it.each([
            { race: { name: 'Elf' }, fetched: { name: 'Elf', traits: [{ name: 'Fey Ancestry' }] }, why: 'no Versatile trait' },
            { race: { name: 'Human' }, fetched: { name: 'Human', traits: [{ name: 'Versatile' }] }, why: 'Versatile without proficiency_choices' },
            { race: { name: 'Human' }, fetched: { name: 'Human', traits: [{ name: 'Versatile', proficiency_choices: { from: [] } }] }, why: 'Versatile with empty from' },
            { race: null, fetched: null, why: 'null race skips the race fetch' },
        ])('no Versatile bonus when $why', async ({ race, fetched, why }) => {
            mockValidationRules(DISK_2024_RULES);
            dataLoader.fetchRaceData.mockResolvedValue(fetched);

            const result = await getFeatLimits({ rules: '2024', level: 1, race });

            expect(result.allowed).toBe(0);
            if (why === 'null race skips the race fetch') {
                expect(dataLoader.fetchRaceData).not.toHaveBeenCalled();
            }
        });

        it('never consults race data for the Versatile bonus outside 2024', async () => {
            mockValidationRules(DISK_5E_RULES);
            dataLoader.fetchRaceData.mockResolvedValue(VERSATILE_HUMAN);

            const result = await getFeatLimits({ rules: '5e', level: 4, race: { name: 'Human' } });

            expect(result.allowed).toBe(1);
            expect(dataLoader.fetchRaceData).not.toHaveBeenCalled();
        });
    });

    describe('validateFeats', () => {
        const OBSERVER = { name: 'Observer', type: 'Origin Feat' };
        const TOUGH = { name: 'Tough', type: 'General' };

        it('returns no warnings when nothing is selected (empty array or missing field)', async () => {
            mockValidationRules(DISK_5E_RULES);

            expect(await validateFeats({ rules: '5e', level: 4, feats: [] }, [])).toEqual([]);
            expect(await validateFeats({ rules: '5e', level: 4 }, [TOUGH])).toEqual([]);
        });

        it('warns with the exact count message when user selections exceed the limit', async () => {
            mockValidationRules(DISK_5E_RULES);

            const warnings = await validateFeats({ rules: '5e', level: 4, feats: ['Tough', 'Resilient'] }, []);

            expect(warnings).toEqual([
                {
                    message: `Rules allow 1 feat(s) at level 4. You have selected 2 (plus 0 pre-selected feat). (${DETAILS_5E})`,
                    type: 'warning',
                },
            ]);
        });

        it('does not warn when exactly the allowed number is selected', async () => {
            mockValidationRules(DISK_5E_RULES);

            expect(await validateFeats({ rules: '5e', level: 4, feats: ['Tough'] }, [])).toEqual([]);
        });

        it('excludes pre-selected background feats from the user-selected count (2024)', async () => {
            mockValidationRules(DISK_2024_RULES);
            dataLoader.fetchBackgroundData.mockResolvedValue({ feat: 'Observer' });

            const warnings = await validateFeats(
                { rules: '2024', level: 1, feats: ['Observer', 'Tough'], background: 'Acolyte' },
                [OBSERVER, TOUGH],
            );

            // Observer counts as pre-selected: only Tough counts against the level-1 allowance of 0
            expect(warnings).toEqual([
                {
                    message: `Rules allow 0 feat(s) at level 1. You have selected 1 (plus 1 pre-selected feat). (${DETAILS_2024_ORIGIN})`,
                    type: 'warning',
                },
                {
                    message: 'Some selected feats are not Origin feats. Level 1 2024 characters typically take an Origin feat.',
                    type: 'info',
                },
            ]);
        });

        it('warns at 2024 level 1 until an Origin feat is selected', async () => {
            mockValidationRules(DISK_2024_RULES);

            const withoutOrigin = await validateFeats({ rules: '2024', level: 1, feats: ['Tough'] }, [OBSERVER, TOUGH]);
            expect(withoutOrigin).toEqual([
                {
                    message: `Rules allow 0 feat(s) at level 1. You have selected 1 (plus 0 pre-selected feat). (${DETAILS_2024_ORIGIN})`,
                    type: 'warning',
                },
                {
                    message: "Level 1 2024 characters should select an Origin feat. Your selected feats don't include an Origin feat.",
                    type: 'warning',
                },
                {
                    message: 'Some selected feats are not Origin feats. Level 1 2024 characters typically take an Origin feat.',
                    type: 'info',
                },
            ]);

            // Selecting the Origin feat clears both origin warnings (count warning remains)
            const withOrigin = await validateFeats({ rules: '2024', level: 1, feats: ['Observer'] }, [OBSERVER, TOUGH]);
            expect(withOrigin).toHaveLength(1);
            expect(withOrigin[0].message).toContain('You have selected 1 (plus 0 pre-selected feat)');
        });

        it('switches to Versatile-specific origin messages when the race object carries the trait', async () => {
            // Synthetic input: the origin branch reads formData.race.traits directly rather than re-fetching
            mockValidationRules(DISK_2024_RULES);
            dataLoader.fetchRaceData.mockResolvedValue(VERSATILE_HUMAN);

            const warnings = await validateFeats(
                { rules: '2024', level: 1, feats: ['Tough'], race: { name: 'Human', traits: [{ name: 'Versatile' }] } },
                [OBSERVER, TOUGH],
            );

            expect(warnings).toEqual([
                {
                    message: 'Your race has the Versatile trait — you should select an Origin feat of your choice.',
                    type: 'warning',
                },
                {
                    message: 'Consider selecting an Origin feat for your Versatile trait. Skilled is recommended.',
                    type: 'info',
                },
            ]);
        });

        it.each([
            { name: 'Master of Reality', type: 'Epic Boon', level: 10, allFeats: [{ name: 'Master of Reality', type: 'Epic Boon' }], warned: true },
            { name: 'Awakened Mind', type: 'Epic Boon Feat', level: 10, allFeats: [{ name: 'Awakened Mind', type: 'Epic Boon Feat' }], warned: true },
            { name: 'Master of Reality', type: 'Epic Boon', level: 18, allFeats: [{ name: 'Master of Reality', type: 'Epic Boon' }], warned: true },
            { name: 'Master of Reality', type: 'Epic Boon', level: 19, allFeats: [{ name: 'Master of Reality', type: 'Epic Boon' }], warned: false },
            { name: 'Master of Reality', type: 'Epic Boon', level: 10, allFeats: [], warned: false },
        ])('Epic Boon gating: $name at level $level warns=$warned', async ({ name, allFeats, level, warned }) => {
            mockValidationRules(DISK_5E_RULES);

            const warnings = await validateFeats({ rules: '5e', level, feats: [name] }, allFeats);
            const epicWarning = warnings.find((w) => w.message.includes('Epic Boon'));

            if (warned) {
                expect(epicWarning).toEqual({
                    message: `Epic Boon feats are typically available at level 19. You are level ${level}.`,
                    type: 'warning',
                });
            } else {
                expect(epicWarning).toBeUndefined();
            }
        });

        it.each([
            {
                level: 2, feat: { name: 'Ability Score Improvement', prerequisites: ['4th level'] },
                expected: [{ message: 'Ability Score Improvement requires 4th level. You are level 2.', type: 'warning' }],
            },
            {
                level: 4, feat: { name: 'Ability Score Improvement', prerequisites: ['4th level'] },
                expected: [],
            },
            {
                level: 4, feat: { name: 'Crusher', prerequisites: ['Strength 13'] },
                expected: [{ message: 'Crusher requires: Strength 13. Verify your character meets this requirement.', type: 'info' }],
            },
            {
                level: 2, feat: { name: 'Heavy Armor Master', prerequisites: ['4th level', 'Strength 13'] },
                expected: [
                    { message: 'Heavy Armor Master requires 4th level. You are level 2.', type: 'warning' },
                    { message: 'Heavy Armor Master requires: Strength 13. Verify your character meets this requirement.', type: 'info' },
                ],
            },
            {
                level: 2, feat: { name: 'Alert', prerequisites: { name: '4th level' } },
                expected: [{ message: 'Alert requires 4th level. You are level 2.', type: 'warning' }],
            },
            {
                level: 4, feat: { name: 'Mimic', prerequisites: [{ foo: 'bar' }] },
                expected: [],
            },
            {
                level: 4, feat: { name: 'Crusher', prerequisites: ['Strength 13'] },
                feats: ['Crusher', 'Crusher'],
                expected: [{ message: 'Crusher requires: Strength 13. Verify your character meets this requirement.', type: 'info' }],
            },
        ])('prerequisite checks for $feat.name at level $level', async ({ level, feat, feats, expected }) => {
            mockValidationRules(DISK_5E_RULES);

            const warnings = await validateFeats({ rules: '5e', level, feats: feats || [feat.name] }, [feat]);

            // Isolate prerequisite messages from the (already-covered) count warning
            expect(warnings.filter((w) => w.message.includes('requires'))).toEqual(expected);
        });
    });

    describe('getFeatTypeInfo', () => {
        it.each([
            { feat: { name: 'Observer', type: 'Origin Feat' }, expected: { type: 'Origin Feat', isOrigin: true, isEpicBoon: false } },
            { feat: { name: 'Master of Reality', type: 'Epic Boon' }, expected: { type: 'Epic Boon', isOrigin: false, isEpicBoon: true } },
            { feat: { name: 'Awakened Mind', type: 'Epic Boon Feat' }, expected: { type: 'Epic Boon Feat', isOrigin: false, isEpicBoon: true } },
            { feat: { name: 'Tough' }, expected: { type: 'General', isOrigin: false, isEpicBoon: false } },
        ])('classifies $feat.name of type $feat.type', async ({ feat, expected }) => {
            expect(getFeatTypeInfo(feat.name, [feat])).toEqual(expected);
        });

        it('classifies a feat missing from the catalogue as Unknown', () => {
            expect(getFeatTypeInfo('Nonexistent Feat', [])).toEqual({ type: 'Unknown', isOrigin: false, isEpicBoon: false });
        });
    });

    describe('getPreSelectedFeats', () => {
        it('returns the normalized background feat for 2024', async () => {
            dataLoader.fetchBackgroundData.mockResolvedValue({ feat: 'Magic Initiate (Druid)' });

            const result = await getPreSelectedFeats({ rules: '2024', background: 'Acolyte' });

            expect(result).toEqual(['Magic Initiate']);
            expect(dataLoader.fetchBackgroundData).toHaveBeenCalledWith('Acolyte', '2024');
        });

        it.each([
            { formData: { rules: '5e', background: 'Acolyte' }, why: '5e has no automatic background feats' },
            { formData: { rules: '2024' }, why: 'no background selected' },
        ])('returns [] without fetching when $why', async ({ formData }) => {
            expect(await getPreSelectedFeats(formData)).toEqual([]);
            expect(dataLoader.fetchBackgroundData).not.toHaveBeenCalled();
        });

        it.each([
            { backgroundData: null },
            { backgroundData: {} },
        ])('returns [] when background data has no feat ($backgroundData)', async ({ backgroundData }) => {
            dataLoader.fetchBackgroundData.mockResolvedValue(backgroundData);

            expect(await getPreSelectedFeats({ rules: '2024', background: 'Charlatan' })).toEqual([]);
        });
    });

    describe('getRaceFeatChoices', () => {
        it('returns Versatile trait choices for 2024', async () => {
            dataLoader.fetchRaceData.mockResolvedValue(VERSATILE_HUMAN);

            const result = await getRaceFeatChoices({ rules: '2024', race: { name: 'Human' } });

            expect(result).toEqual(['Skilled', 'Lucky', 'Tough']);
            expect(dataLoader.fetchRaceData).toHaveBeenCalledWith('Human', '2024');
        });

        it.each([
            { formData: { rules: '2024', race: { name: 'Elf' } }, fetched: { name: 'Elf', traits: [{ name: 'Fey Ancestry' }] }, fetches: true },
            { formData: { rules: '5e', race: { name: 'Human' } }, fetched: VERSATILE_HUMAN, fetches: false },
            { formData: { rules: '2024', race: null }, fetched: null, fetches: false },
            { formData: { rules: '2024', race: {} }, fetched: VERSATILE_HUMAN, fetches: false },
            { formData: { rules: '2024', race: { name: 'Human' } }, fetched: { name: 'Human', traits: [{ name: 'Versatile' }] }, fetches: true },
            { formData: { rules: '2024', race: { name: 'Human' } }, fetched: { name: 'Human', traits: [{ name: 'Versatile', proficiency_choices: { from: [] } }] }, fetches: true },
        ])('returns no choices for $formData.ruleset race input', async ({ formData, fetched, fetches }) => {
            dataLoader.fetchRaceData.mockResolvedValue(fetched);

            expect(await getRaceFeatChoices(formData)).toEqual([]);
            expect(dataLoader.fetchRaceData).toHaveBeenCalledTimes(fetches ? 1 : 0);
        });
    });

    describe('normalizeFeatDescription', () => {
        it.each([
            { input: {}, expected: { text: '', isHtml: false } },
            { input: { description: null }, expected: { text: '', isHtml: false } },
            { input: { description: [] }, expected: { text: '', isHtml: false } },
            { input: { description: [null, undefined] }, expected: { text: '', isHtml: false } },
            { input: { name: 'Tough', desc: ['You gain 10 HP'] }, expected: { text: '', isHtml: false } },
            { input: { description: '<p>Gain +1 Strength</p>' }, expected: { text: '<p>Gain +1 Strength</p>', isHtml: true } },
            { input: { description: ['<p>A</p>', '<p>B</p>'] }, expected: { text: '<p>A</p>', isHtml: true } },
            { input: { description: [null, '<p>Second item</p>'] }, expected: { text: '', isHtml: false } },
            { input: { description: [{ text: '<p>Text</p>' }] }, expected: { text: '<p>Text</p>', isHtml: true } },
            { input: { description: [{ content: '<p>Content</p>' }] }, expected: { text: '<p>Content</p>', isHtml: true } },
            { input: { description: [{ description: '<p>Desc</p>' }] }, expected: { text: '<p>Desc</p>', isHtml: true } },
            { input: { description: [{ text: 'text value', content: 'content value', description: 'desc value' }] }, expected: { text: 'text value', isHtml: true } },
            { input: { description: [{ level: 1, name: 'Some Feat' }] }, expected: { text: '', isHtml: false } },
            { input: { description: [{ foo: 'bar', baz: 42 }] }, expected: { text: '', isHtml: false } },
        ])('normalizes $input → $expected.text', async ({ input, expected }) => {
            expect(normalizeFeatDescription(input)).toEqual(expected);
        });
    });
});
