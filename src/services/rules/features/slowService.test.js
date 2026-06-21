// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSlow } from './slowService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('slowService', () => {
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

    describe('triggerSlow', () => {
        it('returns null for non-Slow spells', async () => {
            const result = await triggerSlow(
                { name: 'Haste', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is missing', async () => {
            const result = await triggerSlow(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is null', async () => {
            const result = await triggerSlow(
                { name: null, level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            const result = await triggerSlow(
                { name: '', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell name case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSlow(
                { name: 'SLoW', level: 3 },
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
            const spell = { name: 'Slow', level: 3, school: 'Transmutation' };

            await triggerSlow(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSlow(
                { name: 'Slow', level: 3 },
                { spellSaveDc: 18, slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 5,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSlow(
                { name: 'Slow', level: 3 },
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

            await triggerSlow(
                { name: 'Slow', level: 3 },
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

            await triggerSlow(
                { name: 'Slow', level: 3 },
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

            await triggerSlow(
                { name: 'Slow', level: 5 },
                { spellSaveDc: 17 },
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

        it('uses default slot level of 3 when neither metaCtx nor spell has level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSlow(
                { name: 'Slow' },
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

        it('prefers metaCtx slotLevel over spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSlow(
                { name: 'Slow', level: 1 },
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

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Slow', description: 'Slow affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerSlow(
                { name: 'Slow', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSlow(
                { name: 'Slow', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and suppresses errors from executeHandler', async () => {
            vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerSlow(
                { name: 'Slow', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalled();
            vi.restoreAllMocks();
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSlow(
                { name: 'Slow', level: 3 },
                {},
                playerStats,
                'MyCampaign',
                'DungeonMap1',
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                'MyCampaign',
                'DungeonMap1',
            );
        });

        it('handles undefined metaCtx', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSlow(
                { name: 'Slow', level: 3 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles null metaCtx', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSlow(
                { name: 'Slow', level: 3 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('treats spell.level 0 as missing and falls back to default slot level 3', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSlow(
                { name: 'Slow', level: 0 },
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
    });
});
