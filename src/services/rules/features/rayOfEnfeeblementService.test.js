// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerRayOfEnfeeblement } from './rayOfEnfeeblementService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('rayOfEnfeeblementService', () => {
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

    describe('triggerRayOfEnfeeblement', () => {
        it('executes handler with correct automation type and targetName', async () => {
            executeHandler.mockResolvedValue(null);

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Ray of Enfeeblement',
                    automation: {
                        type: 'ray_of_enfeeblement',
                        targetName: 'Goblin',
                    },
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue(null);
            const spell = { name: 'Ray of Enfeeblement', level: 2, school: 'Necromancy' };

            await triggerRayOfEnfeeblement(spell, { targetName: 'Orc' }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to "Unknown" when metaCtx is null', async () => {
            executeHandler.mockResolvedValue(null);

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Unknown' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to "Unknown" when metaCtx is undefined', async () => {
            executeHandler.mockResolvedValue(null);

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Unknown' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to "Unknown" when metaCtx has no targetName', async () => {
            executeHandler.mockResolvedValue(null);

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Unknown' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to "Unknown" when targetName is empty string', async () => {
            executeHandler.mockResolvedValue(null);

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                { targetName: '' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Unknown' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('logs error and re-throws when executeHandler rejects', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerRayOfEnfeeblement(
                    { name: 'Ray of Enfeeblement', level: 2 },
                    { targetName: 'Goblin' },
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[rayOfEnfeeblement] Trigger failed:',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });

        it('returns undefined (no return statement)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeUndefined();
        });

        it('passes campaignName and mapName as third and fourth arguments to executeHandler', async () => {
            executeHandler.mockResolvedValue(null);

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                { targetName: 'Dragon' },
                playerStats,
                'MyCampaign',
                'DungeonMap3',
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                'MyCampaign',
                'DungeonMap3',
            );
        });

        it('passes playerStats as second argument to executeHandler', async () => {
            executeHandler.mockResolvedValue(null);
            const customStats = { name: 'Sorcerer', spellAbilities: {} };

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                { targetName: 'Goblin' },
                customStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                customStats,
                campaignName,
                mapName,
            );
        });
    });
});
