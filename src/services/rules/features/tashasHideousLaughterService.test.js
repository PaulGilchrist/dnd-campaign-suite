import { describe, it, expect } from 'vitest';
import { triggerTashasHideousLaughter } from './tashasHideousLaughterService.js';

describe('tashasHideousLaughterService', () => {
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
                "tasha's hideous laughter",
                "TASHA'S HIDEOUS LAUGHTER",
                "TaShA'S HiDeOuS LaUgHtEr",
            ])('returns modal structure for "%s" spell name (case-insensitive match)', async (inputName) => {
                const result = await triggerTashasHideousLaughter(
                    { name: inputName, level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({
                    type: 'modal',
                    modalName: 'tashasLaughter',
                    payload: expect.objectContaining({
                        action: expect.objectContaining({ name: inputName }),
                        campaignName,
                        saveType: 'WIS',
                        saveDc: 15,
                        spellSlotLevel: 1,
                    }),
                });
            });

            it.each([
                'Fire Bolt',
                'Sleep',
                'Hypnotic Pattern',
                "tasha's hideous laughters",
                "tasha's",
                'hideous laughter',
            ])('returns modal for non-match: "%s"', async (spellName) => {
                const result = await triggerTashasHideousLaughter(
                    { name: spellName, level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({
                    type: 'modal',
                    modalName: 'tashasLaughter',
                    payload: expect.objectContaining({
                        action: expect.objectContaining({ name: spellName }),
                    }),
                });
            });

            it.each([undefined, null, ''])(
                'returns modal when spell name is %s',
                async (spellName) => {
                    const result = await triggerTashasHideousLaughter(
                        { name: spellName, level: 1 },
                        {},
                        playerStats,
                        campaignName,
                        mapName,
                    );

                    expect(result).toEqual({
                        type: 'modal',
                        modalName: 'tashasLaughter',
                        payload: expect.objectContaining({
                            action: expect.objectContaining({ name: spellName }),
                        }),
                    });
                },
            );
        });

        describe('save DC resolution', () => {
            it('uses metaCtx spellSaveDc when provided', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    { spellSaveDc: 18 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(18);
            });

            it('prefers metaCtx spellSaveDc over playerStats.saveDc', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    { spellSaveDc: 20 },
                    { ...playerStats, spellAbilities: { saveDc: 15 } },
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(20);
            });

            it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(15);
            });

            it('computes saveDc as 8 + proficiency when no spellAbilities.saveDc', async () => {
                const stats = { name: 'Wizard', proficiency: 3 };

                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(11);
            });

            it('uses default proficiency of 2 when proficiency is missing, null, or undefined', async () => {
                for (const stats of [
                    { name: 'Wizard' },
                    { name: 'Wizard', proficiency: null },
                    { name: 'Wizard', proficiency: undefined },
                ]) {
                    const result = await triggerTashasHideousLaughter(
                        { name: "tasha's hideous laughter", level: 1 },
                        {},
                        stats,
                        campaignName,
                        mapName,
                    );

                    expect(result.payload.saveDc).toBe(10);
                }
            });

            it('uses default saveDc base of 8 when playerStats is empty', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    {},
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(10);
            });

            it('computes saveDc when spellAbilities is undefined', async () => {
                const stats = { name: 'Wizard', proficiency: 4 };

                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(12);
            });

            it('uses proficiency when spellAbilities.saveDc is null', async () => {
                const stats = { name: 'Wizard', spellAbilities: { saveDc: null, modifier: 4 }, proficiency: 5 };

                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(13);
            });
        });

        describe('slot level resolution', () => {
            it('uses metaCtx slotLevel when provided', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 3 },
                    { slotLevel: 5 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.spellSlotLevel).toBe(5);
            });

            it('prefers metaCtx slotLevel over spell.level', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    { spellSaveDc: 17, slotLevel: 6 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.spellSlotLevel).toBe(6);
            });

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 3 },
                    { spellSaveDc: 17 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.spellSlotLevel).toBe(3);
            });

            it.each([null, undefined])(
                'defaults slotLevel to 1 when spell.level is %s',
                async (level) => {
                    const result = await triggerTashasHideousLaughter(
                        { name: "tasha's hideous laughter", level },
                        {},
                        playerStats,
                        campaignName,
                        mapName,
                    );

                    expect(result.payload.spellSlotLevel).toBe(1);
                },
            );

            it('defaults slotLevel to 1 when neither metaCtx nor spell has level', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter" },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.spellSlotLevel).toBe(1);
            });
        });

        describe('action structure', () => {
            it('passes the original spell name into the action', async () => {
                const spell = { name: "tasha's hideous laughter", level: 3, school: 'Enchantment' };

                const result = await triggerTashasHideousLaughter(spell, {}, playerStats, campaignName, mapName);

                expect(result.payload.action.name).toBe("tasha's hideous laughter");
                expect(result.payload.action.automation).toEqual({ type: 'tashas_laughter' });
            });

            it('includes campaignName in payload', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    playerStats,
                    'MyCampaign',
                    'DungeonMap1',
                );

                expect(result.payload.campaignName).toBe('MyCampaign');
            });
        });

        describe('return value', () => {
            it('returns modal structure with correct type and modalName', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.type).toBe('modal');
                expect(result.modalName).toBe('tashasLaughter');
                expect(result.payload).toEqual(expect.objectContaining({
                    action: expect.any(Object),
                    playerStats,
                    campaignName,
                    saveType: 'WIS',
                    saveDc: 15,
                    spellSlotLevel: 1,
                }));
            });
        });

        describe('metaCtx handling', () => {
            it.each([null, undefined])(
                'handles %s metaCtx gracefully using playerStats fallbacks',
                async (metaCtx) => {
                    const result = await triggerTashasHideousLaughter(
                        { name: "tasha's hideous laughter", level: 1 },
                        metaCtx,
                        playerStats,
                        campaignName,
                        mapName,
                    );

                    expect(result.payload.saveDc).toBe(15);
                    expect(result.payload.spellSlotLevel).toBe(1);
                },
            );

            it('handles partial metaCtx with only spellSaveDc', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    { spellSaveDc: 20 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(20);
                expect(result.payload.spellSlotLevel).toBe(1);
            });

            it('handles partial metaCtx with only slotLevel', async () => {
                const result = await triggerTashasHideousLaughter(
                    { name: "tasha's hideous laughter", level: 1 },
                    { slotLevel: 6 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result.payload.saveDc).toBe(15);
                expect(result.payload.spellSlotLevel).toBe(6);
            });
        });
    });
});
