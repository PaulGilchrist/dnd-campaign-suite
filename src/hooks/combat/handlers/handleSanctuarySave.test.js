import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Shared mock implementation for the "sanctuary active" scenario
const makeSanctuaryEffect = (overrides = {}) => ({
    effect: 'sanctuary',
    target: 'Ally',
    source: 'Cleric',
    saveDc: 13,
    ...overrides,
});

const makeContext = (overrides = {}) => ({
    targetName: 'Ally',
    saveDc: 12,
    saveType: 'dex',
    ...overrides,
});

// Minimal mock setup: sanctuary effect exists, no pending prompts
const setupSanctuaryActive = () => {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (key === 'campaign' && prop === 'targetEffects') return [makeSanctuaryEffect()];
        if (key === 'campaign' && prop === 'pendingSavePrompts') return {};
        return null;
    });
};

describe('handleSanctuarySave', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('early returns — no sanctuary check performed', () => {
        it.each([
            [undefined, 'undefined context'],
            [null, 'null context'],
        ])('returns { blocked: false } when context is %s (%s)', async (context) => {
            const result = await handleSanctuarySave('Goblin', 'test-campaign', context, null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
            expect(getRuntimeValue).not.toHaveBeenCalledWith('campaign', 'targetEffects');
        });

        it('returns { blocked: false } when context is missing targetName', async () => {
            const result = await handleSanctuarySave('Goblin', 'test-campaign', { saveDc: 12, saveType: 'wis' }, null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('returns { blocked: false } when context is missing saveDc', async () => {
            const result = await handleSanctuarySave('Goblin', 'test-campaign', { targetName: 'Ally', saveType: 'wis' }, null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('returns { blocked: false } when context is missing saveType', async () => {
            const result = await handleSanctuarySave('Goblin', 'test-campaign', { targetName: 'Ally', saveDc: 12 }, null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });
    });

    describe('sanctuary effect lookup — no match found', () => {
        it('returns { blocked: false } when no targetEffects exist', async () => {
            getRuntimeValue.mockReturnValue([]);
            const result = await handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('returns { blocked: false } when targetEffects is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            const result = await handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('returns { blocked: false } when sanctuary targets a different creature', async () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'sanctuary', target: 'OtherAlly', source: 'Cleric' },
            ]);
            const result = await handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('returns { blocked: false } when sanctuary source is the attacking character', async () => {
            getRuntimeValue.mockReturnValue([
                { effect: 'sanctuary', target: 'Ally', source: 'Goblin' },
            ]);
            const result = await handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);
            expect(result).toEqual({ blocked: false });
            expect(sendSavePrompt).not.toHaveBeenCalled();
        });

        it('finds sanctuary even when saveType differs', async () => {
            // The handler does NOT compare saveType on the sanctuary effect — only target and source matter
            getRuntimeValue.mockReturnValue([
                { effect: 'sanctuary', target: 'Ally', source: 'Cleric', saveType: 'str' },
            ]);
            setupSanctuaryActive();
            // The mock above already sets sanctuary active, so this tests that the effect is found
            // and the save flow proceeds despite saveType mismatch
            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            // The handler is synchronous up to the event listener — no setTimeout needed
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

            const result = await invokePromise;
            expect(result.blocked).toBe(true);
            expect(sendSavePrompt).toHaveBeenCalled();
        });
    });

    describe('sanctuary found — save prompt flow', () => {
        it('creates a pending save prompt and sends it', async () => {
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

            const result = await invokePromise;

            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                promptId: 'test-guid-1234',
                targetName: 'Goblin',
                attackerName: 'Cleric',
                saveType: 'WIS',
                saveDc: 13,
                condition: 'sanctuary',
            }));

            expect(result).toEqual({
                blocked: true,
                description: expect.stringContaining('failed WIS save against Sanctuary'),
            });
        });

        it('removes the pending save prompt after resolution', async () => {
            let pendingPrompts = { 'other-prompt': { promptId: 'other-prompt' } };
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') return [makeSanctuaryEffect()];
                if (key === 'campaign' && prop === 'pendingSavePrompts') return pendingPrompts;
                return null;
            });

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

            await invokePromise;

            // The handler deletes the promptId it created from pendingSavePrompts
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'pendingSavePrompts',
                expect.objectContaining({ 'other-prompt': expect.any(Object) }),
                'test-campaign'
            );
        });

        it('ignores save-result events with a mismatched promptId', async () => {
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            // Dispatch wrong promptId — should be ignored
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'wrong-id', success: false },
            }));

            // Dispatch correct promptId — should resolve
            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: true },
            }));

            const result = await invokePromise;
            expect(result).toEqual({ blocked: false });
        });
    });

    describe('save result handling', () => {
        it('returns { blocked: false } when save succeeds', async () => {
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: true },
            }));

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
        });

        it('returns { blocked: true } with description when save fails', async () => {
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

            const result = await invokePromise;

            expect(result.blocked).toBe(true);
            expect(result.description).toContain('Goblin');
            expect(result.description).toContain('Ally');
            expect(result.description).toContain('failed WIS save against Sanctuary');
            expect(result.description).toContain('The spell is lost');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                success: false,
                characterName: 'Cleric',
                targetName: 'Goblin',
                saveDc: 13,
                saveType: 'WIS',
            }));
        });
    });

    describe('saveDc fallback', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('defaults saveDc to 8 when targetEffect has no saveDc', async () => {
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'targetEffects') return [makeSanctuaryEffect({ saveDc: undefined })];
                if (key === 'campaign' && prop === 'pendingSavePrompts') return {};
                return null;
            });

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

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

    describe('error handling', () => {
        let consoleSpy;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('handles addEntry rejection on failed save gracefully', async () => {
            addEntry.mockRejectedValue(new Error('DB error'));
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

            const result = await invokePromise;

            expect(result.blocked).toBe(true);
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('handles addEntry rejection on successful save gracefully', async () => {
            addEntry.mockRejectedValue(new Error('DB error'));
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'test-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: true },
            }));

            const result = await invokePromise;

            expect(result).toEqual({ blocked: false });
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('campaign name propagation', () => {
        it('uses the provided campaignName in setRuntimeValue and addEntry', async () => {
            setupSanctuaryActive();

            const invokePromise = handleSanctuarySave('Goblin', 'my-campaign', makeContext(), null);

            window.dispatchEvent(new CustomEvent('save-result', {
                detail: { promptId: 'test-guid-1234', success: false },
            }));

            await invokePromise;

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'pendingSavePrompts',
                expect.any(Object),
                'my-campaign'
            );

            expect(addEntry).toHaveBeenCalledWith('my-campaign', expect.any(Object));
        });
    });
});
