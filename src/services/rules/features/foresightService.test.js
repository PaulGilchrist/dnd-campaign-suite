import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerForesight } from './foresightService.js';

const mockGetRuntimeValue = vi.fn();
const mockSetRuntimeValue = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
    setRuntimeValue: (...args) => mockSetRuntimeValue(...args),
}));

describe('foresightService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerForesight', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = { name: 'Wizard' };

        it('returns null for non-Foresight spells', async () => {
            const result = await triggerForesight(
                { name: 'Fire Bolt' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(mockGetRuntimeValue).not.toHaveBeenCalled();
            expect(mockSetRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerForesight(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(mockGetRuntimeValue).not.toHaveBeenCalled();
            expect(mockSetRuntimeValue).not.toHaveBeenCalled();
        });

        it('handles case-insensitive spell name (lowercase)', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await triggerForesight(
                { name: 'foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
        });

        it('handles case-insensitive spell name (capitalized)', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
        });

        it('handles case-insensitive spell name (all caps)', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await triggerForesight(
                { name: 'FORESIGHT' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).not.toBeNull();
            expect(result.type).toBe('popup');
        });

        it('uses metaCtx.targetName when provided', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const metaCtx = { targetName: 'Fighter' };
            await triggerForesight(
                { name: 'Foresight' },
                metaCtx,
                playerStats,
                campaignName,
                mapName,
            );

            expect(mockGetRuntimeValue).toHaveBeenNthCalledWith(1, 'Fighter', 'activeBuffs', campaignName);
        });

        it('falls back to playerStats.name when no targetName in metaCtx', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(mockGetRuntimeValue).toHaveBeenNthCalledWith(1, 'Wizard', 'activeBuffs', campaignName);
        });

        it('adds Foresight buff to target activeBuffs', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(mockSetRuntimeValue).toHaveBeenCalledWith(
                'Wizard',
                'activeBuffs',
                [{
                    name: 'Foresight',
                    effect: 'foresight',
                    duration: '8 hours',
                    source: 'Wizard',
                }],
                campaignName,
            );
        });

        it('preserves existing non-Foresight buffs on target', async () => {
            const existingBuffs = [
                { name: 'Bless', effect: 'bless', duration: '1 minute', source: 'Cleric' },
            ];
            mockGetRuntimeValue
                .mockReturnValueOnce(existingBuffs)
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
            expect(newBuffs).toHaveLength(2);
            expect(newBuffs[0]).toEqual(existingBuffs[0]);
            expect(newBuffs[1].name).toBe('Foresight');
        });

        it('removes existing Foresight buff from target before adding new one', async () => {
            const existingBuffs = [
                { name: 'Bless', effect: 'bless', duration: '1 minute', source: 'Cleric' },
                { name: 'Foresight', effect: 'foresight', duration: '8 hours', source: 'Wizard' },
            ];
            mockGetRuntimeValue
                .mockReturnValueOnce(existingBuffs)
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
            expect(newBuffs).toHaveLength(2);
            expect(newBuffs.filter(b => b.name === 'Foresight')).toHaveLength(1);
            expect(newBuffs[0].name).toBe('Bless');
            expect(newBuffs[1].name).toBe('Foresight');
        });

        it('handles null activeBuffs by treating as empty array', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce(null)
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
            expect(newBuffs).toHaveLength(1);
            expect(newBuffs[0].name).toBe('Foresight');
        });

        it('handles non-array activeBuffs by treating as empty array', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce('not-an-array')
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const newBuffs = mockSetRuntimeValue.mock.calls[0][2];
            expect(newBuffs).toHaveLength(1);
            expect(newBuffs[0].name).toBe('Foresight');
        });

        it('adds targetEffect at campaign level', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            await triggerForesight(
                { name: 'Foresight' },
                { targetName: 'Fighter' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(mockSetRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                'targetEffects',
                [{
                    target: 'Fighter',
                    source: 'Wizard',
                    effect: 'foresight',
                    duration: '8_hours',
                }],
                campaignName,
            );
        });

        it('removes old foresight targetEffect from same caster before adding new one', async () => {
            const existingEffects = [
                { target: 'OldTarget', source: 'Wizard', effect: 'foresight', duration: '8_hours' },
                { target: 'OtherTarget', source: 'AnotherCaster', effect: 'foresight', duration: '8_hours' },
            ];
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce(existingEffects);

            await triggerForesight(
                { name: 'Foresight' },
                { targetName: 'Fighter' },
                playerStats,
                campaignName,
                mapName,
            );

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

            await triggerForesight(
                { name: 'Foresight' },
                { targetName: 'Fighter' },
                playerStats,
                campaignName,
                mapName,
            );

            const newEffects = mockSetRuntimeValue.mock.calls[1][2];
            expect(newEffects).toHaveLength(2);
            expect(newEffects[0]).toEqual(existingEffects[0]);
            expect(newEffects[1].target).toBe('Fighter');
        });

        it('handles null targetEffects by treating as empty array', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce(null);

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const newEffects = mockSetRuntimeValue.mock.calls[1][2];
            expect(newEffects).toHaveLength(1);
            expect(newEffects[0].target).toBe('Wizard');
        });

        it('handles non-array targetEffects by treating as empty array', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce({ not: 'an-array' });

            await triggerForesight(
                { name: 'Foresight' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const newEffects = mockSetRuntimeValue.mock.calls[1][2];
            expect(newEffects).toHaveLength(1);
            expect(newEffects[0].target).toBe('Wizard');
        });

        it('returns popup automation info on success', async () => {
            mockGetRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const result = await triggerForesight(
                { name: 'Foresight' },
                { targetName: 'Fighter' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Foresight',
                    automationType: 'foresight',
                    description: expect.stringContaining('Fighter'),
                },
            });
        });
    });
});
