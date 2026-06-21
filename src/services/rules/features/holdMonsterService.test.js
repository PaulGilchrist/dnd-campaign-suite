// @improved-by-ai
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

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerHoldMonster', () => {
        describe('spell name matching', () => {
            it.each([
                ['hold monster', 'hold monster'],
                ['Hold Monster', 'Hold Monster'],
                ['HOLD MONSTER', 'HOLD MONSTER'],
                ['hold person', 'hold person'],
                ['Hold Person', 'Hold Person'],
                ['HOLD PERSON', 'HOLD PERSON'],
            ])('executes handler for "%s" spell name (case-insensitive match)', async (inputName, expectedName) => {
                executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

                const result = await triggerHoldMonster(
                    { name: inputName, level: 7 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: expectedName,
                        automation: expect.objectContaining({ type: 'hold_monster' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            });

            it.each([
                'Fire Bolt',
                'Hold Elements',
                'Sleep',
                'Hypnotic Pattern',
                '',
                'hold monsters',
                'hold',
                'monster',
            ])('returns null for non-hold spell: "%s"', async (spellName) => {
                const result = await triggerHoldMonster(
                    { name: spellName, level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });
        });

        describe('save DC computation', () => {
            it('uses spellSaveDc from metaCtx when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerHoldMonster(
                    { name: 'Hold Monster', level: 7 },
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

            it('prefers metaCtx spellSaveDc over playerStats.spellAbilities.saveDc', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerHoldMonster(
                    { name: 'Hold Monster', level: 7 },
                    { spellSaveDc: 20 },
                    { ...playerStats, spellAbilities: { saveDc: 15 } },
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 20 }),
                    }),
                    expect.objectContaining({ spellAbilities: { saveDc: 15 } }),
                    campaignName,
                    mapName,
                );
            });

            it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
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

            it('uses default proficiency of 2 when proficiency is missing', async () => {
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

                await triggerHoldMonster(
                    { name: 'Hold Monster', level: 7 },
                    {},
                    {},
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 10 }),
                    }),
                    {},
                    campaignName,
                    mapName,
                );
            });

            it('computes saveDc when spellAbilities is undefined', async () => {
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

        describe('slot level resolution', () => {
            it('uses metaCtx slotLevel when provided', async () => {
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

            it('uses metaCtx slotLevel over spell.level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerHoldMonster(
                    { name: 'Hold Monster', level: 3 },
                    { spellSaveDc: 17, slotLevel: 6 },
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

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
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

            it('defaults slotLevel to 5 when spell.level is null', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerHoldMonster(
                    { name: 'Hold Monster', level: null },
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

            it('defaults slotLevel to 5 when spell.level is undefined', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerHoldMonster(
                    { name: 'Hold Monster', level: undefined },
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
        });

        describe('action structure', () => {
            it('passes the original spell object into the action', async () => {
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

            it('includes saveType WIS in the automation action', async () => {
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

            it('includes automation type hold_monster in the action', async () => {
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
                        automation: expect.objectContaining({ type: 'hold_monster' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes campaignName and mapName to executeHandler', async () => {
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
        });

        describe('return value', () => {
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

            it('returns null when executeHandler throws an error', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerHoldMonster(
                    { name: 'Hold Monster', level: 7 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });
        });

        describe('invalid/null spell name handling', () => {
            it('returns null when spell name is undefined', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerHoldMonster(
                    { level: 7 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('returns null when spell name is null', async () => {
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

            it('returns null when spell name is empty string', async () => {
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
        });

        describe('metaCtx handling', () => {
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
        });
    });
});
