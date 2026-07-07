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

        it('returns null for empty or missing spell name', async () => {
            const result = await triggerSuggestion(
                { name: null },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
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

        it('resolves saveDc from metaCtx first, then playerStats fallback', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

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
        });

        it('resolves slotLevel from metaCtx first, then spell.level fallback', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

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
