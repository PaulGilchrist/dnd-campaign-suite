// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFleshToStone } from './fleshToStoneService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('fleshToStoneService', () => {
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

    describe('triggerFleshToStone', () => {
        describe('spell name matching', () => {
            it.each([
                'Flesh to Stone',
                'flesh to stone',
                'FLESH TO STONE',
                'Flesh To Stone',
            ])('executes handler for "%s" spell name (case-insensitive match)', async (inputName) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerFleshToStone(
                    { name: inputName, level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Flesh to Stone',
                        automation: expect.objectContaining({ type: 'flesh_to_stone', saveDc: 15, saveType: 'CON' }),
                        spell: expect.objectContaining({ name: inputName }),
                        spellSlotLevel: 6,
                    }),
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toEqual({ type: 'popup' });
            });

            it.each([
                'Fire Bolt',
                'Stone Shape',
                'Petrify',
                'Hold Monster',
                'flesh',
                'stone',
                'flesh to',
                'to stone',
            ])('returns null for non-Flesh to Stone spell: "%s"', async (spellName) => {
                const result = await triggerFleshToStone(
                    { name: spellName, level: 0 },
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
            it.each([
                { desc: 'uses metaCtx spellSaveDc', metaCtx: { spellSaveDc: 18 }, expectedDc: 18 },
                { desc: 'falls back to playerStats.spellAbilities.saveDc', metaCtx: {}, expectedDc: 15 },
                { desc: 'computes from proficiency when no saveDc', metaCtx: {}, stats: { name: 'Wizard', proficiency: 3 }, expectedDc: 11 },
                { desc: 'uses default proficiency of 2', metaCtx: {}, stats: { name: 'Wizard' }, expectedDc: 10 },
                { desc: 'uses default saveDc base when no stats', metaCtx: {}, stats: {}, expectedDc: 10 },
                { desc: 'computes when spellAbilities is undefined', metaCtx: {}, stats: { name: 'Wizard', proficiency: 4 }, expectedDc: 12 },
            ])('save DC: $desc', async ({ metaCtx, stats = playerStats, expectedDc }) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFleshToStone(
                    { name: 'Flesh to Stone', level: 6 },
                    metaCtx,
                    stats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: expectedDc }),
                    }),
                    expect.any(Object),
                    campaignName,
                    mapName,
                );
            });
        });

        describe('slot level resolution', () => {
            it.each([
                { desc: 'uses metaCtx slotLevel', spell: { name: 'Flesh to Stone', level: 5 }, metaCtx: { slotLevel: 7 }, expectedLevel: 7 },
                { desc: 'uses metaCtx slotLevel over spell.level', spell: { name: 'Flesh to Stone', level: 3 }, metaCtx: { spellSaveDc: 17, slotLevel: 6 }, expectedLevel: 6 },
                { desc: 'falls back to spell.level', spell: { name: 'Flesh to Stone', level: 7 }, metaCtx: { spellSaveDc: 17 }, expectedLevel: 7 },
                { desc: 'defaults to 6 when spell has no level', spell: { name: 'Flesh to Stone' }, metaCtx: {}, expectedLevel: 6 },
                { desc: 'defaults to 6 when spell.level is null', spell: { name: 'Flesh to Stone', level: null }, metaCtx: {}, expectedLevel: 6 },
                { desc: 'defaults to 6 when spell.level is undefined', spell: { name: 'Flesh to Stone', level: undefined }, metaCtx: {}, expectedLevel: 6 },
            ])('slot level: $desc', async ({ spell, metaCtx, expectedLevel }) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerFleshToStone(
                    spell,
                    metaCtx,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spellSlotLevel: expectedLevel }),
                    playerStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('action structure and propagation', () => {
            it('passes original spell object, campaignName, and mapName to executeHandler', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                const spell = { name: 'Flesh to Stone', level: 6, school: 'Transmutation' };

                await triggerFleshToStone(spell, {}, playerStats, 'MyCampaign', 'DungeonMap1');

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    playerStats,
                    'MyCampaign',
                    'DungeonMap1',
                );
            });
        });

        describe('return value', () => {
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Flesh to Stone', description: 'Flesh to Stone affects...' },
                };
                executeHandler.mockResolvedValue(expectedResult);

                const result = await triggerFleshToStone(
                    { name: 'Flesh to Stone', level: 6 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null or throws', async () => {
                executeHandler.mockResolvedValue(null);
                expect(await triggerFleshToStone({ name: 'Flesh to Stone', level: 6 }, {}, playerStats, campaignName, mapName)).toBeNull();

                executeHandler.mockRejectedValue(new Error('Handler failed'));
                expect(await triggerFleshToStone({ name: 'Flesh to Stone', level: 6 }, {}, playerStats, campaignName, mapName)).toBeNull();
            });
        });

        describe('invalid/null spell name handling', () => {
            it.each([
                { desc: 'undefined name', spell: { level: 6 } },
                { desc: 'null name', spell: { name: null, level: 6 } },
                { desc: 'empty string name', spell: { name: '', level: 6 } },
            ])('returns null when spell name is $desc', async ({ spell }) => {
                const result = await triggerFleshToStone(
                    spell,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            });
        });

        describe('null/undefined metaCtx', () => {
            it.each([
                { desc: 'null', metaCtx: null },
                { desc: 'undefined', metaCtx: undefined },
            ])('handles $desc metaCtx gracefully', async ({ metaCtx }) => {
                executeHandler.mockResolvedValue({ type: 'popup' });

                const result = await triggerFleshToStone(
                    { name: 'Flesh to Stone', level: 6 },
                    metaCtx,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ saveDc: 15 }),
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
