// @maintained-by-ai: 2026-11-15
// bug-revivify-stale-isdead-negative-heal regression pins. A desynced player
// bucket (isDead:1 with POSITIVE currentHitPoints — e.g. left by a writer that
// resurrected without resetting the latch) must never be "revived" DOWNWARD:
// the old `1 - oldHp` heal went negative, drained the target toward 1 HP, and
// still billed the 300 gp diamond + spell slot. Locks:
//   1. the REAL dead gate (isCreatureDead, now HP-consistent) refuses the zombie
//      with zero spend, zero writes, zero log, zero dispatch;
//   2. the service's validate-before-consume `oldHp > 0` assert refuses BEFORE
//      consumeMaterial even if a desync slips past the gate (slip-through rig);
//   3. the classic 0-HP corpse contract (pays the diamond, heals to 1, resets
//      the death state, logs the hp_change heal row) stays byte-unchanged.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'TestCampaign';
const STAMP_MS = Date.UTC(2026, 10, 15, 12, 0, 0);

// ── Hoisted state ──────────────────────────────────────────────

const rt = vi.hoisted(() => ({
    owners: {},          // owner -> { key: value } (seeded per test)
    targetEffects: [],
    reads: [],           // exact ['owner','key'] census
    writes: [],          // exact [owner, key, value, campaign, skipSync] census
}));

const net = vi.hoisted(() => ({
    envelopes: [],       // queued full change-data bodies, consumed FIFO per trigger
    summaryPosts: [],    // storage.set('combatSummary', ...) payloads captured
    diamondChecks: [],   // consumeMaterial call census
    diamondAvailable: true,
}));

const real = vi.hoisted(() => ({ isCreatureDead: null }));

// ── Mocks (same argument-keyed fakes as revivifyService.edge-cases.test.js) ──

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key, campaign) => {
        if (campaign !== undefined && campaign !== CAMPAIGN) {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        if (owner === 'campaign') {
            if (key !== 'targetEffects') {
                throw new Error(`runtime fake: unknown campaign key "${key}"`);
            }
            rt.reads.push([owner, key]);
            return rt.targetEffects;
        }
        const entry = rt.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        rt.reads.push([owner, key]);
        return entry[key];
    }),
    setRuntimeValue: vi.fn((owner, key, value, campaign, skipSync) => {
        if (campaign !== CAMPAIGN) {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        if (owner === 'campaign') {
            if (key !== 'targetEffects') {
                throw new Error(`runtime fake: unknown campaign key "${key}"`);
            }
            rt.writes.push([owner, key, value, campaign, skipSync]);
            rt.targetEffects = value;
            return Promise.resolve();
        }
        const entry = rt.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        rt.writes.push([owner, key, value, campaign, skipSync]);
        entry[key] = value;
        return Promise.resolve();
    }),
    // CLA-092 revive fold: one arity-3 batch commits HP + death-reset; emits
    // the same ordered tuples as the old four sequential setRuntimeValue calls.
    setRuntimeBatch: vi.fn((owner, properties, campaign) => {
        if (campaign !== CAMPAIGN) {
            throw new Error(`runtime fake: unexpected campaign "${campaign}"`);
        }
        const entry = rt.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        for (const [key, value] of Object.entries(properties)) {
            if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
            rt.writes.push([owner, key, value, campaign, undefined]);
            entry[key] = value;
        }
        return Promise.resolve();
    }),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Diamond fake: exact literal or THROWS (drift trap, edge-cases idiom).
vi.mock('../spells/materialComponents.js', () => ({
    consumeMaterial: vi.fn(async (stats, item, campaign) => {
        if (item !== 'Diamond (300 gp)') {
            throw new Error(`material fake: unexpected item "${item}"`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`material fake: unexpected campaign "${campaign}"`);
        }
        net.diamondChecks.push([stats?.name ?? null, item]);
        return net.diamondAvailable;
    }),
}));

// Partial hpModifier mock: real modifyHitPoints/isCreatureDead by default (test 1
// rides the REAL HP-consistent gate); a test can force the dead gate open to
// prove the service's own oldHp assert refuses even when a desync slips past.
vi.mock('../../../services/shared/hpModifier.js', async (importOriginal) => {
    const actual = await importOriginal();
    real.isCreatureDead = actual.isCreatureDead;
    return { ...actual, isCreatureDead: vi.fn((cs, name) => real.isCreatureDead(cs, name)) };
});

// ── Imports ────────────────────────────────────────────────────

import { triggerRevivify } from './revivifyService.js';
import { isCreatureDead } from '../../../services/shared/hpModifier.js';
import { consumeMaterial } from '../spells/materialComponents.js';
import { addEntry } from '../../../services/ui/logService.js';

// Route-aware fetch fake: change-data serves the queued envelope FIFO; the
// storage combatSummary POST is captured; anything else THROWS.
global.fetch = vi.fn(async (url, init) => {
    if (url === `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/change-data`) {
        const envelope = net.envelopes.shift();
        if (!envelope) throw new Error('fetch fake: no change-data envelope queued');
        return { ok: true, status: 200, statusText: 'OK', json: async () => envelope };
    }
    if (url === `/api/campaigns/${encodeURIComponent(CAMPAIGN)}/combatSummary`) {
        net.summaryPosts.push(JSON.parse(init.body).value);
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({}) };
    }
    throw new Error(`fetch fake: unexpected URL ${url}`);
});

const spell = { name: 'Revivify' };
const caster = { name: 'Cleric' };

// The divergent bucket: the exact desynced byte-state (stale isDead over living
// HP). The combatSummary player row is the usual 0/placeholder snapshot.
function seedDivergent(name, currentHitPoints) {
    rt.owners[name] = {
        currentHitPoints,
        isDead: 1,
        hitPoints: 30,
        deathSaves: [false, false, true],
        deathFailures: [true, false, false],
    };
}

function queuePlayerRow(name) {
    net.envelopes.push({
        combatSummary: { round: 1, creatures: [{ name, type: 'player', maxHp: 30, currentHp: 0 }] },
    });
}

function trackSummaryEvents() {
    const events = [];
    const listener = (e) => events.push(e);
    window.addEventListener('combat-summary-updated', listener);
    return { events, stop: () => window.removeEventListener('combat-summary-updated', listener) };
}

const flush = async (n = 4) => {
    for (let i = 0; i < n; i += 1) await Promise.resolve();
};

// ── Tests ──────────────────────────────────────────────────────

describe('triggerRevivify — desynced corpse (stale isDead over positive HP)', () => {
    let consoleError;

    beforeEach(() => {
        rt.owners = {};
        rt.targetEffects = [];
        rt.reads = [];
        rt.writes = [];
        net.envelopes = [];
        net.summaryPosts = [];
        net.diamondChecks = [];
        net.diamondAvailable = true;
        vi.clearAllMocks(); // clears call records; vi.fn(impl) impls persist
        // clearAllMocks keeps implementations — restore the real dead-gate default
        // every test so a slip-through override can't leak into the next one.
        vi.mocked(isCreatureDead).mockImplementation((cs, name) => real.isCreatureDead(cs, name));
        vi.useFakeTimers();
        vi.setSystemTime(STAMP_MS);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        vi.useRealTimers();
    });

    it('refuses a 18-HP zombie through the REAL dead gate — zero diamond, zero writes, zero log, no drain', async () => {
        // Default gate impl is the REAL HP-consistent isCreatureDead: it must call
        // the 18-HP stale-isDead bucket living and refuse before any spend.
        seedDivergent('Ally', 18);
        queuePlayerRow('Ally');
        const { events, stop } = trackSummaryEvents();

        const result = await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Ally');
        await flush();
        stop();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Ally is not dead. Revivify can only target a creature that has died within the last minute.',
            },
        });
        expect(consumeMaterial).not.toHaveBeenCalled();
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]); // HP never written (let alone drained 18 -> 1)
        expect(rt.owners.Ally.currentHitPoints).toBe(18);
        expect(addEntry).not.toHaveBeenCalled();
        expect(net.summaryPosts).toEqual([]);
        expect(events).toEqual([]);
        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Living target refused: Ally'],
        ]);
    });

    it('the service oldHp assert refuses BEFORE the diamond even if the desync slips past the dead gate', async () => {
        // Slip-through rig: force the dead gate OPEN (simulating any future/cached
        // corpse census that still offers the divergent bucket) — the service's own
        // validate-before-consume invariant must refuse, pre-spend.
        vi.mocked(isCreatureDead).mockReturnValue(true);
        seedDivergent('Ally', 18);
        queuePlayerRow('Ally');
        const { events, stop } = trackSummaryEvents();

        const result = await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Ally');
        await flush();
        stop();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Ally is not at 0 Hit Points. Revivify was refused and no diamond was consumed.',
            },
        });
        expect(consumeMaterial).not.toHaveBeenCalled(); // never billed
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]);                  // never drained
        expect(rt.owners.Ally.currentHitPoints).toBe(18);
        expect(addEntry).not.toHaveBeenCalled();       // no spend -> no spend audit owed
        expect(events).toEqual([]);
        // Read census: the guard short-circuits on oldHp — maxHp is never consulted.
        expect(rt.reads).toEqual([['Ally', 'currentHitPoints']]);
        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Ally sits at 18 HP despite the dead gate — refused, no diamond consumed'],
        ]);
    });

    it('classic 0-HP corpse contract unchanged: pays the diamond, heals to 1, resets death state, logs the heal row', async () => {
        seedDivergent('Ally', 0);
        queuePlayerRow('Ally');
        const { events, stop } = trackSummaryEvents();

        const result = await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Ally');
        await flush();
        stop();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'heal',
                name: 'Revivify',
                targetName: 'Ally',
                finalHeal: 1,
                total: 1,
                formula: '1 HP (revived)',
                rolls: [],
                rawTotal: 1,
            },
        });
        expect(consumeMaterial).toHaveBeenCalledTimes(1);
        expect(rt.writes).toEqual([
            ['Ally', 'currentHitPoints', 1, CAMPAIGN, undefined],
            ['Ally', 'deathSaves', [false, false, false], CAMPAIGN, undefined],
            ['Ally', 'deathFailures', [false, false, false], CAMPAIGN, undefined],
            ['Ally', 'isDead', 0, CAMPAIGN, undefined],
        ]);
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
            type: 'hp_change', targetName: 'Ally', delta: 1, currentHp: 1, maxHp: 30,
            isHealing: true, sourceName: 'Cleric', note: 'Revivify', timestamp: STAMP_MS,
        }]);
        expect(events).toHaveLength(1);
        expect(consoleError).not.toHaveBeenCalled();
    });
});
