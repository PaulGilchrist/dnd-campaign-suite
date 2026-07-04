// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    buildSaveDc,
    createSaveListener,
} from './savePrompt.js';

// ── Dependency mocks ──────────────────────────────────────────────

vi.mock('../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { guid: vi.fn() },
}));

vi.mock('../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

// ── Re-import mocked modules ─────────────────────────────────────

const { sendSavePrompt } = await import(
    '../../combat/conditions/savePromptService.js'
);
const utils = await import('../../ui/utils.js').then((m) => m.default);
const { getAbilityModifier } = await import(
    '../../shared/abilityLookup.js'
);

// ── Test fixtures ─────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'Hero',
        abilities: [
            { name: 'Strength', bonus: 3 },
            { name: 'Dexterity', bonus: 1 },
            { name: 'Constitution', bonus: 2 },
            { name: 'Intelligence', bonus: -1 },
            { name: 'Wisdom', bonus: 0 },
            { name: 'Charisma', bonus: 4 },
        ],
        proficiency: 3,
        ...overrides,
    };
}

// ── Helpers ───────────────────────────────────────────────────────

function resetMocks() {
    vi.clearAllMocks();
}

// ── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
    resetMocks();
});

// ─── buildSaveDc ─────────────────────────────────────────────────

describe('buildSaveDc', () => {
    const basePlayerStats = makePlayerStats();

    describe('saveDc === "ability"', () => {
        it('defaults to CON ability when saveAbility is not set', () => {
            getAbilityModifier.mockReturnValue(2);

            const dc = buildSaveDc({ saveDc: 'ability' }, basePlayerStats);

            expect(dc).toBe(13); // 8 + 2 + 3
        });

        it('uses explicit saveAbility when provided as string', () => {
            getAbilityModifier.mockReturnValue(3);

            const dc = buildSaveDc(
                { saveDc: 'ability', saveAbility: 'STR' },
                basePlayerStats
            );

            expect(dc).toBe(14); // 8 + 3 + 3
            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'STR'
            );
        });

        it('uses first element when saveAbility is an array', () => {
            getAbilityModifier.mockReturnValue(5);

            const dc = buildSaveDc(
                { saveDc: 'ability', saveAbility: ['STR', 'DEX'] },
                basePlayerStats
            );

            expect(dc).toBe(16); // 8 + 5 + 3
            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'STR'
            );
        });

        it('handles negative ability modifier', () => {
            getAbilityModifier.mockReturnValue(-1);

            const dc = buildSaveDc(
                { saveDc: 'ability', saveAbility: 'INT' },
                basePlayerStats
            );

            expect(dc).toBe(10); // 8 + (-1) + 3
        });
    });

    describe('saveDc === "spell_save_dc"', () => {
        it('uses CHA ability modifier with proficiency', () => {
            getAbilityModifier.mockReturnValue(4);

            const dc = buildSaveDc({ saveDc: 'spell_save_dc' }, basePlayerStats);

            expect(dc).toBe(15); // 8 + 4 + 3
        });
    });

    describe('fallback (numeric or missing saveDc)', () => {
        it('returns numeric saveDc as-is', () => {
            expect(buildSaveDc({ saveDc: 15 }, basePlayerStats)).toBe(15);
        });

        it('returns default 10 when saveDc is undefined, null, or empty', () => {
            expect(buildSaveDc({}, basePlayerStats)).toBe(10);
            expect(buildSaveDc({ saveDc: null }, basePlayerStats)).toBe(10);
            expect(buildSaveDc({ saveDc: '' }, basePlayerStats)).toBe(10);
        });
    });
});

// ─── createSaveListener ────────────────────────────────────────────

describe('createSaveListener', () => {
    const campaignName = 'TestCampaign';

    it('calls sendSavePrompt with correct data including defaults', () => {
        utils.guid.mockReturnValue('prompt-abc');

        createSaveListener(campaignName, { targetName: 'Orc' });

        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, {
            promptId: 'prompt-abc',
            targetName: 'Orc',
            saveType: 'CON',
            advantage: false,
            disadvantage: false,
        });
    });

    it('passes through all config fields when provided', () => {
        utils.guid.mockReturnValue('prompt-full');

        createSaveListener(campaignName, {
            targetName: 'Orc',
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'The orc falls prone.',
            advantage: true,
            disadvantage: false,
        });

        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, {
            promptId: 'prompt-full',
            targetName: 'Orc',
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'The orc falls prone.',
            advantage: true,
            disadvantage: false,
        });
    });

    it('resolves with event.detail when matching promptId is received', async () => {
        utils.guid.mockReturnValue('matching-guid');

        const { promise } = createSaveListener(campaignName, {
            targetName: 'Goblin',
        });

        window.dispatchEvent(
            new CustomEvent('save-result', {
                detail: {
                    promptId: 'matching-guid',
                    rolled: 17,
                    success: true,
                },
            })
        );

        await Promise.resolve();
        const result = await promise;

        expect(result).toEqual({
            promptId: 'matching-guid',
            rolled: 17,
            success: true,
        });
    });

    it('ignores events with non-matching promptId', async () => {
        utils.guid.mockReturnValue('my-guid');

        const { promise } = createSaveListener(campaignName, {
            targetName: 'Goblin',
        });

        window.dispatchEvent(
            new CustomEvent('save-result', {
                detail: { promptId: 'wrong-guid', rolled: 1 },
            })
        );

        await Promise.resolve();

        // The promise should still be pending — dispatch another event
        // to actually resolve it
        window.dispatchEvent(
            new CustomEvent('save-result', {
                detail: { promptId: 'my-guid', rolled: 20 },
            })
        );

        await Promise.resolve();
        const result = await promise;

        expect(result).toEqual({ promptId: 'my-guid', rolled: 20 });
    });
});
