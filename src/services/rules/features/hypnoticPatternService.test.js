// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHypnoticPattern } from './hypnoticPatternService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Silence console.error during tests (the service logs errors before throwing)
const originalError = console.error;
beforeAll(() => { console.error = () => {}; });
afterAll(() => { console.error = originalError; });

describe('hypnoticPatternService', () => {
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
            const result = await triggerHypnoticPattern(
                { name: 'Fire Bolt', level: 0 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is missing', async () => {
            const result = await triggerHypnoticPattern(
                {},
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('throws when spell object is null', async () => {
            await expect(
                triggerHypnoticPattern(
                    null,
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow("Cannot read properties of null (reading 'name')");
        });

        it('throws when spell object is undefined', async () => {
            await expect(
                triggerHypnoticPattern(
                    undefined,
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow("Cannot read properties of undefined (reading 'name')");
        });
    });

    describe('save DC resolution', () => {
        it('uses metaCtx spellSaveDc when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                { spellSaveDc: 18, slotLevel: 5 },
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 18, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 15, saveType: 'WIS' },
                }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when spellAbilities is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 11, saveType: 'WIS' },
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('throws when proficiency is missing', async () => {
            const stats = { name: 'Wizard' };

            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for hypnotic pattern');
        });

        it('throws when proficiency is null', async () => {
            const stats = { name: 'Wizard', proficiency: null };

            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for hypnotic pattern');
        });

        it('throws when proficiency is undefined', async () => {
            const stats = { name: 'Wizard', proficiency: undefined };

            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for hypnotic pattern');
        });

        it('treats proficiency 0 as a valid value (saveDc = 8)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 0 };

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'hypnotic_pattern', saveDc: 8, saveType: 'WIS' },
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

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                { slotLevel: 5 },
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

        it('falls back to spell.level when metaCtx lacks slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 5 },
                { spellSaveDc: 17 },
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

        it('throws when neither metaCtx.slotLevel nor spell.level is available', async () => {
            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern' },
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for hypnotic pattern');
        });

        it('throws when spell.level is null', async () => {
            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: null },
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for hypnotic pattern');
        });

        it('throws when spell.level is undefined', async () => {
            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: undefined },
                    {},
                    defaultPlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for hypnotic pattern');
        });
    });

    describe('case-insensitive matching', () => {
        it('matches lowercase spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'hypnotic pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('matches uppercase spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'HYPNOTIC PATTERN', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('matches mixed-case spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'HyPnOtIc PaTtErN', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });
    });

    describe('delegation to executeHandler', () => {
        it('passes spell object as "spell" property in action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Hypnotic Pattern', level: 3, school: 'Illusion' };

            await triggerHypnoticPattern(spell, {}, defaultPlayerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName unchanged', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('passes playerStats unchanged', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                defaultPlayerStats,
                campaignName,
                mapName,
            );
        });

        it('returns the result from executeHandler', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Hypnotic Pattern', description: 'Hypnotic Pattern affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });
    });

    describe('metaCtx handling', () => {
        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                undefined,
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles null metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                null,
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles empty metaCtx object gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });
    });
});
