// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerOttoDance } from './ottoDanceService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const mockedExecuteHandler = vi.mocked(executeHandler);

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

        describe('non-Otto-Dance spells', () => {
            it.each([
                { name: 'Vicious Mockery', level: 0 },
                { name: '', level: 6 },
                { level: 6 },
                { name: null, level: 6 },
            ])('returns null for non-matching spell: $name', async () => {
                const result = await triggerOttoDance(
                    { name: 'Vicious Mockery', level: 0 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
                expect(mockedExecuteHandler).not.toHaveBeenCalled();
            });
        });

        describe('spell name matching', () => {
            it.each([
                "Otto's Irresistible Dance",
                "otto's irresistible dance",
                "OTTO'S IRRESISTIBLE DANCE",
                "Otto's iRrEsIsTiBlE dAnCe",
                'Irresistible Dance',
                'irresistible dance',
                'IRRESISTIBLE DANCE',
            ])('matches spell name case-insensitively: "%s"', async (spellName) => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                const result = await triggerOttoDance(
                    { name: spellName, level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ success: true });
            });
        });

        describe('action construction', () => {
            it('passes the automation block with correct type, saveDc, and saveType', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({
                            type: 'ottos_dance',
                            saveType: 'WIS',
                        }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes the original spell object in the action', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });
                const spell = { name: "Otto's Irresistible Dance", level: 6, school: 'Enchantment' };

                await triggerOttoDance(spell, {}, playerStats, campaignName, mapName);

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('saveDc resolution', () => {
            it('uses metaCtx spellSaveDc when provided', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    { spellSaveDc: 19 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 19 }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('falls back to playerStats spellAbilities.saveDc', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 16 }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('computes saveDc from 8 + proficiency when no spellAbilities.saveDc', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });
                const stats = { name: 'Bard', proficiency: 5 };

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 13 }),
                    }),
                    stats,
                    campaignName,
                    mapName,
                );
            });

            it('uses default proficiency of 2 when playerStats.proficiency is missing', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });
                const stats = { name: 'Bard' };

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 10 }),
                    }),
                    stats,
                    campaignName,
                    mapName,
                );
            });

            it('uses default saveDc of 8 when proficiency is also missing', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });
                const stats = { name: 'Bard' };

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 10 }),
                    }),
                    stats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('slotLevel resolution', () => {
            it('uses metaCtx slotLevel when provided', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    { slotLevel: 9 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 9 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 8 },
                    { spellSaveDc: 18 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 8 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('uses default slot level 6 when nothing is provided', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance" },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 6 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('metaCtx handling', () => {
            it('handles undefined metaCtx gracefully', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                const result = await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    undefined,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({ success: true });
                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 16 }),
                        spellSlotLevel: 6,
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('handles empty metaCtx object', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledTimes(1);
            });
        });

        describe('result propagation', () => {
            it('returns the result from executeHandler', async () => {
                const expectedResult = { type: 'popup', payload: { type: 'automation_info' } };
                mockedExecuteHandler.mockResolvedValue(expectedResult);

                const result = await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler resolves null', async () => {
                mockedExecuteHandler.mockResolvedValue(null);

                const result = await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null and logs error when executeHandler rejects', async () => {
                const error = new Error('Handler failed');
                mockedExecuteHandler.mockRejectedValue(error);
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[ottoDanceService]'),
                    error,
                );
                consoleSpy.mockRestore();
            });
        });

        describe('argument passthrough', () => {
            it('passes campaignName and mapName as the 3rd and 4th arguments to executeHandler', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    playerStats,
                    'MyCampaign',
                    'bossRoom',
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.any(Object),
                    playerStats,
                    'MyCampaign',
                    'bossRoom',
                );
            });

            it('passes playerStats as the second argument to executeHandler', async () => {
                mockedExecuteHandler.mockResolvedValue({ success: true });
                const customStats = { name: 'Rogue', proficiency: 3 };

                await triggerOttoDance(
                    { name: "Otto's Irresistible Dance", level: 6 },
                    {},
                    customStats,
                    campaignName,
                    mapName,
                );

                expect(mockedExecuteHandler).toHaveBeenCalledWith(
                    expect.any(Object),
                    customStats,
                    campaignName,
                    mapName,
                );
            });
        });
    });
});
