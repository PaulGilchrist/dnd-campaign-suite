// @maintained-by-ai
// savePrompt.js — createSaveListener dismissal detach (divine-spark
// dismiss-softlock family, 2026-11-05). The un-rolled Dismiss branch of
// SavePromptModal broadcasts `save-dismissed` carrying the promptId. Doctrine
// is unchanged — a DISMISSED save NEVER resolves the `.promise` (the ~40
// fire-and-forget consumers read a falsy `success` as "save failed → apply
// damage") — but the listener hygiene is: the dismissed event must DETACH the
// internal `save-result` handler so it no longer leaks on window and a stray
// late echo for the swept promptId cannot resurrect a phantom resolution.
// Locks: dismissed → no resolve, no save_result log, late save-result echo
// inert; a non-matching dismissed id leaves the listener armed; no dismissal
// → normal resolution untouched.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { guid: vi.fn() },
}));

vi.mock('../../shared/abilityLookup.js', () => ({
    getAbilityModifier: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    deleteRuntimeKey: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { default: utils } = await import('../../ui/utils.js');
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../ui/logService.js');
const { createSaveListener } = await import('./savePrompt.js');

const CAMPAIGN = 'test-campaign';

function mockBuckets(promptId) {
    getRuntimeValue.mockImplementation((characterKey, prop) => {
        if (prop === 'pendingSavePrompts') return { [promptId]: { promptId, campaignName: CAMPAIGN } };
        if (prop === 'pendingSaveListenerPrompts') return [promptId];
        return null;
    });
}

// Microtask flush only (No Game Timers doctrine for production code applies
// to test observation too — a resolving `.then` chain settles within a few
// microtask turns, no wall-clock wait).
async function flush(microtasks = 6) {
    for (let i = 0; i < microtasks; i++) await Promise.resolve();
}

function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

function armListener() {
    utils.guid.mockReturnValue('p-1');
    mockBuckets('p-1');
    const { promptId, promise } = createSaveListener(CAMPAIGN, {
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
    });
    let settled;
    promise.then((detail) => { settled = detail; });
    return { promptId, isSettled: () => settled !== undefined };
}

describe('createSaveListener — save-dismissed detach', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('a matching save-dismissed never resolves the promise but detaches the save-result handler', async () => {
        const { promptId, isSettled } = armListener();

        dispatch('save-dismissed', { promptId, targetName: 'Goblin' });
        await flush();
        expect(isSettled()).toBe(false);

        // Late echo for the swept promptId must be inert: no resolution,
        // no save_result log row.
        dispatch('save-result', { promptId, success: false, roll: 3, total: 5, saveBonus: 2 });
        await flush();
        expect(isSettled()).toBe(false);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('a save-dismissed for a different promptId leaves the listener armed (normal resolution untouched)', async () => {
        const { promptId, isSettled } = armListener();

        dispatch('save-dismissed', { promptId: 'someone-else' });
        await flush();
        expect(isSettled()).toBe(false);

        dispatch('save-result', { promptId, success: true, roll: 18, total: 20, saveBonus: 2 });
        await vi.waitFor(() => {
            expect(isSettled()).toBe(true);
        }, { timeout: 2000 });
        expect(addEntry).toHaveBeenCalledTimes(1);
    });

    it('without any dismissal the promise still resolves once and logs the save outcome', async () => {
        const { promptId, isSettled } = armListener();

        dispatch('save-result', { promptId, success: false, roll: 4, total: 6, saveBonus: 2 });
        await vi.waitFor(() => {
            expect(isSettled()).toBe(true);
        }, { timeout: 2000 });
        expect(addEntry).toHaveBeenCalledTimes(1);
    });
});
