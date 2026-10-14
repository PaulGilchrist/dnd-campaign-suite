import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerMaze } from './mazeService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('mazeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 17, modifier: 4 },
        proficiency: 6,
    };

    describe('triggerMaze', () => {
        describe('spell name matching', () => {
            it.each([
                ['maze', 'maze'],
                ['Maze', 'Maze'],
                ['MAZE', 'MAZE'],
            ])('executes handler for "%s" spell name (case-insensitive match)', async (inputName, expectedName) => {
                executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

                const result = await triggerMaze(
                    { name: inputName, level: 8 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: expectedName,
                        automation: expect.objectContaining({ type: 'maze' }),
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
                'mazes',
                'maze spell',
                undefined,
                null,
            ])('returns null for non-maze spell: "%s"', async (spellName) => {
                const result = await triggerMaze(
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

                await triggerMaze(
                    { name: 'Maze', level: 8 },
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

                await triggerMaze(
                    { name: 'Maze', level: 8 },
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

                await triggerMaze(
                    { name: 'Maze', level: 8 },
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

            it('uses default saveDc of 10 when stats object is empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerMaze(
                    { name: 'Maze', level: 8 },
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

                await triggerMaze(
                    { name: 'Maze', level: 8 },
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

                await triggerMaze(
                    { name: 'Maze', level: 8 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 8 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('defaults slotLevel to 8 when neither metaCtx nor spell has level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerMaze(
                    { name: 'Maze' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: 8 }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('action structure', () => {
            it('constructs the action with all expected fields', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Maze', level: 8, school: 'Conjuration' };

                await triggerMaze(spell, {}, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Maze',
                        spell,
                        spellSlotLevel: 8,
                        automation: expect.objectContaining({
                            type: 'maze',
                            saveDc: 17,
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
                    payload: { type: 'automation_info', name: 'Maze', description: 'Maze affects...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerMaze(
                    { name: 'Maze', level: 8 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerMaze(
                    { name: 'Maze', level: 8 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null when executeHandler throws an error and logs it', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await triggerMaze(
                    { name: 'Maze', level: 8 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith(
                    '[mazeService] Failed to execute Maze handler:',
                    expect.any(Error),
                );
                consoleSpy.mockRestore();
            });
        });

        describe('metaCtx handling', () => {
            it('handles null metaCtx gracefully', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerMaze(
                    { name: 'Maze', level: 8 },
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

            it('handles undefined metaCtx gracefully', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerMaze(
                    { name: 'Maze', level: 8 },
                    undefined,
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
