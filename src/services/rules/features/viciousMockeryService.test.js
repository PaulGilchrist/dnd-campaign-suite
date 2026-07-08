// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerViciousMockeryForGeneric } from './viciousMockeryService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('viciousMockeryService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Bard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma' },
        proficiency: 4,
    };

    describe('triggerViciousMockeryForGeneric', () => {
        it('calls executeHandler with correct action shape for vicious_mockery', async () => {
            executeHandler.mockResolvedValue({ success: true });
            const spell = { name: 'Vicious Mockery', level: 0 };
            const metaCtx = { targetName: 'Goblin' };

            await triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Vicious Mockery',
                    spell,
                    automation: {
                        type: 'vicious_mockery',
                        targetName: 'Goblin',
                    },
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to "Unknown" when metaCtx is null', async () => {
            executeHandler.mockResolvedValue(null);
            const spell = { name: 'Vicious Mockery', level: 0 };

            await triggerViciousMockeryForGeneric(spell, null, playerStats, campaignName, mapName);

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
            const spell = { name: 'Vicious Mockery', level: 0 };
            const metaCtx = {};

            await triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Unknown' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('re-throws when executeHandler rejects', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const spell = { name: 'Vicious Mockery', level: 0 };
            const metaCtx = { targetName: 'Goblin' };

            await expect(
                triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName),
            ).rejects.toThrow('Handler failed');
        });

        it('logs error via console.error when handler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const spell = { name: 'Vicious Mockery', level: 0 };
            const metaCtx = { targetName: 'Goblin' };

            await expect(
                triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName),
            ).rejects.toThrow('Handler failed');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[viciousMockery] Trigger failed:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('returns undefined on success (no return value)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { text: 'Vicious Mockery activated' } });
            const spell = { name: 'Vicious Mockery', level: 0 };
            const metaCtx = { targetName: 'Goblin' };

            const result = await triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName);

            expect(result).toBeUndefined();
        });

        it('passes spell object through in action', async () => {
            executeHandler.mockResolvedValue(null);
            const spell = { name: 'Vicious Mockery', level: 0, damage: '1d4' };
            const metaCtx = { targetName: 'Orc' };

            await triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });
});
