// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPowerWordStun } from './powerWordStunService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('powerWordStunService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const basePlayerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerPowerWordStun', () => {
        it('returns null for non-Power Word Stun spells', async () => {
            const result = await triggerPowerWordStun(
                { name: 'Fire Bolt', level: 0 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerPowerWordStun(
                {},
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for empty spell name string', async () => {
            const result = await triggerPowerWordStun(
                { name: '', level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('does not match partial spell names', async () => {
            const partialNames = ['Power Word', 'Power Word Stunned', 'Power Words Stun', 'word stun'];

            for (const name of partialNames) {
                const result = await triggerPowerWordStun(
                    { name, level: 9 },
                    {},
                    basePlayerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            }
        });

        it.each([
            ['exact match', 'Power Word Stun'],
            ['lowercase', 'power word stun'],
            ['uppercase', 'POWER WORD STUN'],
            ['mixed case', 'PoWeR wOrd StUn'],
        ])('triggers handler for %s spell name', async (_label, spellName) => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerPowerWordStun(
                { name: spellName, level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(result).toBe(expectedResult);
        });

        it('passes correct automation config to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: {
                        type: 'power_word_stun',
                        saveDc: 15,
                        saveType: 'CON',
                    },
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the original spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Power Word Stun', level: 9, school: 'Enchantment' };

            await triggerPowerWordStun(spell, {}, basePlayerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('uses metaCtx spellSaveDc when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                { spellSaveDc: 20, slotLevel: 9 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 20 }),
                    spellSlotLevel: 9,
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
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

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
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

        it('uses metaCtx slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                { spellSaveDc: 18, slotLevel: 8 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 8 }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 7 },
                { spellSaveDc: 17 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default slot level of 8 when no slotLevel or spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun' },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 8 }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Power Word Stun', description: 'Stun affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and swallows executeHandler errors', async () => {
            vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                undefined,
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });
    });
});
