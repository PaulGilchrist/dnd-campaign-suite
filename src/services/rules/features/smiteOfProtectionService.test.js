// @maintained-by-ai
// smiteOfProtectionService lane — post-cast DISPATCHER for Oath of Devotion's
// Smite of Protection (smiteOfProtectionService.js:1-49, 49-line body, REAL here;
// every consumer vi.mocks this module — 20+ spellCastService lanes stub it — so this
// file pins every branch itself per the sole-real-body-owner method #1350).
// Sole production caller: spellCastService/execution/index.js:525, fire-and-forget
// with .catch — the :44 rethrow is the only failure signal that lane sees; pinned
// below with the IDENTICAL Error instance + loop-stop (no second cover dispatched).
// spellUtils.isDivineSmite stays REAL (unmocked): the lowercase exact-name gate is
// proven through the real comparison with REAL disk near-miss names.
// Disk row (public/data/2024/classes.json, Paladin > Oath of Devotion > features[2],
// read 2026-10-21): name 'Smite of Protection', level 15, automation.type
// 'post_cast_smite_cover', casting_time 'passive'; RAW: "Whenever you cast Divine
// Smite, you and your allies have Half Cover while in your Aura of Protection until
// start of next turn." Class feature, not a spell — no spell slot row, no dice, no
// damage arithmetic in this lane (the half-cover buff is the handler's). Envelope
// type literal + 'passive' fallback mirror the disk bytes.
// Real passive shape (automationInfoBuilder/core-handlers.js:175-182):
// { type, name, casting_time, hasAutomation:true } — envelope drops hasAutomation
// and re-nests casting_time under automation; exact key-set arrays pinned below.
// Quirks pinned honestly: :18 inline-duplicates the exported spellUtils.js:7-9
// usesSpellSlot chokepoint (golden dup — OR-gate both faces exercised); :33 reads
// TOP-LEVEL smiteCover.casting_time with a `||` coercion (— '' and missing both
// collapse to 'passive', the disk byte; coercion-census member #1374/#1417 form);
// the :7 guard is nullish-only, so a non-array passives object falls through to the
// golden native TypeError on .filter outside any try (#1379 discipline); :48
// results.length===0 collapses to null (:0-swallow both-sides #1345); console tags
// are asymmetric between the two exports ('[smiteOfProtectionService]' at :7 vs
// '[smiteOfProtection]' at :43) — exact bytes pinned per #1327/#1388 precedent.
// Strict fake: executeHandler records FULL arg tuples and THROWS when dispatched
// beyond its explicit stub budget — 'never dispatches' claims are load-bearing, not
// count-zero vacuity (#1380/1405 budget discipline). No store import here (service
// touches no runtime keys — arming latch 'smiteOfProtectionActive' +
// remove_smite_of_protection te are smiteOfProtectionHandler.test.js's; expiry
// clear payloads #1285, clear types #1287 — cite-skip). NO-CLOCK clean: zero
// Date.now/setTimeout/setInterval in the body (grep-verified 2026-10-21); 'until
// start of next turn' expiry lives in the handler's addExpiration lane, not here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'test-campaign';
const MAP = 'testMap';

vi.mock('../../automation/index.js', () => ({ executeHandler: vi.fn() }));

import { executeHandler } from '../../automation/index.js';
import {
    getSmiteOfProtectionPassives,
    triggerSmiteOfProtection,
} from './smiteOfProtectionService.js';

// ── Recorder state (re-seeded explicitly every test; #1312 vitest-4 retains impls) ──
let calls;   // full executeHandler arg tuples [action, stats, campaign, map]
let budget;  // stub queue: { value } | { reject: true, error }

function strictExecuteHandler(...args) {
    calls.push(args);
    if (budget.length === 0) {
        throw new Error('executeHandler dispatched beyond stubbed budget');
    }
    const next = budget.shift();
    if (next.reject) return Promise.reject(next.error);
    return Promise.resolve(next.value);
}

function cover(name, castingTime) {
    const passive = { type: 'post_cast_smite_cover', name, casting_time: castingTime, hasAutomation: true };
    if (castingTime === undefined) delete passive.casting_time;
    return passive;
}

let consoleError;

beforeEach(() => {
    vi.resetAllMocks();
    calls = [];
    budget = [];
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    executeHandler.mockImplementation(strictExecuteHandler);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('smiteOfProtectionService', () => {
    describe('getSmiteOfProtectionPassives', () => {
        it('selects exactly the post_cast_smite_cover entries in order, by identity', () => {
            const coverA = cover('Smite of Protection', 'passive');
            const coverB = cover('Second Cover', '1 reaction');
            const passives = [
                { type: 'passive_buff', name: 'Aura of Protection' },
                coverA,
                { type: 'post_cast_inspiring_smite', name: 'Inspiring Smite' },
                coverB,
            ];
            const playerStats = { name: 'Paladin', automation: { passives } };

            const result = getSmiteOfProtectionPassives(playerStats);
            expect(result).toHaveLength(2);
            expect(result[0]).toBe(coverA);
            expect(result[1]).toBe(coverB);
            expect(passives).toHaveLength(4);
            expect(playerStats.automation.passives[0]).toEqual({ type: 'passive_buff', name: 'Aura of Protection' });

            const noCovers = { name: 'Cleric', automation: { passives: [{ type: 'passive_buff', name: 'Bless' }] } };
            expect(getSmiteOfProtectionPassives(noCovers)).toEqual([]);
        });

        it('nullish passives throw with exact bytes after console.error; object passives hit the golden unguarded TypeError; trigger propagates', async () => {
            expect(() => getSmiteOfProtectionPassives({ automation: { passives: null } }))
                .toThrow('Expected array, got null');
            expect(() => getSmiteOfProtectionPassives({ automation: {} }))
                .toThrow('Expected array, got undefined');
            expect(() => getSmiteOfProtectionPassives({}))
                .toThrow('Expected array, got undefined');
            expect(consoleError.mock.calls).toEqual([
                ['[smiteOfProtectionService] Missing array:', null],
                ['[smiteOfProtectionService] Missing array:', undefined],
                ['[smiteOfProtectionService] Missing array:', undefined],
            ]);

            // Guard is nullish-only: {} slips past it to the native .filter TypeError, console untouched.
            consoleError.mockClear();
            expect(() => getSmiteOfProtectionPassives({ automation: { passives: {} } })).toThrow(TypeError);
            expect(consoleError).not.toHaveBeenCalled();

            // The throw propagates through trigger (call at :22 is outside any try).
            const spell = { name: 'Divine Smite', level: 1 };
            await expect(triggerSmiteOfProtection(spell, { slotLevel: 1 }, {}, CAMPAIGN, MAP))
                .rejects.toThrow('Expected array, got undefined');
            expect(calls).toHaveLength(0);
            expect(consoleError.mock.calls).toEqual([
                ['[smiteOfProtectionService] Missing array:', undefined],
            ]);
        });

        it('nullish playerStats apex routes into the SAME loud arm — exact console bytes, throw not fabricated [] (#204-class)', async () => {
            // fix#179 refuse-no-fabricated-values twin of inspiringSmiteService: the file-owned
            // loud arm catches the nullish apex via `playerStats?.`; trigger propagates (:25 is
            // outside any try), and zero dispatch happens before the throw.
            expect(() => getSmiteOfProtectionPassives(undefined)).toThrow('Expected array, got undefined');
            expect(() => getSmiteOfProtectionPassives(null)).toThrow('Expected array, got undefined');
            expect(consoleError.mock.calls).toEqual([
                ['[smiteOfProtectionService] Missing array:', undefined],
                ['[smiteOfProtectionService] Missing array:', undefined],
            ]);
            await expect(triggerSmiteOfProtection({ name: 'Divine Smite', level: 1 }, { slotLevel: 1 }, undefined, CAMPAIGN, MAP))
                .rejects.toThrow('Expected array, got undefined');
            expect(consoleError).toHaveBeenCalledTimes(3);
            expect(calls).toHaveLength(0);
        });
    });

    describe('triggerSmiteOfProtection', () => {
        it('disk-path cast dispatches one envelope: full tuple, exact key sets, identity, no clone', async () => {
            const POPUP = { type: 'popup' };
            budget.push({ value: POPUP });
            const smiteCover = cover('Smite of Protection', 'passive');
            const playerStats = { name: 'Paladin', automation: { passives: [smiteCover] } };

            const result = await triggerSmiteOfProtection(
                { name: 'Divine Smite', level: 1 },
                { slotLevel: 1 },
                playerStats,
                CAMPAIGN,
                MAP,
            );

            expect(calls).toHaveLength(1);
            const [action, stats, campaign, mapName] = calls[0];
            expect(action).toEqual({
                name: 'Smite of Protection',
                automation: { type: 'post_cast_smite_cover', casting_time: 'passive' },
            });
            expect(Object.keys(action)).toEqual(['name', 'automation']);
            expect(Object.keys(action.automation)).toEqual(['type', 'casting_time']);
            expect(action.name).toBe(playerStats.automation.passives[0].name);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(CAMPAIGN);
            expect(mapName).toBe(MAP);
            expect(budget).toHaveLength(0);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(POPUP);
            expect(consoleError).not.toHaveBeenCalled();
        });

        it('dispatches covers sequentially in order; casting_time passes through or ||-collapses to passive; inputs unpolluted', async () => {
            const PASSIVE = { kind: 'passive-fallback' };
            const REACTION = { kind: 'reaction-passthrough' };
            const EMPTY = { kind: 'empty-coerced' };
            budget.push({ value: REACTION }, { value: PASSIVE }, { value: EMPTY });
            const passives = [
                cover('First Cover', '1 reaction'),
                cover('NoTime Cover'),
                cover('EmptyTime Cover', ''),
            ];
            const playerStats = { name: 'Paladin', automation: { passives } };

            const result = await triggerSmiteOfProtection(
                { name: 'Divine Smite', level: 1 },
                { slotLevel: 3 },
                playerStats,
                CAMPAIGN,
                MAP,
            );

            expect(calls).toHaveLength(3);
            expect(calls.map(c => [c[0].name, c[0].automation.casting_time])).toEqual([
                ['First Cover', '1 reaction'],
                ['NoTime Cover', 'passive'],
                ['EmptyTime Cover', 'passive'],
            ]);
            expect(result).toHaveLength(3);
            expect(result[0]).toBe(REACTION);
            expect(result[1]).toBe(PASSIVE);
            expect(result[2]).toBe(EMPTY);
            // input purity: the collector-shaped passives array is byte-identical after dispatch
            expect(passives).toEqual([
                { type: 'post_cast_smite_cover', name: 'First Cover', casting_time: '1 reaction', hasAutomation: true },
                { type: 'post_cast_smite_cover', name: 'NoTime Cover', hasAutomation: true },
                { type: 'post_cast_smite_cover', name: 'EmptyTime Cover', casting_time: '', hasAutomation: true },
            ]);
            expect(consoleError).not.toHaveBeenCalled();
        });

        it('every early-return face yields null with zero dispatch (real isDivineSmite against disk near-miss names, slot gate :0/negative/metaCtx-absent, empty covers)', async () => {
            const armedStats = () => ({ name: 'Paladin', automation: { passives: [cover('Smite of Protection', 'passive')] } });
            const faces = [
                [{ name: 'Improved Divine Smite', level: 1 }, { slotLevel: 2 }, armedStats()],
                [{ name: 'Searing Smite', level: 2 }, { slotLevel: 2 }, armedStats()],
                [{ name: 'Divine Smite ', level: 1 }, { slotLevel: 1 }, armedStats()],
                [{ level: 1 }, { slotLevel: 1 }, armedStats()],
                [{ name: 'Divine Smite', level: 0 }, { slotLevel: 0 }, armedStats()],
                [{ name: 'Divine Smite', level: 0 }, undefined, armedStats()],
                [{ name: 'Divine Smite', level: 0 }, {}, armedStats()],
                [{ name: 'Divine Smite', level: 0 }, { slotLevel: -1 }, armedStats()],
                [{ name: 'Divine Smite', level: 1 }, { slotLevel: 1 }, { name: 'Paladin', automation: { passives: [] } }],
            ];

            for (const [spell, metaCtx, playerStats] of faces) {
                const result = await triggerSmiteOfProtection(spell, metaCtx, playerStats, CAMPAIGN, MAP);
                expect(result).toBeNull();
            }
            expect(calls).toHaveLength(0);
            expect(budget).toHaveLength(0);
        });

        it('gate fires on case-insensitive exact name and on each OR slot face independently', async () => {
            const A = { seq: 'a' };
            const B = { seq: 'b' };
            const C = { seq: 'c' };
            budget.push({ value: A }, { value: B }, { value: C });
            const stats = () => ({ name: 'Paladin', automation: { passives: [cover('Smite of Protection', 'passive')] } });

            expect(await triggerSmiteOfProtection({ name: 'divine smite', level: 1 }, { slotLevel: 1 }, stats(), CAMPAIGN, MAP)).toEqual([A]);
            expect(await triggerSmiteOfProtection({ name: 'DIVINE SMITE', level: 0 }, { slotLevel: 3 }, stats(), CAMPAIGN, MAP)).toEqual([B]);
            // spell-level face alone: metaCtx missing entirely
            expect(await triggerSmiteOfProtection({ name: 'Divine Smite', level: 1 }, undefined, stats(), CAMPAIGN, null)).toEqual([C]);

            expect(calls).toHaveLength(3);
            expect(calls[2][3]).toBeNull();
            expect(consoleError).not.toHaveBeenCalled();
        });

        it('handler rejection: identical Error rethrown with exact console bytes, loop stops before next cover', async () => {
            const ERR = new Error('handler exploded');
            budget.push({ reject: true, error: ERR });
            const playerStats = {
                name: 'Paladin',
                automation: { passives: [cover('First Cover', 'passive'), cover('Second Cover', 'passive')] },
            };

            await expect(triggerSmiteOfProtection(
                { name: 'Divine Smite', level: 1 },
                { slotLevel: 1 },
                playerStats,
                CAMPAIGN,
                MAP,
            )).rejects.toBe(ERR);

            expect(calls).toHaveLength(1);
            expect(budget).toHaveLength(0);
            expect(consoleError).toHaveBeenCalledTimes(1);
            expect(consoleError.mock.calls[0][0]).toBe('[smiteOfProtection] Failed to execute smite cover for First Cover:');
            expect(consoleError.mock.calls[0][1]).toBe(ERR);
        });

        it('null handler results are swallowed: all-null pool collapses to null, survivors kept by identity', async () => {
            const stats = () => ({ name: 'Paladin', automation: { passives: [cover('Smite of Protection', 'passive')] } });
            budget.push({ value: null });

            expect(await triggerSmiteOfProtection({ name: 'Divine Smite', level: 1 }, { slotLevel: 1 }, stats(), CAMPAIGN, MAP)).toBeNull();
            expect(calls).toHaveLength(1);

            const POPUP = { type: 'popup' };
            budget.push({ value: null }, { value: POPUP });
            const twoCoverStats = {
                name: 'Paladin',
                automation: { passives: [cover('Null Cover', 'passive'), cover('Popup Cover', 'passive')] },
            };
            const result = await triggerSmiteOfProtection({ name: 'Divine Smite', level: 1 }, { slotLevel: 1 }, twoCoverStats, CAMPAIGN, MAP);

            expect(result).toHaveLength(1);
            expect(result[0]).toBe(POPUP);
            expect(calls).toHaveLength(3);
        });
    });
});
