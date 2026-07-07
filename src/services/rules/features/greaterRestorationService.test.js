// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerGreaterRestoration, confirmGreaterRestoration } from './greaterRestorationService.js';
import { executeHandler, applyGreaterRestorationEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyGreaterRestorationEffect: vi.fn(),
}));

describe('greaterRestorationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric', proficiency: 4 };

    describe('triggerGreaterRestoration', () => {
        it.each([
            'Cure Wounds', 'Healing Word', 'Lesser Restoration', 'Restoration', 'greater', 'restoration', 'greater restorations',
        ])('returns null for non-matching spell: "%s"', async (spellName) => {
            const result = await triggerGreaterRestoration({ name: spellName, level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
        });

        it.each([undefined, null, ''])('returns null when spell name is %s', async (name) => {
            const result = await triggerGreaterRestoration({ name, level: 5 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
        });

        it.each([
            ['spell.range', { range: '60 feet' }, '60 feet'],
            ['default "Touch"', {}, 'Touch'],
        ])('uses %s for range', async (_label, spellOverrides, expectedRange) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5, ...spellOverrides }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: { type: 'greater_restoration', range: expectedRange } }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success, logs error and returns null on failure', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Greater Restoration', description: 'Ends one effect...' } };

            executeHandler.mockResolvedValue(expectedResult);
            let result = await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);

            executeHandler.mockRejectedValue(new Error('Connection refused'));
            result = await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[greaterRestoration] Failed to execute Greater Restoration handler:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });

    describe('confirmGreaterRestoration', () => {
        const action = { name: 'Greater Restoration', automation: { type: 'greater_restoration', range: 'Touch' } };
        const confirmationResult = { confirmed: true };

        it('returns result from applyGreaterRestorationEffect on success', async () => {
            const expectedResult = { applied: true, removedConditions: ['charmed', 'petrified'] };
            applyGreaterRestorationEffect.mockResolvedValue(expectedResult);
            const result = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, confirmationResult);
            expect(result).toBe(expectedResult);
        });

        it('logs error and returns null when effect throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyGreaterRestorationEffect.mockRejectedValue(new Error('Database error'));
            const result = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, confirmationResult);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[greaterRestoration] Failed to apply Greater Restoration effect:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
