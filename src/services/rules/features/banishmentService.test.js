import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerBanishment } from './banishmentService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('banishmentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
        proficiency: 4,
    };
    const spell = { name: 'Banishment', level: 4 };

    describe('triggerBanishment', () => {
        describe('spell name matching', () => {
            it.each([
                'Banishment',
                'banishment',
                'BANISHMENT',
                'bAnIsHmEnT',
            ])('triggers for "%s" spell name (case-insensitive)', async (name) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerBanishment(
                    { name, level: 4 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ type: 'popup' });
            });

            it.each([
                'Banishment Shield',
                'Banishing Smite',
                'Banishment Force',
                'Banished',
                'Banisher',
                '',
                undefined,
                null,
            ])('returns null for non-banishment spell: "%s"', async (name) => {
                const result = await triggerBanishment(
                    { name, level: 1 },
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
            it('uses metaCtx.spellSaveDc when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
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

            it('falls back to playerStats.spellAbilities.saveDc', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
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

                await triggerBanishment(
                    spell,
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                // 8 + proficiency(3) = 11
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 11 }),
                    }),
                    stats,
                    campaignName,
                    mapName,
                );
            });

            it('uses default saveDc of 10 when stats are minimal (proficiency defaults to 2)', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
                    {},
                    {},
                    campaignName,
                    mapName,
                );

                // 8 + (undefined || 2) = 10
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
            it('uses metaCtx.slotLevel when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
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

                await triggerBanishment(
                    spell,
                    {},
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

            it('defaults slotLevel to 4 when neither metaCtx nor spell has level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    { name: 'banishment' },
                    {},
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
        });

        describe('action structure', () => {
            it('constructs action with correct type and fields', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Banishment',
                        automation: expect.objectContaining({
                            type: 'banishment',
                            saveDc: 15,
                            saveType: 'CHA',
                        }),
                        spell,
                        spellSlotLevel: 4,
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes spell object through to the action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const customSpell = { name: 'banishment', level: 6, school: 'abjuration' };

                await triggerBanishment(
                    customSpell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        spell: customSpell,
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes metaCtx through to the action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const customMeta = { targetName: 'Dragon', slotLevel: 5 };

                await triggerBanishment(
                    spell,
                    customMeta,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        metaCtx: customMeta,
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('return value', () => {
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Banishment', description: 'Banishment affects target.' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null when executeHandler throws', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });
        });

        describe('metaCtx handling', () => {
            it.each([null, undefined])('handles %s metaCtx gracefully', async (metaCtx) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerBanishment(
                    spell,
                    metaCtx,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalled();
                expect(result).toEqual({ type: 'popup' });
            });

            it('handles metaCtx with only partial fields', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
                    { slotLevel: 6 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalled();
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 6 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('campaignName and mapName forwarding', () => {
            it('forwards campaignName to executeHandler', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    'MyCampaign',
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.any(Object),
                    playerStats,
                    'MyCampaign',
                    mapName,
                );
            });

            it('forwards mapName to executeHandler', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    'dungeon-map-1',
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.any(Object),
                    playerStats,
                    campaignName,
                    'dungeon-map-1',
                );
            });
        });

        describe('error handling', () => {
            it('logs error to console.error when executeHandler throws', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));
                const consoleSpy = vi.spyOn(console, 'error');

                await triggerBanishment(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[banishmentService] Failed to execute Banishment handler:'),
                    expect.any(Error),
                );

                consoleSpy.mockRestore();
            });

            it('still returns null even when console.error is unavailable', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerBanishment(
                    spell,
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
