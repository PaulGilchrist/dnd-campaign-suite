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

        describe('spell matching', () => {
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

            it('returns null for empty or missing spell name', async () => {
                for (const name of ['', undefined, null]) {
                    const result = await triggerMassSuggestion(
                        { name },
                        {},
                        basePlayerStats,
                        campaignName,
                        mapName,
                    );
                    expect(result).toBeNull();
                    expect(executeHandler).not.toHaveBeenCalled();
                }
            });

            it('matches spell name case-insensitively', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const spellNames = ['Mass Suggestion', 'MASS SUGGESTION', 'mass suggestion', 'MaSs SuGgEsTiOn'];
                for (const name of spellNames) {
                    await triggerMassSuggestion(
                        { name, level: 6 },
                        {},
                        basePlayerStats,
                        campaignName,
                        mapName,
                    );
                    expect(executeHandler).toHaveBeenCalled();
                    vi.clearAllMocks();
                }
            });
        });

        describe('save DC resolution', () => {
            it('resolves saveDc from metaCtx, playerStats, or proficiency fallback', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                // metaCtx overrides playerStats
                await triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 6 },
                    { spellSaveDc: 18 },
                    basePlayerStats,
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
                    expect.anything(),
                    expect.anything(),
                    expect.anything(),
                );
                vi.clearAllMocks();

                // proficiency-based fallback: 8 + proficiency
                const statsWithProficiency = { name: 'Wizard', proficiency: 3 };
                await triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 6 },
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
        });

        describe('slot level resolution', () => {
            it('resolves slotLevel from metaCtx or spell.level', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                // metaCtx slotLevel takes priority
                await triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 6 },
                    { slotLevel: 7 },
                    basePlayerStats,
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

                // spell.level fallback
                await triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 7 },
                    { spellSaveDc: 17 },
                    basePlayerStats,
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
        });

        describe('delegation to executeHandler', () => {
            it('builds action with correct automation structure and calls executeHandler', async () => {
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
                        automation: expect.objectContaining({
                            type: 'mass_suggestion',
                            saveType: 'WIS',
                        }),
                        spellSlotLevel: 6,
                    }),
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
            });

            it('returns executeHandler result on success', async () => {
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

            it('returns null when executeHandler returns null or throws', async () => {
                executeHandler.mockResolvedValue(null);
                let result = await triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 6 },
                    {},
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();

                executeHandler.mockRejectedValue(new Error('Handler failed'));
                result = await triggerMassSuggestion(
                    { name: 'Mass Suggestion', level: 6 },
                    {},
                    basePlayerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
            });
        });
    });
});
