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

    describe('triggerRayOfEnfeeblement', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('calls executeHandler with correct action structure', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const spell = { name: 'Ray of Enfeeblement', level: 2 };

            await triggerRayOfEnfeeblement(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Ray of Enfeeblement',
                    spell,
                    automation: expect.objectContaining({
                        type: 'ray_of_enfeeblement',
                        targetName: 'Goblin',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses "Unknown" as targetName when metaCtx is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const spell = { name: 'Ray of Enfeeblement', level: 2 };

            await triggerRayOfEnfeeblement(
                spell,
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        targetName: 'Unknown',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses "Unknown" as targetName when metaCtx.targetName is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const spell = { name: 'Ray of Enfeeblement', level: 2 };

            await triggerRayOfEnfeeblement(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        targetName: 'Unknown',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Ray of Enfeeblement', level: 2, school: 'Necromancy' };

            await triggerRayOfEnfeeblement(
                spell,
                { targetName: 'Orc' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns undefined when executeHandler succeeds (no return value)', async () => {
            executeHandler.mockResolvedValue(undefined);

            const result = await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 2 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeUndefined();
        });

        it('throws when executeHandler throws an error', async () => {
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
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

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
            executeHandler.mockResolvedValue({ type: 'popup' });
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

        it('falls back to "Unknown" when targetName is empty string', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const spell = { name: 'Ray of Enfeeblement', level: 2 };

            await triggerRayOfEnfeeblement(
                spell,
                { targetName: '' },
                playerStats,
                campaignName,
                mapName,
            );

            // Empty string is falsy so || falls back to "Unknown"
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        targetName: 'Unknown',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('logs error to console when executeHandler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockRejectedValue(new Error('Connection failed'));

            await expect(
                triggerRayOfEnfeeblement(
                    { name: 'Ray of Enfeeblement', level: 2 },
                    { targetName: 'Goblin' },
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Connection failed');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[rayOfEnfeeblement] Trigger failed:',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });

        it('uses spell level as spellSlotLevel in automation context', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerRayOfEnfeeblement(
                { name: 'Ray of Enfeeblement', level: 3 },
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    spell: expect.objectContaining({ level: 3 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });
});
