// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFear } from './fearService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('fearService', () => {
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

    describe('triggerFear', () => {
        describe('spell name matching', () => {
            it.each([
                ['Fear'],
                ['fear'],
                ['FEAR'],
                ['fEaR'],
            ])('executes handler for "%s" spell name (case-insensitive)', async (name) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerFear(
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
                'Fire Bolt',
                'Silence',
                'Hold Monster',
                'Fearful',
                'fearless',
                '',
                'fears',
                undefined,
                null,
            ])('returns null for non-Fear spell: "%s"', async (spellName) => {
                const result = await triggerFear(
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

        describe('save DC resolution', () => {
            it('uses metaCtx spellSaveDc when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFear(
                    { name: 'Fear', level: 3 },
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

            it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFear(
                    { name: 'Fear', level: 3 },
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

            it('computes saveDc from proficiency when spellAbilities is missing', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', proficiency: 3 };

                await triggerFear(
                    { name: 'Fear', level: 3 },
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

            it('uses default saveDc of 10 when stats object is empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFear(
                    { name: 'Fear', level: 3 },
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
        });

        describe('slot level resolution', () => {
            it('uses metaCtx slotLevel when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFear(
                    { name: 'Fear', level: 3 },
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

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFear(
                    { name: 'Fear', level: 5 },
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

                await triggerFear(
                    { name: 'Fear' },
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

        describe('metaCtx null/undefined', () => {
            it.each([null, undefined])('handles %s metaCtx gracefully', async (metaCtx) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerFear(
                    { name: 'Fear', level: 3 },
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
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Fear', description: 'Fear affects...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerFear(
                    { name: 'Fear', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerFear(
                    { name: 'Fear', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null when executeHandler throws an error', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerFear(
                    { name: 'Fear', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });
        });
    });
});
