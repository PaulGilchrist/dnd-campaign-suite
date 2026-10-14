import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSleetStorm } from './sleetStormService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('sleetStormService', () => {
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

    describe('triggerSleetStorm', () => {
        describe('action construction', () => {
            it('calls executeHandler with correct action structure', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                const [action] = executeHandler.mock.calls[0];
                expect(action.name).toBe('Sleet Storm');
                expect(action.automation.type).toBe('sleet_storm');
                expect(action.automation.saveType).toBe('DEX');
                expect(action.spell).toEqual({ name: 'Sleet Storm', level: 3 });
            });

            it('passes spellSlotLevel to action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(3);
            });

            it('handles null metaCtx by treating it as empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    null,
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.automation.saveType).toBe('DEX');
                expect(action.automation.type).toBe('sleet_storm');
            });

            it('handles undefined metaCtx by treating it as empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    undefined,
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.automation.saveType).toBe('DEX');
            });
        });

        describe('save DC resolution', () => {
            it('uses metaCtx spellSaveDc when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    { spellSaveDc: 18 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.automation.saveDc).toBe(18);
            });

            it('falls back to playerStats.spellAbilities.saveDc when metaCtx lacks it', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.automation.saveDc).toBe(15);
            });

            it('computes saveDc from proficiency when spellAbilities is missing', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', proficiency: 3 };

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                // 8 + 3 = 11
                expect(action.automation.saveDc).toBe(11);
            });

            it('uses default saveDc of 10 when stats object is empty', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    {},
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                // 8 + (2 default) = 10
                expect(action.automation.saveDc).toBe(10);
            });

            it('treats null saveDc as falsy and falls back to proficiency', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', spellAbilities: { saveDc: null }, proficiency: 4 };

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                // 8 + 4 = 12
                expect(action.automation.saveDc).toBe(12);
            });

            it('treats 0 saveDc as falsy and falls back to proficiency', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const stats = { name: 'Wizard', spellAbilities: { saveDc: 0 }, proficiency: 5 };

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                // 8 + 5 = 13
                expect(action.automation.saveDc).toBe(13);
            });
        });

        describe('slot level resolution', () => {
            it('uses metaCtx slotLevel when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    { slotLevel: 5 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(5);
            });

            it('falls back to spell.level when metaCtx has no slotLevel', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 4 },
                    { spellSaveDc: 17 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(4);
            });

            it('defaults slotLevel to 3 when neither metaCtx nor spell has level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(3);
            });

            it('treats null slotLevel as falsy and falls back to spell.level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 4 },
                    { slotLevel: null },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(4);
            });

            it('treats 0 slotLevel as falsy and falls back to spell.level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 5 },
                    { slotLevel: 0 },
                    playerStats,
                    campaignName,
                    mapName,
                );

                const [action] = executeHandler.mock.calls[0];
                expect(action.spellSlotLevel).toBe(5);
            });
        });

        describe('return value', () => {
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Sleet Storm', description: '...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler throws an error', async () => {
                const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[sleetStormService] Failed to execute Sleet Storm handler'),
                    expect.any(Error),
                );
                consoleSpy.mockRestore();
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerSleetStorm(
                    { name: 'Sleet Storm', level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });
        });

        describe('defensive coding', () => {
            it('handles empty spell object with defaults', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerSleetStorm({}, undefined, playerStats, campaignName, mapName);

                const [action] = executeHandler.mock.calls[0];
                expect(action.name).toBe(undefined);
                expect(action.automation.type).toBe('sleet_storm');
                expect(action.automation.saveType).toBe('DEX');
                expect(action.automation.saveDc).toBe(15);
                expect(action.spellSlotLevel).toBe(3);
            });

            it('throws when playerStats is undefined or null', async () => {
                await expect(
                    triggerSleetStorm(
                        { name: 'Sleet Storm', level: 3 },
                        {},
                        undefined,
                        campaignName,
                        mapName,
                    ),
                ).rejects.toThrow();

                await expect(
                    triggerSleetStorm(
                        { name: 'Sleet Storm', level: 3 },
                        {},
                        null,
                        campaignName,
                        mapName,
                    ),
                ).rejects.toThrow();
            });
        });
    });
});
