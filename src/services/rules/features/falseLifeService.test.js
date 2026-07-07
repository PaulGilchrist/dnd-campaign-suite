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

        it('returns null for non-False-Life spell', async () => {
            const result = await triggerFalseLife({ name: 'Fire Bolt', level: 0 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches "false life" case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const result = await triggerFalseLife({ name: 'false life', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ type: 'popup' });
        });

        it('passes slotLevel from metaCtx to handler, falls back to spell.level, defaults to 1', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFalseLife({ name: 'False Life', level: 1 }, { slotLevel: 5 }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                playerStats, campaignName, mapName,
            );
            vi.clearAllMocks();

            await triggerFalseLife({ name: 'False Life', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 1 }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success, logs error and returns null on failure', async () => {
            const consoleSpy = vi.spyOn(console, 'error');
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', description: 'Gained temp HP' } };

            executeHandler.mockResolvedValue(expectedResult);
            let result = await triggerFalseLife({ name: 'False Life', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            result = await triggerFalseLife({ name: 'False Life', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[falseLife] Failed to execute False Life handler:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });
});
