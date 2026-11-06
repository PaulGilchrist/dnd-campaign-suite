// @maintained-by-ai
// savePrompt.logSaveDismissed — the shared dismissal log-row producer of the
// save-dismissed sweep family (2026-11-05). Modal producers without their own
// refusal helper route the queue's `save-dismissed` broadcast through HERE, so
// every abandoned un-rolled save leaves the same honest audit row: type
// 'automation', automationType/Detail 'save_dismissed', reason 'save was
// dismissed — no effect' — and NEVER a fabricated save_result/roll row.
// Log-service rejections must stay swallowed with console.error (the modal's
// drain must not die on a logging failure).
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { logSaveDismissed } from './savePrompt.js';
import * as logService from '../../ui/logService.js';

describe('savePrompt — logSaveDismissed row', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
    });

    it('writes exactly one automation/save_dismissed row and no save_result row', async () => {
        await logSaveDismissed('test-campaign', {
            casterName: 'Wizard1',
            abilityName: 'Hypnotic Pattern',
            targetName: 'PlayerAlly',
            saveDc: 14,
            saveType: 'WIS',
            logPrefix: '[HypnoticPatternModal]',
        });

        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        const [campaign, entry] = logService.addEntry.mock.calls[0];
        expect(campaign).toBe('test-campaign');
        expect(entry).toMatchObject({
            type: 'automation',
            automationType: 'save_dismissed',
            automationDetail: 'save_dismissed',
            characterName: 'Wizard1',
            abilityName: 'Hypnotic Pattern',
            targetName: 'PlayerAlly',
            saveDc: 14,
            saveType: 'WIS',
            reason: 'save was dismissed — no effect',
        });
        expect(entry.description).toContain("PlayerAlly's WIS save (DC 14) against Hypnotic Pattern was dismissed before rolling — no effect.");
        expect(entry.type).not.toBe('save_result');
    });

    it('swallows a log-service rejection (the dismissal drain must not die on logging)', async () => {
        logService.addEntry.mockRejectedValueOnce(new Error('network down'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(logSaveDismissed('test-campaign', {
            casterName: 'W', abilityName: 'A', targetName: 'T', saveDc: 12, saveType: 'WIS',
        })).resolves.toBeUndefined();
        expect(errSpy).toHaveBeenCalled();
    });
});
