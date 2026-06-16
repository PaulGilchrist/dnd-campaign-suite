import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFalseLife } from './falseLifeService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('falseLifeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerFalseLife', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = { name: 'Wizard', proficiency: 4 };

        function buildExpectedAction(spell, slotLevel) {
            return {
                name: 'False Life',
                automation: {
                    type: 'false_life',
                    tempHpExpression: '2d4+4',
                },
                spell,
                spellSlotLevel: slotLevel,
            };
        }

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

        it('handles "false life" case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'false life', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining(buildExpectedAction(spell, 1)),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles "FALSE LIFE" uppercase', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'FALSE LIFE', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles "False Life" mixed case', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses metaCtx.slotLevel when provided', async () => {
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
                expect.objectContaining(buildExpectedAction(spell, 5)),
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
                expect.objectContaining(buildExpectedAction(spell, 3)),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to 1 when neither metaCtx.slotLevel nor spell.level is available', async () => {
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
                expect.objectContaining(buildExpectedAction(spell, 1)),
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

        it('returns null when executeHandler throws an error', async () => {
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

        it('passes correct automation type and tempHpExpression', async () => {
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

        it('handles null metaCtx gracefully', async () => {
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

        it('handles null playerStats gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'False Life', level: 1 };

            const result = await triggerFalseLife(
                spell,
                {},
                null,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                null,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });
    });
});
