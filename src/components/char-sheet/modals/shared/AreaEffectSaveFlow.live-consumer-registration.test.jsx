// @maintained-by-ai
// Condition-AoE modal save-prompt hooks + the page-local live registry
// (bug-aoe-live-save-stamped-reload-lapse, shared-hook lane).
// issuePlayerSavePrompt arms player saves for the condition AoE modals
// (Calm Emotions / Hypnotic Pattern / Tasha's Hideous Laughter) and stamps
// the promptId into the campaign's pendingSaveListenerPrompts book. That
// bucket is exactly the marker resolveConsumerlessSavePrompt treats as
// "a createSaveListener chain is awaiting this prompt" — but this lane's
// consumer is the modal's own window `save-result` listener, invisible to
// the page-local registry. Answering such a prompt on the mounting page
// therefore stamped a phantom "resolved after a page reload — effect not
// applied" save_lapsed pair beside the effect the same page applied.
// Locks:
//  • while useSaveResultListener is mounted over the queue, the Done seam's
//    resolveConsumerlessSavePrompt is byte-inert (no lapse pair, no
//    generic save_result row, no writes at all);
//  • before it mounts and after it unmounts (reload/detached-chain face),
//    the honest lapse pair still writes — the suppression is scoped to
//    listener lifetime, never a removal of the rescue lane.
// Uses the REAL useRuntimeState module (store + fetch lane) and the REAL
// savePrompt.js seam — sibling convention to
// savePrompt.consumerless-resolution.test.js / savePrompt.drain-evict.test.js.

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { setRuntimeValue, clearRuntimeState, getAllStoreKeys, listeners } from '../../../../hooks/runtime/useRuntimeState.js';
import { resolveConsumerlessSavePrompt } from '../../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { useSaveResultListener, useSaveDismissedListener } from './AreaEffectSaveFlow.utils.js';

const CAMPAIGN = 'test-campaign';

const flush = () => new Promise(r => setTimeout(r, 0));

let fetchSpy;

function clearAllStores() {
    for (const key of getAllStoreKeys()) clearRuntimeState(key);
    listeners.clear();
}

// Book truth at Done-time: the listener-armed prompt is listed in the
// pendingSaveListenerPrompts bucket (issuePlayerSavePrompt's stamp).
function seedArmedListenerPrompt(promptId) {
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', [promptId], CAMPAIGN);
    fetchSpy.mockClear();
    addEntry.mockClear();
}

function armedPrompt(promptId) {
    return {
        promptId,
        targetName: 'Goblin',
        saveType: 'WIS',
        saveDc: 17,
        sourceName: 'Calm Emotions',
    };
}

const ROLLED_DETAIL = { promptId: 'unused', success: false, roll: 5, total: 9, saveBonus: 4 };

const noop = () => {};

beforeEach(() => {
    clearAllStores();
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
});

describe('useSaveResultListener — page-local live-consumer registration', () => {
    it('suppresses the consumerless lane while the listener is mounted (zero rows)', async () => {
        const promptId = 'live-modal-1';
        seedArmedListenerPrompt(promptId);

        const { unmount } = renderHook(() =>
            useSaveResultListener([{ promptId, targetName: 'Goblin' }], noop)
        );

        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(promptId), { ...ROLLED_DETAIL, promptId });
        await flush();

        expect(addEntry).not.toHaveBeenCalled();
        unmount();
    });

    it('re-marks survivors and drops settled ids on every queue re-render', async () => {
        const settled = 'live-modal-2a';
        const survivor = 'live-modal-2b';
        seedArmedListenerPrompt(survivor);

        // Queue holds both prompts; the settled one's Done seam must not
        // write while the listener (still consuming `survivor`) is mounted.
        const { rerender, unmount } = renderHook(
            ({ queue }) => useSaveResultListener(queue, noop),
            { initialProps: { queue: [{ promptId: settled }, { promptId: survivor }] } }
        );

        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(settled), { ...ROLLED_DETAIL, promptId: settled });
        await flush();
        expect(addEntry).not.toHaveBeenCalled();

        // Drain the settled prompt: cleanup clears the old pair, setup
        // re-marks the survivor — the survivor stays suppressed...
        rerender({ queue: [{ promptId: survivor }] });
        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(survivor), { ...ROLLED_DETAIL, promptId: survivor });
        await flush();
        expect(addEntry).not.toHaveBeenCalled();

        // ...and the drained one is no longer registered: answering it now
        // (e.g. a replayed overlay) writes the honest lapse pair.
        seedArmedListenerPrompt(settled);
        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(settled), { ...ROLLED_DETAIL, promptId: settled });
        await flush();
        expect(addEntry.mock.calls.map(([, e]) => e).some(e => e.automationType === 'save_lapsed')).toBe(true);
        unmount();
    });

    it('un-rolled Dismiss seam honors the same registration (useSaveDismissedListener)', async () => {
        const promptId = 'live-modal-3';
        seedArmedListenerPrompt(promptId);

        const { unmount } = renderHook(() =>
            useSaveDismissedListener([{ promptId, targetName: 'Goblin' }], noop)
        );

        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(promptId), null);
        await flush();
        expect(addEntry).not.toHaveBeenCalled();

        // With the listener gone (reload face), the un-rolled Dismiss of the
        // replayed prompt still leaves its honest dismissed-lapse row.
        unmount();
        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(promptId), null);
        await flush();
        const rows = addEntry.mock.calls.map(([, e]) => e);
        expect(rows.filter(e => e.automationType === 'save_lapsed')).toHaveLength(1);
        expect(rows.some(e => e.type === 'save_result')).toBe(false);
        expect(rows.find(e => e.automationType === 'save_lapsed').description).toContain('dismissed after a page reload');
    });

    it('unmount strips the registration so a replayed prompt resolves honestly (reload face)', async () => {
        const promptId = 'live-modal-4';
        seedArmedListenerPrompt(promptId);

        const { unmount } = renderHook(() =>
            useSaveResultListener([{ promptId, targetName: 'Goblin' }], noop)
        );
        unmount();

        resolveConsumerlessSavePrompt(CAMPAIGN, armedPrompt(promptId), { ...ROLLED_DETAIL, promptId });
        await flush();

        const rows = addEntry.mock.calls.map(([, e]) => e);
        expect(rows.some(e => e.type === 'save_result')).toBe(true);
        const lapseRows = rows.filter(e => e.automationType === 'save_lapsed');
        expect(lapseRows).toHaveLength(1);
        expect(lapseRows[0].description).toContain('resolved after a page reload');
    });
});
