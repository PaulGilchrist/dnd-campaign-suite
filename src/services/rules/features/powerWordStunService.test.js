import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPowerWordStun } from './powerWordStunService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('powerWordStunService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerPowerWordStun', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-Power Word Stun spells', async () => {
            const result = await triggerPowerWordStun(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is undefined', async () => {
            const result = await triggerPowerWordStun(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('throws when spell object is null', async () => {
            await expect(
                triggerPowerWordStun(
                    null,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler for exact "Power Word Stun" match', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "power word stun" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: 'power word stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles uppercase "POWER WORD STUN" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: 'POWER WORD STUN', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "PoWeR wOrd StUn" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: 'PoWeR wOrd StUn', level: 9 },
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

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                { spellSaveDc: 20, slotLevel: 9 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 20 }),
                    spellSlotLevel: 9,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
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

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
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

        it('uses default proficiency of 2 when not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses default saveDc of 10 when no proficiency or spellAbilities', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses metaCtx slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                { spellSaveDc: 18, slotLevel: 8 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 8 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 7 },
                { spellSaveDc: 17 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default slot level of 8 when no slotLevel or spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 8 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Power Word Stun', description: 'Stun affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Power Word Stun', level: 9, school: 'Enchantment' };

            await triggerPowerWordStun(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets automation type to power_word_stun', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ type: 'power_word_stun' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets saveType to CON', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveType: 'CON' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                'TestCampaign',
                'testMap',
            );
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('throws when playerStats is undefined', async () => {
            await expect(
                triggerPowerWordStun(
                    { name: 'Power Word Stun', level: 9 },
                    {},
                    undefined,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles empty spell name string', async () => {
            const result = await triggerPowerWordStun(
                { name: '', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('does not match partial spell names like "Power Word"', async () => {
            const result = await triggerPowerWordStun(
                { name: 'Power Word', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('does not match partial spell names like "Power Word Stunned"', async () => {
            const result = await triggerPowerWordStun(
                { name: 'Power Word Stunned', level: 9 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });
});
