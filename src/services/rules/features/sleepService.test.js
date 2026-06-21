// @improved-by-ai
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

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerSleep', () => {
        it('executes handler for non-Sleep spells (automation handles filtering)', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSleep(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('matches spell name case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSleep(
                { name: 'sLeEp', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
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

        it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
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
            const stats = { name: 'Wizard' };

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it('throws when proficiency is explicitly null', async () => {
            const stats = { name: 'Wizard', proficiency: null };

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it('throws when proficiency is undefined', async () => {
            const stats = { name: 'Wizard', proficiency: undefined };

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it('throws when spellAbilities.saveDc is null and proficiency is missing', async () => {
            const stats = {
                name: 'Wizard',
                spellAbilities: { saveDc: null, modifier: 4 },
            };

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it('throws when spellAbilities is undefined and proficiency is missing', async () => {
            const stats = { name: 'Wizard' };

            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
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

        it('prefers metaCtx slotLevel over spell.level', async () => {
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

        it('throws when slot level is not available from either source', async () => {
            await expect(
                triggerSleep(
                    { name: 'Sleep' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for sleep spell');
        });

        it('throws when spell has no level and metaCtx has no slotLevel', async () => {
            await expect(
                triggerSleep(
                    { name: 'Sleep', level: null },
                    { spellSaveDc: 15 },
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for sleep spell');
        });

        it('throws when spell has no level and metaCtx has no slotLevel (undefined)', async () => {
            await expect(
                triggerSleep(
                    { name: 'Sleep', level: undefined },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for sleep spell');
        });

        it('throws when spell object is empty', async () => {
            await expect(
                triggerSleep(
                    {},
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for sleep spell');
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

        it('handles metaCtx as null', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
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

        it('includes saveType WIS in the automation action', async () => {
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
                    automation: expect.objectContaining({
                        type: 'sleep',
                        saveType: 'WIS',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when playerStats is undefined', async () => {
            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    undefined,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow();
        });

        it('throws when playerStats is null', async () => {
            await expect(
                triggerSleep(
                    { name: 'Sleep', level: 1 },
                    {},
                    null,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow();
        });
    });
});
