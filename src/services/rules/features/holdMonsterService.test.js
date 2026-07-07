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
                undefined,
                null,
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
        });

        describe('action structure', () => {
            it('constructs the action with all expected fields', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Hold Monster', level: 7, school: 'Enchantment' };

                await triggerHoldMonster(spell, {}, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Hold Monster',
                        spell,
                        spellSlotLevel: 7,
                        automation: expect.objectContaining({
                            type: 'hold_monster',
                            saveDc: 15,
                            saveType: 'WIS',
                        }),
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

        describe('metaCtx handling', () => {
            it('handles null/undefined metaCtx gracefully', async () => {
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
        });
    });
});
