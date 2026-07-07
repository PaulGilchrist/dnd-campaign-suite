// @improved-by-ai
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

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerTashasHideousLaughter', () => {
        describe('spell name matching', () => {
            it.each([
                ["tasha's hideous laughter", "tasha's hideous laughter"],
                ["TASHA'S HIDEOUS LAUGHTER", "TASHA'S HIDEOUS LAUGHTER"],
                ["TaShA'S HiDeOuS LaUgHtEr", "TaShA'S HiDeOuS LaUgHtEr"],
            ])('executes handler for "%s" spell name (case-insensitive match)', async (inputName) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerTashasHideousLaughter(
                    { name: inputName, level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ type: 'tashas_laughter', saveDc: 15, saveType: 'WIS' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toEqual({ type: 'popup' });
            });

            it.each([
                'Fire Bolt',
                'Sleep',
                'Hypnotic Pattern',
                "tasha's hideous laughters",
                "tasha's",
                'hideous laughter',
            ])('returns null for non-match: "%s"', async (spellName) => {
                const result = await triggerTashasHideousLaughter(
                    { name: spellName, level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it.each([undefined, null, ''])(
                'returns null when spell name is %s',
                async (spellName) => {
                    const result = await triggerTashasHideousLaughter(
                        { name: spellName, level: 1 },
                        {},
                        playerStats,
                        campaignName,
                        mapName,
                    );

                    expect(result).toBeNull();
                    expect(executeHandler).not.toHaveBeenCalled();
                },
            );
        });

        describe('save DC resolution', () => {
            it('uses metaCtx spellSaveDc when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

            it('prefers metaCtx spellSaveDc over playerStats.saveDc', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

            it('computes saveDc as 8 + proficiency when no spellAbilities.saveDc', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', proficiency: 3 };

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

            it('uses default proficiency of 2 when proficiency is missing, null, or undefined', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                for (const stats of [
                    { name: 'Wizard' },
                    { name: 'Wizard', proficiency: null },
                    { name: 'Wizard', proficiency: undefined },
                ]) {
                    await triggerTashasHideousLaughter(
                        { name: "tasha's hideous laughter", level: 1 },
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
                    executeHandler.mockClear();
                }
            });

            it('uses default saveDc base of 8 when playerStats is empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

            it('uses proficiency when spellAbilities.saveDc is null', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', spellAbilities: { saveDc: null, modifier: 4 }, proficiency: 5 };

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 13 }),
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

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 3 },
                    { slotLevel: 5 },
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

            it('prefers metaCtx slotLevel over spell.level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 3 },
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

            it.each([null, undefined])(
                'defaults slotLevel to 1 when spell.level is %s',
                async (level) => {
                    executeHandler.mockResolvedValue({ type: 'popup' });

                    await triggerTashasHideousLaughter(
                        { name: "tasha's hideous laughter", level },
                        {},
                        playerStats,
                        campaignName,
                        mapName,
                    );

                    expect(executeHandler).toHaveBeenCalledWith(
                        expect.objectContaining({ spellSlotLevel: 1 }),
                        playerStats,
                        campaignName,
                        mapName,
                    );
                },
            );

            it('defaults slotLevel to 1 when neither metaCtx nor spell has level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter" },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 1 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('action structure', () => {
            it('passes the original spell object into the action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: "tasha's hideous laughter", level: 3, school: 'Enchantment' };

                await triggerTashasHideousLaughter(spell, {}, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes campaignName and mapName as the last two arguments', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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
                    payload: { type: 'automation_info', name: "tasha's hideous laughter", description: 'Target laughs' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null or throws', async () => {
                const spell = { name: "tasha's hideous laughter", level: 1 };

                executeHandler.mockResolvedValue(null);
                expect(
                    await triggerTashasHideousLaughter(spell, {}, playerStats, campaignName, mapName),
                ).toBeNull();

                executeHandler.mockRejectedValue(new Error('Handler failed'));
                expect(
                    await triggerTashasHideousLaughter(spell, {}, playerStats, campaignName, mapName),
                ).toBeNull();
            });
        });

        describe('metaCtx handling', () => {
            it.each([null, undefined])(
                'handles %s metaCtx gracefully using playerStats fallbacks',
                async (metaCtx) => {
                    executeHandler.mockResolvedValue({ type: 'popup' });

                    const result = await triggerTashasHideousLaughter(
                        { name: "tasha's hideous laughter", level: 1 },
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
                },
            );

            it('handles partial metaCtx with only spellSaveDc', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

                await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
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

        describe('early return when spell does not match', () => {
            it.each([undefined, null])(
                'returns null when playerStats is %s and spell does not match',
                async (playerStatsArg) => {
                    const result = await triggerTashasHideousLaughter(
                        { name: 'Fire Bolt', level: 0 },
                        {},
                        playerStatsArg,
                        campaignName,
                        mapName,
                    );

                    expect(result).toBeNull();
                    expect(executeHandler).not.toHaveBeenCalled();
                },
            );
        });
    });
});
