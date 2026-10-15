// @maintained-by-ai — deterministic unit tests for savePrompt.js's own contract
// (buildSaveDc arithmetic, createSaveListener payload shape, promptId matching).
// Pure behaviour behind mock boundaries; no timers, no network (setup.js fetch is inert).
// If buildPromptPayload gains a field, extend the exact-payload assertions in one place.
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

// ── Tests ─────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
});

// ─── buildSaveDc ─────────────────────────────────────────────────

describe('buildSaveDc', () => {
    const basePlayerStats = makePlayerStats();

    describe('saveDc === "ability"', () => {
        it('defaults to CON ability when saveAbility is not set', () => {
            getAbilityModifier.mockReturnValue(2);

            const dc = buildSaveDc({ saveDc: 'ability' }, basePlayerStats);

            expect(dc).toBe(13); // 8 + 2 + 3
            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'CON'
            );
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
            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'CHA'
            );
        });

        it('prefers explicit spellAbilities.saveDc over recomputing', () => {
            const stats = makePlayerStats({
                spellAbilities: { saveDc: 18 },
            });

            expect(buildSaveDc({ saveDc: 'spell_save_dc' }, stats)).toBe(18);
            expect(getAbilityModifier).not.toHaveBeenCalled();
        });

        it('uses spellAbilities.modifier when present instead of ability lookup', () => {
            const stats = makePlayerStats({
                spellAbilities: { modifier: 5 },
            });

            const dc = buildSaveDc({ saveDc: 'spell_save_dc' }, stats);

            expect(dc).toBe(16); // 8 + 5 + 3
            expect(getAbilityModifier).not.toHaveBeenCalled();
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
            attackerName: null,
            saveType: 'CON',
            advantage: false,
            disadvantage: false,
            condition: null,
            damageFormula: null,
            damageType: null,
            rawDamage: 0,
            sourceName: null,
            secondaryFormula: null,
            secondaryDamageType: null,
            secondaryRawDamage: 0,
            isSpellDamage: false,
            saveConditions: null,
        });
    });

    // CLA-034: saveConditions (e.g. ['frightened'] from a Fear Ray) must be
    // threaded onto the prompt payload so conditional_advantage passives can
    // key on the SAVE's own condition.
    it('passes through all config fields when provided', () => {
        utils.guid.mockReturnValue('prompt-full');

        createSaveListener(campaignName, {
            targetName: 'Orc',
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'The orc falls prone.',
            advantage: true,
            disadvantage: false,
            saveConditions: ['frightened'],
        });

        expect(sendSavePrompt).toHaveBeenCalledWith(campaignName, {
            promptId: 'prompt-full',
            targetName: 'Orc',
            attackerName: null,
            saveType: 'DEX',
            saveDc: 15,
            dcSuccess: 'The orc falls prone.',
            advantage: true,
            disadvantage: false,
            condition: null,
            damageFormula: null,
            damageType: null,
            rawDamage: 0,
            sourceName: null,
            secondaryFormula: null,
            secondaryDamageType: null,
            secondaryRawDamage: 0,
            isSpellDamage: false,
            saveConditions: ['frightened'],
        });
    });

    it('ignores save-result events with a non-matching promptId and resolves with event.detail on match', async () => {
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

        // Still pending after the mismatched event — the matching event resolves it
        window.dispatchEvent(
            new CustomEvent('save-result', {
                detail: {
                    promptId: 'my-guid',
                    rolled: 17,
                    success: true,
                },
            })
        );

        await Promise.resolve();
        const result = await promise;

        expect(result).toEqual({
            promptId: 'my-guid',
            rolled: 17,
            success: true,
        });
    });
});
