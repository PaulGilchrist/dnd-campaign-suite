import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSeeInvisibility } from './seeInvisibilityService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('seeInvisibilityService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerSeeInvisibility', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-See Invisibility spells', async () => {
            const result = await triggerSeeInvisibility(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is "see invisibility" case-insensitive and executes handler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'See Invisibility',
                    automation: expect.objectContaining({
                        type: 'temp_buff',
                        effect: 'see_invisibility',
                        duration: '1_hour',
                        action: 'action',
                        casting_time: '1 action',
                    }),
                    spellSlotLevel: 2,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "see invisibility" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSeeInvisibility(
                { name: 'see invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "SEE INVISIBILITY" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSeeInvisibility(
                { name: 'SEE INVISIBILITY', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'See Invisibility' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('throws when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerSeeInvisibility(
                    { name: 'See Invisibility', level: 2 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'See Invisibility', level: 2, school: 'Divination' };

            await triggerSeeInvisibility(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as spellSlotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults spellSlotLevel to 2 when spell.level is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSeeInvisibility(
                { name: 'See Invisibility' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 2 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults spellSlotLevel to 2 when spell.level is null', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: null },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 2 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined spell name gracefully', async () => {
            const result = await triggerSeeInvisibility(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles empty string spell name gracefully', async () => {
            const result = await triggerSeeInvisibility(
                { name: '' },
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
