// @maintained-by-ai: 2026-11-15
// Revive-crossing `unconscious` strip — Revivify SPELL-LANE end-to-end pin
// (improve 2026-11-15, QY backlog). The lane commits through the CLA-092 heal
// choke (applyHealingToTarget), whose oldHp<=0 -> newHp>0 branch now folds the
// interceptor-parity strip (shared/reviveTargetHp.stripUnconsciousOnRevive —
// sheds exactly `unconscious`, case-folded, prone rides through) into the ONE
// merged victim batch: still a single setRuntimeBatch call, the merged census
// GAINS the activeConditions key, zero extra setRuntimeValue/echo pair. The
// refusal lanes (living target) never reach the crossing and never read the
// condition bucket at all. Same strict owner-fake harness as
// revivifyService.stale-corpse.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CAMPAIGN = 'TestCampaign';
const STAMP_MS = Date.UTC(2026, 10, 15, 12, 0, 0);

const rt = vi.hoisted(() => ({
    owners: {},          // owner -> { key: value } (seeded per test)
    targetEffects: [],
    reads: [],           // exact ['owner','key'] census
    writes: [],          // exact [owner, key, value, campaign, skipSync] census
}));

const net = vi.hoisted(() => ({
    envelopes: [],       // queued full change-data bodies, consumed FIFO per trigger
    summaryPosts: [],    // storage.set('combatSummary', ...) payloads captured
    diamondAvailable: true,
}));

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
        const entry = rt.owners[owner];
        if (!entry) throw new Error(`runtime fake: unknown owner "${owner}"`);
        if (!(key in entry)) throw new Error(`runtime fake: unknown key "${owner}.${key}"`);
        rt.writes.push([owner, key, value, campaign, skipSync]);
        entry[key] = value;
        return Promise.resolve();
    }),
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

vi.mock('../spells/materialComponents.js', () => ({
    consumeMaterial: vi.fn(async () => net.diamondAvailable),
}));

import { triggerRevivify } from './revivifyService.js';
import { setRuntimeBatch, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../services/ui/logService.js';

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

// QY-seeded corpse byte-state: 0 HP, isDead latch, stale saves AND the
// unconscious+prone conditions a dead creature rides (the backlog face:
// pre-improve the revive passed activeConditions through unchanged).
function seedCorpse(name, conditions) {
    rt.owners[name] = {
        currentHitPoints: 0,
        isDead: 1,
        hitPoints: 30,
        deathSaves: [true, true, false],
        deathFailures: [true, false, false],
        activeConditions: [...conditions],
    };
}

function queuePlayerRow(name) {
    net.envelopes.push({
        combatSummary: { round: 1, creatures: [{ name, type: 'player', maxHp: 30, currentHp: 0 }] },
    });
}

const flush = async (n = 4) => {
    for (let i = 0; i < n; i += 1) await Promise.resolve();
};

describe('triggerRevivify — death→life crossing sheds unconscious', () => {
    let consoleError;

    beforeEach(() => {
        rt.owners = {};
        rt.targetEffects = [];
        rt.reads = [];
        rt.writes = [];
        net.envelopes = [];
        net.summaryPosts = [];
        net.diamondAvailable = true;
        vi.clearAllMocks(); // clears call records; vi.fn(impl) impls persist
        vi.useFakeTimers();
        vi.setSystemTime(STAMP_MS);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        vi.useRealTimers();
    });

    it('player corpse at 0 HP carrying unconscious+prone: ONE merged batch sheds unconscious, keeps prone, single audit row', async () => {
        seedCorpse('Ally', ['unconscious', 'prone']);
        queuePlayerRow('Ally');

        const result = await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Ally');
        await flush();

        // ONE merged batch, zero separate setRuntimeValue — the strip folded
        // INTO the same POST (no second victim write, no echo pair).
        expect(setRuntimeBatch).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeBatch).toHaveBeenCalledWith('Ally', {
            currentHitPoints: 1,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
            isDead: 0,
            activeConditions: ['prone'],
        }, CAMPAIGN);
        // Merged-batch census: the four proven keys + the folded strip.
        expect(rt.writes).toEqual([
            ['Ally', 'currentHitPoints', 1, CAMPAIGN, undefined],
            ['Ally', 'deathSaves', [false, false, false], CAMPAIGN, undefined],
            ['Ally', 'deathFailures', [false, false, false], CAMPAIGN, undefined],
            ['Ally', 'isDead', 0, CAMPAIGN, undefined],
            ['Ally', 'activeConditions', ['prone'], CAMPAIGN, undefined],
        ]);
        // Mirror truth after the lane completes.
        expect(rt.owners.Ally).toEqual({
            currentHitPoints: 1,
            isDead: 0,
            hitPoints: 30,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
            activeConditions: ['prone'],
        });
        // Audit trio unaffected by the fold: exactly one hp_change row,
        // byte-identical to the proven success contract.
        expect(addEntry).toHaveBeenCalledTimes(1);
        expect(addEntry.mock.calls[0]).toEqual([CAMPAIGN, {
            type: 'hp_change', targetName: 'Ally', delta: 1, currentHp: 1, maxHp: 30,
            isHealing: true, sourceName: 'Cleric', note: 'Revivify', timestamp: STAMP_MS,
        }]);
        expect(result.payload.formula).toBe('1 HP (revived)');
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('corpse without unconscious keeps the exact four-key batch (nothing materialised on a plain revive)', async () => {
        seedCorpse('Ally', ['prone']);
        queuePlayerRow('Ally');

        await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Ally');
        await flush();

        expect(rt.writes).toHaveLength(4);
        expect(rt.writes.some(w => w[1] === 'activeConditions')).toBe(false);
        expect(rt.owners.Ally.activeConditions).toEqual(['prone']);
    });

    it('monster corpse crossing sheds unconscious from its condition bucket; summary POST unchanged', async () => {
        rt.owners.Goblin = { activeConditions: ['unconscious'] };
        net.envelopes.push({
            combatSummary: { round: 1, creatures: [{ name: 'Goblin', type: 'monster', maxHp: 7, currentHp: 0 }] },
        });

        const result = await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Goblin');
        await flush();

        expect(setRuntimeBatch).not.toHaveBeenCalled();
        expect(rt.writes).toEqual([
            ['Goblin', 'activeConditions', [], CAMPAIGN, undefined],
        ]);
        expect(net.summaryPosts).toHaveLength(1);
        expect(net.summaryPosts[0].creatures[0].currentHp).toBe(1);
        expect(result.payload.finalHeal).toBe(1);
    });

    it('living 18-HP unconscious target: refusal through the REAL dead gate sheds nothing and never reads the condition bucket', async () => {
        seedCorpse('Ally', ['unconscious']);
        rt.owners.Ally.currentHitPoints = 18; // stale isDead over living HP
        queuePlayerRow('Ally');

        const result = await triggerRevivify(spell, {}, caster, CAMPAIGN, 'Ally');
        await flush();

        expect(result.payload.description).toBe(
            'Ally is not dead. Revivify can only target a creature that has died within the last minute.');
        expect(rt.writes).toEqual([]);
        expect(rt.owners.Ally.activeConditions).toEqual(['unconscious']); // untouched
        const condReads = rt.reads.filter(([, key]) => key === 'activeConditions');
        expect(condReads).toEqual([]); // zero-behaviour-change on refusal lanes
    });
});
