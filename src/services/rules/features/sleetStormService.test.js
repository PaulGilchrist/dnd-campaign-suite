// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerSleetStorm } from './sleetStormService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Identity: pure forwarder/producer for the Lv3 conjuration zone spell
// (public/data/spells.json sleet-storm + public/data/2024/spells.json —
// concentration up to 1 minute, DEX save, NO damage dice on the disk row:
// damage:null). This service composes the cast envelope and dispatches it;
// the 'sleet_storm' automation routes to routeSaveStyle at
// automationRouter.js:191. Zone maturation, per-turn area saves, te stamps
// ('sleet_storm' te at targetEffectDefinitions.js:1150) and the
// 'sleet_storm_area_save' round-seam repeat live in
// automation/handlers/spells/sleetStormHandler.js + expireStaleEffects.js —
// NOT this lane. No dice, no store writes, no clock here (no-clock
// mandatory: 'up to 1 minute' is combat-scoped).
describe('sleetStormService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Explicit re-seed: vitest clearAllMocks retains implementations;
        // reset clears them, so re-arm the default dispatch outcome here.
        executeHandler.mockResolvedValue({ type: 'popup' });
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    it('dispatches the exact sleet_storm action envelope positionally, inputs untouched', async () => {
        const spell = Object.freeze({ name: 'Sleet Storm', level: 3 });
        const metaCtx = Object.freeze({ spellSaveDc: 18 });
        const result = Object.freeze({ type: 'popup' });
        executeHandler.mockResolvedValue(result);

        const returned = await triggerSleetStorm(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, forwardedStats, forwardedCampaign, forwardedMap] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Sleet Storm',
            automation: { type: 'sleet_storm', saveDc: 18, saveType: 'DEX' },
            spell,
            spellSlotLevel: 3,
        });
        expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
        expect(Object.keys(action.automation)).toEqual(['type', 'saveDc', 'saveType']);
        // Same-reference forwarding (aliasing contract, not deep copies).
        expect(action.spell).toBe(spell);
        expect(forwardedStats).toBe(playerStats);
        expect(forwardedCampaign).toBe(campaignName);
        expect(forwardedMap).toBe(mapName);
        // Frozen inputs prove zero mutation of caller data.
        expect(Object.isFrozen(spell)).toBe(true);
        expect(Object.isFrozen(metaCtx)).toBe(true);
        expect(returned).toBe(result);
    });

    it.each([
        { label: 'prefers metaCtx.spellSaveDc over playerStats', metaCtx: { spellSaveDc: 18 }, stats: playerStats, expected: 18 },
        { label: 'falls back to playerStats.spellAbilities.saveDc', metaCtx: {}, stats: playerStats, expected: 15 },
        { label: 'computes 8 + proficiency when spellAbilities missing', metaCtx: {}, stats: { name: 'Wizard', proficiency: 3 }, expected: 11 },
        { label: 'defaults to 8 + 2 on empty stats', metaCtx: {}, stats: {}, expected: 10 },
        { label: 'treats null saveDc as falsy', metaCtx: {}, stats: { spellAbilities: { saveDc: null }, proficiency: 4 }, expected: 12 },
        { label: 'treats 0 saveDc as falsy', metaCtx: {}, stats: { spellAbilities: { saveDc: 0 }, proficiency: 5 }, expected: 13 },
        { label: 'null metaCtx falls back to playerStats', metaCtx: null, stats: playerStats, expected: 15 },
        { label: 'undefined metaCtx falls back to playerStats', metaCtx: undefined, stats: playerStats, expected: 15 },
        { label: 'metaCtx.spellSaveDc:0 is falsy, falls back', metaCtx: { spellSaveDc: 0 }, stats: playerStats, expected: 15 },
    ])('saveDc resolution: $label', async ({ metaCtx, stats, expected }) => {
        executeHandler.mockClear();

        await triggerSleetStorm({ name: 'Sleet Storm', level: 3 }, metaCtx, stats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action] = executeHandler.mock.calls[0];
        // Full-set automation object: type and saveType are constants of this lane.
        expect(action.automation).toEqual({ type: 'sleet_storm', saveDc: expected, saveType: 'DEX' });
    });

    it.each([
        { label: 'prefers metaCtx.slotLevel', metaCtx: { slotLevel: 5 }, spell: { name: 'Sleet Storm', level: 3 }, expected: 5 },
        { label: 'falls back to spell.level', metaCtx: {}, spell: { name: 'Sleet Storm', level: 4 }, expected: 4 },
        { label: 'defaults to 3 when neither provides a level', metaCtx: {}, spell: { name: 'Sleet Storm' }, expected: 3 },
        { label: 'treats null slotLevel as falsy', metaCtx: { slotLevel: null }, spell: { name: 'Sleet Storm', level: 4 }, expected: 4 },
        { label: 'treats 0 slotLevel as falsy', metaCtx: { slotLevel: 0 }, spell: { name: 'Sleet Storm', level: 5 }, expected: 5 },
    ])('spellSlotLevel resolution: $label', async ({ metaCtx, spell, expected }) => {
        executeHandler.mockClear();

        await triggerSleetStorm(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action] = executeHandler.mock.calls[0];
        expect(action.spellSlotLevel).toBe(expected);
    });

    it('returns the handler result by identity (pass-through, incl. null)', async () => {
        const expectedResult = {
            type: 'popup',
            payload: { type: 'automation_info', name: 'Sleet Storm', description: '...' },
        };
        executeHandler.mockResolvedValue(expectedResult);

        const result = await triggerSleetStorm({ name: 'Sleet Storm', level: 3 }, {}, playerStats, campaignName, mapName);
        expect(result).toBe(expectedResult);

        executeHandler.mockResolvedValue(null);
        expect(await triggerSleetStorm({ name: 'Sleet Storm', level: 3 }, {}, playerStats, campaignName, mapName)).toBeNull();
    });

    it('swallows a handler rejection: logs exact bytes, returns null', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        const err = new Error('sleet dispatch failure');
        executeHandler.mockRejectedValue(err);

        const result = await triggerSleetStorm({ name: 'Sleet Storm', level: 3 }, {}, playerStats, campaignName, mapName);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('[sleetStormService] Failed to execute Sleet Storm handler:', err);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });

    it('golden quirk: derefs playerStats unguarded — rejects TypeError, executeHandler never reached', async () => {
        await expect(
            triggerSleetStorm({ name: 'Sleet Storm', level: 3 }, {}, undefined, campaignName, mapName),
        ).rejects.toThrow(TypeError('Cannot read properties of undefined (reading \'spellAbilities\')'));

        await expect(
            triggerSleetStorm({ name: 'Sleet Storm', level: 3 }, {}, null, campaignName, mapName),
        ).rejects.toThrow(TypeError('Cannot read properties of null (reading \'spellAbilities\')'));

        expect(executeHandler).not.toHaveBeenCalled();
    });
});
