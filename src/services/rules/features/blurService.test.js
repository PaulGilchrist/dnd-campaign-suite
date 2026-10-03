// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerBlur } from './blurService.js';

const mockGetRuntimeValue = vi.fn();
const mockSetRuntimeValue = vi.fn();
const mockAddEntry = vi.fn();

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
    setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (...args) => {
        mockAddEntry(...args);
        return { catch: (fn) => ({ catch: fn }) };
    },
}));

describe('blurService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Wizard' };

    function mockEmptyThen(value) {
        mockGetRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce(value ?? []);
    }

    function callTrigger(spell = { name: 'Blur' }, metaCtx = {}, stats = playerStats) {
        return triggerBlur(spell, metaCtx, stats, campaignName, mapName);
    }

    describe('triggerBlur', () => {
        describe('non-Blur spells', () => {
            it.each([
                ['Fire Bolt', {}],
                ['lesser restoration', {}],
                ['not blur', {}],
            ])('returns null for non-Blur spell "%s"', async (spellName, metaCtx) => {
                const result = await triggerBlur(
                    { name: spellName },
                    metaCtx,
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
                expect(mockGetRuntimeValue).not.toHaveBeenCalled();
                expect(mockSetRuntimeValue).not.toHaveBeenCalled();
            });
        });

        describe('activeBuffs management', () => {
            it('adds Blur buff to target activeBuffs', async () => {
                mockEmptyThen([]);

                await callTrigger();

                expect(mockSetRuntimeValue).toHaveBeenCalledWith(
                    playerStats.name,
                    'activeBuffs',
                    [{
                        name: 'Blur',
                        effect: 'blur',
                        duration: 'Concentration, up to 1 minute',
                        source: playerStats.name,
                    }],
                    campaignName,
                );
            });

            it('resolves target from metaCtx.targetName over playerStats.name', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Blur' }, { targetName: 'Fighter' });

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    1,
                    'Fighter',
                    'activeBuffs',
                    expect.any(Array),
                    campaignName,
                );
            });

            it('preserves existing non-Blur buffs', async () => {
                const existingBuffs = [
                    { name: 'Mage Armor', effect: 'mage_armor', duration: '8 hours', source: 'Wizard' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce(existingBuffs)
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs).toHaveLength(2);
                expect(newBuffs[0]).toEqual(existingBuffs[0]);
                expect(newBuffs[1].name).toBe('Blur');
            });

            it('deduplicates Blur buffs from different casters', async () => {
                const existingBuffs = [
                    { name: 'Blur', effect: 'blur', duration: 'Concentration, up to 1 minute', source: 'Sorcerer' },
                    { name: 'Mage Armor', effect: 'mage_armor', duration: '8 hours', source: 'Wizard' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce(existingBuffs)
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs.filter(b => b.name === 'Blur')).toHaveLength(1);
                expect(newBuffs[1].source).toBe('Wizard');
            });

            it('treats non-array activeBuffs as empty array', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce(null)
                    .mockReturnValueOnce([]);

                await callTrigger();

                const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
                expect(newBuffs).toHaveLength(1);
                expect(newBuffs[0].name).toBe('Blur');
            });
        });

        describe('targetEffects management', () => {
            it('adds blur effect at campaign level', async () => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Blur' }, { targetName: 'Fighter' });

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    2,
                    'campaign',
                    'targetEffects',
                    expect.any(Array),
                    campaignName,
                );
            });

            it('removes old blur effect from same caster before adding new one', async () => {
                const existingEffects = [
                    { target: 'OldTarget', source: 'Wizard', effect: 'blur', duration: 'concentration' },
                    { target: 'OtherTarget', source: 'AnotherCaster', effect: 'blur', duration: 'concentration' },
                ];
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(existingEffects);

                await callTrigger({ name: 'Blur' }, { targetName: 'Fighter' });

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

                await callTrigger({ name: 'Blur' }, { targetName: 'Fighter' });

                const newEffects = mockSetRuntimeValue.mock.calls[1][2];
                expect(newEffects).toHaveLength(2);
                expect(newEffects[0]).toEqual(existingEffects[0]);
                expect(newEffects[1].target).toBe('Fighter');
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

            it('does not throw when campaign targetEffects is null (clean change-data)', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(null);

                await expect(callTrigger()).resolves.toMatchObject({ type: 'popup' });
            });

            it('writes blur targetEffect when campaign targetEffects is null (SP-019)', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(null);

                await callTrigger();

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    2,
                    'campaign',
                    'targetEffects',
                    [{ target: 'Wizard', source: 'Wizard', effect: 'blur', duration: 'concentration' }],
                    campaignName,
                );
            });

            it('logs the cast when campaign targetEffects is null (SP-019)', async () => {
                mockGetRuntimeValue
                    .mockReturnValueOnce([])
                    .mockReturnValueOnce(null);

                await callTrigger();

                expect(mockAddEntry).toHaveBeenCalledWith(
                    campaignName,
                    expect.objectContaining({ spellName: 'Blur' }),
                );
            });
        });

        describe('return value', () => {
            it('returns popup with automation_info on success', async () => {
                mockEmptyThen([]);

                const result = await callTrigger({ name: 'Blur' }, { targetName: 'Fighter' });

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Blur',
                        automationType: 'blur',
                        description: '<b>Blur</b><br/>Fighter has <b>Disadvantage on attack rolls against them</b> for 1 minute (concentration). Creatures with Blindsight or Truesight are immune to this effect.',
                    },
                });
            });

            it('uses playerStats.name as target in description when no targetName provided', async () => {
                mockEmptyThen([]);

                const result = await callTrigger();

                expect(result.payload.description).toContain('Wizard');
            });

            it('says "themself" when targeting self', async () => {
                mockEmptyThen([]);

                await callTrigger();

                expect(mockAddEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                    description: expect.stringContaining('casts Blur on themself'),
                }));
            });
        });

        describe('case-insensitive matching', () => {
            it.each([
                'blur',
                'Blur',
                'BLUR',
                'BlUr',
            ])('matches spell name "%s"', async (spellName) => {
                mockEmptyThen([]);

                const result = await triggerBlur(
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
            it.each([
                ['null metaCtx', null],
                ['undefined metaCtx', undefined],
                ['missing targetName', {}],
            ])('uses playerStats.name when %s', async (_, metaCtx) => {
                mockEmptyThen([]);

                await callTrigger({ name: 'Blur' }, metaCtx);

                expect(mockSetRuntimeValue).toHaveBeenNthCalledWith(
                    1,
                    playerStats.name,
                    'activeBuffs',
                    expect.any(Array),
                    campaignName,
                );
            });
        });
    });
});
