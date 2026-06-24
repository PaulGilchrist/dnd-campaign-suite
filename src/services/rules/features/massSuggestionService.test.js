// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerMassSuggestion } from './massSuggestionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('massSuggestionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerMassSuggestion', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const basePlayerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-Mass Suggestion spells', async () => {
            const result = await triggerMassSuggestion(
                { name: 'Fire Bolt', level: 0 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is missing', async () => {
            const result = await triggerMassSuggestion(
                { level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            const result = await triggerMassSuggestion(
                { name: '', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell name case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'MASS SUGGESTION', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('delegates to executeHandler with correct action shape', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Mass Suggestion',
                    spellSlotLevel: 6,
                    automation: expect.objectContaining({
                        type: 'mass_suggestion',
                        saveType: 'WIS',
                    }),
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the original spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Mass Suggestion', level: 6, school: 'Enchantment' };

            await triggerMassSuggestion(spell, {}, basePlayerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                { spellSaveDc: 18, slotLevel: 6 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 6,
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when spellAbilities is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
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

        it('throws when proficiency is not available', async () => {
            const stats = { name: 'Wizard' };

            await expect(
                triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 6 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required for mass suggestion');
        });

        it('throws when slot level is not available from either source', async () => {
            await expect(
                triggerMassSuggestion(
                    { name: 'Mass Suggestion' },
                    {},
                    basePlayerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required for mass suggestion');
        });

        it('uses metaCtx slotLevel over spell.level when both are present', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                { spellSaveDc: 15, slotLevel: 7 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to spell.level when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 7 },
                { spellSaveDc: 17 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('returns the result from executeHandler', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Mass Suggestion', description: 'Mass suggestion affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('passes campaignName and mapName through to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('prefers metaCtx spellSaveDc over playerStats spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerMassSuggestion(
                { name: 'Mass Suggestion', level: 6 },
                { spellSaveDc: 20 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 20 }),
                }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });
    });
});
