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

    describe('triggerGreaterRestoration', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = { name: 'Cleric', proficiency: 4 };

        it('returns null for non-Greater Restoration spells', async () => {
            const result = await triggerGreaterRestoration(
                { name: 'Cure Wounds', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerGreaterRestoration(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            const result = await triggerGreaterRestoration(
                { name: '', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns result for "Greater Restoration" with correct casing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerGreaterRestoration(
                { name: 'Greater Restoration', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Greater Restoration',
                    automation: expect.objectContaining({
                        type: 'greater_restoration',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "greater restoration" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerGreaterRestoration(
                { name: 'greater restoration', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "GREATER RESTORATION" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerGreaterRestoration(
                { name: 'GREATER RESTORATION', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses spell.range in automation when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerGreaterRestoration(
                { name: 'Greater Restoration', level: 5, range: '60 feet' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: '60 feet' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults range to "Touch" when spell has no range', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerGreaterRestoration(
                { name: 'Greater Restoration', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: 'Touch' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults range to "Touch" when spell.range is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerGreaterRestoration(
                { name: 'Greater Restoration', level: 5, range: undefined },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: 'Touch' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Greater Restoration', level: 5, school: 'Abjuration' };

            await triggerGreaterRestoration(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Greater Restoration', description: 'Ends one effect...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerGreaterRestoration(
                { name: 'Greater Restoration', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerGreaterRestoration(
                { name: 'Greater Restoration', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('throws when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });
    });

    describe('confirmGreaterRestoration', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = { name: 'Cleric' };
        const action = {
            name: 'Greater Restoration',
            automation: { type: 'greater_restoration', range: 'Touch' },
        };
        const result = { confirmed: true };

        it('calls applyGreaterRestorationEffect with correct arguments', async () => {
            const expectedResult = { applied: true };
            applyGreaterRestorationEffect.mockResolvedValue(expectedResult);

            const output = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, result);

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                result,
            );
            expect(output).toBe(expectedResult);
        });

        it('returns the applied result on success', async () => {
            const applied = { success: true, effects: ['charmed', 'petrified'] };
            applyGreaterRestorationEffect.mockResolvedValue(applied);

            const output = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, result);

            expect(output).toBe(applied);
        });

        it('throws when applyGreaterRestorationEffect throws', async () => {
            applyGreaterRestorationEffect.mockRejectedValue(new Error('Effect failed'));

            await expect(
                confirmGreaterRestoration(action, playerStats, campaignName, mapName, result),
            ).rejects.toThrow('Effect failed');
        });

        it('returns null when applyGreaterRestorationEffect returns null', async () => {
            applyGreaterRestorationEffect.mockResolvedValue(null);

            const output = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, result);

            expect(output).toBeNull();
        });

        it('handles undefined result gracefully', async () => {
            applyGreaterRestorationEffect.mockResolvedValue({ applied: true });

            const output = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, undefined);

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                undefined,
            );
            expect(output).toEqual({ applied: true });
        });

        it('handles undefined action gracefully', async () => {
            applyGreaterRestorationEffect.mockResolvedValue(null);

            const output = await confirmGreaterRestoration(undefined, playerStats, campaignName, mapName, result);

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                undefined,
                playerStats,
                campaignName,
                mapName,
                result,
            );
            expect(output).toBeNull();
        });
    });
});
