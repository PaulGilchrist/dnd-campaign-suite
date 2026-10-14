import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerRegenerate, confirmRegenerate } from './regenerateService.js';
import { executeHandler, applyRegenerateEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyRegenerateEffect: vi.fn(),
}));

describe('regenerateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric', proficiency: 4 };

    describe('triggerRegenerate', () => {
        it.each([
            'Heal', 'Cure Wounds', 'Prayer of Healing', 'mass cure wounds', 'healing word', 'regeneration', 'regenerative',
        ])('returns null for non-matching spell: "%s"', async (spellName) => {
            const result = await triggerRegenerate({ name: spellName, level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
        });

        it.each([undefined, null, ''])('returns null when spell name is %s', async (name) => {
            const result = await triggerRegenerate({ name, level: 7 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
        });

        it('calls executeHandler with correct action for Regenerate spell', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerRegenerate({ name: 'Regenerate', level: 7 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Regenerate',
                    automation: { type: 'regenerate', range: 'Touch' },
                }),
                playerStats, campaignName, mapName,
            );
        });

        it('uses custom range when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerRegenerate({ name: 'Regenerate', level: 7, range: '60 feet' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: { type: 'regenerate', range: '60 feet' } }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success, logs error and returns null on failure', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Regenerate', description: 'Applied' } };

            executeHandler.mockResolvedValue(expectedResult);
            let result = await triggerRegenerate({ name: 'Regenerate', level: 7 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);

            executeHandler.mockRejectedValue(new Error('Connection refused'));
            result = await triggerRegenerate({ name: 'Regenerate', level: 7 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[regenerate] Failed to execute Regenerate handler:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('confirmRegenerate', () => {
        const action = { name: 'Regenerate', automation: { type: 'regenerate', range: 'Touch' } };
        const confirmationResult = { targetName: 'Goblin' };

        it('returns result from applyRegenerateEffect on success', async () => {
            const expectedResult = { applied: true, healAmount: 33 };
            applyRegenerateEffect.mockResolvedValue(expectedResult);
            const result = await confirmRegenerate(action, playerStats, campaignName, mapName, confirmationResult);
            expect(result).toBe(expectedResult);
        });

        it('logs error and returns null when effect throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyRegenerateEffect.mockRejectedValue(new Error('Database error'));
            const result = await confirmRegenerate(action, playerStats, campaignName, mapName, confirmationResult);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[regenerate] Failed to apply Regenerate effect:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
