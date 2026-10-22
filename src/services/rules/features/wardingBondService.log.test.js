// @maintained-by-ai
// LANE: this .log file owns ONLY the SUCCESS-path (settled) log payloads of
// wardingBondService.js — every addEntry call that fires when the collaborator
// resolves. Sole settled entry on this face: hp_change (:37-46), field-by-field
// byte pairing: campaign arg byte, entry-type key, the targetName slot carrying the
// CASTER's name (not the struck creature's — the counterintuitive byte), the
// hardcoded abilityName literal, and the maxHp slot's SOURCE (in-summary creature
// vs live store read) proven by decoy bytes. Family map (verified by header scan):
//   .test.js        — buff-lookup gates (:57-62), distance gate/end (:67-75),
//                    SP-125 end envelopes, separation-end description stringContaining
//   .concentration  — dc stamp VALUES (:47-49), lethal-end census + em-dash byte
//                    'Warding Bond ends — Paladin dropped to 0 hit points.' (:17 :52),
//                    Date.now() :18 end-entry sentinel (#1428) — end-entry payloads are
//                    NOT re-homed here; this lane never reaches :18 (non-terminal rows)
//   .damage.test.js — HP arithmetic (:22-30), full hp_change numeric envelopes as
//                    arithmetic outputs (:134-142, :170-179, :233-242), delta=actual-loss
//                    clamp quirk (:40), store-wins, caster-hp-0 gate (:81)
//   .edgeCases      — '-0' delta artifact, #1427 FIXED verdict rows: negative damage
//                    loud-refused (never heals — old heal bytes 5/-10->15 captured
//                    pre-fix in the #1427 record), NaN/null invalid inputs loud-refused
//                    at the entry gate (fix#39/fix#5 shapes), sign-convention compliance
//                    rows (isHealing derived from delta), multi-buff first-match
//   .errors         — addEntry REJECTION console arms: '[wardingBond] Error:' (:46)
//                    and '[wardingBond] Break log error:' (:19), rejection-console
//                    ownership (#1382/#1385/#1388/#1428) — cited, never cloned here.
// STUB REC EXECUTED (#1428 live rec, verbatim: 'Stale { catch: fn => fn() }
// success-path-fires-catch stub persists in ... wardingBondService.log.test.js:13'):
// the fake-thenable is GONE. addEntry is re-seeded mockResolvedValue(undefined) per
// test (#1312 vi.resetAllMocks strips vitest-4 retained implementations) — a REAL
// Promise: the service's floating .catch (:46) settles in a microtask and NEVER fires
// its console handler on the success path. Bounded microtask flush (10 ticks,
// #1401 form) before every console census; reason: real floating .catch needs one
// microtask drain to settle — the flush itself is the proof (a fake thenable fired
// synchronously, so the OLD lane would have logged '[wardingBond] Error:' with
// undefined on every success and stayed silent only because it never censused
// console). Rejection coverage = cite .errors, do not re-implement.
// DISK TRUTH (#1408 anti-phantom): logService.js read from disk this pass —
// addEntry is `async function addEntry(campaignName, entry)` (arity 2, returns
// response.json()). Arity-2 census pinned below against the real signature.
// QUIRK SCAN (this face's verdicts): (1) #1427 positive-delta isHealing:false heal
// path — FIXED at the service entry gate (negative/NaN now loud-refused before any
// addEntry), and isHealing is now DERIVED `delta > 0` (canonical CharHitPoints.jsx:35
// law; renderer polarity fix#49 LogHpHealingEntry.jsx:90-91). This lane only ever
// feeds POSITIVE damage, so its settled hp_change bytes are unchanged: negative delta
// + isHealing:false stays sign-honest. (2) NaN-poison: refused loud — .edgeCases —
// cited. (3) zero-shape 'still emits' (0-damage log, #1427 fourth arm): .edgeCases —
// cited. (4) golden unguarded-deref: N/A on settled rows — every field resolves
// defined here; the throwing store fake is the unexpected-read guard.
// NO-CLOCK: zero timers, zero Date.now() gates on this face; hp_change entries carry
// NO timestamp key (:37-46), so full-set toEqual is deterministic with no fake-timer
// freeze (the only Date.now(), :18, is the break-log stamp owned by .concentration's
// #1428 sentinel — never byte-read here).
// ZERO-DICE: damage arrives pre-rolled as the wardDamage parameter (:56->:82->:23);
// no RNG in this service, nothing to stub.
// DISTINGUISHABLE FIXTURES (#1348, family-wide): siblings use 10/7/3, 26/52/16,
// 100/200/55, 5/-3->8, 20, 25, 17, 40, 999, 30 and names Paladin/Goblin/Sprite/
// Wizard. This lane uses NEW bytes only: caster 18/24 dmg 9->9 (NPC lane), caster
// store 19/23 decoy-summary 77/21 dmg 13->6 (player lane), distance 42; names
// Seraphine/Grix/Kestrel/Harsk — cross-lane byte collisions are impossible and the
// cited faces stay greppable.
// INTERPOLATION KILL-LITERALS (#1422/#1412 method): caster name != target name in
// every row, so the targetName slot cannot pass by fixture coincidence — it must
// carry the CASTER byte ('Seraphine'/'Kestrel') and provably NOT the struck
// creature's ('Grix'/'Harsk'). abilityName is a service-owned literal (:45), pinned
// as the exact string on fixtures whose names share no substring with it.
// STANDARDS: argument-keyed STATEFUL store fake THROWS on unknown owner|key, wrong
// campaign, arity drift (get=3/set=4) (#1372/#1393/#1400/#1425/#1426/#1428);
// read-order exact censuses (#1372); vi.resetAllMocks + explicit re-seed per test
// (#1312); console.error spy restored afterEach; no objectContaining / expect.any /
// find-truthy / bare toHaveBeenCalled() on payload claims (#1419/#1421/#1424 bar —
// full-set toEqual with exact key-set instead); input purity #1395 (target snapshot);
// survivor-never-logged #1327 (bystander in summary, zero entries name it);
// suite-name-vs-behavior #1423; synchronous service form kept synchronous except the
// bounded flush (#1426/#1401). MARKER INCIDENT #1361: exactly one marker, this line.
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

const campaignName = 'TestCampaign';

// Settled-path hp_change payload key-set, copied byte-exact from service :37-46.
// No timestamp/description/detail keys exist on this entry — exact-set census.
const HP_KEYS = ['type', 'targetName', 'delta', 'currentHp', 'maxHp', 'isHealing', 'isUnconscious', 'abilityName'];

// Argument-keyed STATEFUL store fake. Throws on unknown owner|key, wrong campaign,
// or arity drift at this service's call sites (getRuntimeValue/3, setRuntimeValue/4).
// Same fake shape as the sibling .damage/.concentration lanes so the family behaves
// identically under audit.
function seedStore(initial) {
    const data = new Map(Object.entries(initial));
    const reads = [];
    const writes = [];
    getRuntimeValue.mockImplementation(function (owner, key, campaign) {
        if (arguments.length !== 3) {
            throw new Error(`getRuntimeValue arity drift: ${arguments.length} args`);
        }
        if (campaign !== campaignName) {
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
        if (campaign !== campaignName) {
            throw new Error(`setRuntimeValue wrong campaign: ${campaign}`);
        }
        writes.push([owner, key, value]);
        data.set(`${owner}|${key}`, value);
    });
    return { reads, writes, data };
}

function bondBuff(casterName) {
    return [{ effect: 'warding_bond', sourceCharacter: casterName }];
}

// Bounded microtask flush (#1401 form): the service is synchronous; ONLY the two
// floating .catch arms (:19/:46) are async, and a REAL resolved Promise settles its
// .catch in one microtask. Ten ticks is a generous fixed bound — no timers, no
// polling loop (NO-CLOCK). After the flush, a clean console census PROVES the
// success path never fired either catch handler (the retired fake-thenable stub
// fired catch synchronously on success — this is the byte-level discrimination).
const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('wardingBondService log lane — settled hp_change payload bytes', () => {
    let consoleError;

    beforeEach(() => {
        // vitest 4: resetAllMocks strips implementations retained by clearAllMocks —
        // every fake is re-seeded explicitly (#1312, no stub leakage across rows).
        vi.resetAllMocks();
        // REAL Promise semantics (stub rec #1428): resolves — the service's floating
        // .catch (:46) must settle in a microtask WITHOUT invoking its handler.
        addEntry.mockResolvedValue(undefined);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    it('NPC caster hit: one hp_change entry, campaign byte, caster name in the target slot, exact key-set, clean console after flush', async () => {
        // Seraphine (NPC caster, in-summary) wards Grix (struck target).
        // The counterintuitive payload byte: targetName carries the CASTER ('Seraphine'),
        // never the struck creature — kill-literal via distinct names (#1422 method).
        // Fresh fixture bytes (18/24, dmg 9): zero collision with sibling lanes (#1348).
        getDistanceFeet.mockReturnValue(42); // 42 <= 60: in-range; distance face is .test.js
        const casterPos = { q: 1, r: 2 };
        const targetPos = { q: 3, r: 4 };
        const seraphine = { name: 'Seraphine', currentHp: 18, maxHp: 24, position: casterPos };
        const grix = { name: 'Grix', position: targetPos };
        const bystander = { name: 'Harsk', currentHp: 22, maxHp: 22 }; // survivor-never-logged #1327
        const grixSnapshot = JSON.parse(JSON.stringify(grix)); // input purity #1395
        const { reads, writes } = seedStore({ 'Grix|activeBuffs': bondBuff('Seraphine') });

        applyWardingBond(grix, { creatures: [seraphine, grix, bystander] }, campaignName, 9);

        await flushMicrotasks();

        // Call census: exactly ONE addEntry, arity 2 vs disk signature
        // addEntry(campaignName, entry), campaign byte in arg 0.
        expect(addEntry.mock.calls).toHaveLength(1);
        const [campaignArg, entry] = addEntry.mock.calls[0];
        expect(addEntry.mock.calls[0]).toHaveLength(2);
        expect(campaignArg).toBe(campaignName);

        // Exact key-set: no timestamp (deterministic without a fake-timer freeze),
        // no description/message/free-text field on hp_change (:37-46 disk truth).
        expect(Object.keys(entry)).toEqual(HP_KEYS);

        // Full-set payload, byte-by-byte:
        expect(entry).toEqual({
            type: 'hp_change',                 // entry-type key literal (:38)
            targetName: 'Seraphine',          // CASTER byte, not 'Grix' (:39)
            delta: -9,                        // -(18 - 9): raw damage sign (:40)
            currentHp: 9,                     // post-mirror HP (:41)
            maxHp: 24,                        // from in-summary creature (NPC path :33)
            isHealing: false,               // hardcoded literal (:43)
            isUnconscious: false,           // 9 > 0 (:44)
            abilityName: 'Warding Bond',    // service-owned literal (:45) — neither fixture
                                              // name shares a substring with it (kill-literal)
        });
        // Slot-direction kill: the struck creature's name appears NOWHERE in the entry.
        expect(entry.targetName).not.toBe('Grix');
        expect(JSON.stringify(entry)).not.toContain('Harsk'); // bystander never named (#1327)

        // NPC lane state scoping (payload source): single buff-lookup read, zero writes
        // (caster HP mutates in place :29 — arithmetic VALUES are .damage's face).
        expect(reads).toEqual(['Grix|activeBuffs']);
        expect(writes).toEqual([]);
        expect(JSON.parse(JSON.stringify(grix))).toEqual(grixSnapshot); // target untouched

        // Real-Promise proof (stub rec): after the bounded flush the floating .catch
        // (:46) settled WITHOUT firing — rejection-console face is .errors, cited only.
        expect(consoleError.mock.calls).toEqual([]);
    });

    it('player caster hit: targetName and maxHp slots carry STORE bytes, not combatSummary decoys', async () => {
        // Kestrel is a type:'player' caster present in the summary with DECOY HP bytes
        // (77/21). The payload's maxHp must read 23 — the store's 'maxHitPoints' (:31-32)
        // — and currentHp must be 19 - 13 = 6, never a decoy arithmetic (77 - 13 = 64).
        // Fresh bytes (19/23/77/21/13/6): zero collision with .damage's 26/52/999/16.
        getDistanceFeet.mockReturnValue(42);
        const staleSummaryCaster = { name: 'Kestrel', type: 'player', currentHp: 77, maxHp: 21 };
        const harsk = { name: 'Harsk' };
        const { reads, writes } = seedStore({
            'Harsk|activeBuffs': bondBuff('Kestrel'),
            'Kestrel|currentHitPoints': 19,
            'Kestrel|maxHitPoints': 23,
            'Kestrel|concentration': null, // read at :34-36; dc-stamp face is .concentration
        });

        applyWardingBond(harsk, { creatures: [staleSummaryCaster, harsk] }, campaignName, 13);

        await flushMicrotasks();

        // Read-order census (#1372): the payload bytes for targetName/maxHp/source HP
        // arrive in this exact order — any re-order at :31-36 flips a byte here.
        expect(reads).toEqual([
            'Harsk|activeBuffs',
            'Kestrel|currentHitPoints',
            'Kestrel|maxHitPoints',
            'Kestrel|concentration',
        ]);
        expect(writes).toEqual([['Kestrel', 'currentHitPoints', 6]]);

        expect(addEntry.mock.calls).toHaveLength(1);
        const [campaignArg, entry] = addEntry.mock.calls[0];
        expect(addEntry.mock.calls[0]).toHaveLength(2);
        expect(campaignArg).toBe(campaignName);
        expect(Object.keys(entry)).toEqual(HP_KEYS);
        expect(entry).toEqual({
            type: 'hp_change',
            targetName: 'Kestrel',          // slot = buff sourceCharacter byte (caster), :39
            delta: -13,                     // -(19 - 6): store-sourced HP, not decoy 77 (:40)
            currentHp: 6,                   // 19 - 13 from the STORE; decoy math gives 64 (:41)
            maxHp: 23,                      // store maxHitPoints; summary decoy was 21 (:31-32)
            isHealing: false,
            isUnconscious: false,
            abilityName: 'Warding Bond',
        });
        expect(entry.targetName).not.toBe('Harsk'); // kill-literal: struck target absent
        expect(consoleError.mock.calls).toEqual([]); // success never fires .catch (:46)
    });
});
