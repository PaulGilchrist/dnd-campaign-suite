// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerMaze } from './mazeService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Lane map (verified 2026-10-21):
// - mazeService.js is the SOLE producer of the automation.type:'maze' trigger
//   envelope in non-test src (automationRouter.js:189 and mazeHandler.js consume it).
// - Escape-check dice rolls, targetEffect stamps (dc:20, concentration), storage
//   reads/writes, and logs all live in mazeHandler.js — covered by its sibling
//   suites (mazeHandler.test.js, mazeHandler.edgeCases.test.js,
//   mazeHandler.sp080-escape-concentration.test.js). This suite pins ONLY the
//   envelope this service produces: name gate, DC/slot coercion tiers, stamps,
//   arg identity, passthrough, and catch behavior.
// - Zero-store lane: mazeService imports only executeHandler (grep: no
//   getRuntimeValue/setRuntimeValue/storage/localStorage) → stateful-store fake N/A.
// - Dice: unreachable in this lane (no roll call) → stub N/A.
// - No timers/Date.now in this lane → no fake timers needed (no-clock policy clean).
// - Live caller triggerSpells.js:112 always spreads { ...metaCtx, spellSaveDc } with a
//   numeric DC (execution/index.js:193-221), so metaCtx.spellSaveDc is the live tier;
//   the stats fallbacks below are the service's own contract and stay pinned.

const POPUP = { type: 'popup', payload: { type: 'automation_info' } };
const CAMPAIGN = 'TestCampaign';
const MAP = 'testMap';
const FULL_STATS = {
    name: 'Wizard',
    spellAbilities: { saveDc: 17, modifier: 4 },
    proficiency: 6,
};

describe('triggerMaze', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // DC coercion census member (#1374 spectrum): ||-chain, falsy DC falls through:
    // metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc || 8 + (proficiency || 2).
    // Slot: metaCtx?.slotLevel || spell.level || 8. Rows use mutually-distinguishable
    // bytes (saveDc 20/17/13/10, slot 9/8/8/7) so every tier is separately observable.
    it.each([
        {
            label: 'metaCtx wins on every field',
            spell: { name: 'Maze', level: 8 },
            metaCtx: { spellSaveDc: 20, slotLevel: 9 },
            stats: FULL_STATS,
            saveDc: 20,
            slot: 9,
        },
        {
            label: 'metaCtx spellSaveDc 0 falls through to stats saveDc (||-pass, raw case preserved in name)',
            spell: { name: 'MAZE', level: 8 },
            metaCtx: { spellSaveDc: 0 },
            stats: FULL_STATS,
            saveDc: 17,
            slot: 8,
        },
        {
            label: 'null metaCtx + no spellAbilities computes 8+proficiency, slot defaults to 8',
            spell: { name: 'maze' },
            metaCtx: null,
            stats: { name: 'Wizard', proficiency: 5 },
            saveDc: 13,
            slot: 8,
        },
        {
            label: 'stats saveDc 0 and proficiency 0 fall through to 8+2, slotLevel 0 falls through to spell.level',
            spell: { name: 'maze', level: 7 },
            metaCtx: { slotLevel: 0 },
            stats: { name: 'Wizard', spellAbilities: { saveDc: 0 }, proficiency: 0 },
            saveDc: 10,
            slot: 7,
        },
    ])('$label', async ({ spell, metaCtx, stats, saveDc, slot }) => {
        executeHandler.mockResolvedValue(POPUP);

        const result = await triggerMaze(spell, metaCtx, stats, CAMPAIGN, MAP);

        const [action, gotStats, gotCampaign, gotMap] = executeHandler.mock.calls[0];
        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(action).toEqual({
            name: spell.name,
            automation: { type: 'maze', saveDc, saveType: 'WIS' },
            spell,
            spellSlotLevel: slot,
        });
        expect(action.spell).toBe(spell);
        expect(gotStats).toBe(stats);
        expect(gotCampaign).toBe(CAMPAIGN);
        expect(gotMap).toBe(MAP);
        expect(result).toBe(POPUP);
    });

    it('stamps exactly the four documented action keys', async () => {
        executeHandler.mockResolvedValue(POPUP);

        await triggerMaze({ name: 'maze', level: 8 }, {}, FULL_STATS, CAMPAIGN, MAP);

        expect(Object.keys(executeHandler.mock.calls[0][0]).sort()).toEqual(
            ['automation', 'name', 'spell', 'spellSlotLevel']
        );
    });

    // Gate is exact lowercase-set membership ('maze' only). Rows keep only
    // behaviorally-distinct near-misses: substring, multi-word, empty, neighbor control spell.
    it.each(['Mazes', 'maze spell', '', 'Hold Monster'])(
        'returns null without touching the handler for non-maze name %j',
        async (name) => {
            const result = await triggerMaze({ name, level: 8 }, {}, FULL_STATS, CAMPAIGN, MAP);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        }
    );

    it('throws native TypeError for malformed inputs — guards live OUTSIDE the try, console.error untouched (#1360 class)', async () => {
        const consoleSpy = vi.spyOn(console, 'error');

        await expect(triggerMaze(null, {}, FULL_STATS, CAMPAIGN, MAP)).rejects.toThrow(TypeError);
        await expect(triggerMaze(undefined, {}, FULL_STATS, CAMPAIGN, MAP)).rejects.toThrow(TypeError);
        // metaCtx falsy forces the unguarded playerStats.spellAbilities deref.
        await expect(triggerMaze({ name: 'maze' }, {}, undefined, CAMPAIGN, MAP)).rejects.toThrow(TypeError);

        expect(executeHandler).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('returns null and logs exact prefix with the identical Error when the handler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, 'error');

        const result = await triggerMaze({ name: 'Maze', level: 8 }, {}, FULL_STATS, CAMPAIGN, MAP);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('[mazeService] Failed to execute Maze handler:', err);
    });
});
