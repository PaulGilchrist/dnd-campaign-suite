import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerImprisonment } from './imprisonmentService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('imprisonmentService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 17, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 11 },
        proficiency: 6,
    };

    describe('triggerImprisonment', () => {
        describe('spell name matching', () => {
            it.each([
                ['imprisonment', 'imprisonment'],
                ['Imprisonment', 'Imprisonment'],
                ['IMPRISONMENT', 'IMPRISONMENT'],
            ])('executes handler for "%s" spell name (case-insensitive match)', async (inputName, expectedName) => {
                executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

                const result = await triggerImprisonment(
                    { name: inputName, level: 9 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: expectedName,
                        automation: expect.objectContaining({ type: 'imprisonment' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            });

            it.each([
                'Fire Bolt',
                'Hold Monster',
                'Sleep',
                'Hypnotic Pattern',
                '',
                'imprisonments',
                'imprison',
                'imprisonment spell',
                undefined,
                null,
            ])('returns null for non-imprisonment spell: "%s"', async (spellName) => {
                const result = await triggerImprisonment(
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

                await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
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

            it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 17 }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', proficiency: 5 };

                await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
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

                await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
                    { slotLevel: 9 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 9 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 9 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('action structure', () => {
            it('constructs the action with all expected fields', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Imprisonment', level: 9, school: 'Abjuration' };

                await triggerImprisonment(spell, {}, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Imprisonment',
                        spell,
                        spellSlotLevel: 9,
                        automation: expect.objectContaining({
                            type: 'imprisonment',
                            saveDc: 17,
                            saveType: 'WIS',
                            options: ['Burial', 'Chaining', 'Hedged Prison', 'Minimus Containment', 'Slumber'],
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
                    payload: { type: 'automation_info', name: 'Imprisonment', description: 'Imprisonment affects...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null when executeHandler throws an error', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
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

                const result = await triggerImprisonment(
                    { name: 'Imprisonment', level: 9 },
                    null,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 17 }),
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
