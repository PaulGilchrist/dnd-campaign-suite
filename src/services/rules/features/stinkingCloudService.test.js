// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerStinkingCloud } from './stinkingCloudService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('stinkingCloudService', () => {
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

    describe('triggerStinkingCloud', () => {
        it('always executes handler for stinking cloud regardless of spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Stinking Cloud',
                    automation: expect.objectContaining({
                        type: 'stinking_cloud',
                        saveDc: 15,
                        saveType: 'CON',
                    }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                { spellSaveDc: 18, slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        saveDc: 18,
                        saveType: 'CON',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses slotLevel from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                { spellSaveDc: 16, slotLevel: 6 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    spellSlotLevel: 6,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
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

        it('prefers metaCtx spellSaveDc over playerStats.spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                { spellSaveDc: 20 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 20 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
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

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
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

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 5 },
                { spellSaveDc: 16 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('prefers metaCtx slotLevel over spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                { slotLevel: 6 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 6 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default level 3 when no slotLevel or spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud' },
                {},
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

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Stinking Cloud', description: 'Stinking Cloud affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and logs error when executeHandler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[stinkingCloudService] Failed to execute Stinking Cloud handler'),
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Stinking Cloud', level: 3, school: 'Conjuration' };

            await triggerStinkingCloud(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined spell gracefully with defaults', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: undefined,
                    automation: expect.objectContaining({
                        type: 'stinking_cloud',
                        saveDc: 15,
                        saveType: 'CON',
                    }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined metaCtx gracefully with defaults', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles null metaCtx gracefully with defaults', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when playerStats is undefined', async () => {
            await expect(
                triggerStinkingCloud(
                    { name: 'Stinking Cloud', level: 3 },
                    {},
                    undefined,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
        });

        it('throws when playerStats is null', async () => {
            await expect(
                triggerStinkingCloud(
                    { name: 'Stinking Cloud', level: 3 },
                    {},
                    null,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
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

        it('uses proficiency default when spellAbilities is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', spellAbilities: undefined, proficiency: 5 };

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 13 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses proficiency default when spellAbilities.saveDc is null', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', spellAbilities: { saveDc: null } };

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
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

        it('uses proficiency default when spellAbilities.saveDc is 0', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', spellAbilities: { saveDc: 0 } };

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 3 },
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

        it('uses spell.level as fallback when metaCtx slotLevel is 0', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 4 },
                { slotLevel: 0 },
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

        it('uses spell.level as fallback when metaCtx slotLevel is null', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerStinkingCloud(
                { name: 'Stinking Cloud', level: 4 },
                { slotLevel: null },
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
    });
});
