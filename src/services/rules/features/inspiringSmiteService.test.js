// @maintained-by-ai
// inspiringSmiteService lane — TRIGGER ENVELOPE PRODUCER + CLA-200 CAST-TOKEN
// STAMPER (inspiringSmiteService.js:5-56). Sole production caller of
// triggerInspiringSmite is spellCastService/execution/index.js:528, fire-and-forget
// with .catch — so the rethrow at :51 is the caller's only failure signal; this lane
// pins it (rejects with the IDENTICAL Error instance, loop stops).
// spellUtils.isDivineSmite stays REAL (unmocked): the lowercase-name gate is proven
// through the real comparison. Strict argument-keyed fakes: setRuntimeValue THROWS on
// any key other than 'inspiringSmiteCastToken' or any campaign other than
// 'test-campaign' and records the FULL arity-4 tuple (no skipSync 5th arg — this is
// a live broadcast); executeHandler THROWS when called beyond its stubbed budget.
// Stamp-vs-dispatch order is machine-proven by a shared seq recorder, not call-counts.
// Date.now() at :32 is an ARM-TOKEN IDENTITY consumed by equality at
// inspiringSmiteHandler.js:96-99 (not an expiry countdown — no-clock clean); it is
// pinned byte-exact under fake timers, never expect.any.
// Owned elsewhere (cite-skip): the post_cast_inspiring_smite handler side — lastAttack
// gate, 2d8+level THP dice (fixed-stub tables), 30ft/isWithinRange delegation,
// inspiring-smite-pending modal payload (inspiringSmiteHandler.test.js); the
// once-per-cast refuse/re-arm latch consuming inspiringSmiteCastToken/
// inspiringSmiteUsedToken (inspiringSmiteLatch.test.js); dispatcher routing of the
// envelope type (inspiringSmiteRowActivation.test.js, automationRouter.js:284).
// Cousin smites are distinct lanes: smiteOfProtectionService.js has its own test;
// clearExpirationEffects_additional_types.test.js #1287 owns remove_smite_of_protection
// and clearAllExpirationEffects_additional.test.js #1285 owns the smiteOfProtection/
// bulwarkOfForce/naturesSanctuary clearSelfBuffs payloads — zero inspiringSmite bytes
// appear in the expiration lanes (verified by grep, 2026-10-21).
// Disk row (public/data/2024/classes.json, Paladin > Oath of Glory > Inspiring Smite,
// read 2026-10-21): level 3, automation.type 'post_cast_inspiring_smite',
// casting_time 'passive' — the envelope's type literal and casting_time fallback mirror
// this row; no save field (damage-split/THP RAW), no spell-slot disk row, no
// 'At Higher Levels' dice in this lane (pool dice live in the handler lane).
// Quirks pinned honestly: :19 inline-duplicates the exported spellUtils.js:7
// usesSpellSlot chokepoint (golden dup — OR-gate both faces exercised below); the :8
// guard is nullish-only, so a non-array passives object falls through to the golden
// native TypeError on .filter (:11), outside any try — pinned per #1379 discipline.
// getInspiringSmitePassives demoted to module-local #1381 (export keyword dropped,
// ZERO external importers): its filter/guard behavior is pinned THROUGH the public
// triggerInspiringSmite entry (#82-class restructure — no private-symbol imports).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const MAP = 'testMap';
const EPOCH = new Date('2026-10-21T12:00:00Z').getTime();

// ── Recorder state (strict fakes defined in beforeEach = explicit re-seed) ──
let stamps;      // full setRuntimeValue tuples [name, key, value, campaign]
let envelopes;  // full executeHandler arg tuples [action, stats, campaign, map]
let seq;        // call-order markers: 'stamp' | 'handle:<name>'
let results;    // stub queue: { value } | { reject: true, error }

vi.mock('../../automation/index.js', () => ({ executeHandler: vi.fn() }));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({ setRuntimeValue: vi.fn() }));

import { executeHandler } from '../../automation/index.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { triggerInspiringSmite } from './inspiringSmiteService.js';

function strictSetRuntimeValue(name, key, value, campaign) {
    if (arguments.length !== 4) throw new Error(`setRuntimeValue arity: expected 4, got ${arguments.length}`);
    if (key !== 'inspiringSmiteCastToken') throw new Error(`Unexpected store key written: ${key}`);
    if (campaign !== CAMPAIGN) throw new Error(`Wrong campaign stamped: ${campaign}`);
    if (typeof value !== 'number') throw new Error(`Token must be a number, got ${typeof value}`);
    seq.push('stamp');
    stamps.push([name, key, value, campaign]);
    return Promise.resolve();
}

function strictExecuteHandler(action, stats, campaign, map) {
    if (arguments.length !== 4) throw new Error(`executeHandler arity: expected 4, got ${arguments.length}`);
    if (campaign !== CAMPAIGN || map !== MAP) throw new Error(`Wrong dispatch target: ${campaign}/${map}`);
    if (!action || !action.automation) throw new Error('Envelope missing automation');
    seq.push(`handle:${action.name}`);
    envelopes.push([action, stats, campaign, map]);
    const next = results.shift();
    if (!next) throw new Error(`executeHandler called beyond stubbed budget (${action.name})`);
    if (next.reject) return Promise.reject(next.error);
    return Promise.resolve(next.value);
}

function makeStats(name, passives) {
    return { name, automation: { passives } };
}

const SMITE = { name: 'Divine Smite' };
const passive = (name, extra = {}) => ({ type: 'post_cast_inspiring_smite', name, ...extra });

let consoleSpy;

beforeEach(() => {
    vi.resetAllMocks();
    stamps = [];
    envelopes = [];
    seq = [];
    results = [];
    setRuntimeValue.mockImplementation(strictSetRuntimeValue);
    executeHandler.mockImplementation(strictExecuteHandler);
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(EPOCH);
});

afterEach(() => {
    consoleSpy.mockRestore();
    vi.useRealTimers();
});

describe('inspiringSmiteService', () => {
    describe('passive-pool filter (getInspiringSmitePassives demoted to module-local #1381 — behavior pinned via the public trigger)', () => {
        it('filters exactly to post_cast_inspiring_smite, order-preserved; near-miss types never dispatched', async () => {
            const keep1 = passive('Inspire 1');
            const keep2 = passive('Inspire 2');
            const stats = makeStats('Astra', [
                { type: 'post_cast_smite_of_protection', name: 'Smite of Protection' },
                keep1,
                { type: 'pre_cast_inspiring_smite', name: 'Near Miss Prefix' },
                { type: 'post_cast_inspiring_smite_extended', name: 'Near Miss Suffix' },
                keep2,
            ]);
            results.push({ value: { pool: 9 } }, { value: { pool: 11 } });

            await expect(triggerInspiringSmite(SMITE, { slotLevel: 1 }, stats, CAMPAIGN, MAP))
                .resolves.toEqual([{ pool: 9 }, { pool: 11 }]);

            // Only keep1/keep2 survive the filter: exact dispatch order, exact bytes.
            expect(seq).toEqual(['stamp', 'handle:Inspire 1', 'handle:Inspire 2']);
            expect(envelopes).toEqual([
                [{ name: 'Inspire 1', automation: { type: 'post_cast_inspiring_smite', casting_time: 'passive' } }, stats, CAMPAIGN, MAP],
                [{ name: 'Inspire 2', automation: { type: 'post_cast_inspiring_smite', casting_time: 'passive' } }, stats, CAMPAIGN, MAP],
            ]);
            expect(envelopes[0][0].name).toBe(keep1.name);
            expect(envelopes[1][0].name).toBe(keep2.name);
        });

        // Empty pool → null with ZERO writes/dispatches is already pinned by the
        // passive-gate row of the trigger gate test below (same makeStats shape).

        it.each([
            ['missing passives', () => ({ automation: {} }), 'Expected array, got undefined', undefined],
            ['null passives', () => ({ automation: { passives: null } }), 'Expected array, got null', null],
        ])('%s: guarded loud throw rides the trigger — exact console bytes, zero stamp, zero dispatch', async (_label, makeBroken, message, logged) => {
            await expect(triggerInspiringSmite(SMITE, { slotLevel: 1 }, makeBroken(), CAMPAIGN, MAP))
                .rejects.toThrow(message);
            expect(consoleSpy.mock.calls).toEqual([['[inspiringSmiteService] Missing array:', logged]]);
            expect(stamps).toEqual([]);
            expect(envelopes).toEqual([]);
        });

        it('non-array passives object falls through the nullish-only guard to the golden native TypeError on .filter, outside any try, no extra console.error', async () => {
            await expect(triggerInspiringSmite(
                SMITE, { slotLevel: 1 }, { automation: { passives: {} } }, CAMPAIGN, MAP
            )).rejects.toThrow(TypeError);
            expect(consoleSpy).not.toHaveBeenCalled();
            expect(stamps).toEqual([]);
            expect(envelopes).toEqual([]);
        });

        it('nullish playerStats apex routes into the SAME loud arm — exact console bytes, throw not fabricated pool (#204-class)', async () => {
            // fix#179 refuse-no-fabricated-values: a nullish apex must not return [] that a
            // consumer could misread as eligibility-checked; the file-owned loud throw propagates
            // from the passive read (trigger call site, outside any try).
            await expect(triggerInspiringSmite(
                SMITE, { slotLevel: 1 }, undefined, CAMPAIGN, MAP
            )).rejects.toThrow('Expected array, got undefined');
            expect(consoleSpy).toHaveBeenCalledTimes(1); // no stamp, no dispatch before the throw
            expect(stamps).toEqual([]);
            expect(envelopes).toEqual([]);
        });
    });

    describe('triggerInspiringSmite', () => {
        it('every gate returns null with ZERO writes and ZERO dispatch, checked before the stamp', async () => {
            // (a) name gate first: near-miss cousin spell name would pass a
            //     containment check; exact lowercase match required. Broken stats
            //     would THROW if passives were read — returning null proves the
            //     gate precedes the passive read.
            await expect(triggerInspiringSmite(
                { name: 'Searing Smite', level: 3 }, { slotLevel: 2 }, { automation: {} }, CAMPAIGN, MAP
            )).resolves.toBeNull();
            // (b) slot gate precedes the passive read (same broken-stats proof);
            //     slotLevel 0, negative slotLevel and absent metaCtx all fail.
            await expect(triggerInspiringSmite(
                { name: 'Divine Smite', level: 0 }, { slotLevel: 0 }, { automation: {} }, CAMPAIGN, MAP
            )).resolves.toBeNull();
            await expect(triggerInspiringSmite(
                { name: 'Divine Smite', level: 0 }, { slotLevel: -1 }, { automation: {} }, CAMPAIGN, MAP
            )).resolves.toBeNull();
            // (c) passive gate precedes the stamp (CLA-200: no orphan tokens).
            await expect(triggerInspiringSmite(
                SMITE, { slotLevel: 1 }, makeStats('Astra', []), CAMPAIGN, MAP
            )).resolves.toBeNull();
            expect(stamps).toEqual([]);
            expect(envelopes).toEqual([]);
            expect(seq).toEqual([]);
        });

        it('CLA-200: stamps the exact cast-token tuple BEFORE dispatch and builds exact envelopes on both slot faces', async () => {
            const custom = passive('Inspire Custom', { casting_time: '1 action' });
            const fallback = passive('Inspire Default');
            const stats = makeStats('Astra', [custom, fallback]);

            // Face 1: metaCtx.slotLevel arming (spell.level undefined).
            results.push({ value: { pool: 9 } }, { value: { pool: 11 } });
            await expect(triggerInspiringSmite(SMITE, { slotLevel: 2 }, stats, CAMPAIGN, MAP))
                .resolves.toEqual([{ pool: 9 }, { pool: 11 }]);

            expect(seq).toEqual(['stamp', 'handle:Inspire Custom', 'handle:Inspire Default']);
            expect(stamps).toEqual([['Astra', 'inspiringSmiteCastToken', EPOCH, CAMPAIGN]]);
            expect(envelopes).toEqual([
                [{ name: 'Inspire Custom', automation: { type: 'post_cast_inspiring_smite', casting_time: '1 action' } }, stats, CAMPAIGN, MAP],
                [{ name: 'Inspire Default', automation: { type: 'post_cast_inspiring_smite', casting_time: 'passive' } }, stats, CAMPAIGN, MAP],
            ]);
            // stats identity forwarded untouched (not cloned/mutated).
            expect(envelopes[0][1]).toBe(stats);

            // Face 2: fresh cast, fresh token — spell.level alone arms; the token
            // re-stamps with the advanced clock so the latch sees a new identity.
            seq.length = 0; stamps.length = 0; envelopes.length = 0;
            results.push({ value: { pool: 7 } }, { value: { pool: 8 } });
            vi.setSystemTime(EPOCH + 60000);
            await expect(triggerInspiringSmite(
                { name: 'Divine Smite', level: 1 }, {}, stats, CAMPAIGN, MAP
            )).resolves.toEqual([{ pool: 7 }, { pool: 8 }]);
            expect(seq).toEqual(['stamp', 'handle:Inspire Custom', 'handle:Inspire Default']);
            expect(stamps).toEqual([['Astra', 'inspiringSmiteCastToken', EPOCH + 60000, CAMPAIGN]]);
        });

        it('filters falsy handler results, returns null when all falsy, and stamps once per cast regardless of passive count', async () => {
            const stats = makeStats('Astra', [passive('Inspire 1'), passive('Inspire 2'), passive('Inspire 3')]);

            results.push({ value: { result: 1 } }, { value: null }, { value: { result: 3 } });
            await expect(triggerInspiringSmite(SMITE, { slotLevel: 1 }, stats, CAMPAIGN, MAP))
                .resolves.toEqual([{ result: 1 }, { result: 3 }]);
            expect(stamps).toHaveLength(1); // one cast, three passives, one token
            expect(seq.filter(s => s === 'stamp')).toHaveLength(1);

            results.push({ value: null }, { value: null }, { value: null });
            await expect(triggerInspiringSmite(SMITE, { slotLevel: 1 }, stats, CAMPAIGN, MAP))
                .resolves.toBeNull();
            expect(stamps).toHaveLength(2); // second cast re-armed
        });

        it('rethrows the identical handler Error after an exact-prefix log, stops the loop, and keeps the stamp (no rollback)', async () => {
            const err = new Error('handler failed');
            const stats = makeStats('Astra', [passive('Inspire 1'), passive('Inspire 2')]);
            // Only passive 1 is stubbed: if the loop kept going, the strict fake
            // throws 'beyond budget' and the identical-instance assertion fails.
            results.push({ reject: true, error: err });

            await expect(triggerInspiringSmite(SMITE, { slotLevel: 1 }, stats, CAMPAIGN, MAP))
                .rejects.toBe(err);
            expect(consoleSpy.mock.calls).toEqual([
                ['[inspiringSmite] Failed to execute inspiring smite for Inspire 1:', err],
            ]);
            expect(envelopes).toHaveLength(1); // passive 2 never dispatched
            // Token stays stamped: the CLA-200 latch equality is the backstop, this
            // lane must not roll the store back (rollback would re-arm a consumed cast).
            expect(stamps).toEqual([['Astra', 'inspiringSmiteCastToken', EPOCH, CAMPAIGN]]);
        });
    });
});
