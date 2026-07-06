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

        it('uses spellSaveDc from metaCtx when provided, falls back to playerStats, computes from proficiency', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                { spellSaveDc: 18, slotLevel: 3 },
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 18 }), spellSlotLevel: 3 }),
                playerStats,
                campaignName,
                mapName,
            );

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 15 }) }),
                playerStats,
                campaignName,
                mapName,
            );

            const stats = { name: 'Wizard', proficiency: 3 };
            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                stats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 11 }) }),
                stats,
                campaignName,
                mapName,
            );
        });

        it.each([
            { stats: { name: 'Wizard' }, label: 'proficiency is missing' },
            { stats: { name: 'Wizard', proficiency: null }, label: 'proficiency is null' },
            { stats: { name: 'Wizard', proficiency: undefined }, label: 'proficiency is undefined' },
            { stats: { name: 'Wizard', spellAbilities: { saveDc: null, modifier: 4 } }, label: 'saveDc is null and proficiency is missing' },
            { stats: { name: 'Wizard', spellAbilities: undefined }, label: 'spellAbilities is undefined and proficiency is missing' },
        ])('throws when %s', async ({ stats }) => {
            await expect(
                triggerSleep({ name: 'Sleep', level: 1 }, {}, stats, campaignName, mapName)
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it.each([
            ['metaCtx slotLevel', { spellSaveDc: 17, slotLevel: 4 }, 4],
            ['spell.level', { spellSaveDc: 17 }, 3],
        ])('uses %s for spellSlotLevel', async (_label, metaCtx, expectedLevel) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerSleep(
                { name: 'Sleep', level: 3 },
                metaCtx,
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: expectedLevel }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it.each([
            { spell: { name: 'Sleep' }, metaCtx: {}, label: 'no level and no slotLevel' },
            { spell: { name: 'Sleep', level: null }, metaCtx: { spellSaveDc: 15 }, label: 'spell.level is null' },
            { spell: { name: 'Sleep', level: undefined }, metaCtx: {}, label: 'spell.level is undefined' },
            { spell: {}, metaCtx: {}, label: 'empty spell object' },
        ])('throws when %s', async ({ spell, metaCtx }) => {
            await expect(
                triggerSleep(spell, metaCtx, playerStats, campaignName, mapName)
            ).rejects.toThrow('slot level is required for sleep spell');
        });

        it.each([undefined, null])('handles metaCtx %s gracefully', async (metaCtx) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerSleep(
                { name: 'Sleep', level: 1 },
                metaCtx,
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalled();
        });

        it('returns result from executeHandler on success, null when handler returns null or throws', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Sleep', description: 'Sleep affects...' } };
            executeHandler.mockResolvedValue(expectedResult);

            let result = await triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);

            executeHandler.mockResolvedValue(null);
            result = await triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            result = await triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStats, campaignName, mapName);
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
                    automation: expect.objectContaining({ type: 'sleep', saveType: 'WIS' }),
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

        it.each([undefined, null])('throws when playerStats is %s', async (playerStatsVal) => {
            await expect(
                triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStatsVal, campaignName, mapName)
            ).rejects.toThrow();
        });
    });
});
