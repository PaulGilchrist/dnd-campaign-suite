// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSleep } from './sleepService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('sleepService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerSleep', () => {
        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Sleep', level: 1, school: 'Evocation' };

            await triggerSleep(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('resolves saveDc from metaCtx, playerStats, or proficiency', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                { spellSaveDc: 18, slotLevel: 3 },
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 18 }), spellSlotLevel: 3 }),
                playerStats,
                campaignName,
                mapName,
            );

            await triggerSleep(
                { name: 'Sleep', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ saveDc: 15 }) }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('throws when proficiency is missing and no saveDc fallback', async () => {
            await expect(
                triggerSleep({ name: 'Sleep', level: 1 }, {}, { name: 'Wizard' }, campaignName, mapName)
            ).rejects.toThrow('playerStats.proficiency is required for sleep spell');
        });

        it('uses metaCtx slotLevel over spell.level for spellSlotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerSleep(
                { name: 'Sleep', level: 3 },
                { spellSaveDc: 17, slotLevel: 4 },
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

        it('throws when slot level is missing from both metaCtx and spell', async () => {
            await expect(
                triggerSleep({ name: 'Sleep' }, { spellSaveDc: 15 }, playerStats, campaignName, mapName)
            ).rejects.toThrow('slot level is required for sleep spell');
        });

        it('returns result from executeHandler on success, null when handler returns null or throws', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Sleep', description: 'Sleep affects...' } };
            executeHandler.mockResolvedValue(expectedResult);

            let result = await triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);

            executeHandler.mockResolvedValue(null);
            result = await triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            result = await triggerSleep({ name: 'Sleep', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
        });
    });
});
