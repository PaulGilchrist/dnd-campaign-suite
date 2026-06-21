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
        it('returns null for non-False-Life spells', async () => {
            const result = await triggerFalseLife(
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
            const result = await triggerFalseLife(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            const result = await triggerFalseLife(
                { name: '' },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell name case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'fAlSe LiFe', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: {
                        type: 'false_life',
                        tempHpExpression: '2d4+4',
                    },
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('prefers metaCtx.slotLevel over spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life', level: 1 };

            await triggerFalseLife(
                spell,
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
            const spell = { name: 'False Life', level: 3 };

            await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 3 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to 1 when neither source provides slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life' };

            await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 1 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the full spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life', level: 2, school: 'Necromancy', castingTime: '1 action' };

            await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', description: 'Gained temp HP' } };
            executeHandler.mockResolvedValue(expectedResult);
            const spell = { name: 'False Life', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);
            const spell = { name: 'False Life', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and suppresses error when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const spell = { name: 'False Life', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                '[falseLife] Failed to execute False Life handler:',
                expect.any(Error),
            );
        });

        it('handles null metaCtx by using spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life', level: 2 };

            const result = await triggerFalseLife(
                spell,
                null,
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
            expect(result).toEqual({ type: 'popup' });
        });

        it('passes playerStats, campaignName, and mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life', level: 1 };

            await triggerFalseLife(
                spell,
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
    });
});
