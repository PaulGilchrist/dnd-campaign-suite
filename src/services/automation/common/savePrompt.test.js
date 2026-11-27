// @maintained-by-ai 2026-11-26
// Deterministic unit tests for savePrompt.js's CONSTRUCTION/DISPATCH lane:
// buildSaveDc arithmetic, createSaveListener's exact sendSavePrompt payload
// (the modal contract) + promptId routing, and the registerLiveSaveListener/
// unregisterLiveSaveListener pair the modal-family arms (SaveAttackAoeModal)
// use to project liveness — the ONLY pin these exports have anywhere.
// Downstream lanes live in the sibling files: drain-to-evict
// (savePrompt.drain-evict), dropPendingSavePrompt (…drop-pending),
// consumerless lapse copies + owner-tab stamp/pagehide (…consumerless-
// resolution), dismiss detach (…dismiss-detach), save_result attribution +
// suppressOutcomeLog (…save-result-attribution), logSaveDismissed
// (…log-save-dismissed). No timers, no network (logService is mocked).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    buildSaveDc,
    createSaveListener,
    registerLiveSaveListener,
    unregisterLiveSaveListener,
    resolveConsumerlessSavePrompt,
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

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Re-import mocked modules ─────────────────────────────────────

const { sendSavePrompt } = await import(
    '../../combat/conditions/savePromptService.js'
);
const utils = await import('../../ui/utils.js').then((m) => m.default);
const { getAbilityModifier } = await import(
    '../../shared/abilityLookup.js'
);
const { addEntry } = await import('../../ui/logService.js');

// Real runtime store for the liveness-pair test (sibling convention,
// savePrompt.drain-evict / …consumerless-resolution).
import {
    setRuntimeValue,
    clearRuntimeState,
    getAllStoreKeys,
    listeners,
} from '../../../hooks/runtime/useRuntimeState.js';

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
    for (const key of getAllStoreKeys()) clearRuntimeState(key);
    listeners.clear();
});

// ─── buildSaveDc ─────────────────────────────────────────────────

describe('buildSaveDc', () => {
    const basePlayerStats = makePlayerStats();

    describe('saveDc === "ability"', () => {
        it('defaults to CON ability when saveAbility is not set', () => {
            getAbilityModifier.mockReturnValue(2);

            const dc = buildSaveDc({ saveDc: 'ability' }, basePlayerStats);

            expect(dc).toBe(13); // 8 + 2 + 3
            // Seam contract: WHICH ability modifier the lookup is asked for.
            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'CON'
            );
        });

        it.each([
            ['a string', 'STR'],
            ['an array', ['STR', 'DEX']],
        ])('uses the first saveAbility when provided as %s', (_shape, saveAbility) => {
            getAbilityModifier.mockReturnValue(3);

            const dc = buildSaveDc(
                { saveDc: 'ability', saveAbility },
                basePlayerStats
            );

            expect(dc).toBe(14); // 8 + 3 + 3
            expect(getAbilityModifier).toHaveBeenCalledWith(
                basePlayerStats.abilities,
                'STR'
            );
        });

        it('propagates a negative ability modifier', () => {
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
        it('returns numeric saveDc as-is, including 0 (never a truthiness demotion)', () => {
            expect(buildSaveDc({ saveDc: 15 }, basePlayerStats)).toBe(15);
            expect(buildSaveDc({ saveDc: 0 }, basePlayerStats)).toBe(0);
        });

        it('returns default 10 when saveDc is undefined, null, or empty', () => {
            expect(buildSaveDc({}, basePlayerStats)).toBe(10);
            expect(buildSaveDc({ saveDc: null }, basePlayerStats)).toBe(10);
            expect(buildSaveDc({ saveDc: '' }, basePlayerStats)).toBe(10);
        });

        it('returns default 10 for a missing playerStats (guard branch)', () => {
            expect(buildSaveDc({ saveDc: 'ability' }, null)).toBe(10);
            expect(buildSaveDc({ saveDc: 'spell_save_dc' }, undefined)).toBe(10);
        });
    });
});

// ─── createSaveListener ────────────────────────────────────────────

describe('createSaveListener', () => {
    const campaignName = 'TestCampaign';

    it('dispatches the exact prompt payload with defaults for an unadorned config', () => {
        utils.guid.mockReturnValue('prompt-abc');

        createSaveListener(campaignName, { targetName: 'Orc' });

        expect(sendSavePrompt).toHaveBeenLastCalledWith(campaignName, {
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
            suppressOutcomeLog: false,
        });
    });

    // CLA-034: saveConditions (e.g. ['frightened'] from a Fear Ray) must be
    // threaded onto the prompt payload so conditional_advantage passives can
    // key on the SAVE's own condition.
    it('threads every provided config field onto the payload unchanged', () => {
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

        expect(sendSavePrompt).toHaveBeenLastCalledWith(campaignName, {
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
            suppressOutcomeLog: false,
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

        const result = await promise;

        expect(result).toEqual({
            promptId: 'my-guid',
            rolled: 17,
            success: true,
        });
    });
});

// ─── Modal-family liveness pair ────────────────────────────────────
// SaveAttackAoeModal / the condition modals arm prompts WITHOUT
// createSaveListener — their live consumer is a page-local React listener,
// so they project liveness through register/unregisterLiveSaveListener.
// While registered, resolveConsumerlessSavePrompt must no-op (a live chain
// writes the outcome rows); after detach the honest lapse pair rides again
// (lapse-copy wording itself is pinned by …consumerless-resolution).

describe('registerLiveSaveListener / unregisterLiveSaveListener', () => {
    const campaignName = 'TestCampaign';
    const MODAL_PROMPT = {
        promptId: 'modal-1',
        targetName: 'Goblin',
        saveType: 'DEX',
        saveDc: 14,
        sourceName: 'Fear Ray',
    };
    const DETAIL = { promptId: 'modal-1', success: true, roll: 15, saveBonus: 4, total: 19 };

    beforeEach(() => {
        // Modal-family shape: listener-book row WITHOUT a createSaveListener
        // arm (this page never ran createSaveListener for 'modal-1').
        setRuntimeValue('campaign', 'pendingSaveListenerPrompts', ['modal-1'], campaignName);
    });

    it('suppresses the consumerless rescue while registered and re-arms the honest rows after unregister', () => {
        registerLiveSaveListener('modal-1');
        resolveConsumerlessSavePrompt(campaignName, MODAL_PROMPT, DETAIL);
        expect(addEntry).not.toHaveBeenCalled();

        unregisterLiveSaveListener('modal-1');
        resolveConsumerlessSavePrompt(campaignName, MODAL_PROMPT, DETAIL);

        const rows = addEntry.mock.calls.map(([, entry]) => entry);
        expect(rows.some((e) => e.type === 'save_result')).toBe(true);
        expect(rows.some((e) => e.automationType === 'save_lapsed')).toBe(true);
    });

    it('is inert for falsy promptIds (register/unregister never throw, liveness unchanged)', () => {
        expect(() => registerLiveSaveListener()).not.toThrow();
        expect(() => unregisterLiveSaveListener(null)).not.toThrow();

        // Nothing was registered, so the rescue lane stays active.
        resolveConsumerlessSavePrompt(campaignName, MODAL_PROMPT, DETAIL);
        expect(addEntry).toHaveBeenCalled();
    });
});
