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
        it.each([
            { spell: {}, label: 'missing name' },
            { spell: { name: null }, label: 'null name' },
            { spell: { name: 'Cure Wounds', level: 1 }, label: 'non-Aid spell' },
        ])('returns null for $label', async ({ spell }) => {
            const result = await triggerAidSpell(spell, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each(['aid', 'Aid', 'AID', 'AiD'])('matches spell name "%s" case-insensitively', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerAidSpell({ name, level: 2 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalled();
        });

        it('uses slotLevel from metaCtx, falls back to spell.level, defaults to 2', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerAidSpell({ name: 'Aid', level: 2 }, { slotLevel: 5 }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                playerStats, campaignName, mapName,
            );
            vi.clearAllMocks();

            await triggerAidSpell({ name: 'Aid', level: 4 }, { spellSaveDc: 17 }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                playerStats, campaignName, mapName,
            );
            vi.clearAllMocks();

            await triggerAidSpell({ name: 'Aid' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 2 }),
                playerStats, campaignName, mapName,
            );
        });

        it('passes spell object and range to the action, defaults range to "30 feet"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const spell = { name: 'Aid', level: 2, school: 'Abjuration', range: '60 feet' };
            await triggerAidSpell(spell, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    spell,
                    automation: expect.objectContaining({ range: '60 feet' }),
                }),
                playerStats, campaignName, mapName,
            );
            vi.clearAllMocks();

            await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: '30 feet' }),
                }),
                playerStats, campaignName, mapName,
            );
        });

        it('builds action with correct automation defaults', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        type: 'aid',
                        maxTargets: 3,
                        hpMaxIncreaseExpression: '5 + ((spellSlotLevel - 2) * 5)',
                    }),
                }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Aid', description: 'Aid affects...' },
            };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toEqual(expectedResult);
        });

        it('returns null when handler returns null or throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            executeHandler.mockResolvedValue(null);
            let result = await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            result = await triggerAidSpell({ name: 'Aid', level: 2 }, {}, playerStats, campaignName, mapName);
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

        it('returns null and logs error when effect application returns null or throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            applyAidEffect.mockResolvedValue(null);
            let result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);
            expect(result).toBeNull();

            applyAidEffect.mockRejectedValue(new Error('Aid effect failed'));
            result = await confirmAidSpell(action, playerStats, campaignName, mapName, targetNames);
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
