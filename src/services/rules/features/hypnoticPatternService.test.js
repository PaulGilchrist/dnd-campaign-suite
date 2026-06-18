import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHypnoticPattern } from './hypnoticPatternService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('hypnoticPatternService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerHypnoticPattern', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-Hypnotic Pattern spells', async () => {
            const result = await triggerHypnoticPattern(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is "hypnotic pattern" case-insensitive and executes handler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Hypnotic Pattern',
                    automation: expect.objectContaining({
                        type: 'hypnotic_pattern',
                        saveDc: 15,
                        saveType: 'WIS',
                    }),
                    spellSlotLevel: 3,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "hypnotic pattern" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'hypnotic pattern', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "HYPNOTIC PATTERN" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerHypnoticPattern(
                { name: 'HYPNOTIC PATTERN', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                { spellSaveDc: 18, slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 5,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
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
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
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
                    automation: expect.objectContaining({ saveDc: 11 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('throws when proficiency is not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern', level: 3 },
                    {},
                    stats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('playerStats.proficiency is required');
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Hypnotic Pattern', description: 'Hypnotic Pattern affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                playerStats,
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
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Hypnotic Pattern', level: 3, school: 'Illusion' };

            await triggerHypnoticPattern(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 5 },
                { spellSaveDc: 17 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when slot level is not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await expect(
                triggerHypnoticPattern(
                    { name: 'Hypnotic Pattern' },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('slot level is required');
        });

        it('handles undefined spell name gracefully', async () => {
            const result = await triggerHypnoticPattern(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('includes saveType WIS in the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveType: 'WIS' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('includes automation type hypnotic_pattern in the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ type: 'hypnotic_pattern' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerHypnoticPattern(
                { name: 'Hypnotic Pattern', level: 3 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });
    });
});
