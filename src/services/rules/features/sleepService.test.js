import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSleep } from './sleepService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('sleepService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerSleep', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('executes handler for non-Sleep spells (no name filtering)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSleep(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('returns null when spell name is "sleep" case-insensitive and executes handler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Sleep',
                    automation: expect.objectContaining({
                        type: 'sleep',
                        saveDc: 15,
                        saveType: 'WIS',
                    }),
                    spellSlotLevel: 1,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "sleep" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSleep(
                { name: 'sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "SLEEP" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSleep(
                { name: 'SLEEP', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                { spellSaveDc: 18, slotLevel: 3 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 11 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('throws when proficiency is not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required');
        });

        it('throws when saveDc base of 8 cannot be calculated without proficiency', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = {};

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required');
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Sleep', description: 'Sleep affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Sleep', level: 1, school: 'Evocation' };

            await triggerSleep(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 3 },
                { spellSaveDc: 17 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 3 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when spell object is empty (no level info)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await expect(
                triggerSleep(
                    {},
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required');
        });

        it('handles metaCtx as undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });

        it('throws when playerStats is undefined (no null safety)', async () => {
            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    undefined,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
        });

        it('uses spell slot level from metaCtx over spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                { spellSaveDc: 17, slotLevel: 4 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws spellSlotLevel when no level info available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await expect(
                triggerSleep(
                    { name: 'Sleep' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required');
        });

        it('verifies automation action structure', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 2 },
                { spellSaveDc: 16 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Sleep',
                    automation: {
                        type: 'sleep',
                        saveDc: 16,
                        saveType: 'WIS',
                    },
                    spellSlotLevel: 2,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });
});
