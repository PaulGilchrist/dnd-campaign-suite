// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerForesight } from './foresightService.js';

const mockGetRuntimeValue = vi.fn();
const mockSetRuntimeValue = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
    setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

describe('foresightService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Wizard' };

    /**
     * Helper: mock getRuntimeValue to return empty buffs + empty targetEffects,
     * then return the given value for subsequent calls.
     */
    function mockEmptyThen(value) {
        mockGetRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce(value ?? []);
    }

    function callTrigger(spell = { name: 'Foresight' }, metaCtx = {}, stats = playerStats) {
        return triggerForesight(spell, metaCtx, stats, campaignName, mapName);
    }

    describe('triggerForesight', () => {
        describe('non-Foresight spells', () => {
            it.each([
                ['Fire Bolt', {}],
                ['lesser restoration', {}],
                ['', {}],
                [null, {}],
            ])('returns null for spell name "%s"', async (spellName) => {
                const result = await triggerForesight(
                    { name: spellName },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(mockGetRuntimeValue).not.toHaveBeenCalled();
                expect(mockSetRuntimeValue).not.toHaveBeenCalled();
            });

            it('returns null for Foresight spell with empty metaCtx when not matching', async () => {
                const result = await triggerForesight(
                    { name: 'Fire Bolt' },
                    { targetName: 'Target' },
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(mockGetRuntimeValue).not.toHaveBeenCalled();
            });

            it('returns null when spell has no name property', async () => {
                const result = await triggerForesight(
                    {},
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(mockGetRuntimeValue).not.toHaveBeenCalled();
            });
        });

        describe('activeBuffs management', () => {
            it('adds Foresight buff to target activeBuffs', async () => {
                mockEmptyThen([]);

                await callTrigger();

                expect(mockSetRuntimeValue).toHaveBeenCalledWith(
                    playerStats.name,
                    'activeBuffs',
                    [{
                        name: 'Foresight',
                        effect: 'foresight',
                        duration: '8 hours',
                        source: playerStats.name,
                    }],
                    campaignName,
                );
            });

            it('resolves target from metaCtx.targetName over playerStats.name', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Foresight' }, { targetName: 'Fighter' });

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    1,
                    'Fighter',
                    'activeBuffs',
                    expect.any(Array),
                    campaignName,
                );
            });

            it('preserves existing non-Foresight buffs', async () => {
                const existingBuffs = [
                    { name: 'Bless', effect: 'bless', duration: '1 minute', source: 'Cleric' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce(existingBuffs)
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs).toHaveLength(2);
                expect(newBuffs[0]).toEqual(existingBuffs[0]);
                expect(newBuffs[1].name).toBe('Foresight');
            });

            it('deduplicates Foresight buffs from different casters', async () => {
                const existingBuffs = [
                    { name: 'Foresight', effect: 'foresight', duration: '8 hours', source: 'Cleric' },
                    { name: 'Bless', effect: 'bless', duration: '1 minute', source: 'Cleric' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce(existingBuffs)
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs.filter(b => b.name === 'Foresight')).toHaveLength(1);
                expect(newBuffs[1].source).toBe('Wizard');
            });

            it('treats null activeBuffs as empty array', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce(null)
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs).toHaveLength(1);
                expect(newBuffs[0].name).toBe('Foresight');
            });

            it('treats non-array activeBuffs as empty array', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce('not-an-array')
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs).toHaveLength(1);
                expect(newBuffs[0].name).toBe('Foresight');
            });
        });

        describe('targetEffects management', () => {
            it('adds foresight effect at campaign level', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Foresight' }, { targetName: 'Fighter' });

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    2,
                    campaignName,
                    'targetEffects',
                    expect.any(Array),
                    campaignName,
                );
            });

            it('removes old foresight effect from same caster before adding new one', async () => {
                const existingEffects = [
                    { target: 'OldTarget', source: 'Wizard', effect: 'foresight', duration: '8_hours' },
                    { target: 'OtherTarget', source: 'AnotherCaster', effect: 'foresight', duration: '8_hours' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(existingEffects);

                await callTrigger({ name: 'Foresight' }, { targetName: 'Fighter' });

                const newEffects = mockSetRuntimeValue.mock.calls[1][2];
                expect(newEffects).toHaveLength(2);
                expect(newEffects[0]).toEqual(existingEffects[1]);
                expect(newEffects[1].target).toBe('Fighter');
                expect(newEffects[1].source).toBe('Wizard');
            });

            it('preserves unrelated targetEffects', async () => {
                const existingEffects = [
                    { target: 'Fighter', source: 'Wizard', effect: 'some_other_effect', duration: '1_hour' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(existingEffects);

                await callTrigger({ name: 'Foresight' }, { targetName: 'Fighter' });

                const newEffects = mockSetRuntimeValue.mock.calls[1][2];
                expect(newEffects).toHaveLength(2);
                expect(newEffects[0]).toEqual(existingEffects[0]);
                expect(newEffects[1].target).toBe('Fighter');
            });

            it('throws when targetEffects is not an array', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(null);

                await expect(
                    callTrigger(),
                ).rejects.toThrow('Expected array, got null');
            });

            it('treats non-array targetEffects as empty array', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce({ not: 'an-array' });

                await callTrigger();

                const newEffects = mockSetRuntimeValue.mock.calls[1][2];
                expect(newEffects).toHaveLength(1);
                expect(newEffects[0].target).toBe('Wizard');
            });
        });

        describe('return value', () => {
            it('returns popup with automation_info on success', async () => {
                mockEmptyThen([]);

                const result = await callTrigger({ name: 'Foresight' }, { targetName: 'Fighter' });

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Foresight',
                        automationType: 'foresight',
                        description: '<b>Foresight</b><br/>Fighter has <b>Advantage on D20 Tests</b>, and other creatures have <b>Disadvantage on attack rolls</b> against them for 8 hours.',
                    },
                });
            });

            it('uses playerStats.name as target in description when no targetName provided', async () => {
                mockEmptyThen([]);

                const result = await callTrigger();

                expect(result.payload.description).toContain('Wizard');
            });
        });

        describe('case-insensitive matching', () => {
            it.each([
                'foresight',
                'Foresight',
                'FORESIGHT',
                'FoReSiGhT',
            ])('matches spell name "%s"', async (spellName) => {
                mockEmptyThen([]);

                const result = await triggerForesight(
                    { name: spellName },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).not.toBeNull();
                expect(result.type).toBe('popup');
            });
        });

        describe('metaCtx handling', () => {
            it('uses playerStats.name when metaCtx is null', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Foresight' }, null);

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    1,
                    playerStats.name,
                    'activeBuffs',
                    expect.any(Array),
                    campaignName,
                );
            });

            it('uses playerStats.name when metaCtx is undefined', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Foresight' }, undefined);

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    1,
                    playerStats.name,
                    'activeBuffs',
                    expect.any(Array),
                    campaignName,
                );
            });

            it('uses playerStats.name when metaCtx.targetName is missing', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Foresight' }, {});

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    1,
                    playerStats.name,
                    'activeBuffs',
                    expect.any(Array),
                    campaignName,
                );
            });
        });

        describe('mapName parameter', () => {
            it('does not use the mapName parameter', async () => {
                mockEmptyThen([]);

                await callTrigger();

                const allGetCalls = mockGetRuntimeValue.mock.calls;
                const mapNames = allGetCalls.map(call => call[2]);
                expect(mapNames).not.toContain('testMap');
            });
        });
    });
});
