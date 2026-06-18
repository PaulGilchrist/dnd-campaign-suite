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

        it('uses default proficiency of 2 when not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses default saveDc base of 8 when no proficiency or spellAbilities', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = {};

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                stats,
                campaignName,
                mapName,
            );
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

        it('throws when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
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

        it('executes handler even with empty spell object', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSleep(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
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

        it('defaults spellSlotLevel to 1 when no level info available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 1 }),
                playerStats,
                campaignName,
                mapName,
            );
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
