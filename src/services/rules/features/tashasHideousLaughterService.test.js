import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerTashasHideousLaughter } from './tashasHideousLaughterService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('tashasHideousLaughterService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerTashasHideousLaughter', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-Tasha Hideous Laughter spells', async () => {
            const result = await triggerTashasHideousLaughter(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerTashasHideousLaughter(
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
            const result = await triggerTashasHideousLaughter(
                { name: '', level: 1 },
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

            const result = await triggerTashasHideousLaughter(
                { name: "TASHA'S HIDEOUS LAUGHTER", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles lowercase spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerTashasHideousLaughter(
                { name: "tasha's hideous laughter", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed case spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerTashasHideousLaughter(
                { name: "TaShA'S HiDeOuS LaUgHtEr", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
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

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
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

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
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

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
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

        it('uses spell.level as slotLevel when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 3 },
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

        it('uses metaCtx slotLevel over spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                { spellSaveDc: 17, slotLevel: 5 },
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

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: "Tasha's Hideous Laughter", level: 3, school: 'Enchantment' };

            await triggerTashasHideousLaughter(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
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

        it('sets automation type to tashas_laughter', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ type: 'tashas_laughter' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets saveType to WIS', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveType: 'WIS' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: "Tasha's Hideous Laughter", description: 'Target laughs' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('handles undefined playerStats gracefully for non-matching spell', async () => {
            const result = await triggerTashasHideousLaughter(
                { name: 'Fire Bolt', level: 0 },
                {},
                undefined,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles undefined metaCtx', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerTashasHideousLaughter(
                { name: "Tasha's Hideous Laughter", level: 1 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
        });
    });
});
