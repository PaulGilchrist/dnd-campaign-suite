import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHoldMonster } from './holdMonsterService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('holdMonsterService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerHoldMonster', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-hold spells', async () => {
            const result = await triggerHoldMonster(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for other spells not in HOLD_SPELL_NAMES', async () => {
            const result = await triggerHoldMonster(
                { name: 'Hold Elements', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('triggers handler for "hold monster" (lowercase)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerHoldMonster(
                { name: 'hold monster', level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'hold monster',
                    automation: expect.objectContaining({
                        type: 'hold_monster',
                        saveDc: 15,
                        saveType: 'WIS',
                    }),
                    spellSlotLevel: 7,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('triggers handler for "hold monster" (title case)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Hold Monster',
                    automation: expect.objectContaining({
                        type: 'hold_monster',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('triggers handler for "hold person" (lowercase)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHoldMonster(
                { name: 'hold person', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'hold person',
                    automation: expect.objectContaining({
                        type: 'hold_monster',
                        saveDc: 15,
                        saveType: 'WIS',
                    }),
                    spellSlotLevel: 5,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('triggers handler for "hold person" (title case)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHoldMonster(
                { name: 'Hold Person', level: 5 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Hold Person',
                    automation: expect.objectContaining({
                        type: 'hold_monster',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                { spellSaveDc: 18, slotLevel: 7 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 7,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

        it('uses default saveDc base of 8 when no proficiency at all', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = {};

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Hold Monster', description: 'Hold Monster affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('throws when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerHoldMonster(
                    { name: 'Hold Monster', level: 7 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Hold Monster', level: 7, school: 'Enchantment' };

            await triggerHoldMonster(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                { spellSaveDc: 17 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses metaCtx slotLevel over spell.level when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 5 },
                { slotLevel: 7 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults slotLevel to 5 when neither metaCtx nor spell has level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster' },
                {},
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

        it('handles undefined spell name gracefully for hold monster', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles empty string spell name gracefully', async () => {
            const result = await triggerHoldMonster(
                { name: '', level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles undefined spell object gracefully', async () => {
            try {
                await triggerHoldMonster(
                    undefined,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(true).toBe(false);
            } catch (e) {
                expect(e).toBeInstanceOf(TypeError);
            }
        });

        it('passes correct campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

        it('uses WIS as saveType in automation action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

        it('handles partial metaCtx with only slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

        it('handles partial metaCtx with only spellSaveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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

        it('handles null metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                null,
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
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
                undefined,
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
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles spell with null name', async () => {
            const result = await triggerHoldMonster(
                { name: null, level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles spell with number type', async () => {
            try {
                await triggerHoldMonster(
                    { name: 123, level: 7 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(true).toBe(false);
            } catch (e) {
                expect(e).toBeInstanceOf(TypeError);
            }
        });

        it('handles hold monster with spellAbilities undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 4 };

            await triggerHoldMonster(
                { name: 'Hold Monster', level: 7 },
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
});
