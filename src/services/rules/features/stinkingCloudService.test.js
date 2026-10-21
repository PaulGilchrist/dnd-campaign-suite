// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerStinkingCloud } from './stinkingCloudService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Identity: pure forwarder/producer for the Lv3 conjuration zone spell
// (public/data/spells.json stinking-cloud: '1 action', CON save, duration
// 'Up to 1 minute' + concentration:true, area_of_effect {type:'sphere',
// size:20 NUMBER} ; public/data/2024/spells.json: casting_time 'Action'
// — honest case divergence vs 5e lowercase, but THIS lane reads NEITHER
// casting_time nor area_of_effect, so the #1391/#1420 case-split and the
// silence #1413 numeric-size .match TypeError class are N/A here — the
// radius:20 default lives in stinkingCloudHandler.js tracking, not here).
// Both disk rows agree dc.dc_type CON; saveType 'CON' is a constant of
// this lane. 'stinking_cloud' routes to routeSaveStyle at
// automationRouter.js:191 (sleet_storm cousin, #1416 twin of this exact
// forwarder shape) and dispatches handleStinkingCloud at automation/
// index.js:584. Zone seam: the cloud does NOT ride repeatSaveService
// (#1405) nor zoneRepeatTurnEndService — recurring turn-start CON saves
// ride expireStaleEffects.js Phase 4 (effectKey 'stinking_cloud',
// trackingPrefix 'stinkingCloud') per pair-header #1973 (areaSave) /
// #1974 (cast handle); zone maturation is round-counter at initiative
// seams owned by zoneDurationClock #1332 (handler stamps addExpiration
// rounds:10 — CLA-334 minutes→10, NOT this lane). No clock, no dice, no
// store writes here (no-clock mandatory: 'up to 1 minute' is
// combat-scoped; this forwarder never stamps duration).
// Collision note (#1378): 'stinking_cloud' envelope is ALSO composed
// inline by handleStinkingCloudConfirm at useAreaEffectHandlers.js:110 —
// byte-identical coercion chain (spellSaveDc || spellAbilities?.saveDc
// || 8 + (proficiency || 2)). Cross-file duplication REPORTED, not fixed;
// the full-envelope pin below is the drift detector for OUR producer.
// HP-key census: N/A — condition-only cloud, zero damage (appliedDamage 0
// pinned by sibling #1973). Caller: triggerSpells.js:361 injects
// { ...metaCtx, spellSaveDc } so metaCtx precedence (row 1) is the live
// production shape; the modal lane is upstream (#1345 selection, N/A).
describe('stinkingCloudService', () => {
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

    it('dispatches the exact stinking_cloud action envelope positionally, inputs untouched', async () => {
        const spell = Object.freeze({ name: 'Stinking Cloud', level: 3 });
        const metaCtx = Object.freeze({ spellSaveDc: 18 });
        const result = Object.freeze({ type: 'popup' });
        executeHandler.mockResolvedValue(result);

        const returned = await triggerStinkingCloud(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, forwardedStats, forwardedCampaign, forwardedMap] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'Stinking Cloud',
            automation: { type: 'stinking_cloud', saveDc: 18, saveType: 'CON' },
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
        // Frozen inputs prove zero mutation of caller data (#1395).
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
        { label: 'treats 0 saveDc as falsy (:0-swallow)', metaCtx: {}, stats: { spellAbilities: { saveDc: 0 }, proficiency: 5 }, expected: 13 },
        { label: 'null metaCtx falls back to playerStats', metaCtx: null, stats: playerStats, expected: 15 },
        { label: 'undefined metaCtx falls back to playerStats', metaCtx: undefined, stats: playerStats, expected: 15 },
        { label: 'metaCtx.spellSaveDc:0 is falsy, falls back', metaCtx: { spellSaveDc: 0 }, stats: playerStats, expected: 15 },
    ])('saveDc resolution: $label', async ({ metaCtx, stats, expected }) => {
        executeHandler.mockClear();

        await triggerStinkingCloud({ name: 'Stinking Cloud', level: 3 }, metaCtx, stats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action] = executeHandler.mock.calls[0];
        // Full-set automation object: type and saveType are constants of this lane.
        expect(action.automation).toEqual({ type: 'stinking_cloud', saveDc: expected, saveType: 'CON' });
    });

    it.each([
        { label: 'prefers metaCtx.slotLevel', metaCtx: { slotLevel: 6 }, spell: { name: 'Stinking Cloud', level: 3 }, expected: 6 },
        { label: 'falls back to spell.level', metaCtx: {}, spell: { name: 'Stinking Cloud', level: 5 }, expected: 5 },
        { label: 'defaults to 3 when neither provides a level', metaCtx: {}, spell: { name: 'Stinking Cloud' }, expected: 3 },
        { label: 'treats null slotLevel as falsy', metaCtx: { slotLevel: null }, spell: { name: 'Stinking Cloud', level: 4 }, expected: 4 },
        { label: 'treats 0 slotLevel as falsy (both-sides :0-swallow)', metaCtx: { slotLevel: 0 }, spell: { name: 'Stinking Cloud', level: 3 }, expected: 3 },
    ])('spellSlotLevel resolution: $label', async ({ metaCtx, spell, expected }) => {
        executeHandler.mockClear();

        await triggerStinkingCloud(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action] = executeHandler.mock.calls[0];
        expect(action.spellSlotLevel).toBe(expected);
    });

    it('returns the handler result by identity (pass-through, incl. null)', async () => {
        const expectedResult = {
            type: 'popup',
            payload: { type: 'automation_info', name: 'Stinking Cloud', description: '...' },
        };
        executeHandler.mockResolvedValue(expectedResult);

        const result = await triggerStinkingCloud({ name: 'Stinking Cloud', level: 3 }, {}, playerStats, campaignName, mapName);
        expect(result).toBe(expectedResult);

        executeHandler.mockResolvedValue(null);
        expect(await triggerStinkingCloud({ name: 'Stinking Cloud', level: 3 }, {}, playerStats, campaignName, mapName)).toBeNull();
    });

    it('swallows a handler rejection: logs exact bytes, returns null', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        const err = new Error('dispatch failure');
        executeHandler.mockRejectedValue(err);

        const result = await triggerStinkingCloud({ name: 'Stinking Cloud', level: 3 }, {}, playerStats, campaignName, mapName);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('[stinkingCloudService] Failed to execute Stinking Cloud handler:', err);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });

    it('golden quirks: unguarded playerStats/spell derefs reject TypeError, executeHandler never reached', async () => {
        // :4 playerStats.spellAbilities and :5 spell.level / :8 spell.name
        // are unguarded — console.error never fires (throw precedes try).
        await expect(
            triggerStinkingCloud({ name: 'Stinking Cloud', level: 3 }, {}, undefined, campaignName, mapName),
        ).rejects.toThrow(TypeError('Cannot read properties of undefined (reading \'spellAbilities\')'));

        await expect(
            triggerStinkingCloud({ name: 'Stinking Cloud', level: 3 }, {}, null, campaignName, mapName),
        ).rejects.toThrow(TypeError('Cannot read properties of null (reading \'spellAbilities\')'));

        // spell undefined: slotLevel line :5 derefs spell.level first...
        executeHandler.mockClear();
        await expect(
            triggerStinkingCloud(undefined, {}, playerStats, campaignName, mapName),
        ).rejects.toThrow(TypeError('Cannot read properties of undefined (reading \'level\')'));

        // ...unless metaCtx.slotLevel short-circuits it into :8 spell.name.
        await expect(
            triggerStinkingCloud(undefined, { slotLevel: 4 }, playerStats, campaignName, mapName),
        ).rejects.toThrow(TypeError('Cannot read properties of undefined (reading \'name\')'));

        expect(executeHandler).not.toHaveBeenCalled();
    });
});
