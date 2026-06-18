import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAidSpell, confirmAidSpell } from './aidSpellService.js';
import { executeHandler, applyAidEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyAidEffect: vi.fn(),
}));

describe('aidSpellService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric', proficiency: 4 };

    describe('triggerAidSpell', () => {
        it('returns null for non-Aid spells', async () => {
            const result = await triggerAidSpell(
                { name: 'Cure Wounds', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns result and calls executeHandler for "Aid" spell', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerAidSpell(
                { name: 'Aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Aid',
                    automation: expect.objectContaining({
                        type: 'aid',
                        maxTargets: 3,
                        hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)',
                    }),
                    spellSlotLevel: 2,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "aid" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerAidSpell(
                { name: 'aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "AID" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerAidSpell(
                { name: 'AID', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses slotLevel from metaCtx when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid', level: 2 },
                { slotLevel: 5 },
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

        it('falls back to spell.level when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid', level: 4 },
                { spellSaveDc: 17 },
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

        it('defaults to level 2 when neither metaCtx.slotLevel nor spell.level are available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid' },
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

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Aid', description: 'Aid affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerAidSpell(
                { name: 'Aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerAidSpell(
                { name: 'Aid', level: 2 },
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
                triggerAidSpell(
                    { name: 'Aid', level: 2 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Aid', level: 2, school: 'Abjuration' };

            await triggerAidSpell(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets range from spell.range property', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid', level: 2, range: '60 feet' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: '60 feet' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults range to "30 feet" when spell.range is not provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: '30 feet' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('builds action with maxTargets of 3', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ maxTargets: 3 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('builds action with correct hpMaxIncreaseExpression', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell(
                { name: 'Aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('handles undefined spell name gracefully', async () => {
            const result = await triggerAidSpell(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles null spell name gracefully', async () => {
            const result = await triggerAidSpell(
                { name: null },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('confirmAidSpell', () => {
        const action = {
            name: 'Aid',
            automation: { type: 'aid', maxTargets: 3, hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)' },
            spellSlotLevel: 2,
        };
        const targetNames = ['Gromp', 'Liala', 'Kaelen'];

        it('calls applyAidEffect with correct arguments', async () => {
            applyAidEffect.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(applyAidEffect).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, targetNames);
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('returns the result from applyAidEffect on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Aid Applied' } };
            applyAidEffect.mockResolvedValue(expectedResult);

            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(result).toBe(expectedResult);
        });

        it('returns null when applyAidEffect returns null', async () => {
            applyAidEffect.mockResolvedValue(null);

            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(result).toBeNull();
        });

        it('throws when applyAidEffect throws an error', async () => {
            applyAidEffect.mockRejectedValue(new Error('Aid effect failed'));

            await expect(
                confirmAidSpell(action, playerStats, campaignName, mapName, targetNames),
            ).rejects.toThrow('Aid effect failed');
        });

        it('passes targetNames correctly with multiple targets', async () => {
            applyAidEffect.mockResolvedValue({ type: 'popup' });
            const manyTargets = ['A', 'B', 'C', 'D'];

            await confirmAidSpell(action, playerStats, campaignName, mapName, manyTargets);

            expect(applyAidEffect).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, manyTargets);
        });

        it('handles empty targetNames array', async () => {
            applyAidEffect.mockResolvedValue({ type: 'popup' });

            await confirmAidSpell(action, playerStats, campaignName, mapName, []);

            expect(applyAidEffect).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, []);
        });
    });
});
