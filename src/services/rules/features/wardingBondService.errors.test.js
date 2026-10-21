// @maintained-by-ai
// LANE: this .errors file owns ONLY the failure arms of applyWardingBond's collaborator
// call sites — which collaborator fails, which arm catches, and what state is stranded
// when it does. The family map (six faces, verified by header scan):
//   .test.js        — buff-lookup gates (:57-62), distance gate/end (:67-75), SP-125 envelopes
//   .damage.test.js — HP arithmetic (:22-30), full hp_change envelope VALUES (:37-46),
//                     both caster-HP read paths (:77-80), caster-hp-0 gate (:81)
//   .concentration  — dc stamp VALUES (:47-49), lethal-end census, em-dash byte
//   .log            — hp_change payload/message bytes field-by-field
//   .edgeCases      — '-0' delta, negative damage, NaN poison, multi-buff first-match
//   .errors (HERE)  — addEntry-rejection console arms, throw-vs-reject discrimination,
//                     rollback-free partial-state pins, fire-and-forget store hazards.
// This lane never byte-audits envelope VALUES (keys + one composition byte per row are
// path discriminators, not envelope faces). Prefixes are copied byte-exact from source:
//   '[wardingBond] Error:'            -> wardingBondService.js:46 (hp_change .catch)
//   '[wardingBond] Break log error:'  -> wardingBondService.js:19 (ability_use .catch)
// This is the ONLY lane that exercises the break prefix; the concentration sibling
// (:12) cites '.errors — addEntry rejection console.error' — PRESERVED.
//
// COLLABORATOR-FAILURE OWNERSHIP TABLE (arms verified against source; service contains
// ZERO try/catch — grep 'try' on the source returns only imports/catch-method lines):
// | collaborator                | site            | failure shape          | arm                          |
// | addEntry (hp_change)      | service :37-46  | Promise rejection      | .catch :46 -> console '[wardingBond] Error:' (microtask, NOT sync) |
// | addEntry (ability_use)    | service :13-19  | Promise rejection      | .catch :19 -> console '[wardingBond] Break log error:' |
// | addEntry                  | :37 / :13       | SYNCHRONOUS throw      | native throw through applyWardingBond; console UNTOUCHED (#1360 golden) |
// | getRuntimeValue           | :57/:7/:10/:32/:34/:79 | sync throw | native throw; nothing logged, nothing written |
// | getDistanceFeet           | :67             | sync throw             | native throw (real rangeCheck.js is unmocked — true-table guard) |
// | setRuntimeValue           | :9/:12/:27      | sync throw           | native throw; write ATTEMPT recorded, no rollback, no console |
// | setRuntimeValue           | :27             | rejection (fire-and-forget, result NEVER consumed — no .catch in service) | SOURCE HOLE (report-only): unhandled-rejection hazard. Pinned reject-free: the test fake attaches its own noop .catch so the suite stays green while proving the service never inspects the result — console census stays empty and the store stays on the OLD HP while the log reports the NEW one (stranded optimistic state #1382). |
//
// FALSIFYING PAIRS #1297 (rejection does NOT abort the mirror):
// - hp_change rejects -> caster HP already mutated (:29 in-place) / already written
//   (:27 store), post-log steps still run (concentration dc stamp :47-49, lethal
//   endWardingBond :51-53 — break log still ATTEMPTED).
// - break log rejects -> BOTH buff-strip writes (:9/:12) already landed byte-exact;
//   zero rollback, and no retry after flush (NO-CLOCK below).
// Caller boundary (applyDamage.js:804, inside handleWardedDamageEvents, 'do not
// reorder' sequence): applyWardingBond is sync-void and returns undefined even when
// logs reject — rejections are fully swallowed at :19/:46 and never surface across
// :804. A SYNCHRONOUS collaborator throw, by contrast, propagates natively across
// :804 and truncates every downstream event in that sequence — pinned by row 4.
//
// DETERMINISM #1312: vi.clearAllMocks (vitest-4 RETAINS implementations) + every row
// re-seeds resolve-vs-reject EXPLICITLY via fakeAddEntry/seedStore — rejection stubs
// never leak across rows; no mockReturnValueOnce chains. console.error spy restored
// in afterEach.
// STANDARDS: argument-keyed STATEFUL store fake throws on unknown owner|key, wrong
// campaign, arity drift (get=3, set=4 — a 5th skipSync arg THROWS, #1341 position
// audit: this service writes exactly 4 args); addEntry fake throws on arity != 2 or
// wrong campaign; read-order + write-budget EXACT censuses; console censuses are full
// [prefix, Error-instance] tuples with toBe identity — no stringContaining, no bare
// toHaveBeenCalled()/objectContaining/expect.any on any log/mutation claim; input
// purity #1395 (target creature snapshot).
// FLUSH: the only async legs are the two floating .catch arms (:19/:46) — real
// Promises reject in microtasks; fixed 20-tick drain is the complete bounded flush
// (#1401 form). NO-CLOCK: grep setTimeout/setInterval on the service = ZERO hits
// (verified live this pass); rejection paths schedule no retry — addEntry census
// never grows after flush, asserted per row. The only Date.now() (:18) is the break
// log stamp — pinned here only as the 'timestamp' KEY sentinel, never byte-read.
// QUIRK SCAN (cite, don't re-test): :73-75 second isDistanceInRange guard is dead
// code (edgeCases header); :33 '(casterCreature.maxHp || 10)' silent-zero fallback
// and the :0-swallow duty live in the damage/edgeCases lanes. Golden ERROR-shaped
// inputs that reach THIS face: rejected Promises and synchronous throws from
// collaborators — the shapes no sibling injects.
// ZERO-DICE: no RNG in this module; damage arrives pre-rolled. Nothing to stub.
// MARKER INCIDENT #1361: exactly one marker, this line.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyWardingBond } from './wardingBondService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

const CAMPAIGN = 'TestCampaign';
const HP_PREFIX = '[wardingBond] Error:';
const BREAK_PREFIX = '[wardingBond] Break log error:';

// Exact key-sets copied from source literal order (:37-46 / :13-18). Values are the
// damage/log lanes' face; key census here only identifies WHICH entry each arm saw.
const HP_KEYS = ['type', 'targetName', 'delta', 'currentHp', 'maxHp', 'isHealing', 'isUnconscious', 'abilityName'];
const BREAK_KEYS = ['type', 'characterName', 'abilityName', 'description', 'timestamp'];

// Complete bounded microtask flush (fixed ticks; no timers exist in the service).
const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

// Argument-keyed STATEFUL store fake. Throws on unknown owner|key, wrong campaign,
// arity drift (get=3/set=4). writeOverrides inject per-'owner|key' behavior AFTER
// the write attempt is recorded: () => Promise|throw. Same fake shape as the
// maintained siblings/.damage lane so the family behaves identically under audit.
function seedStore(initial, writeOverrides = {}) {
    const data = new Map(Object.entries(initial));
    const reads = [];
    const writes = [];
    getRuntimeValue.mockImplementation(function (owner, key, campaign) {
        if (arguments.length !== 3) {
            throw new Error(`getRuntimeValue arity drift: ${arguments.length} args`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`getRuntimeValue wrong campaign: ${campaign}`);
        }
        const k = `${owner}|${key}`;
        reads.push(k);
        if (!data.has(k)) {
            throw new Error(`unexpected read getRuntimeValue('${owner}', '${key}')`);
        }
        return data.get(k);
    });
    setRuntimeValue.mockImplementation(function (owner, key, value, campaign) {
        if (arguments.length !== 4) {
            throw new Error(`setRuntimeValue arity drift: ${arguments.length} args`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`setRuntimeValue wrong campaign: ${campaign}`);
        }
        writes.push([owner, key, value]);
        const override = writeOverrides[`${owner}|${key}`];
        if (override) return override();
        data.set(`${owner}|${key}`, value);
    });
    return { reads, writes, data };
}

// addEntry fake with REAL Promise semantics (the retired thenable stub fired .catch
// synchronously on success paths — a mis-model this lane deletes). Types listed in
// rejectByType reject with the given (distinct, identity-tagged) Error instance;
// all other types resolve.
function fakeAddEntry(rejectByType = {}) {
    addEntry.mockImplementation(function (campaign, entry) {
        if (arguments.length !== 2) {
            throw new Error(`addEntry arity drift: ${arguments.length} args`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`addEntry wrong campaign: ${campaign}`);
        }
        if (rejectByType[entry.type]) {
            return Promise.reject(rejectByType[entry.type]);
        }
        return Promise.resolve();
    });
}

// addEntry attempt census: [campaign, entry type, exact key-set] — no values, no
// objectContaining, full census (vacuity guard #1385).
const logAttempts = () => addEntry.mock.calls.map(([campaign, entry]) => [campaign, entry.type, Object.keys(entry)]);

function bondBuff(sourceCharacter) {
    return [{ effect: 'warding_bond', sourceCharacter }];
}

function expectNativeThrow(fn, err) {
    let thrown;
    try {
        fn();
    } catch (e) {
        thrown = e;
    }
    expect(thrown).toBe(err); // same instance crosses :804 untouched by any catch
}

describe('wardingBondService errors lane — addEntry rejection console arms and collaborator failure discrimination', () => {
    let consoleError;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('hp_change rejection logs exactly one prefixed console leg in a MICROTASK while every synchronous mutation stays rolled-in', async () => {
        // NPC caster in the summary: :29 mutates in place BEFORE the rejecting log (:37).
        const casterPos = { x: 0, y: 0 };
        const targetPos = { x: 4, y: 0 };
        const caster = { name: 'Paladin', type: 'monster', currentHp: 30, maxHp: 30, position: casterPos, concentration: { dc: 10 } };
        const goblin = { name: 'Goblin', position: targetPos };
        const goblinSnapshot = JSON.parse(JSON.stringify(goblin));
        const store = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });
        const errH = new Error('log failure');
        getDistanceFeet.mockReturnValue(30);
        fakeAddEntry({ hp_change: errH });

        const ret = applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 25);
        expect(ret).toBeUndefined(); // sync-void across applyDamage.js:804

        // Synchronous census: the rejection is NOT yet observable — the retired stub
        // called .catch handlers synchronously; a real Promise cannot.
        expect(consoleError.mock.calls).toEqual([]);
        expect(logAttempts()).toEqual([[CAMPAIGN, 'hp_change', HP_KEYS]]);
        expect(getDistanceFeet.mock.calls).toEqual([[casterPos, targetPos]]);
        // Falsifying half #1297: first log throws-ish (rejects), mirror state stands.
        expect(caster.currentHp).toBe(5);
        expect(JSON.parse(JSON.stringify(goblin))).toEqual(goblinSnapshot); // input purity #1395
        expect(store.writes).toEqual([]); // NPC path never writes the store
        expect(store.reads).toEqual(['Goblin|activeBuffs']);
        // Post-log steps still run despite the pending rejection (:47-49 order sentinel).
        expect(caster.concentration.dc).toBe(12);

        await flush();
        expect(consoleError.mock.calls).toEqual([[HP_PREFIX, errH]]);
        expect(consoleError.mock.calls[0][1]).toBe(errH); // identical instance #1385
        expect(addEntry.mock.calls.length).toBe(1); // no retry after rejection (NO-CLOCK)
    });

    it('lethal mirror with BOTH logs rejecting: console census is [mirror, break] in source order; HP write and both buff strips are rollback-free', async () => {
        // Player caster: store-write path (:27) + lethal end (:51-53) exercising both
        // prefixes in one flow — the only row that pins the :19 break prefix pairing.
        const caster = { name: 'Paladin', type: 'player', position: { x: 0, y: 0 } };
        const goblin = { name: 'Goblin', position: { x: 1, y: 0 } };
        const store = seedStore({
            'Goblin|activeBuffs': bondBuff('Paladin'),
            'Paladin|currentHitPoints': 4,
            'Paladin|maxHitPoints': 12,
            'Paladin|concentration': null,
            'Paladin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Goblin' }, { effect: 'bless' }],
        });
        const errH = new Error('mirror log failure');
        const errB = new Error('break log failure');
        getDistanceFeet.mockReturnValue(30);
        fakeAddEntry({ hp_change: errH, ability_use: errB });

        applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 4);

        // Synchronous census: two entries attempted, in source order; console still empty.
        expect(logAttempts()).toEqual([
            [CAMPAIGN, 'hp_change', HP_KEYS],
            [CAMPAIGN, 'ability_use', BREAK_KEYS],
        ]);
        expect(consoleError.mock.calls).toEqual([]);
        // Exact read-order census: gate -> share reads -> end reads.
        expect(store.reads).toEqual([
            'Goblin|activeBuffs',
            'Paladin|currentHitPoints',
            'Paladin|maxHitPoints',
            'Paladin|concentration',
            'Goblin|activeBuffs',
            'Paladin|activeBuffs',
        ]);
        // Zero-rollback proof #1382: HP 0 + both strips landed byte-exact BEFORE the
        // rejections even settle; the bond cannot survive the break-log failure.
        expect(store.writes).toEqual([
            ['Paladin', 'currentHitPoints', 0],
            ['Goblin', 'activeBuffs', []],
            ['Paladin', 'activeBuffs', [{ effect: 'bless' }]],
        ]);

        await flush();
        expect(consoleError.mock.calls).toEqual([
            [HP_PREFIX, errH],
            [BREAK_PREFIX, errB],
        ]);
        expect(consoleError.mock.calls[0][1]).toBe(errH);
        expect(consoleError.mock.calls[1][1]).toBe(errB);
        expect(addEntry.mock.calls.length).toBe(2);
        expect(store.writes.length).toBe(3); // no retry, no extra strip (NO-CLOCK)
    });

    it('distance-end rejection: only the break prefix fires; mirror lane is never attempted and strips stay landed', async () => {
        // :69-71 gate path into endWardingBond — a second, gate-shaped route to the
        // same :19 arm, proving the reject arm is per-entry not per-call-site-order.
        const caster = { name: 'Paladin', type: 'monster', currentHp: 10, maxHp: 10, position: { x: 0, y: 0 } };
        const goblin = { name: 'Goblin', position: { x: 61, y: 0 } };
        const store = seedStore({
            'Goblin|activeBuffs': bondBuff('Paladin'),
            'Paladin|activeBuffs': [{ effect: 'warding_bond', sourceCharacter: 'Goblin' }, { effect: 'bless' }],
        });
        const errB = new Error('break log failure');
        getDistanceFeet.mockReturnValue(61); // real (unmocked) rangeCheck rejects 61>60
        fakeAddEntry({ ability_use: errB });

        applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 5);

        expect(getDistanceFeet).toHaveBeenCalledTimes(1);
        expect(logAttempts()).toEqual([[CAMPAIGN, 'ability_use', BREAK_KEYS]]); // hp_change NEVER attempted
        expect(caster.currentHp).toBe(10); // mirror skipped entirely — caster untouched
        expect(store.reads).toEqual(['Goblin|activeBuffs', 'Goblin|activeBuffs', 'Paladin|activeBuffs']);
        expect(store.writes).toEqual([
            ['Goblin', 'activeBuffs', []],
            ['Paladin', 'activeBuffs', [{ effect: 'bless' }]],
        ]);
        expect(consoleError.mock.calls).toEqual([]);

        await flush();
        expect(consoleError.mock.calls).toEqual([[BREAK_PREFIX, errB]]);
        expect(consoleError.mock.calls[0][1]).toBe(errB);
    });

    it('synchronous throws from any collaborator propagate NATIVELY across :804 — console untouched on every arm (#1360 golden form)', async () => {
        const casterPos = { x: 0, y: 0 };
        const targetPos = { x: 4, y: 0 };

        // A) bond read :57 throws: first line of the function; nothing has run.
        const errA = new Error('store read down');
        getRuntimeValue.mockImplementation(() => { throw errA; });
        fakeAddEntry({});
        expectNativeThrow(() => applyWardingBond({ name: 'Goblin', position: targetPos }, { creatures: [] }, CAMPAIGN, 5), errA);
        expect(addEntry.mock.calls).toEqual([]);
        vi.clearAllMocks();

        // B) getDistanceFeet :67 throws: gate read succeeded, distance never returns.
        const errB = new Error('distance down');
        const storeB = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });
        getDistanceFeet.mockImplementation(() => { throw errB; });
        fakeAddEntry({});
        expectNativeThrow(() => applyWardingBond({ name: 'Goblin', position: targetPos }, { creatures: [{ name: 'Paladin', type: 'monster', currentHp: 10, position: casterPos }, { name: 'Goblin', position: targetPos }] }, CAMPAIGN, 5), errB);
        expect(storeB.reads).toEqual(['Goblin|activeBuffs']);
        expect(storeB.writes).toEqual([]);
        expect(addEntry.mock.calls).toEqual([]);
        vi.clearAllMocks();

        // C) setRuntimeValue HP write :27 throws: attempt recorded, log never reached (:37 sits after :27).
        const errC = new Error('hp write down');
        const storeC = seedStore(
            {
                'Goblin|activeBuffs': bondBuff('Paladin'),
                'Paladin|currentHitPoints': 4,
                'Paladin|maxHitPoints': 12,
                'Paladin|concentration': null,
            },
            { 'Paladin|currentHitPoints': () => { throw errC; } },
        );
        getDistanceFeet.mockReturnValue(30); // clearAllMocks RETAINS impls — re-seed after row B's throw
        fakeAddEntry({});
        expectNativeThrow(() => applyWardingBond({ name: 'Goblin', position: targetPos }, { creatures: [{ name: 'Paladin', type: 'player', position: casterPos }, { name: 'Goblin', position: targetPos }] }, CAMPAIGN, 4), errC);
        expect(storeC.writes).toEqual([['Paladin', 'currentHitPoints', 0]]); // stranded attempt, no rollback possible
        expect(storeC.data.get('Paladin|currentHitPoints')).toBe(4); // store still OLD value
        expect(addEntry.mock.calls).toEqual([]);
        vi.clearAllMocks();

        // D) addEntry throws SYNCHRONOUSLY (:37): the golden throw-vs-reject
        // discriminator — the .catch chain is never constructed, console untouched,
        // yet the :29 in-place HP mutation is already rolled in.
        const errD = new Error('log service exploded');
        const caster = { name: 'Paladin', type: 'monster', currentHp: 30, maxHp: 30, position: casterPos, concentration: null };
        const goblin = { name: 'Goblin', position: targetPos };
        seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });
        getDistanceFeet.mockReturnValue(30);
        addEntry.mockImplementation(() => { throw errD; });
        expectNativeThrow(() => applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 25), errD);
        expect(caster.currentHp).toBe(5);

        await flush();
        expect(consoleError.mock.calls).toEqual([]); // zero console bytes across ALL four native arms
    });

    it('fire-and-forget setRuntimeValue rejection is invisible: service never consumes the result, logs optimistic HP over a stranded old store byte', async () => {
        // SOURCE HOLE (report-only, #1401 class): setRuntimeValue at :27 is
        // fire-and-forget with NO .catch — a rejection is unhandled in production.
        // The fake attaches its own noop .catch so this suite stays rejection-free
        // while pinning that the service itself never observes the failure.
        const errS = new Error('hp write rejected');
        const caster = { name: 'Paladin', type: 'player', position: { x: 0, y: 0 } };
        const goblin = { name: 'Goblin', position: { x: 1, y: 0 } };
        const store = seedStore(
            {
                'Goblin|activeBuffs': bondBuff('Paladin'),
                'Paladin|currentHitPoints': 10,
                'Paladin|maxHitPoints': 20,
                'Paladin|concentration': null,
            },
            {
                'Paladin|currentHitPoints': () => {
                    const p = Promise.reject(errS);
                    p.catch(() => { }); // test-side suppressant; production has none
                    return p;
                },
            },
        );
        fakeAddEntry({});
        getDistanceFeet.mockReturnValue(30);

        applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 3);

        // Mirror continued past the failed write: hp_change attempted with optimistic
        // bytes 7/-3 while the store stays at 10 (stranded optimistic state #1382).
        expect(logAttempts()).toEqual([[CAMPAIGN, 'hp_change', HP_KEYS]]);
        expect(addEntry.mock.calls[0][1]).toMatchObject({ currentHp: 7, delta: -3 });
        expect(store.data.get('Paladin|currentHitPoints')).toBe(10);

        await flush();
        expect(consoleError.mock.calls).toEqual([]); // error never surfaces — silent by source shape
    });

    it('reject-then-succeed compose: a rejected addEntry poisons no latch — the bond survives and the second call mirrors again (#1307)', async () => {
        const caster = { name: 'Paladin', type: 'monster', currentHp: 30, maxHp: 30, position: { x: 0, y: 0 }, concentration: null };
        const goblin = { name: 'Goblin', position: { x: 4, y: 0 } };
        const store = seedStore({ 'Goblin|activeBuffs': bondBuff('Paladin') });
        const buffRef = store.data.get('Goblin|activeBuffs');
        const err1 = new Error('first log failure');
        getDistanceFeet.mockReturnValue(30);
        let attempts = 0;
        addEntry.mockImplementation(function (campaign, entry) {
            if (campaign !== CAMPAIGN || entry.type !== 'hp_change') {
                throw new Error(`compose row: unexpected log ${campaign}/${entry.type}`);
                }
            attempts += 1;
            return attempts === 1 ? Promise.reject(err1) : Promise.resolve();
        });

        applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 5);
        await flush();
        expect(consoleError.mock.calls).toEqual([[HP_PREFIX, err1]]);
        expect(caster.currentHp).toBe(25);
        expect(store.data.get('Goblin|activeBuffs')).toBe(buffRef); // no latch strip, same live array
        expect(store.data.get('Goblin|activeBuffs')).toEqual(bondBuff('Paladin'));

        applyWardingBond(goblin, { creatures: [caster, goblin] }, CAMPAIGN, 5);
        await flush();
        // Second call fully processed: fresh mirror, second envelope currentHp byte 20
        // is the compose discriminator (cross-call state), not an envelope face.
        expect(getDistanceFeet).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls.length).toBe(2);
        expect(addEntry.mock.calls[1][1].currentHp).toBe(20);
        expect(caster.currentHp).toBe(20);
        expect(consoleError.mock.calls).toEqual([[HP_PREFIX, err1]]); // exactly ONE leg total — resolved log adds none
        expect(store.reads).toEqual(['Goblin|activeBuffs', 'Goblin|activeBuffs']);
    });
});
