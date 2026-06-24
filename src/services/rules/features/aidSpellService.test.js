// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerAidSpell, confirmAidSpell } from './aidSpellService.js';
import { executeHandler, applyAidEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyAidEffect: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = { name: 'Cleric', proficiency: 4 };

describe('aidSpellService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerAidSpell', () => {
        it('returns null when spell name is missing', async () => {
            const result = await triggerAidSpell({}, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is null', async () => {
            const result = await triggerAidSpell({ name: null }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for non-Aid spells', async () => {
            const result = await triggerAidSpell({ name: 'Cure Wounds', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell names case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const names = ['aid', 'Aid', 'AID', 'AiD'];

            for (const name of names) {
                await triggerAidSpell({ name, level: 2 }, {}, playerStats, campaignName, mapName);
                expect(executeHandler).toHaveBeenCalled();
                vi.clearAllMocks();
            }
        });

        it('passes spellSlotLevel from metaCtx.slotLevel when provided', async () => {
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

        it('defaults to level 2 when neither slotLevel nor spell.level are available', async () => {
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

        it('passes the spell object and range to the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Aid', level: 2, school: 'Abjuration', range: '60 feet' };

            await triggerAidSpell(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    spell,
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

        it('builds action with correct automation defaults', async () => {
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
                        type: 'aid',
                        maxTargets: 3,
                        hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns handler result on success', async () => {
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

            expect(result).toEqual(expectedResult);
        });

        it('returns null when handler returns null', async () => {
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

        it('catches handler errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerAidSpell(
                { name: 'Aid', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[aidSpell] Failed to execute Aid handler:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });
    });

    describe('confirmAidSpell', () => {
        const action = {
            name: 'Aid',
            automation: { type: 'aid', maxTargets: 3, hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)' },
            spellSlotLevel: 2,
        };
        const targetNames = ['Gromp', 'Liala', 'Kaelen'];

        it('returns the effect application result on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Aid Applied' } };
            applyAidEffect.mockResolvedValue(expectedResult);

            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(result).toEqual(expectedResult);
        });

        it('passes all arguments through to applyAidEffect', async () => {
            applyAidEffect.mockResolvedValue({ type: 'popup' });

            await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(applyAidEffect).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, targetNames);
        });

        it('returns null when effect application returns null', async () => {
            applyAidEffect.mockResolvedValue(null);

            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(result).toBeNull();
        });

        it('catches effect errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyAidEffect.mockRejectedValue(new Error('Aid effect failed'));

            const result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[aidSpell] Failed to apply Aid effect:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('passes empty targetNames array through to effect application', async () => {
            applyAidEffect.mockResolvedValue({ type: 'popup' });

            await confirmAidSpell(action, playerStats, campaignName, mapName, []);

            expect(applyAidEffect).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, []);
        });
    });
});
