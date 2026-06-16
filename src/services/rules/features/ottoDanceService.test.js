import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerOttoDance } from './ottoDanceService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('ottoDanceService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerOttoDance', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Bard',
            spellAbilities: { saveDc: 16, modifier: 4, spellCastingAbility: 'Charisma', toHit: 10 },
            proficiency: 4,
        };

        it('returns null for non-Otto Dance spells', async () => {
            const result = await triggerOttoDance(
                { name: 'Vicious Mockery', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches "Otto\'s Irresistible Dance" case-insensitive', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: "Otto's Irresistible Dance",
                    automation: expect.objectContaining({
                        type: 'ottos_dance',
                        saveDc: 16,
                        saveType: 'WIS',
                    }),
                    spellSlotLevel: 6,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('matches "irresistible dance" (short name) case-insensitive', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerOttoDance(
                { name: 'Irresistible Dance', level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Irresistible Dance',
                    automation: expect.objectContaining({
                        type: 'ottos_dance',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('matches lowercase short name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerOttoDance(
                { name: "otto's irresistible dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerOttoDance(
                { name: "OTTO'S IRRESISTIBLE DANCE", level: 6 },
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

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                { spellSaveDc: 19, slotLevel: 7 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 19 }),
                    spellSlotLevel: 7,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 16 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Bard', proficiency: 5 };

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                stats,
                campaignName,
                mapName,
            );

            // 8 + proficiency(5) = 13
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 13 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses default proficiency of 2 when not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Bard' };

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                stats,
                campaignName,
                mapName,
            );

            // 8 + 2 = 10
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
                payload: { type: 'automation_info', name: "Otto's Irresistible Dance" },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: "Otto's Irresistible Dance", level: 6, school: 'Enchantment' };

            await triggerOttoDance(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 8 },
                { spellSaveDc: 18 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 8 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default slot level 6 when no metaCtx or spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance" },
                {},
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

        it('handles undefined spell name gracefully', async () => {
            const result = await triggerOttoDance(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('sets saveType to WIS in action automation', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
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

        it('sets automation type to ottos_dance', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ type: 'ottos_dance' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
                playerStats,
                'MyCampaign',
                'bossRoom',
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                'MyCampaign',
                'bossRoom',
            );
        });

        it('passes playerStats as second argument to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const customStats = { name: 'Rogue', proficiency: 3 };

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                {},
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

        it('handles metaCtx slotLevel override', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                { spellSaveDc: 17, slotLevel: 9 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 9 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerOttoDance(
                { name: "Otto's Irresistible Dance", level: 6 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 16 }),
                    spellSlotLevel: 6,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles empty spell name string', async () => {
            const result = await triggerOttoDance(
                { name: '', level: 6 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });
});
