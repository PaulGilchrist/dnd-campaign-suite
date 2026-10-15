// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../services/ui/logService.js';
import { handleSanctuarySave } from './handleSanctuarySave.js';

// Seam only: casting/removal of the sanctuary targetEffect is owned by
// automation/handlers/spells/sanctuaryHandler.js — this file guards the
// WIS-save gate that blocks save-based damage until the prompt resolves.

const PROMPT_ID = 'test-guid-1234';
const CONTEXT = { targetName: 'Ally', saveDc: 12, saveType: 'dex' };

const sanctuaryEffect = (overrides = {}) => ({
    effect: 'sanctuary',
    target: 'Ally',
    source: 'Cleric',
    saveDc: 13,
    ...overrides,
});

// Sanctuary active on Ally (cast by Cleric); pending prompts fresh per read,
// like the serialized runtime store.
const mockSanctuaryActive = (pending = {}) => {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [sanctuaryEffect()];
        if (key === 'campaign' && prop === 'pendingSavePrompts') return { ...pending };
        return null;
    });
};

// The handler registers its save-result listener synchronously before
// awaiting, so dispatching in the same tick resolves it.
const dispatchSaveResult = (detail) => {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
};

// Value passed to the LAST setRuntimeValue('campaign', 'pendingSavePrompts', ...) call
const lastPendingWrite = () =>
    setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === 'pendingSavePrompts').at(-1)[2];

describe('handleSanctuarySave', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('no sanctuary check performed', () => {
        it.each([
            [undefined, 'undefined context'],
            [null, 'null context'],
            [{ saveDc: 12, saveType: 'wis' }, 'missing targetName'],
            [{ targetName: 'Ally', saveType: 'wis' }, 'missing saveDc'],
            [{ targetName: 'Ally', saveDc: 12 }, 'missing saveType'],
        ])('returns { blocked: false } for %s without reading effects', (context, _label) => {
            return handleSanctuarySave('Goblin', 'test-campaign', context, null).then((result) => {
                expect(result).toEqual({ blocked: false });
                expect(getRuntimeValue).not.toHaveBeenCalled();
                expect(sendSavePrompt).not.toHaveBeenCalled();
            });
        });
    });

    describe('no matching sanctuary effect', () => {
        it.each([
            ['null targetEffects', () => null],
            ['empty targetEffects', () => []],
            ['sanctuary on a different target', () => [sanctuaryEffect({ target: 'OtherAlly' })]],
            ['sanctuary cast by the attacker', () => [sanctuaryEffect({ source: 'Goblin' })]],
            ['a different (non-sanctuary) effect on the target', () => [{ effect: 'shield', target: 'Ally', source: 'Cleric' }]],
        ])('returns { blocked: false } when %s', (_label, effects) => {
            getRuntimeValue.mockImplementation((key, prop) =>
                key === 'campaign' && prop === 'targetEffects' ? effects() : null);

            return handleSanctuarySave('Goblin', 'test-campaign', CONTEXT, null).then((result) => {
                expect(result).toEqual({ blocked: false });
                expect(sendSavePrompt).not.toHaveBeenCalled();
            });
        });
    });

    describe('sanctuary save prompt flow', () => {
        // NOTE: in the prompt, targetName is the ATTACKER (Goblin) making the
        // WIS save to be allowed to harm the warded Ally.
        it('prompts a WIS save, blocks damage and logs when the save fails', async () => {
            mockSanctuaryActive({ 'other-prompt': { promptId: 'other-prompt' } });

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', CONTEXT, null);
            dispatchSaveResult({ promptId: PROMPT_ID, success: false });

            const result = await invokePromise;

            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                promptId: PROMPT_ID,
                targetName: 'Goblin',
                attackerName: 'Cleric',
                saveType: 'WIS',
                saveDc: 13,
                condition: 'sanctuary',
            }));

            expect(result).toEqual({
                blocked: true,
                description: 'Goblin failed WIS save against Sanctuary on Ally. The spell is lost.',
            });

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: false,
                characterName: 'Cleric',
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'WIS',
            }));

            // Resolution removes this prompt but preserves unrelated pending prompts
            const finalPending = lastPendingWrite();
            expect(finalPending).not.toHaveProperty(PROMPT_ID);
            expect(finalPending).toHaveProperty('other-prompt');
        });

        it('allows damage and logs when the save succeeds', async () => {
            mockSanctuaryActive({ 'other-prompt': { promptId: 'other-prompt' } });

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', CONTEXT, null);
            dispatchSaveResult({ promptId: PROMPT_ID, success: true });

            const result = await invokePromise;

            expect(result).toEqual({ blocked: false });

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: true,
                characterName: 'Cleric',
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'WIS',
            }));

            expect(lastPendingWrite()).not.toHaveProperty(PROMPT_ID);
        });

        it('ignores save-result events with a mismatched promptId', async () => {
            mockSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', CONTEXT, null);

            dispatchSaveResult({ promptId: 'wrong-id', success: false });

            dispatchSaveResult({ promptId: PROMPT_ID, success: true });

            const result = await invokePromise;
            expect(result).toEqual({ blocked: false });
        });

        it('defaults saveDc to 8 and logs when the targetEffect has no saveDc', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') return [sanctuaryEffect({ saveDc: undefined })];
                if (key === 'campaign' && prop === 'pendingSavePrompts') return {};
                return null;
            });

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', CONTEXT, null);
            dispatchSaveResult({ promptId: PROMPT_ID, success: false });

            await invokePromise;

            expect(consoleSpy).toHaveBeenCalledWith(
                '[sanctuary] Missing saveDc on targetEffect for target',
                'Ally',
                '— defaulting to 8'
            );
            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                saveDc: 8,
            }));
        });
    });

    describe('log failures never break the damage lane', () => {
        it.each([true, false])('resolves normally when addEntry rejects (save success=%s)', async (success) => {
            addEntry.mockRejectedValue(new Error('DB error'));
            mockSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', CONTEXT, null);
            dispatchSaveResult({ promptId: PROMPT_ID, success });

            const result = await invokePromise;

            expect(result.blocked).toBe(!success);
            expect(consoleSpy).toHaveBeenCalled();
        });
    });
});
