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
        describe('spell name matching', () => {
            it.each([
                ['Slow'],
                ['slow'],
                ['SLOW'],
                ['sLoW'],
            ])('executes handler for "%s" spell name (case-insensitive)', async (name) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerSlow(
                    { name, level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ type: 'popup' });
            });

            it.each([
                'Haste',
                'Fire Bolt',
                'Silence',
                'Fear',
                'fears',
                '',
            ])('returns null for non-Slow spell: "%s"', async (spellName) => {
                const result = await triggerSlow(
                    { name: spellName, level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it.each([
                [undefined],
                [null],
            ])('returns null when spell name is %s', async (name) => {
                const result = await triggerSlow(
                    { name, level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });
        });

        describe('save DC resolution', () => {
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

            it('uses default proficiency of 2 when proficiency is missing', async () => {
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
        });

        describe('slot level resolution', () => {
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

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
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

            it('defaults slotLevel to 3 when neither metaCtx nor spell has level', async () => {
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

        describe('action structure', () => {
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
        });

        describe('metaCtx edge cases', () => {
            it.each([
                [undefined],
                [null],
            ])('handles %s metaCtx gracefully', async (metaCtx) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerSlow(
                    { name: 'Slow', level: 3 },
                    metaCtx,
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
        });

        describe('return value', () => {
            it('returns result from executeHandler on success, null when handler returns null or throws', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Slow', description: 'Slow affects...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                let result = await triggerSlow({ name: 'Slow', level: 3 }, {}, playerStats, campaignName, mapName);
                expect(result).toBe(expectedResult);

                executeHandler.mockResolvedValue(null);
                result = await triggerSlow({ name: 'Slow', level: 3 }, {}, playerStats, campaignName, mapName);
                expect(result).toBeNull();

                vi.spyOn(console, 'error').mockReturnValue();
                executeHandler.mockRejectedValue(new Error('Handler failed'));
                result = await triggerSlow({ name: 'Slow', level: 3 }, {}, playerStats, campaignName, mapName);
                expect(result).toBeNull();
                expect(console.error).toHaveBeenCalled();
                vi.restoreAllMocks();
            });
        });
    });
});
