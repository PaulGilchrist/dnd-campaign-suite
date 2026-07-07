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
        it('passes action with stinking_cloud automation type to executeHandler', async () => {
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
                    automation: expect.objectContaining({
                        type: 'stinking_cloud',
                        saveType: 'CON',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        describe('saveDc resolution', () => {
            it('prefers metaCtx spellSaveDc over playerStats', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerStinkingCloud(
                    { name: 'Stinking Cloud', level: 3 },
                    { spellSaveDc: 18 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 18 }),
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

            it('computes saveDc from proficiency when spellAbilities is missing', async () => {
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

            it('treats null saveDc as falsy and falls back to proficiency', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', spellAbilities: { saveDc: null }, proficiency: 4 };

                await triggerStinkingCloud(
                    { name: 'Stinking Cloud', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 12 }),
                    }),
                    stats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('slotLevel resolution', () => {
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

            it('falls back to spell.level when metaCtx lacks slotLevel', async () => {
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

            it('treats null or 0 slotLevel as falsy and falls back to spell.level', async () => {
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

        describe('passthrough and error handling', () => {
            it('returns result from executeHandler', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Stinking Cloud' },
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

            it('returns null when executeHandler throws', async () => {
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
        });

        describe('defensive coding', () => {
            it('handles empty spell and undefined metaCtx with defaults', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerStinkingCloud({}, undefined, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: {
                            type: 'stinking_cloud',
                            saveDc: 15,
                            saveType: 'CON',
                        },
                        spellSlotLevel: 3,
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('throws when playerStats is undefined or null', async () => {
                await expect(
                    triggerStinkingCloud(
                        { name: 'Stinking Cloud', level: 3 },
                        {},
                        undefined,
                        campaignName,
                        mapName,
                    ),
                ).rejects.toThrow();

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
        });
    });
});
