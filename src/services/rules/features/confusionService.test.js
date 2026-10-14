import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerConfusion } from './confusionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Silence console.error during tests (the service logs errors before returning null)
const originalError = console.error;
beforeAll(() => { console.error = () => {}; });
afterAll(() => { console.error = originalError; });

describe('confusionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const defaultPlayerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('early returns', () => {
        it('returns null for non-matching spell name', async () => {
            const result = await triggerConfusion(
                { name: 'Fire Bolt', level: 0 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for empty spell name', async () => {
            const result = await triggerConfusion(
                { name: '', level: 0 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('throws when spell is null', async () => {
            await expect(
                triggerConfusion(
                    null,
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow("Cannot read properties of null (reading 'name')");
        });

        it('is case-insensitive for spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerConfusion(
                { name: 'CoNfUsIoN', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });
    });

    describe('save DC resolution', () => {
        it('uses metaCtx spellSaveDc when provided (highest priority)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                { spellSaveDc: 18, slotLevel: 5 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 18, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 15, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx has null spellSaveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                { spellSaveDc: null },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 15, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx has undefined spellSaveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                { spellSaveDc: undefined },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 15, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when spellAbilities is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 11, saveType: 'WIS' },
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when spellAbilities is null', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', spellAbilities: null, proficiency: 5 };

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 13, saveType: 'WIS' },
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('throws when proficiency is missing', async () => {
            const stats = { name: 'Wizard' };

            await expect(
                triggerConfusion(
                    { name: 'Confusion', level: 4 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for confusion');
        });

        it('throws when proficiency is null', async () => {
            const stats = { name: 'Wizard', proficiency: null };

            await expect(
                triggerConfusion(
                    { name: 'Confusion', level: 4 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for confusion');
        });

        it('throws when proficiency is undefined', async () => {
            const stats = { name: 'Wizard', proficiency: undefined };

            await expect(
                triggerConfusion(
                    { name: 'Confusion', level: 4 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for confusion');
        });

        it('treats proficiency 0 as a valid value (saveDc = 8)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 0 };

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'confusion', saveDc: 8, saveType: 'WIS' },
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('throws when spellAbilities is missing and proficiency is missing', async () => {
            const stats = { name: 'Wizard' };

            await expect(
                triggerConfusion(
                    { name: 'Confusion', level: 4 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for confusion');
        });
    });

    describe('slot level resolution', () => {
        it('uses metaCtx slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                { slotLevel: 6 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 6 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to spell.level when metaCtx lacks slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 7 },
                { spellSaveDc: 17 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level when metaCtx has undefined slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 5 },
                { slotLevel: undefined },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level when metaCtx has null slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 3 },
                { slotLevel: null },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 3 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('action object structure', () => {
        it('passes spell object to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Confusion', level: 4, school: 'Enchantment' };

            await triggerConfusion(spell, {}, defaultPlayerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('passes metaCtx to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const metaCtx = { targets: ['Goblin'], heightenTarget: 'Goblin' };

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                metaCtx,
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ metaCtx }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('sets automation type to confusion with saveType WIS', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        type: 'confusion',
                        saveType: 'WIS',
                    }),
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('delegation to executeHandler', () => {
        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.anything(),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('returns the result from executeHandler', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Confusion', description: 'Confusion affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[confusionService] Failed to execute Confusion handler'),
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('returns null when executeHandler rejects with any error', async () => {
            executeHandler.mockRejectedValue(new TypeError('Unexpected error'));

            const result = await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('handles empty object as metaCtx', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined metaCtx', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                undefined,
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('handles spell with missing level field', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion' },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: undefined }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('handles spell with level 0', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerConfusion(
                { name: 'Confusion', level: 0 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 0 }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('handles playerStats with undefined spellAbilities but valid proficiency', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 6 };

            await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 14 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });
    });
});
