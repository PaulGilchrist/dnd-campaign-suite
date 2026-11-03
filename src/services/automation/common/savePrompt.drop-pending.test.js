// @maintained-by-ai
// savePrompt.js — dropPendingSavePrompt (backlog 2026-11-03 save-prompt-queue-
// dismiss-orphan). createSaveListener registers the promptId in the campaign
// pendingSavePrompts bucket + pendingSaveListenerPrompts list; a DISMISSED
// save never resolves, so Dismiss must sweep both itself. Locks: id present →
// row removed and list pruned (broadcast writes); id absent → NO writes (no
// pointless POST churn); missing promptId → inert.

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
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import(
    '../../../hooks/runtime/useRuntimeState.js'
);
const { dropPendingSavePrompt } = await import('./savePrompt.js');

const CAMPAIGN = 'test-campaign';

function mockBuckets({ saves, listenerIds }) {
    getRuntimeValue.mockImplementation((characterKey, prop) => {
        if (prop === 'pendingSavePrompts') return saves;
        if (prop === 'pendingSaveListenerPrompts') return listenerIds;
        return null;
    });
}

describe('dropPendingSavePrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('removes the row and prunes the listener list, broadcasting both writes', () => {
        mockBuckets({
            saves: {
                'p-1': { promptId: 'p-1', campaignName: CAMPAIGN, targetName: 'Goblin' },
                'p-2': { promptId: 'p-2', campaignName: CAMPAIGN, targetName: 'Goblin' },
            },
            listenerIds: ['p-1', 'p-2'],
        });

        dropPendingSavePrompt(CAMPAIGN, 'p-1');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'pendingSavePrompts',
            { 'p-2': { promptId: 'p-2', campaignName: CAMPAIGN, targetName: 'Goblin' } },
            CAMPAIGN
        );
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'pendingSaveListenerPrompts',
            ['p-2'],
            CAMPAIGN
        );
        expect(setRuntimeValue).toHaveBeenCalledTimes(2);
    });

    it('drains to an empty bucket object (zero rows for dismissed ids = criterion truth)', () => {
        mockBuckets({
            saves: { 'p-1': { promptId: 'p-1', campaignName: CAMPAIGN } },
            listenerIds: ['p-1'],
        });

        dropPendingSavePrompt(CAMPAIGN, 'p-1');

        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingSavePrompts', {}, CAMPAIGN);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'pendingSaveListenerPrompts', [], CAMPAIGN);
    });

    it('writes nothing when the id lives in neither bucket (no pointless churn, e.g. staged prompts)', () => {
        mockBuckets({ saves: { other: {} }, listenerIds: ['other'] });

        dropPendingSavePrompt(CAMPAIGN, 'ghost');

        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('tolerates absent buckets (null store reads)', () => {
        mockBuckets({ saves: null, listenerIds: null });

        expect(() => dropPendingSavePrompt(CAMPAIGN, 'p-1')).not.toThrow();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('is inert without a promptId (legacy bare-key prompts)', () => {
        mockBuckets({ saves: {}, listenerIds: [] });

        dropPendingSavePrompt(CAMPAIGN, undefined);
        dropPendingSavePrompt(CAMPAIGN, null);

        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
