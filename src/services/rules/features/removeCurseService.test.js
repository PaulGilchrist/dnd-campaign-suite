import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerRemoveCurse, confirmRemoveCurse } from './removeCurseService.js';
import { executeHandler, applyRemoveCurseEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyRemoveCurseEffect: vi.fn(),
}));

describe('removeCurseService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerRemoveCurse', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Ranger',
            spellAbilities: { saveDc: 14, modifier: 3, spellCastingAbility: 'Wisdom', toHit: 8 },
            proficiency: 4,
        };

        it('returns null for non-Remove Curse spells', async () => {
            const result = await triggerRemoveCurse(
                { name: 'Detect Magic', level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            const result = await triggerRemoveCurse(
                { name: '', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('throws when spell is undefined', async () => {
            await expect(
                triggerRemoveCurse(
                    undefined,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow("Cannot read properties of undefined (reading 'name')");
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell has no name property', async () => {
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

        it('matches "Remove Curse" case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('matches lowercase "remove curse"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerRemoveCurse(
                { name: 'remove curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('matches uppercase "REMOVE CURSE"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerRemoveCurse(
                { name: 'REMOVE CURSE', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('passes spell range to action automation', async () => {
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
                    automation: expect.objectContaining({ range: 'Self' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default range "Touch" when spell has no range', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ range: 'Touch' }),
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

        it('returns result from executeHandler on success', async () => {
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

        it('returns null when executeHandler returns null', async () => {
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

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('logs error when executeHandler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockRejectedValue(new Error('Connection refused'));

            await triggerRemoveCurse(
                { name: 'Remove Curse', level: 2 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                '[removeCurse] Failed to execute Remove Curse handler:',
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('passes all arguments to executeHandler correctly', async () => {
            executeHandler.mockResolvedValue({ success: true });

            await triggerRemoveCurse(
                { name: 'Remove Curse', level: 3 },
                { someMeta: 'data' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Remove Curse',
                    automation: { type: 'remove_curse', range: 'Touch' },
                    spell: { name: 'Remove Curse', level: 3 },
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('does not match similar spell names like "Lesser Remove Curse"', async () => {
            const result = await triggerRemoveCurse(
                { name: 'Lesser Remove Curse', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('does not match "Curse Removal"', async () => {
            const result = await triggerRemoveCurse(
                { name: 'Curse Removal', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('confirmRemoveCurse', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Ranger',
            spellAbilities: { saveDc: 14, modifier: 3, spellCastingAbility: 'Wisdom', toHit: 8 },
            proficiency: 4,
        };
        const action = {
            name: 'Remove Curse',
            automation: { type: 'remove_curse', range: 'Touch' },
        };

        it('returns result from applyRemoveCurseEffect on success', async () => {
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

        it('passes all arguments to applyRemoveCurseEffect correctly', async () => {
            applyRemoveCurseEffect.mockResolvedValue({ success: true });
            const result = { type: 'popup', payload: { curseId: 'abc123' } };

            await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                result,
            );

            expect(applyRemoveCurseEffect).toHaveBeenCalledWith(
                action,
                playerStats,
                campaignName,
                mapName,
                result,
            );
        });

        it('returns null when applyRemoveCurseEffect returns null', async () => {
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

        it('returns null when applyRemoveCurseEffect throws an error', async () => {
            applyRemoveCurseEffect.mockRejectedValue(new Error('Application failed'));

            const result = await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                { type: 'popup' },
            );

            expect(result).toBeNull();
        });

        it('logs error when applyRemoveCurseEffect throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            applyRemoveCurseEffect.mockRejectedValue(new Error('Database error'));

            const result = await confirmRemoveCurse(
                action,
                playerStats,
                campaignName,
                mapName,
                { type: 'popup' },
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                '[removeCurse] Failed to apply Remove Curse effect:',
                expect.any(Error),
            );
            expect(result).toBeNull();
            consoleSpy.mockRestore();
        });

        it('handles undefined result parameter', async () => {
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

        it('handles empty action object', async () => {
            applyRemoveCurseEffect.mockResolvedValue({ success: true });

            const result = await confirmRemoveCurse(
                {},
                playerStats,
                campaignName,
                mapName,
                { type: 'popup' },
            );

            expect(applyRemoveCurseEffect).toHaveBeenCalledWith(
                {},
                playerStats,
                campaignName,
                mapName,
                expect.any(Object),
            );
            expect(result).toEqual({ success: true });
        });

        it('handles null action object', async () => {
            applyRemoveCurseEffect.mockResolvedValue({ success: true });

            const result = await confirmRemoveCurse(
                null,
                playerStats,
                campaignName,
                mapName,
                { type: 'popup' },
            );

            expect(applyRemoveCurseEffect).toHaveBeenCalledWith(
                null,
                playerStats,
                campaignName,
                mapName,
                expect.any(Object),
            );
            expect(result).toEqual({ success: true });
        });
    });
});
