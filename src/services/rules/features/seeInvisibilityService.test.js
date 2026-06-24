// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSeeInvisibility } from './seeInvisibilityService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('seeInvisibilityService', () => {
    beforeEach(() => {
        executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Wizard' };

    describe('triggerSeeInvisibility', () => {
        it('returns null and does not call handler for non-matching spell names', async () => {
            const nonMatchingNames = ['Fire Bolt', 'Invisibility', 'see invis', 'InViSiBiLiTy', ''];

            for (const spellName of nonMatchingNames) {
                executeHandler.mockClear();
                const result = await triggerSeeInvisibility(
                    { name: spellName, level: 0 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            }
        });

        it('executes handler for "See Invisibility" (exact case)', async () => {
            executeHandler.mockClear();
            const result = await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('executes handler for "see invisibility" (lowercase)', async () => {
            executeHandler.mockClear();
            const result = await triggerSeeInvisibility(
                { name: 'see invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('executes handler for "SEE INVISIBILITY" (uppercase)', async () => {
            executeHandler.mockClear();
            const result = await triggerSeeInvisibility(
                { name: 'SEE INVISIBILITY', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('executes handler for mixed-case "SeE iNvIsIbIlIty"', async () => {
            executeHandler.mockClear();
            const result = await triggerSeeInvisibility(
                { name: 'SeE iNvIsIbIlIty', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('passes the original spell object to the handler', async () => {
            executeHandler.mockClear();
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'See Invisibility', level: 2, school: 'Divination' };

            await triggerSeeInvisibility(spell, {}, playerStats, campaignName, mapName);

            const [action] = executeHandler.mock.calls[0];
            expect(action.spell).toBe(spell);
        });

        it('uses spell.level as spellSlotLevel', async () => {
            executeHandler.mockClear();
            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(4);
        });

        it('defaults spellSlotLevel to 2 when spell.level is missing', async () => {
            executeHandler.mockClear();
            await triggerSeeInvisibility(
                { name: 'See Invisibility' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(2);
        });

        it('defaults spellSlotLevel to 2 when spell.level is null', async () => {
            executeHandler.mockClear();
            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: null },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(2);
        });

        it('defaults spellSlotLevel to 2 when spell.level is undefined', async () => {
            executeHandler.mockClear();
            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: undefined },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(2);
        });

        it('defaults spellSlotLevel to 2 when spell.level is 0', async () => {
            executeHandler.mockClear();
            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(2);
        });

        it('passes campaignName and mapName to the handler', async () => {
            executeHandler.mockClear();
            await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 2 },
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

        it('returns the handler result on success', async () => {
            executeHandler.mockClear();
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

            expect(result).toEqual(expectedResult);
        });

        it('returns null when handler returns null', async () => {
            executeHandler.mockClear();
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

        it('returns null when handler throws', async () => {
            executeHandler.mockClear();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerSeeInvisibility(
                { name: 'See Invisibility', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null when spell object has no name property', async () => {
            executeHandler.mockClear();
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

        it('throws when spell.name is a non-string type', async () => {
            await expect(
                triggerSeeInvisibility(
                    { name: 123, level: 2 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow('toLowerCase is not a function');
        });
    });
});
