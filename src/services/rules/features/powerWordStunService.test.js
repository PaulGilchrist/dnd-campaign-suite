// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPowerWordStun } from './powerWordStunService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('powerWordStunService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const basePlayerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerPowerWordStun', () => {
        it.each([
            ['non-matching spell', 'Fire Bolt', 0],
            ['undefined spell name', undefined, 0],
            ['empty spell name', '', 9],
            ['partial match', 'Power Word', 9],
            ['partial match', 'Power Word Stunned', 9],
            ['partial match', 'Power Words Stun', 9],
            ['partial match', 'word stun', 9],
        ])('returns null and does not call handler for %s', async (_label, spellName, level) => {
            const result = await triggerPowerWordStun(
                { name: spellName, level },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each([
            ['exact match', 'Power Word Stun'],
            ['lowercase', 'power word stun'],
            ['uppercase', 'POWER WORD STUN'],
            ['mixed case', 'PoWeR wOrd StUn'],
        ])('calls executeHandler for %s spell name', async (_label, spellName) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: spellName, level: 9 },
                {},
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, cname, mname] = executeHandler.mock.calls[0];
            expect(action.automation.type).toBe('power_word_stun');
            expect(action.automation.saveType).toBe('CON');
            expect(action.spellSlotLevel).toBe(9);
            expect(action.name).toBe(spellName);
            expect(result).toEqual({ type: 'popup' });
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Power Word Stun', level: 9, school: 'Enchantment' };

            await triggerPowerWordStun(spell, {}, basePlayerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it.each([
            ['metaCtx spellSaveDc', { spellSaveDc: 20, slotLevel: 9 }, 20, 9],
            ['playerStats spellAbilities.saveDc', {}, 15, 9],
            ['proficiency-based fallback', {}, 11, 9],
            ['default proficiency', {}, 10, 9],
        ])('computes saveDc from %s', async (_label, metaCtx, expectedDc, expectedSlot) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = _label === 'proficiency-based fallback'
                ? { name: 'Wizard', proficiency: 3 }
                : _label === 'default proficiency'
                    ? { name: 'Wizard' }
                    : basePlayerStats;

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                metaCtx,
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: expectedDc }),
                    spellSlotLevel: expectedSlot,
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 7 },
                { spellSaveDc: 17 },
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 7 }),
                basePlayerStats,
                campaignName,
                mapName,
            );
        });

        it('returns handler result, null on handler null, and null on handler error', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Power Word Stun', description: 'Stun affects...' },
            };

            executeHandler.mockResolvedValue(expectedResult);
            expect(await triggerPowerWordStun({ name: 'Power Word Stun', level: 9 }, {}, basePlayerStats, campaignName, mapName)).toBe(expectedResult);

            executeHandler.mockResolvedValue(null);
            expect(await triggerPowerWordStun({ name: 'Power Word Stun', level: 9 }, {}, basePlayerStats, campaignName, mapName)).toBeNull();

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            expect(await triggerPowerWordStun({ name: 'Power Word Stun', level: 9 }, {}, basePlayerStats, campaignName, mapName)).toBeNull();
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerPowerWordStun(
                { name: 'Power Word Stun', level: 9 },
                undefined,
                basePlayerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });
    });
});
