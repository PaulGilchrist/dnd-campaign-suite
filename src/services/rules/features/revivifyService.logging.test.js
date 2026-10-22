// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// LOGGING lane (5 -> 2 tests, all upgraded to exact bytes). Sibling split (#1407,
// headers verified; edge-cases.test.js:5-12 cites THIS file's face):
//   revivifyService.test.js        — base: trigger/gates happy path, alive refusals
//       (incl :286 alive-monster refusal envelope + its zero-log row), consumeMaterial
//       keying, result envelopes, 4-write order budgets.
//   revivifyService.edge-cases.test.js — boundary rows (-8/-3 deltas), golden read
//       census (:216), write-budget census (:291), summary-in-place persistence (:298-301),
//       refusal-zero-log census (:359), addEntry-rejection swallow at :115 with same-Error
//       identity + exact console prefix (:364-391 — log-rejection already pinned there:
//       NOT re-run here), caster/maxHp pre-consume guard refusals (#1407 fixed),
//       disk canon + drift detector.
// THIS lane: successful-revival LOG BYTES only — full-set addEntry census per outcome
//       (PC vs monster), cross-input interpolation distinguishability (#1348/#1296),
//       log-entry key order (#1400), survivor/dead-bystander silence in a MIXED summary
//       (#1327 — distinct from edge's pure-refusal census), timestamps frozen
//       (#1405/#1407 STAMP_MS form), input purity (#1395).
// NO-CLOCK: Revivify's RAW "last minute" text is UNMODELED state-only (verified #1407);
//       this fake seeds no time-like key, so a wall-clock read would THROW. The only
//       Date.now() on this path is the log timestamp (:114), frozen at STAMP_MS and
//       asserted as an exact byte — never expect.any on time fields.
// ZERO-DICE: revivify heals via the static `1 - oldHp` expression (revivifyService.js:103),
//       popup rolls are [] and the log echoes no dice — no dice stub needed.
// addEntry is a verbatim passthrough (logService.js:9-16 POSTs the entry unshaped), so a
// full-call toEqual pins revivifyService.js:105-115 literal byte-for-byte.

const CAMPAIGN = 'TestCampaign';
const STAMP_MS = Date.UTC(2026, 9, 21, 12, 0, 0);

// ── Hoisted fake state ─────────────────────────────────────────

const fake = vi.hoisted(() => ({
    owners: {},          // targeted PC owner -> { key: value }; unseeded owner = stray-read trap
    targetEffects: [],  // campaign store: empty = heal never blocked, infernal wound never open
    logs: [],          // EVERY addEntry call [campaign, entry] from any lane — full census
    envelopes: [],     // queued change-data bodies, FIFO per getCombatContext
    summaryPosts: [],  // captured storage.set('combatSummary') POST bodies (monster persist)

    reset() {
        this.owners = {};
        this.targetEffects = [];
        this.logs = [];
        this.envelopes = [];
        this.summaryPosts = [];
    },

    rtGet(owner, key, campaign) {
        if (campaign !== undefined && campaign !== CAMPAIGN) {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        if (owner === 'campaign') {
            if (key !== 'targetEffects') {
                throw new Error(`runtime fake: unknown campaign key "${key}"`);
            }
            return this.targetEffects;
        }
        const entry = this.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        return entry[key];
    },

    rtSet(owner, key, value, campaign) {
        // Arity + campaign strictness; values never asserted here (write budgets are
        // base :504 and edge :291 faces) but arity drift must not pass silently.
        if (campaign !== CAMPAIGN) {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        if (arguments.length !== 4) {
            throw new Error(`runtime fake: unexpected write arity ${arguments.length}`);
        }
        const entry = this.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        entry[key] = value;
        return Promise.resolve();
    },

    addEntry(campaign, entry) {
        if (campaign !== CAMPAIGN) {
            throw new Error(`log fake: unexpected campaign "${campaign}"`);
        }
        // Sync capture BEFORE the resolved promise: census is visible the moment the
        // trigger returns, no flush races on log visibility.
        this.logs.push([campaign, entry]);
        return Promise.resolve();
    },

    consume(stats, item, campaign) {
        if (campaign !== CAMPAIGN) {
            throw new Error(`material fake: unexpected campaign "${campaign}"`);
        }
        if (item !== 'Diamond (300 gp)') {
            throw new Error(`material fake: unexpected item "${item}"`);
        }
        if (!stats || typeof stats.name !== 'string') {
            throw new Error('material fake: playerStats must be a real named caster');
        }
        return Promise.resolve(true);
    },

    fetch(url, init) {
        if (url === `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/change-data`) {
            const envelope = this.envelopes.shift();
            if (!envelope) throw new Error('fetch fake: no change-data envelope queued');
            return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => envelope });
        }
        if (url === `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/combatSummary`) {
            this.summaryPosts.push(JSON.parse(init.body).value);
            return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) });
        }
        throw new Error(`fetch fake: unexpected URL ${url}`);
    },
}));

// ── Mocks (thin delegates; impls re-seeded every beforeEach below) ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key, campaign) => fake.rtGet(owner, key, campaign)),
    setRuntimeValue: vi.fn((owner, key, value, campaign) => fake.rtSet(owner, key, value, campaign)),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn((campaign, entry) => fake.addEntry(campaign, entry)),
}));

vi.mock('../spells/materialComponents.js', () => ({
    consumeMaterial: vi.fn((stats, item, campaign) => fake.consume(stats, item, campaign)),
}));

// ── Imports ──────────────────────────────────────────────────────

import { triggerRevivify } from './revivifyService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';
import { consumeMaterial } from '../spells/materialComponents.js';

// ── Helpers ──────────────────────────────────────────────────────

global.fetch = vi.fn((url, init) => fake.fetch(url, init));

function queueSummary(creatures, round = 1) {
    const envelope = { combatSummary: { round, creatures } };
    fake.envelopes.push(envelope);
    return envelope;
}

function seedPlayer(name, currentHitPoints, isDead, hitPoints) {
    fake.owners[name] = {
        currentHitPoints,
        isDead,
        hitPoints,
        deathSaves: [true, false, false],
        deathFailures: [false, true, false],
    };
}

const flush = async (n = 6) => {
    for (let i = 0; i < n; i += 1) await Promise.resolve();
};

// ── Tests ────────────────────────────────────────────────────────

describe('triggerRevivify - log bytes', () => {
    let consoleError;

    beforeEach(() => {
        vi.resetAllMocks();
        fake.reset();
        vi.mocked(getRuntimeValue).mockImplementation((owner, key, campaign) => fake.rtGet(owner, key, campaign));
        vi.mocked(setRuntimeValue).mockImplementation((owner, key, value, campaign) => fake.rtSet(owner, key, value, campaign));
        vi.mocked(addEntry).mockImplementation((campaign, entry) => fake.addEntry(campaign, entry));
        vi.mocked(consumeMaterial).mockImplementation((stats, item, campaign) => fake.consume(stats, item, campaign));
        vi.mocked(global.fetch).mockImplementation((url, init) => fake.fetch(url, init));
        vi.useFakeTimers();
        vi.setSystemTime(STAMP_MS); // freezes the only Date.now() on this path (:114)
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        vi.useRealTimers();
    });

    it('PC revival logs EXACTLY one full-set hp_change row: runtime-canonical maxHp, every slot interpolated from distinct inputs, key order, frozen timestamp, clean console', async () => {
        // Every slot mutually distinguishable (#1348/#1296): note != 'Revivify' kills a
        // hardcoded-note, sourceName != targetName kills a swap, maxHp 47 (runtime
        // hitPoints seed) != 30 (summary placeholder) kills summary-fed PC maxHp —
        // the branch edge seeds null on, so it is uniquely this lane's byte.
        const spell = Object.freeze({ name: 'Astral Renewal' });
        const caster = Object.freeze({ name: 'Seraphina' });
        seedPlayer('Torvin', 0, 1, 47);
        // Bram: alive PC bystander, deliberately UNSEEDED — any stray runtime read of a
        // non-target owner THROWS. He must never appear in the log census (#1327).
        queueSummary([
            { name: 'Torvin', maxHp: 30, currentHp: 0, type: 'player' },
            { name: 'Bram', maxHp: 22, currentHp: 11, type: 'player' },
        ], 3);

        await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Torvin');
        await flush();

        expect(fake.logs).toEqual([[CAMPAIGN, {
            type: 'hp_change',
            targetName: 'Torvin',
            delta: 1,
            currentHp: 1,
            maxHp: 47,
            isHealing: true,
            sourceName: 'Seraphina',
            note: 'Astral Renewal',
            timestamp: STAMP_MS,
        }]]);
        // Key order of the revivifyService.js:105-115 literal (#1400 precedent);
        // addEntry is a passthrough (logService.js:9-16), so this IS the posted byte order.
        expect(Object.keys(fake.logs[0][1])).toEqual([
            'type', 'targetName', 'delta', 'currentHp', 'maxHp', 'isHealing', 'sourceName', 'note', 'timestamp',
        ]);
        // Frozen caster/spell inputs survived the call untouched (#1395 purity — a
        // mutation attempt on these frozen args would itself have thrown).
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('monster revival logs its own summary-canonical bytes; alive target and dead bystander stay silent in the post-refusal addEntry census', async () => {
        const spell = Object.freeze({ name: 'Revivify' });
        const caster = Object.freeze({ name: 'Seraphina' });
        // Gribble revives (delta 1, maxHp 9 straight off the summary — monsters are
        // summary-canonical). Hesketh: dead PC bystander, UNSEEDED stray-read trap.
        // Snarl: alive monster — revived-second attempt must add ZERO log rows (mixed
        // census face; refusal envelopes censused at base :286/edge :359, not re-run).
        queueSummary([
            { name: 'Gribble', maxHp: 9, currentHp: 0, type: 'monster' },
            { name: 'Hesketh', maxHp: 44, currentHp: 0, type: 'player' },
            { name: 'Snarl', maxHp: 14, currentHp: 7, type: 'monster' },
        ], 2);
        queueSummary([
            { name: 'Gribble', maxHp: 9, currentHp: 0, type: 'monster' },
            { name: 'Hesketh', maxHp: 44, currentHp: 0, type: 'player' },
            { name: 'Snarl', maxHp: 14, currentHp: 7, type: 'monster' },
        ], 2);

        await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Gribble');
        await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Snarl');
        await flush(); // drain the queued storage.set('combatSummary') POST

        expect(fake.logs).toEqual([[CAMPAIGN, {
            type: 'hp_change',
            targetName: 'Gribble',
            delta: 1,
            currentHp: 1,
            maxHp: 9,
            isHealing: true,
            sourceName: 'Seraphina',
            note: 'Revivify',
            timestamp: STAMP_MS,
        }]]);
        // Per-outcome completeness (#1327): exactly one row, only for the revived
        // creature — the refusal target and the dead bystander never generate log bytes.
        expect(fake.logs.map(([, e]) => e.targetName)).toEqual(['Gribble']);
    });
});
