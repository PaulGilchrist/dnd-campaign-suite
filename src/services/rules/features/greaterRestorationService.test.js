// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerGreaterRestoration, confirmGreaterRestoration } from './greaterRestorationService.js';
import { executeHandler, applyGreaterRestorationEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyGreaterRestorationEffect: vi.fn(),
}));

describe('greaterRestorationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric', proficiency: 4 };

    describe('triggerGreaterRestoration', () => {
        describe('spell name matching', () => {
            it.each([
                ['Greater Restoration', 'Greater Restoration'],
                ['greater restoration', 'Greater Restoration'],
                ['GREATER RESTORATION', 'Greater Restoration'],
                ['Greater Restoration', 'Greater Restoration'],
            ])('executes handler for "%s" spell name (case-insensitive match)', async (inputName) => {
                executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

                const result = await triggerGreaterRestoration(
                    { name: inputName, level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            });

            it.each([
                'Cure Wounds',
                'Healing Word',
                'Lesser Restoration',
                'Restoration',
                'greater',
                'restoration',
                'greater restorations',
            ])('returns null for non-matching spell: "%s"', async (spellName) => {
                const result = await triggerGreaterRestoration(
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

        describe('invalid/null spell name handling', () => {
            it('returns null when spell name is undefined', async () => {
                const result = await triggerGreaterRestoration(
                    {},
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('returns null when spell name is null', async () => {
                const result = await triggerGreaterRestoration(
                    { name: null, level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('returns null when spell name is empty string', async () => {
                const result = await triggerGreaterRestoration(
                    { name: '', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });
        });

        describe('action structure', () => {
            it('passes the original spell object into the action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Greater Restoration', level: 5, school: 'Abjuration' };

                await triggerGreaterRestoration(spell, {}, playerStats, campaignName, mapName);

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes campaignName and mapName to executeHandler', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
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

            it('includes automation type greater_restoration in the action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ type: 'greater_restoration' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('range resolution', () => {
            it('uses spell.range when provided', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5, range: '60 feet' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ range: '60 feet' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('defaults range to "Touch" when spell has no range property', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ range: 'Touch' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('defaults range to "Touch" when spell.range is undefined', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5, range: undefined },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ range: 'Touch' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });

            it('defaults range to "Touch" when spell.range is null', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5, range: null },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ range: 'Touch' }),
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('return value and error handling', () => {
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Greater Restoration', description: 'Ends one effect...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);

                const result = await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns null when executeHandler throws an error', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));

                const result = await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('logs error when executeHandler throws', async () => {
                const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                executeHandler.mockRejectedValue(new Error('Connection refused'));

                await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(consoleSpy).toHaveBeenCalledWith(
                    '[greaterRestoration] Failed to execute Greater Restoration handler:',
                    expect.any(Error),
                );
                consoleSpy.mockRestore();
            });
        });

        describe('metaCtx handling', () => {
            it('handles null metaCtx gracefully', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    null,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalled();
                expect(result).toEqual({ type: 'popup' });
            });

            it('handles undefined metaCtx gracefully', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerGreaterRestoration(
                    { name: 'Greater Restoration', level: 5 },
                    undefined,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalled();
                expect(result).toEqual({ type: 'popup' });
            });
        });
    });

    describe('confirmGreaterRestoration', () => {
        const action = {
            name: 'Greater Restoration',
            automation: { type: 'greater_restoration', range: 'Touch' },
        };
        const confirmationResult = { confirmed: true };

        it('returns result from applyGreaterRestorationEffect on success', async () => {
            const expectedResult = { applied: true, removedConditions: ['charmed', 'petrified'] };
            applyGreaterRestorationEffect.mockResolvedValue(expectedResult);

            const result = await confirmGreaterRestoration(
                action,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(result).toBe(expectedResult);
        });

        it('passes all arguments to applyGreaterRestorationEffect correctly', async () => {
            applyGreaterRestorationEffect.mockResolvedValue({ applied: true });

            await confirmGreaterRestoration(
                action,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );
        });

        it('returns null when applyGreaterRestorationEffect returns null', async () => {
            applyGreaterRestorationEffect.mockResolvedValue(null);

            const result = await confirmGreaterRestoration(
                action,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(result).toBeNull();
        });

        it('returns null when applyGreaterRestorationEffect throws an error', async () => {
            applyGreaterRestorationEffect.mockRejectedValue(new Error('Effect failed'));

            const result = await confirmGreaterRestoration(
                action,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(result).toBeNull();
        });

        it('logs error when applyGreaterRestorationEffect throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyGreaterRestorationEffect.mockRejectedValue(new Error('Database error'));

            const result = await confirmGreaterRestoration(
                action,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                '[greaterRestoration] Failed to apply Greater Restoration effect:',
                expect.any(Error),
            );
            expect(result).toBeNull();
            consoleSpy.mockRestore();
        });

        it('handles undefined result parameter', async () => {
            applyGreaterRestorationEffect.mockResolvedValue({ applied: true });

            const result = await confirmGreaterRestoration(
                action,
                playerStats,
                campaignName,
                mapName,
                undefined,
            );

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                undefined,
            );
            expect(result).toEqual({ applied: true });
        });

        it('handles empty action object', async () => {
            applyGreaterRestorationEffect.mockResolvedValue({ applied: true });

            const result = await confirmGreaterRestoration(
                {},
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                {},
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );
            expect(result).toEqual({ applied: true });
        });

        it('handles null action object', async () => {
            applyGreaterRestorationEffect.mockResolvedValue({ applied: true });

            const result = await confirmGreaterRestoration(
                null,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );

            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(
                null,
                playerStats,
                campaignName,
                mapName,
                confirmationResult,
            );
            expect(result).toEqual({ applied: true });
        });
    });
});
