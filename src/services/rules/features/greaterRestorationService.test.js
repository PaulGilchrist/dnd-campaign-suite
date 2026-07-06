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
        it.each(['Greater Restoration', 'greater restoration', 'GREATER RESTORATION'])('matches "%s" case-insensitively', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });
            const result = await triggerGreaterRestoration({ name, level: 5 }, {}, playerStats, campaignName, mapName);
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it.each([
            'Cure Wounds', 'Healing Word', 'Lesser Restoration', 'Restoration', 'greater', 'restoration', 'greater restorations',
        ])('returns null for non-matching spell: "%s"', async (spellName) => {
            const result = await triggerGreaterRestoration({ name: spellName, level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each([undefined, null, ''])('returns null when spell name is %s', async (name) => {
            const result = await triggerGreaterRestoration({ name, level: 5 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each([
            ['spell.range', { range: '60 feet' }, '60 feet'],
            ['default "Touch"', {}, 'Touch'],
            ['null range', { range: null }, 'Touch'],
            ['undefined range', { range: undefined }, 'Touch'],
        ])('uses %s for range', async (_label, spellOverrides, expectedRange) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5, ...spellOverrides }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ range: expectedRange }) }),
                playerStats, campaignName, mapName,
            );
        });

        it('includes automation type greater_restoration in the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ type: 'greater_restoration' }) }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Greater Restoration', description: 'Ends one effect...' } };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);
        });

        it('catches handler errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockRejectedValue(new Error('Connection refused'));
            const result = await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);
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

        it('catches effect errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyGreaterRestorationEffect.mockRejectedValue(new Error('Database error'));
            const result = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, confirmationResult);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[greaterRestoration] Failed to apply Greater Restoration effect:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
