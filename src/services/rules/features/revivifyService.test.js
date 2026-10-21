// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// BASE lane (21 -> 8 tests). Sibling split (headers verified):
//   THIS file — trigger happy path (PC + monster lanes), alive refusals (base :286
//       face kept greppable), consumeMaterial keying (base :85 face kept greppable),
//       result envelopes, 4-write order census (base :504 face, folded per #1407 rec:
//       the ≡ single-field rows 'sets currentHitPoints to 1' / 'resets deathSaves' /
//       'resets deathFailures' / 'sets isDead' / 'finds target by name' are all
//       subsumed by the exact full-set write census in test 1).
//   revivifyService.logging.test.js    — EXACT log-entry bytes for revivals. This lane
//       therefore keeps LOG ROWS STRUCTURAL-COUNT ONLY (#1408 rec: no partial
//       objectContaining log assertions here — the old :243/:274/:362 rows are gone).
//   revivifyService.edge-cases.test.js — boundary deltas (-8/-3), golden read census
//       (:216), full-set write-budget + latch flip (:291), monster summary-in-place
//       persistence (:298-301), refusal-zero-log census (:359), addEntry-rejection
//       swallow (:364-391), golden unguarded-deref (:412), disk canon + drift detector.
// FETCH: route-aware fake (no never-resolving floats — the old global.fetch =
//   new Promise(() => {}) float is replaced; unknown routes REJECT explicitly).
// NO-CLOCK: death-time stays UNMODELED state-only (#1407 verdict). The only
//   Date.now() on this path is the log timestamp (:61); timers are frozen at
//   STAMP_MS for stamp determinism only, never for gating.
// ZERO-DICE: revivify heals via the static `1 - oldHp` expression
//   (revivifyService.js:46); popup rolls are [] — no dice stub needed.
// FIXTURE DISTINCTNESS (#1348): every name/number here is unique across the three
//   lanes (edge: Ally/Goblin 30/7, logging: Torvin/Gribble 47/9) so no byte is
//   accidentally re-pinned; the hardcoded '300+ GP' refusal text is pinned once,
//   behind a CUSTOM spell name, in test 3.

const CAMPAIGN = 'TestCampaign';
const STAMP_MS = Date.UTC(2026, 9, 21, 12, 0, 0);
const CHANGE_DATA_URL = `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/change-data`;
const SUMMARY_POST_URL = `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/combatSummary`;

// ── Hoisted fake state ─────────────────────────────────────────

const rt = vi.hoisted(() => ({
    owners: {},          // owner -> { key: value }; unseeded owner = stray-access trap
    targetEffects: [],  // campaign store: empty = heal never blocked, wound never open
    writes: [],         // exact [owner, key, value, campaign, skipSync] census
}));

const net = vi.hoisted(() => ({
    envelopes: [],       // queued change-data bodies, FIFO per getCombatContext
    summaryPosts: [],    // captured storage.set('combatSummary') payloads
    logs: [],            // structural log capture (bytes owned by logging lane)
    diamondChecks: [],   // consumeMaterial call census [casterName, item]
    diamondAvailable: true,
    rejectNextChangeData: false, // explicit rejection arm (never-resolving floats banned)
}));

// ── Mocks (impls live in the factories; clearAllMocks keeps them, #1312-safe) ──

// Argument-keyed STATEFUL strict runtime fake: unknown owner/key/campaign/arity
// THROWS (standard: read-order censuses stay honest, no silent holes).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key, campaign) => {
        if (campaign !== undefined && campaign !== 'TestCampaign') {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        if (owner === 'campaign') {
            if (key !== 'targetEffects') {
                throw new Error(`runtime fake: unknown campaign key "${key}"`);
            }
            return rt.targetEffects;
        }
        const entry = rt.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        return entry[key];
    }),
    setRuntimeValue: vi.fn((...args) => {
        const [owner, key, value, campaign, skipSync] = args;
        if (campaign !== 'TestCampaign') {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        if (args.length !== 4) {
            throw new Error(`runtime fake: unexpected write arity ${args.length}`);
        }
        const entry = rt.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        rt.writes.push([owner, key, value, campaign, skipSync]);
        entry[key] = value;
        return Promise.resolve();
    }),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn((campaign, entry) => {
        if (campaign !== 'TestCampaign') {
            throw new Error(`log fake: unexpected campaign "${campaign}"`);
        }
        net.logs.push([campaign, entry]); // sync capture before resolve (no flush race)
        return Promise.resolve();
    }),
}));

// consumeMaterial fake: exact diamond literal or THROWS (drift guard on the
// hardcoded key; byte-vs-disk comparison owned by edge disk canon #1407).
vi.mock('../spells/materialComponents.js', () => ({
    consumeMaterial: vi.fn(async (stats, item, campaign) => {
        if (campaign !== 'TestCampaign') {
            throw new Error(`material fake: unexpected campaign "${campaign}"`);
        }
        if (item !== 'Diamond (300 gp)') {
            throw new Error(`material fake: unexpected item "${item}"`);
        }
        if (!stats || typeof stats.name !== 'string') {
            throw new Error('material fake: playerStats must be a real named caster');
        }
        net.diamondChecks.push([stats.name, item]);
        return net.diamondAvailable;
    }),
}));

// Route-aware fetch fake (#1408 form): change-data serves the FIFO queue, the
// storage combatSummary POST is captured, anything else REJECTS explicitly —
// no never-resolving floats anywhere on this path.
global.fetch = vi.fn((url, init) => {
    if (url === CHANGE_DATA_URL) {
        if (net.rejectNextChangeData) {
            net.rejectNextChangeData = false;
            return Promise.reject(new Error('offline'));
        }
        const envelope = net.envelopes.shift();
        if (!envelope) {
            return Promise.reject(new Error('fetch fake: no change-data envelope queued'));
        }
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => envelope });
    }
    if (url === SUMMARY_POST_URL && init && init.method === 'POST') {
        net.summaryPosts.push(JSON.parse(init.body).value);
        return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
    }
    return Promise.reject(new Error(`fetch fake: unexpected route ${init?.method ?? 'GET'} ${url}`));
});

// ── Imports ──────────────────────────────────────────────────────

import { triggerRevivify } from './revivifyService.js';
import { setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { consumeMaterial } from '../spells/materialComponents.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeSpell(name) {
    return { name };
}

function makeCaster(name = 'Brother Aldous') {
    return { name };
}

function queueSummary(round, creatures) {
    net.envelopes.push({ combatSummary: { round, creatures } });
}

function seedDeadPC(name, currentHitPoints, isDead, hitPoints) {
    rt.owners[name] = {
        currentHitPoints,
        isDead,
        hitPoints,
        deathSaves: [true, true, false],
        deathFailures: [true, false, true],
    };
}

const flush = async (n = 6) => {
    for (let i = 0; i < n; i += 1) await Promise.resolve();
};

// ── Tests ────────────────────────────────────────────────────────

describe('triggerRevivify', () => {
    let consoleError;

    beforeEach(() => {
        rt.owners = {};
        rt.targetEffects = [];
        rt.writes = [];
        net.envelopes = [];
        net.summaryPosts = [];
        net.logs = [];
        net.diamondChecks = [];
        net.diamondAvailable = true;
        net.rejectNextChangeData = false;
        vi.clearAllMocks(); // clears call records/order; factory impls persist
        vi.useFakeTimers();
        vi.setSystemTime(STAMP_MS); // freezes the only Date.now(): log timestamp (:61)
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        vi.useRealTimers();
    });

    it('sets all four runtime values in correct order on PC revival: full-set write census (skipSync position audited), call order fetch<consume<writes, fetch census, full success envelope', async () => {
        // :504 owner face (folded #1407 rec #1: the ≡ field-level rows collapse here).
        // Death detected by the HP arm (isDead null) — edge seeds isDead 1 instead.
        const caster = makeCaster('Brother Aldous');
        seedDeadPC('Dorn', 0, null, 26); // hitPoints 26 != summary placeholder maxHp 19
        queueSummary(5, [{ name: 'Dorn', maxHp: 19, currentHp: 1, type: 'player' }]);

        const result = await triggerRevivify(makeSpell('Revivify'), {}, caster, CAMPAIGN, 'Dorn');
        await flush();

        // Exact 4-write ordered tuples, skipSync undefined at every slot (#1341).
        expect(rt.writes).toEqual([
            ['Dorn', 'currentHitPoints', 1, CAMPAIGN, undefined],
            ['Dorn', 'deathSaves', [false, false, false], CAMPAIGN, undefined],
            ['Dorn', 'deathFailures', [false, false, false], CAMPAIGN, undefined],
            ['Dorn', 'isDead', 0, CAMPAIGN, undefined],
        ]);
        expect(rt.writes).toHaveLength(4); // budget: no fifth write
        // Latch flip visible in the store: pre-revival nonzero saves cleared.
        expect(rt.owners.Dorn).toEqual({
            currentHitPoints: 1,
            isDead: 0,
            hitPoints: 26,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
        });
        // Call order: canonical fetch -> diamond -> runtime writes.
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(CHANGE_DATA_URL);
        expect(consumeMaterial).toHaveBeenCalledTimes(1);
        expect(consumeMaterial).toHaveBeenCalledWith(caster, 'Diamond (300 gp)', CAMPAIGN); // identity, not objectContaining
        expect(consumeMaterial.mock.invocationCallOrder[0])
            .toBeLessThan(setRuntimeValue.mock.invocationCallOrder[0]);
        // Players never POST the summary (runtime-canonical): the only fetch is the GET.
        expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([CHANGE_DATA_URL]);
        // Full success envelope + exact key set (#1400 order, folded ≡ result rows).
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'heal',
                name: 'Revivify',
                targetName: 'Dorn',
                finalHeal: 1,
                total: 1,
                formula: '1 HP (revived)',
                rolls: [],
                rawTotal: 1,
            },
        });
        expect(Object.keys(result.payload)).toEqual([
            'type', 'name', 'targetName', 'finalHeal', 'total', 'formula', 'rolls', 'rawTotal',
        ]);
        // Log: structural count only here (exact bytes owned by the logging lane).
        expect(net.logs).toHaveLength(1);
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('revives a dead monster summary-canonical: zero runtime writes, exactly one summary POST, dead bystander byte-identical, full envelope', async () => {
        const caster = makeCaster('Brother Aldous');
        queueSummary(2, [
            { name: 'Hrolg', maxHp: 13, currentHp: 0, type: 'monster' },
            { name: 'Vex', maxHp: 23, currentHp: 0, type: 'monster' },
        ]);

        const result = await triggerRevivify(makeSpell('Restore the Fallen'), {}, caster, CAMPAIGN, 'Hrolg');
        await flush(); // drain the queued storage.set('combatSummary') POST

        // Monster lane writes NOTHING to the runtime store (empty owners map = every
        // stray owner access would have THROWN); persistence is the summary POST.
        expect(rt.writes).toEqual([]);
        expect(net.summaryPosts).toHaveLength(1);
        expect(net.summaryPosts[0].creatures).toEqual([
            { name: 'Hrolg', maxHp: 13, currentHp: 1, type: 'monster' },
            { name: 'Vex', maxHp: 23, currentHp: 0, type: 'monster' }, // bystander untouched
        ]);
        expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([CHANGE_DATA_URL, SUMMARY_POST_URL]);
        expect(consumeMaterial).toHaveBeenCalledTimes(1);
        // Spell-name interpolation distinguishability (#1348): payload.name follows the
        // spell argument, not a hardcoded literal.
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'heal',
                name: 'Restore the Fallen',
                targetName: 'Hrolg',
                finalHeal: 1,
                total: 1,
                formula: '1 HP (revived)',
                rolls: [],
                rawTotal: 1,
            },
        });
        expect(net.logs).toHaveLength(1); // structural only
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('refuses when the diamond is unavailable: nothing consumed past the gate, zero writes/logs/POST, hardcoded 300 GP text survives a custom spell name', async () => {
        net.diamondAvailable = false;
        seedDeadPC('Mourne', 0, null, 24);
        queueSummary(1, [{ name: 'Mourne', maxHp: 24, currentHp: 1, type: 'player' }]);

        const result = await triggerRevivify(makeSpell('Ghostly Revival'), {}, makeCaster('Brother Aldous'), CAMPAIGN, 'Mourne');
        await flush();

        // Full refusal envelope: payload.name interpolates the custom spell while the
        // description stays the hardcoded 'Revivify requires...' literal.
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Ghostly Revival',
                automationType: 'revivify',
                description: 'Revivify requires a diamond worth 300+ GP, which the spell consumes.',
            },
        });
        expect(net.diamondChecks).toEqual([['Brother Aldous', 'Diamond (300 gp)']]);
        expect(rt.writes).toEqual([]);
        expect(rt.owners.Mourne.currentHitPoints).toBe(0); // stays dead
        expect(net.logs).toEqual([]);
        expect(net.summaryPosts).toEqual([]);
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('calls consumeMaterial with correct diamond item name', async () => {
        // :85 owner face: exact argument census (identity + literal), single check,
        // and the check lands AFTER the dead-gate but BEFORE the HP commit.
        const caster = makeCaster('Alvina');
        seedDeadPC('Mourne', 0, null, 24);
        queueSummary(1, [{ name: 'Mourne', maxHp: 24, currentHp: 1, type: 'player' }]);

        const result = await triggerRevivify(makeSpell('Revivify'), {}, caster, CAMPAIGN, 'Mourne');
        await flush();

        expect(consumeMaterial.mock.calls).toEqual([[caster, 'Diamond (300 gp)', CAMPAIGN]]);
        expect(net.diamondChecks).toEqual([['Alvina', 'Diamond (300 gp)']]);
        expect(consumeMaterial.mock.invocationCallOrder[0])
            .toBeLessThan(setRuntimeValue.mock.invocationCallOrder[0]);
        expect(result.payload.finalHeal).toBe(1);
        expect(rt.writes).toHaveLength(4);
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('refuses an ALIVE monster (no material consumed, no HP write)', async () => {
        // :286 face, kept greppable for the logging lane ledger (logging :231).
        queueSummary(3, [{ name: 'Krag', maxHp: 15, currentHp: 6, type: 'monster' }]);

        const result = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Krag');
        await flush();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Krag is not dead. Revivify can only target a creature that has died within the last minute.',
            },
        });
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]);
        expect(net.logs).toEqual([]);
        expect(net.summaryPosts).toEqual([]);
        expect(consoleError.mock.calls).toEqual([['[revivify] Living target refused: Krag']]);
    });

    it('refuses an ALIVE player even when the summary placeholder looks dead — runtime is the death truth, no diamond, no HP write', async () => {
        // Contradictory fixture unique to this lane (pitfall 37): runtime HP 31 alive,
        // isDead 0, while the combatSummary placeholder entry carries currentHp 0.
        rt.owners.Ysolde = {
            currentHitPoints: 31,
            isDead: 0,
            hitPoints: 31,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
        };
        queueSummary(4, [{ name: 'Ysolde', maxHp: 31, currentHp: 0, type: 'player' }]);

        const result = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Ysolde');
        await flush();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Ysolde is not dead. Revivify can only target a creature that has died within the last minute.',
            },
        });
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]);
        expect(rt.owners.Ysolde.currentHitPoints).toBe(31);
        expect(net.logs).toEqual([]);
        expect(consoleError.mock.calls).toEqual([['[revivify] Living target refused: Ysolde']]);
    });

    it('target-not-found refusals across three lookup-miss arms (empty creatures, missing combatSummary key, rejected fetch): identical gate bytes, zero side effects', async () => {
        // Arm 1: live summary, empty roster -> :26 gate fires on find() miss.
        queueSummary(1, []);
        const ref1 = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Wisp');
        expect(ref1).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Wisp is not present in combat. Revivify can only target a creature that has died within the last minute.',
            },
        });

        // Arm 2: envelope without a combatSummary key -> getCombatContext returns null
        // silently -> same gate, no extra console noise.
        net.envelopes.push({});
        const ref2 = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Nullbody');
        expect(ref2).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Nullbody is not present in combat. Revivify can only target a creature that has died within the last minute.',
            },
        });

        // Arm 3: rejected fetch -> caught inside getCombatContext -> refuses, never throws.
        net.rejectNextChangeData = true;
        const ref3 = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Corin');

        expect(ref3).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Corin is not present in combat. Revivify can only target a creature that has died within the last minute.',
            },
        });
        expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([CHANGE_DATA_URL, CHANGE_DATA_URL, CHANGE_DATA_URL]); // one GET per arm, no POSTs
        expect(net.envelopes).toEqual([]); // queue fully drained
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]);
        expect(net.logs).toEqual([]);
        expect(net.summaryPosts).toEqual([]);
        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Target Wisp not found in combat summary'],
            ['[revivify] Target Nullbody not found in combat summary'],
            ['[getCombatContext] Error fetching change-data:', 'offline'],
            ['[revivify] Target Corin not found in combat summary'],
        ]);
    });

    it('a creature entry with no type field rides the monster lane: dead revives summary-canonical, alive refuses', async () => {
        // Type-gate split (#1406 form): service :44 `type === 'player'` — absent type
        // falls to the monster arm in BOTH directions, folded into one row.
        queueSummary(1, [{ name: 'Mosslump', maxHp: 17, currentHp: 0 }]);
        queueSummary(1, [{ name: 'Mosslump', maxHp: 17, currentHp: 9 }]);

        const revived = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Mosslump');
        expect(revived).toEqual({
            type: 'popup',
            payload: {
                type: 'heal',
                name: 'Revivify',
                targetName: 'Mosslump',
                finalHeal: 1,
                total: 1,
                formula: '1 HP (revived)',
                rolls: [],
                rawTotal: 1,
            },
        });
        expect(rt.writes).toEqual([]); // monster lane: zero runtime writes

        const refused = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Mosslump');
        expect(refused.payload).toEqual({
            type: 'automation_info',
            name: 'Revivify',
            automationType: 'revivify',
            description: 'Mosslump is not dead. Revivify can only target a creature that has died within the last minute.',
        });
        await flush();

        expect(net.diamondChecks).toHaveLength(1); // second trigger refused pre-consume
        expect(net.logs).toHaveLength(1); // structural only
        expect(net.summaryPosts).toHaveLength(1);
        expect(net.summaryPosts[0].creatures[0].currentHp).toBe(1);
        expect(consoleError.mock.calls).toEqual([['[revivify] Living target refused: Mosslump']]);
    });
});
