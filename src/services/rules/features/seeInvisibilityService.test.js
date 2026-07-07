// @improved-by-ai
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

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Wizard' };

    describe('triggerSeeInvisibility', () => {
        it.each([
            'Fire Bolt', 'Invisibility', 'see invis', 'InViSiBiLiTy',
        ])('returns null for non-See Invisibility spell: "%s"', async (name) => {
            const result = await triggerSeeInvisibility({ name, level: 0 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each([undefined, null, ''])('returns null when spell name is %s', async (name) => {
            const result = await triggerSeeInvisibility({ name, level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each(['See Invisibility', 'see invisibility', 'SEE INVISIBILITY', 'SeE iNvIsIbIlIty'])('matches "%s" case-insensitively', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });
            const result = await triggerSeeInvisibility({ name, level: 2 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it.each([
            ['uses spell.level when provided', { level: 4 }, 4],
            ['defaults to level 2 when level is absent', {}, 2],
        ])('uses %s for spellSlotLevel', async (_label, spellOverrides, expectedLevel) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerSeeInvisibility({ name: 'See Invisibility', ...spellOverrides }, {}, playerStats, campaignName, mapName);
            const [action] = executeHandler.mock.calls[0];
            expect(action.spellSlotLevel).toBe(expectedLevel);
        });

        it('returns handler result on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'See Invisibility' } };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await triggerSeeInvisibility({ name: 'See Invisibility', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toEqual(expectedResult);
        });

        it('catches handler errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error');
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const result = await triggerSeeInvisibility({ name: 'See Invisibility', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            consoleSpy.mockRestore();
        });
    });
});
