// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFalseLife } from './falseLifeService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('falseLifeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Wizard', proficiency: 4 };

    describe('triggerFalseLife', () => {
        it.each([
            ['non-False-Life spell', { name: 'Fire Bolt', level: 0 }],
            ['undefined name', {}],
            ['null name', { name: null }],
            ['empty name', { name: '' }],
        ])('returns null for %s', async (_label, spell) => {
            const result = await triggerFalseLife(spell, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each(['fAlSe LiFe', 'false life', 'FALSE LIFE'])('matches "%s" case-insensitively', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const result = await triggerFalseLife({ name, level: 1 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: { type: 'false_life', tempHpExpression: '2d4+4' } }),
                playerStats, campaignName, mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it.each([
            ['metaCtx slotLevel', { slotLevel: 5 }, 5],
            ['spell.level', {}, 1],
            ['default level 1', {}, 1],
        ])('uses %s for spellSlotLevel', async (_label, metaCtx, expectedLevel) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerFalseLife({ name: 'False Life', level: 1 }, metaCtx, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: expectedLevel }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', description: 'Gained temp HP' } };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await triggerFalseLife({ name: 'False Life', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);
        });

        it('catches handler errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error');
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const result = await triggerFalseLife({ name: 'False Life', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[falseLife] Failed to execute False Life handler:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
