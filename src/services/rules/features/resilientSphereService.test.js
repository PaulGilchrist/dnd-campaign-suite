// @maintained-by-ai
/**
 * resilientSphereService — trigger-service lane for the Resilient Sphere spell.
 *
 * Source identity (READ FIRST): src/services/rules/features/resilientSphereService.js —
 * a 37-line cast-trigger envelope forwarder. NOT an HP-absorption interceptor (not on the
 * applyDamage ZERO_HP_INTERCEPTORS chain) and NOT a charge/uses latch artifact: it touches no
 * store, no charges, no dice. Disk fronting: 5e row public/data/spells.json:8213 "Resilient
 * Sphere" and 2024 row public/data/2024/spells.json:9668 "Otiluke's Resilient Sphere"; both
 * declare automation.type "resilient_sphere" (:8239 / :9698) -> HANDLER_MAP
 * (src/services/automation/index.js:579). Name split across rulesets is the disk truth.
 *
 * Export map: single export `triggerResilientSphere` — LIVE: imported and called at
 * src/services/rules/spells/spellCastService/execution/triggerSpells.js:17/:219
 * (handleResilientSphere), which duplicates the name gate inline (chokepoint dup) and always
 * injects spellSaveDc into metaCtx. Caller-side dispatch is pinned in the spellCastService
 * lanes (they mock this service); the service's own gate/resolution stays pinned independently
 * here so a future non-special-cased caller is safe.
 *
 * OWNED HERE (the whole service body):
 *  - name gate: lowercase() then strict === against the two literals (no trim — trailing-space
 *    near-miss falls through); `(spell.name || '')` falsy guard; gate derefs spell.name and
 *    playerStats OUTSIDE the try (golden TypeErrors propagate, console untouched).
 *  - saveDc coercion ladder: metaCtx?.spellSaveDc || playerStats.spellAbilities?.saveDc ||
 *    8 + (proficiency || 2). || chain swallows 0 — pinned both sides. Producer of real DCs is
 *    the caller/spellSaveDc computation; the service owns only this fallback ladder.
 *  - slotLevel ladder: metaCtx?.slotLevel || spell.level || 4 (0 swallowed — pinned). Spell's
 *    disk level is 4 in both rulesets, so 4 is the rules-correct default, not a magic number.
 *  - exact full-set action envelope + 4-arg tuple to executeHandler; result identity pass-thru.
 *  - metaCtx forwarding quirk: line 26's `...(targetName && { resilientSphereTargetName })`
 *    is INERT inline duplication — targetName is re-read from the same metaCtx that line 24
 *    already spreads verbatim, so the guard can never add, change, or REMOVE a key
 *    (falsy '' targetName still forwards as ''). Pinned as byte-identical forwarding.
 *  - reject -> null with exact console.error bytes.
 *
 * NOT OWNED HERE (owner lanes, cited):
 *  - barrier mechanics / toggle / condition log / save roll: src/services/automation/
 *    handlers/spells/resilientSphereHandler.test.js (consumes action.metaCtx.
 *    resilientSphereTargetName at resilientSphereHandler.js:13; empty-string targetName
 *    consumption pinned there too).
 *  - caller dispatch through triggerSpells: spellCastService.featureTriggers.test.js and
 *    siblings (they mock triggerResilientSphere; complementary, not redundant).
 *
 * N/A declarations (grep evidence on the source file):
 *  - Store fake N/A: zero getRuntimeValue/setRuntimeValue/useRuntimeState/useSyncedState —
 *    no writes at all, so the 5-arg inert skipSync house pattern (#1405) cannot occur here.
 *  - NO-CLOCK POLICY: no Date.now / setTimeout / setInterval / round counters in source
 *    (grep clean). 'Immune to all damage ... until the spell ends' duration lives purely in
 *    the handler lane; zero expiry numbers are stored here.
 *  - Dice N/A: zero dice rolled in this lane (the DEX save is rolled downstream in the
 *    handler lane).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerResilientSphere } from './resilientSphereService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const mockedExecuteHandler = vi.mocked(executeHandler);

const FULL_NAME = "Otiluke's Resilient Sphere"; // 2024 disk row (spells.json:9668)
const SHORT_NAME = 'Resilient Sphere';          // 5e disk row (spells.json:8213)
const campaignName = 'TestCampaign';
const mapName = 'testMap';

const fullStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

const call = (spell = { name: SHORT_NAME, level: 4 }, metaCtx = {}, stats = fullStats) =>
    triggerResilientSphere(spell, metaCtx, stats, campaignName, mapName);

const lastAction = () => {
    expect(mockedExecuteHandler).toHaveBeenCalledTimes(1);
    return mockedExecuteHandler.mock.calls[0][0];
};

describe('resilientSphereService — triggerResilientSphere', () => {
    beforeEach(() => {
        // reset (not clear) so a stale mockResolvedValue from one test can never leak.
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('name gate: lowercase + strict ===, no trim, falsy guard', () => {
        it.each([
            // Real disk near-misses — same "Sphere" family, must NOT match:
            { label: '5e Flaming Sphere', spell: { name: 'Flaming Sphere', level: 2 } },
            { label: '5e Freezing Sphere', spell: { name: 'Freezing Sphere', level: 6 } },
            { label: "2024 Otiluke's Freezing Sphere", spell: { name: "Otiluke's Freezing Sphere", level: 7 } },
            { label: '2024 Vitriolic Sphere', spell: { name: 'Vitriolic Sphere', level: 4 } },
            { label: 'plural near-miss', spell: { name: 'Resilient Spheres', level: 4 } },
            { label: 'trailing-space near-miss (strict ===, no trim)', spell: { name: `${SHORT_NAME} `, level: 4 } },
            { label: 'missing name (falsy guard)', spell: { level: 4 } },
        ])('returns null and never calls executeHandler: $label', async ({ spell }) => {
            const result = await call(spell);

            expect(result).toBeNull();
            expect(mockedExecuteHandler).toHaveBeenCalledTimes(0);
        });

        it.each([
            { label: '2024 disk name', name: FULL_NAME },
            { label: '5e disk name', name: SHORT_NAME },
            { label: 'all-uppercase full name', name: "OTILUKE'S RESILIENT SPHERE" },
            { label: 'short name lowercase', name: 'resilient sphere' },
        ])('matches $label and passes the handler result through by identity', async ({ name }) => {
            const sentinel = { success: true, via: name };
            mockedExecuteHandler.mockResolvedValue(sentinel);

            const result = await call({ name, level: 4 });

            expect(mockedExecuteHandler).toHaveBeenCalledTimes(1);
            // identity: same object, not a copy — pass-through pinned per row.
            expect(result).toBe(sentinel);
        });

        it('rejects with golden TypeErrors when spell or playerStats is undefined (deref runs outside try)', async () => {
            const consoleSpy = vi.spyOn(console, 'error');

            // bypass call()'s default param — must pass literal undefined to reach the deref
            await expect(triggerResilientSphere(undefined, {}, fullStats, campaignName, mapName))
                .rejects.toThrow(TypeError);
            await expect(triggerResilientSphere(null, {}, fullStats, campaignName, mapName))
                .rejects.toThrow(TypeError);
            await expect(
                triggerResilientSphere({ name: SHORT_NAME, level: 4 }, {}, undefined, campaignName, mapName)
            ).rejects.toThrow(TypeError);

            expect(mockedExecuteHandler).toHaveBeenCalledTimes(0);
            expect(consoleSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe('action envelope and argument tuple', () => {
        it('hands executeHandler the exact full action object and exact argument tuple', async () => {
            const spell = { name: FULL_NAME, level: 4, school: 'Abjuration' };
            const sentinel = { type: 'popup' };
            mockedExecuteHandler.mockResolvedValue(sentinel);

            const result = await call(spell);

            // Full-set envelope: exact key sets (no objectContaining) pin that nothing extra
            // is smuggled onto action or automation, and metaCtx:{} is always present.
            expect(mockedExecuteHandler).toHaveBeenCalledWith(
                {
                    name: FULL_NAME,
                    automation: { type: 'resilient_sphere', saveDc: 15, saveType: 'DEX' },
                    spell,
                    spellSlotLevel: 4,
                    metaCtx: {},
                },
                fullStats,
                campaignName,
                mapName,
            );
            expect(lastAction().spell).toBe(spell);
            expect(result).toBe(sentinel);
        });

        it.each([
            { label: 'metaCtx.spellSaveDc wins over spellAbilities', metaCtx: { spellSaveDc: 18 }, stats: fullStats, expected: 18 },
            { label: 'metaCtx.spellSaveDc 0 swallowed by ||, falls to spellAbilities', metaCtx: { spellSaveDc: 0 }, stats: fullStats, expected: 15 },
            { label: 'no spellAbilities: 8 + proficiency', metaCtx: {}, stats: { name: 'Wizard', proficiency: 3 }, expected: 11 },
            { label: 'proficiency 0: 8 + (0 || 2)', metaCtx: {}, stats: { name: 'Wizard', proficiency: 0 }, expected: 10 },
            { label: 'proficiency missing: 8 + 2 default', metaCtx: {}, stats: { name: 'Wizard' }, expected: 10 },
        ])('saveDc $label -> $expected', async ({ metaCtx, stats, expected }) => {
            mockedExecuteHandler.mockResolvedValue(null);

            await call({ name: SHORT_NAME, level: 4 }, metaCtx, stats);

            expect(lastAction().automation.saveDc).toBe(expected);
        });

        it.each([
            { label: 'metaCtx.slotLevel wins over spell.level', spell: { name: SHORT_NAME, level: 4 }, metaCtx: { slotLevel: 6 }, expected: 6 },
            { label: 'falls back to spell.level', spell: { name: SHORT_NAME, level: 6 }, metaCtx: {}, expected: 6 },
            { label: 'spell.level 0 swallowed by || -> rules default 4', spell: { name: SHORT_NAME, level: 0 }, metaCtx: {}, expected: 4 },
            { label: 'no level anywhere -> rules default 4', spell: { name: SHORT_NAME }, metaCtx: {}, expected: 4 },
        ])('slotLevel $label -> $expected', async ({ spell, metaCtx, expected }) => {
            mockedExecuteHandler.mockResolvedValue(null);

            await call(spell, metaCtx, fullStats);

            expect(lastAction().spellSlotLevel).toBe(expected);
        });
    });

    describe('metaCtx forwarding — verbatim shallow copy; the targetName guard is inert dup', () => {
        it.each([
            { label: 'undefined metaCtx -> exactly {}', metaCtx: undefined, expected: {} },
            { label: 'null metaCtx -> exactly {}', metaCtx: null, expected: {} },
            { label: 'empty metaCtx -> exactly {}', metaCtx: {}, expected: {} },
            {
                label: 'truthy resilientSphereTargetName forwarded verbatim',
                metaCtx: { resilientSphereTargetName: 'AllyPlayer' },
                expected: { resilientSphereTargetName: 'AllyPlayer' },
            },
            {
                label: "falsy '' targetName still forwarded (guard removes nothing — INERT dup)",
                metaCtx: { resilientSphereTargetName: '' },
                expected: { resilientSphereTargetName: '' },
            },
            {
                label: 'unrelated metaCtx keys forwarded untouched',
                metaCtx: { slotLevel: 5, fromModal: true },
                expected: { slotLevel: 5, fromModal: true },
            },
        ])('action.metaCtx deep-equals $label', async ({ metaCtx, expected }) => {
            mockedExecuteHandler.mockResolvedValue(null);

            await call({ name: SHORT_NAME, level: 4 }, metaCtx);

            const action = lastAction();
            expect(action.metaCtx).toEqual(expected);
            expect(Object.keys(action.metaCtx)).toEqual(Object.keys(expected));
            if (metaCtx) {
                // spread copy: new object identity, original input untouched (purity)
                expect(action.metaCtx).not.toBe(metaCtx);
                expect(metaCtx).toEqual(expected);
            }
        });
    });

    describe('failure lane', () => {
        it('returns null and logs the exact bytes with the identical error object when executeHandler rejects', async () => {
            const error = new Error('Handler failed');
            mockedExecuteHandler.mockRejectedValue(error);
            const consoleSpy = vi.spyOn(console, 'error');

            const result = await call();

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith(
                '[resilientSphereService] Failed to execute Resilient Sphere handler:',
                error,
            );
        });
    });
});
