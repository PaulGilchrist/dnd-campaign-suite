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
        it('returns null for non-matching spell names', async () => {
            const nonMatchingNames = [
                'Detect Magic',
                'Lesser Remove Curse',
                'Curse Removal',
                'remove curses',
                '',
            ];

            for (const name of nonMatchingNames) {
                const result = await triggerRemoveCurse(
                    { name, level: 2 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );
                expect(result).toBeNull();
                expect(executeHandler).not.toHaveBeenCalled();
            }
        });

        it('returns null when spell object is missing name property', async () => {
            const result = await triggerRemoveCurse(
                { level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler for case-insensitive "remove curse"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerRemoveCurse(
                { name: 'REMOVE CURSE', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
            expect(executeHandler).toHaveBeenCalledTimes(1);
        });

        it('passes spell range to action automation, defaulting to "Touch"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2, range: 'Self' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'remove_curse', range: 'Self' },
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Remove Curse', level: 2, school: 'Abjuration' };

            await triggerRemoveCurse(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns handler result on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Remove Curse', description: 'Remove curse removes...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when handler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
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

            const result = await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[removeCurse] Failed to execute Remove Curse handler:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });
    });

    describe('confirmRemoveCurse', () => {
        const action = {
            name: 'Remove Curse',
            automation: { type: 'remove_curse', range: 'Touch' },
        };

        it('returns the effect application result on success', async () => {
            const expectedResult = { success: true, removedCurse: 'Cursed Sword' };
            applyRemoveCurseEffect.mockResolvedValue(expectedResult);

            const result = await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                { type: 'popup', payload: {} },
            );

            expect(result).toBe(expectedResult);
        });

        it('passes all arguments through to applyRemoveCurseEffect', async () => {
            applyRemoveCurseEffect.mockResolvedValue({ success: true });
            const popupResult = { type: 'popup', payload: { curseId: 'abc123' } };

            await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                popupResult,
            );

            expect(applyRemoveCurseEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                popupResult,
            );
        });

        it('returns null when effect application returns null', async () => {
            applyRemoveCurseEffect.mockResolvedValue(null);

            const result = await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                { type: 'popup' },
            );

            expect(result).toBeNull();
        });

        it('catches effect errors, logs them, and returns null', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyRemoveCurseEffect.mockRejectedValue(new Error('Application failed'));

            const result = await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                { type: 'popup' },
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[removeCurse] Failed to apply Remove Curse effect:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('passes undefined result through to effect application', async () => {
            applyRemoveCurseEffect.mockResolvedValue({ success: true });

            const result = await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                undefined,
            );

            expect(applyRemoveCurseEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                undefined,
            );
            expect(result).toEqual({ success: true });
        });
    });
});
