// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSuggestion } from './suggestionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('suggestionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerSuggestion', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-Suggestion spells', async () => {
            const result = await triggerSuggestion(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell name case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const spellNames = ['Suggestion', 'suggestion', 'SUGGESTION', 'SuGgEsTiOn'];
            for (const name of spellNames) {
                await triggerSuggestion(
                    { name, level: 3 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(executeHandler).toHaveBeenCalled();
                vi.clearAllMocks();
            }
        });

        it('returns null for empty or missing spell name', async () => {
            const emptyNames = ['', undefined, null];
            for (const name of emptyNames) {
                const result = await triggerSuggestion(
                    { name },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
                vi.clearAllMocks();
            }
        });

        it('builds action with correct automation structure and calls executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Suggestion',
                    automation: {
                        type: 'suggestion',
                        saveDc: 15,
                        saveType: 'WIS',
                    },
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the original spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Suggestion', level: 3, school: 'Enchantment' };

            await triggerSuggestion(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('resolves saveDc from metaCtx first, then playerStats, then proficiency fallback', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            // metaCtx overrides playerStats
            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                { spellSaveDc: 18 },
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                }),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
            vi.clearAllMocks();

            // playerStats.spellAbilities.saveDc fallback
            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
            vi.clearAllMocks();

            // proficiency-based fallback: 8 + proficiency
            const statsWithProficiency = { name: 'Wizard', proficiency: 3 };
            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                statsWithProficiency,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 11 }),
                }),
                statsWithProficiency,
                campaignName,
                mapName,
            );
            vi.clearAllMocks();

            // default proficiency of 2 when missing
            const statsNoProficiency = { name: 'Wizard' };
            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                statsNoProficiency,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                statsNoProficiency,
                campaignName,
                mapName,
            );
        });

        it('resolves slotLevel from metaCtx first, then spell.level, then default of 2', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            // metaCtx slotLevel takes priority
            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                { slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
            vi.clearAllMocks();

            // spell.level fallback
            await triggerSuggestion(
                { name: 'Suggestion', level: 7 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
            vi.clearAllMocks();

            // default slot level of 2
            await triggerSuggestion(
                { name: 'Suggestion' },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 2 }),
                expect.anything(),
                expect.anything(),
                expect.anything(),
            );
        });

        it('handles undefined metaCtx by falling back to playerStats', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns executeHandler result on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Suggestion', description: 'Suggestion affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and logs error when executeHandler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerSuggestion(
                { name: 'Suggestion', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[suggestionService] Failed to execute Suggestion handler'),
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });
    });
});
