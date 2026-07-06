// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerRemoveCurse, confirmRemoveCurse } from './removeCurseService.js';
import { executeHandler, applyRemoveCurseEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyRemoveCurseEffect: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = {
    name: 'Ranger',
    spellAbilities: { saveDc: 14, modifier: 3, spellCastingAbility: 'Wisdom', toHit: 8 },
    proficiency: 4,
};

describe('removeCurseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerRemoveCurse', () => {
        it.each([
            'Detect Magic', 'Lesser Remove Curse', 'Curse Removal', 'remove curses', '',
        ])('returns null for non-Remove Curse spell: "%s"', async (name) => {
            const result = await triggerRemoveCurse({ name, level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('is case-insensitive for "Remove Curse"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });
            const result = await triggerRemoveCurse({ name: 'REMOVE CURSE', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it.each([undefined, null, ''])('returns null when spell name is %s', async (name) => {
            const result = await triggerRemoveCurse({ name, level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('passes spell range to action automation, defaulting to "Touch"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerRemoveCurse({ name: 'Remove Curse', level: 2, range: 'Self' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: { type: 'remove_curse', range: 'Self' } }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success', async () => {
            const expectedResult = { type: 'popup', payload: { type: 'automation_info', name: 'Remove Curse', description: 'Remove curse removes...' } };
            executeHandler.mockResolvedValue(expectedResult);
            const result = await triggerRemoveCurse({ name: 'Remove Curse', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);
        });

        it('catches handler errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            const result = await triggerRemoveCurse({ name: 'Remove Curse', level: 2 }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[removeCurse] Failed to execute Remove Curse handler:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('confirmRemoveCurse', () => {
        const action = { name: 'Remove Curse', automation: { type: 'remove_curse', range: 'Touch' } };

        it('returns the effect application result on success', async () => {
            const expectedResult = { success: true, removedCurse: 'Cursed Sword' };
            applyRemoveCurseEffect.mockResolvedValue(expectedResult);
            const result = await confirmRemoveCurse(action, playerStats, campaignName, mapName, { type: 'popup', payload: {} });
            expect(result).toBe(expectedResult);
        });

        it('catches effect errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyRemoveCurseEffect.mockRejectedValue(new Error('Application failed'));
            const result = await confirmRemoveCurse(action, playerStats, campaignName, mapName, { type: 'popup' });
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('[removeCurse] Failed to apply Remove Curse effect:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
