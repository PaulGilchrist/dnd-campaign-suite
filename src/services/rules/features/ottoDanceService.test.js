// @maintained-by-ai
/**
 * ottoDanceService — trigger-service lane for Otto's Irresistible Dance.
 *
 * Source identity (READ FIRST): src/services/rules/features/ottoDanceService.js —
 * a 28-line spell-cast trigger shim (2024-style epic-boon name in the spell list;
 * not an item, not a class feature). Single export `triggerOttoDance`, LIVE:
 * called at src/services/rules/spells/spellCastService/execution/triggerSpells.js:211
 * (handleOttoDance), which duplicates the name gate inline (chokepoint dup) and always
 * injects spellSaveDc — the service's own gate/resolution stays pinned independently so a
 * future non-special-cased caller is safe. Caller-side dispatch of both spell names is
 * pinned at spellCastService.special.test.js:165 (complementary, not redundant).
 *
 * OWNED HERE (the whole service body):
 *  - name gate: strict lowercase === against the two literals, NO trim (trailing-space
 *    near-miss intentionally falls through), falsy-name `(spell.name || '')` guard,
 *    gate runs OUTSIDE the try (undefined spell = golden TypeError).
 *  - saveDc resolution: metaCtx?.spellSaveDc || spellAbilities?.saveDc || 8+(prof||2)
 *    (|| chain swallows 0 — pinned).
 *  - slotLevel resolution: metaCtx?.slotLevel || spell.level || 6 (swallows 0 — pinned).
 *  - exact action envelope + full argument tuple handed to executeHandler, result
 *    identity pass-through, reject -> null with exact console.error payload.
 *
 * NOT OWNED HERE (owner lanes, cited):
 *  - dance-compulsion mechanics (te stamp 'ottos_irresistible_dance', forced-dance
 *    action economy, save-or-charmed): src/services/automation/handlers/spells/
 *    ottosDanceHandler.test.js — that lane rolls the initial save.
 *  - reroll-and-escape decision: createRollConditionSaveHandler.test.jsx (rollType
 *    'save-ottos-dance'); te registry row: targetEffectDefinitions.js:948 /
 *    targetEffectDefinitions.test.js:117.
 *  - rest/initiative CLEAR side of the te: clearAllExpirationEffects_rest_cleanup.test.js
 *    #1286 :280-305 (preserved there byte-exact; this lane never touches the clear side).
 *  - per-turn dance ticks: turnStart lanes (none found for otto — the te persists
 *    until the save/escape owner clears it).
 *
 * N/A declarations (grep evidence on the source file):
 *  - Store fake N/A: ottoDanceService.js contains no getRuntimeValue/setRuntimeValue/
 *    useRuntimeState/useSyncedState — zero store access; only collaborator is
 *    executeHandler, stubbed below.
 *  - NO-CLOCK POLICY: no Date.now / setTimeout / setInterval in the source (grep clean).
 *    'Until save ends' duration lives purely in the handler lane; zero expiry numbers
 *    are stored here.
 *  - HP pair N/A: source performs no HP writes.
 *  - Dice N/A: no dice rolled in the service (saves are rolled downstream).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerOttoDance } from './ottoDanceService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const mockedExecuteHandler = vi.mocked(executeHandler);

const OTTO = "Otto's Irresistible Dance";
const campaignName = 'TestCampaign';
const mapName = 'testMap';

const fullStats = {
    name: 'Bard',
    spellAbilities: { saveDc: 16, modifier: 4, spellCastingAbility: 'Charisma', toHit: 10 },
    proficiency: 4,
};

const call = (spell = { name: OTTO, level: 6 }, metaCtx = {}, stats = fullStats) =>
    triggerOttoDance(spell, metaCtx, stats, campaignName, mapName);

const lastAction = () => {
    expect(mockedExecuteHandler).toHaveBeenCalledTimes(1);
    return mockedExecuteHandler.mock.calls[0][0];
};

describe('ottoDanceService — triggerOttoDance', () => {
    beforeEach(() => {
        // reset (not clear) so a stale mockResolvedValue from one test can never leak.
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('name gate: strict lowercase ===, no trim, falsy guard', () => {
        it.each([
            { label: 'different spell', spell: { name: 'Vicious Mockery', level: 0 } },
            { label: 'empty string name', spell: { name: '', level: 6 } },
            { label: 'missing name (falsy guard)', spell: { level: 6 } },
            { label: 'null name (falsy guard)', spell: { name: null, level: 6 } },
            { label: 'trailing-space near-miss (strict ===, no trim)', spell: { name: `${OTTO} `, level: 6 } },
            { label: 'typo near-miss', spell: { name: "Otto's Resistible Dance", level: 6 } },
        ])('returns null and never calls executeHandler: $label', async ({ spell }) => {
            const result = await call(spell);

            expect(result).toBeNull();
            expect(mockedExecuteHandler).not.toHaveBeenCalled();
        });

        it.each([
            { label: 'canonical name', name: OTTO },
            { label: 'all-uppercase', name: "OTTO'S IRRESISTIBLE DANCE" },
            { label: 'alternate short name lowercase', name: 'irresistible dance' },
        ])('matches $label and passes the handler result through by identity', async ({ name }) => {
            const sentinel = { success: true, via: name };
            mockedExecuteHandler.mockResolvedValue(sentinel);

            const result = await call({ name, level: 6 });

            expect(mockedExecuteHandler).toHaveBeenCalledTimes(1);
            // identity: same object, not a copy — pass-through pinned per row.
            expect(result).toBe(sentinel);
        });

        it('rejects with TypeError when spell is undefined (gate deref runs outside try)', async () => {
            // bypass call()'s default param — must pass literal undefined to reach the gate
            await expect(triggerOttoDance(undefined, {}, fullStats, campaignName, mapName))
                .rejects.toThrow(TypeError);
            expect(mockedExecuteHandler).not.toHaveBeenCalled();
        });
    });

    describe('action envelope and argument tuple', () => {
        it('hands executeHandler the exact full action object and exact argument tuple', async () => {
            const spell = { name: OTTO, level: 6, school: 'Enchantment' };
            mockedExecuteHandler.mockResolvedValue(null);

            await call(spell);

            // Full-set envelope: exact key sets (no objectContaining) pin that nothing
            // extra is smuggled onto action or automation.
            expect(mockedExecuteHandler).toHaveBeenCalledWith(
                {
                    name: OTTO,
                    automation: { type: 'ottos_dance', saveDc: 16, saveType: 'WIS' },
                    spell,
                    spellSlotLevel: 6,
                },
                fullStats,
                campaignName,
                mapName,
            );
            expect(lastAction().spell).toBe(spell);
        });

        it.each([
            { label: 'metaCtx.spellSaveDc wins over spellAbilities', spell: { name: OTTO, level: 6 }, metaCtx: { spellSaveDc: 19 }, stats: fullStats, expected: 19 },
            { label: 'metaCtx.spellSaveDc 0 swallowed by ||, falls to spellAbilities', spell: { name: OTTO, level: 6 }, metaCtx: { spellSaveDc: 0 }, stats: fullStats, expected: 16 },
            { label: 'no spellAbilities: 8 + proficiency', spell: { name: OTTO, level: 6 }, metaCtx: {}, stats: { name: 'Bard', proficiency: 5 }, expected: 13 },
            { label: 'no spellAbilities, proficiency 0: 8 + (0 || 2)', spell: { name: OTTO, level: 6 }, metaCtx: {}, stats: { name: 'Bard', proficiency: 0 }, expected: 10 },
            { label: 'no spellAbilities, proficiency missing: 8 + 2 default', spell: { name: OTTO, level: 6 }, metaCtx: {}, stats: { name: 'Bard' }, expected: 10 },
        ])('saveDc $label -> $expected', async ({ spell, metaCtx, stats, expected }) => {
            mockedExecuteHandler.mockResolvedValue(null);

            await call(spell, metaCtx, stats);

            expect(lastAction().automation.saveDc).toBe(expected);
        });

        it.each([
            { label: 'metaCtx.slotLevel wins over spell.level', spell: { name: OTTO, level: 6 }, metaCtx: { slotLevel: 9 }, expected: 9 },
            { label: 'falls back to spell.level', spell: { name: OTTO, level: 8 }, metaCtx: {}, expected: 8 },
            { label: 'spell.level 0 swallowed by || -> default 6', spell: { name: OTTO, level: 0 }, metaCtx: {}, expected: 6 },
        ])('slotLevel $label -> $expected', async ({ spell, metaCtx, expected }) => {
            mockedExecuteHandler.mockResolvedValue(null);

            await call(spell, metaCtx, fullStats);

            expect(lastAction().spellSlotLevel).toBe(expected);
        });
    });

    describe('failure lane', () => {
        it('returns null and logs the exact prefix with the identical error object when executeHandler rejects', async () => {
            const error = new Error('Handler failed');
            mockedExecuteHandler.mockRejectedValue(error);
            const consoleSpy = vi.spyOn(console, 'error');

            const result = await call();

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                `[ottoDanceService] Failed to execute ${OTTO} handler:`,
                error,
            );
        });
    });
});
