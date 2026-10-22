// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

// EDGE-CASES lane. Sibling split (verified by headers):
//   revivifyService.test.js        — base: trigger/gates happy path, alive refusals,
//                                     consumeMaterial keying, result envelopes, 4-write order.
//   revivifyService.logging.test.js — log-entry happy-path bytes for revivals.
// THIS lane: boundary rows on both sides of every threshold — death-window (no clock),
//   negative-HP heals vs the literal-total popup, retry-after-revive diamond guard,
//   missing-field refusals, missing maxHp refuses PRE-CONSUME (#1407b fixed),
//   log-rejection swallow, caster-guard refuses PRE-CONSUME (#1407a fixed),
//   spend-log-never-lost blocked-heal arm, disk canon + drift detector.

const CAMPAIGN = 'TestCampaign';
const STAMP_MS = Date.UTC(2026, 9, 21, 12, 0, 0);

// ── Hoisted state ──────────────────────────────────────────────

const rt = vi.hoisted(() => ({
    owners: {},          // owner -> { key: value } (seeded per test)
    targetEffects: [],
    reads: [],         // exact ['owner','key'] census
    writes: [],        // exact [owner, key, value, campaign, skipSync] census
}));

const net = vi.hoisted(() => ({
    envelopes: [],       // queued full change-data bodies, consumed FIFO per trigger
    summaryPosts: [],    // storage.set('combatSummary', ...) payloads captured
    diamondChecks: [],   // consumeMaterial call census
    diamondAvailable: true,
}));

// ── Mocks ──────────────────────────────────────────────────────

// Argument-keyed STATEFUL runtime fake. Throws on unknown owner/key/campaign.
// NO time-like key is seeded ('deathTimestamp'/'diedAtRound' would THROW), so a
// wall-clock death-window comparison inside the service could not run: this file
// proves NO-CLOCK compliance for the RAW "died within the last minute" text by
// construction. The gate is state-only (isCreatureDead: runtime isDead/currentHitPoints
// for players, combatSummary.currentHp <= 0 for monsters — hpModifier.js:6-15).
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((owner, key, campaign) => {
        if (campaign !== undefined && campaign !== 'TestCampaign') {
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
        if (campaign !== 'TestCampaign') {
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
}));

// addEntry fake captures every log payload (never rejects unless a test overrides).
vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn((campaign) => {
        if (campaign !== 'TestCampaign') {
            throw new Error(`log fake: unexpected campaign "${campaign}"`);
        }
        return Promise.resolve();
    }),
}));

// consumeMaterial fake: exact diamond literal or THROWS (drift guard on the
// hardcoded key). PlayerStats guard now runs BEFORE consume (validateBeforeConsume, revivifyService.js:28,
// #1407a fix), so a malformed caster never reaches this fake — its strictness here
// is a second-line drift trap, not the live failure site (it was pre-fix).
vi.mock('../spells/materialComponents.js', () => ({
    consumeMaterial: vi.fn(async (stats, item, campaign) => {
        if (item !== 'Diamond (300 gp)') {
            throw new Error(`material fake: unexpected item "${item}"`);
        }
        if (campaign !== 'TestCampaign') {
            throw new Error(`material fake: unexpected campaign "${campaign}"`);
        }
        net.diamondChecks.push([stats?.name ?? null, item]);
        return net.diamondAvailable;
    }),
}));

// ── Imports ────────────────────────────────────────────────────

import { triggerRevivify } from './revivifyService.js';
import { consumeMaterial } from '../spells/materialComponents.js';
import { addEntry } from '../../ui/logService.js';

// ── Fakes / helpers ────────────────────────────────────────────

// Route-aware fetch fake: change-data serves the queued envelope FIFO; the
// storage combatSummary POST is captured; anything else THROWS (no silent holes,
// no never-resolving floats).
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

function makeSpell(name) {
    return { name };
}

function makeCaster(name) {
    return { name: name || 'Cleric' };
}

function queueCombat(round, creatures) {
    const envelope = { combatSummary: { round, creatures } };
    net.envelopes.push(envelope);
    return envelope;
}

function seedPlayer(name, currentHitPoints, isDead, hitPoints) {
    rt.owners[name] = {
        currentHitPoints,
        isDead,
        hitPoints,
        deathSaves: [false, false, true], // pre-existing failures cleared by revival
        deathFailures: [true, false, false],
    };
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

describe('triggerRevivify - edge cases', () => {
    let consoleError;

    beforeEach(() => {
        rt.owners = {};
        rt.targetEffects = [];
        rt.reads = [];
        rt.writes = [];
        net.envelopes = [];
        net.summaryPosts = [];
        net.diamondChecks = [];
        net.entries = [];
        net.diamondAvailable = true;
        vi.clearAllMocks(); // clears call records; vi.fn(impl) impls persist
        vi.useFakeTimers();
        vi.setSystemTime(STAMP_MS); // freezes the only Date.now(): log timestamp (:114)
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        vi.useRealTimers();
    });

    it('death window is not modeled: round 99 revival revives at 1 HP, full popup bytes, read census proves state-only gate (no clock)', async () => {
        const caster = makeCaster();
        seedPlayer('Ally', 0, 1, null); // dead at 0 HP; hitPoints null -> maxHp from summary
        const envelope = queueCombat(99, [{ name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' }]);

        const { events, stop } = trackSummaryEvents();
        const result = await triggerRevivify(makeSpell('Revivify'), {}, caster, CAMPAIGN, 'Ally');
        stop();

        // combatSummary.round is never consulted — dead-but-long-dead still revives.
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
        // Exact read-order census: isCreatureDead gate -> hoisted oldHp+maxHp
        // validation reads (#1407a/b validate-before-consume, pre-diamond) ->
        // heal-block seam -> modifyHitPoints (maxHp, oldHp) -> infernal-wound
        // seam. Zero time-key reads. The extra ['Ally','hitPoints'] here vs the
        // pre-fix 7-row census is the validate-before-consume hoist's read.
        expect(rt.reads).toEqual([
            ['Ally', 'isDead'],
            ['Ally', 'currentHitPoints'],
            ['Ally', 'currentHitPoints'],
            ['Ally', 'hitPoints'],
            ['campaign', 'targetEffects'],
            ['Ally', 'hitPoints'],
            ['Ally', 'currentHitPoints'],
            ['campaign', 'targetEffects'],
        ]);
        // Dead->alive latch flip in the canonical store; player summary placeholder
        // stays 0 (players are runtime-canonical, not summary-canonical).
        expect(rt.owners.Ally).toEqual({
            currentHitPoints: 1,
            isDead: 0,
            hitPoints: null,
            deathSaves: [false, false, false],
            deathFailures: [false, false, false],
        });
        expect(envelope.combatSummary.creatures[0].currentHp).toBe(0);
        expect(consumeMaterial).toHaveBeenCalledTimes(1);
        expect(consumeMaterial.mock.calls[0][0]).toBe(caster); // identity, not objectContaining
        expect(net.diamondChecks).toEqual([['Cleric', 'Diamond (300 gp)']]);
        // modifyHitPoints dispatches exactly once on non-zero delta (revivifyService.js:104).
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('combat-summary-updated');
        expect(events[0].detail).toBeNull();
        expect(consoleError).not.toHaveBeenCalled();
    });

    it('boundary compose: revive from -8 (finalHeal 9 vs literal total 1), retry refused post-revive without second diamond, monster -3 flips summary in place', async () => {
        const caster = makeCaster('Cleric');
        seedPlayer('Ally', -8, 1, 30);
        const allyEntry = { name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' };
        const goblinEntry = { name: 'Goblin', maxHp: 7, currentHp: -3, type: 'monster' };
        queueCombat(4, [allyEntry, goblinEntry]);
        queueCombat(4, [allyEntry, goblinEntry]);
        queueCombat(4, [allyEntry, goblinEntry]);
        const { events, stop } = trackSummaryEvents();

        // Stage A: player overkill-death at -8. Heal expression is 1 - oldHp = 9,
        // landing exactly at the RAW "1 hit point" floor; popup total/rawTotal stay
        // literal 1 while finalHeal reports the honest 9 (documented contradiction).
        const popA = await triggerRevivify(makeSpell('Revivify'), {}, caster, CAMPAIGN, 'Ally');
        expect(popA.payload).toEqual({
            type: 'heal',
            name: 'Revivify',
            targetName: 'Ally',
            finalHeal: 9,
            total: 1,
            formula: '1 HP (revived)',
            rolls: [],
            rawTotal: 1,
        });

        // Stage B: state has flipped to alive -> dead-gate refuses, diamond NOT re-consumed.
        const popB = await triggerRevivify(makeSpell('Revivify'), {}, caster, CAMPAIGN, 'Ally');
        expect(popB).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Ally is not dead. Revivify can only target a creature that has died within the last minute.',
            },
        });

        // Stage C: monster side of the same threshold, -3 -> 1 (heal 4).
        const popC = await triggerRevivify(makeSpell('Revivify'), {}, caster, CAMPAIGN, 'Goblin');
        expect(popC.payload.finalHeal).toBe(4);
        await flush();
        stop();

        // Full write census: exactly four writes (the player latch), all 4-arg —
        // skipSync undefined (canonical writes POST + SSE; skipSync is SSE-echo-only).
        // Monster revival writes NO runtime keys (summary-in-place instead).
        expect(rt.writes).toEqual([
            ['Ally', 'currentHitPoints', 1, CAMPAIGN, undefined],
            ['Ally', 'deathSaves', [false, false, false], CAMPAIGN, undefined],
            ['Ally', 'deathFailures', [false, false, false], CAMPAIGN, undefined],
            ['Ally', 'isDead', 0, CAMPAIGN, undefined],
        ]);
        // Latch flip observable at both dead->alive writers: store and by-reference summary.
        expect(allyEntry.currentHp).toBe(0);
        expect(goblinEntry.currentHp).toBe(1);
        expect(net.summaryPosts).toHaveLength(1);
        expect(net.summaryPosts[0].creatures.find((c) => c.name === 'Goblin').currentHp).toBe(1);
        // One diamond per actual revival (stage B refusal consumed nothing).
        expect(consumeMaterial).toHaveBeenCalledTimes(2);
        expect(events).toHaveLength(2); // stages A and C only
        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Living target refused: Ally'],
        ]);
        // Exact log bytes for both boundary heals, timestamp frozen at STAMP_MS.
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls[0]).toEqual(['TestCampaign', {
            type: 'hp_change', targetName: 'Ally', delta: 9, currentHp: 1, maxHp: 30,
            isHealing: true, sourceName: 'Cleric', note: 'Revivify', timestamp: STAMP_MS,
        }]);
        expect(addEntry.mock.calls[1]).toEqual(['TestCampaign', {
            type: 'hp_change', targetName: 'Goblin', delta: 4, currentHp: 1, maxHp: 7,
            isHealing: true, sourceName: 'Cleric', note: 'Revivify', timestamp: STAMP_MS,
        }]);
    });

    it('dead-gate refusals: monster entry with missing currentHp (cannot confirm dead), then case-sensitive name near-miss — exact bytes, zero side effects', async () => {
        const { events, stop } = trackSummaryEvents();

        // Side 1 of threshold: currentHp undefined != null -> treated alive -> refuse
        // BEFORE any diamond/HP/log work.
        queueCombat(2, [{ name: 'Unknown', maxHp: 50, type: 'monster' }]);
        const ref1 = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'Unknown');
        expect(ref1).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Unknown is not dead. Revivify can only target a creature that has died within the last minute.',
            },
        });

        // Side 2: name match is strict === — a case near-miss fails the lookup gate
        // (fires before the dead gate; the real dead 'Ally' entry is never examined).
        queueCombat(2, [{ name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' }]);
        const ref2 = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster(), CAMPAIGN, 'ally');
        expect(ref2).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'ally is not present in combat. Revivify can only target a creature that has died within the last minute.',
            },
        });
        stop();

        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Living target refused: Unknown'],
            ['[revivify] Target ally not found in combat summary'],
        ]);
        expect(rt.reads).toEqual([]);
        expect(rt.writes).toEqual([]);
        expect(consumeMaterial).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(net.summaryPosts).toEqual([]);
        expect(events).toEqual([]);
    });

    it('addEntry rejection is swallowed by the .catch at :115 — exact console prefix + same Error instance, revival persists, success envelope intact', async () => {
        seedPlayer('Ally', 0, 1, null);
        queueCombat(1, [{ name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' }]);
        const logError = new Error('log down');
        vi.mocked(addEntry).mockRejectedValueOnce(logError);

        const result = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster('Cleric'), CAMPAIGN, 'Ally');
        await flush();

        expect(consoleError).toHaveBeenCalledWith('[revivify] Error logging heal:', logError);
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
        // The failed log did NOT roll back the revive nor consume a second diamond.
        expect(rt.writes).toHaveLength(4);
        expect(rt.owners.Ally.currentHitPoints).toBe(1);
        expect(consumeMaterial).toHaveBeenCalledTimes(1);
    });

    it('unresolvable maxHp (runtime null + no summary maxHp): refuses BEFORE the diamond is consumed — zero spend, zero writes, zero log, exact bytes', async () => {
        seedPlayer('Ally', 0, 1, null); // hitPoints null AND summary entry carries no maxHp
        queueCombat(1, [{ name: 'Ally', currentHp: 0, type: 'player' }]); // no maxHp field
        const { events, stop } = trackSummaryEvents();

        const result = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster('Cleric'), CAMPAIGN, 'Ally');
        await flush();
        stop();

        // #1407b fixed: the old :50 ternary `applied ? applied.maxHp : (…) ?? 0`
        // shipped maxHp:undefined in the stamped log after the diamond was spent.
        // maxHp now resolves pre-consume (fix#5 parseHp law: refuse, never stamp
        // undefined, never fabricate 0 — auraOfVitalityHandler.js:106 precedent).
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Could not determine max HP for Ally. Revivify was refused and no diamond was consumed.',
            },
        });
        expect(consumeMaterial).not.toHaveBeenCalled(); // spend never happens
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]);
        expect(rt.owners.Ally.currentHitPoints).toBe(0); // stays dead
        expect(addEntry).not.toHaveBeenCalled();
        expect(net.summaryPosts).toEqual([]);
        expect(events).toEqual([]);
        expect(rt.reads).toEqual([
            ['Ally', 'isDead'],
            ['Ally', 'currentHitPoints'],
            ['Ally', 'currentHitPoints'], // hoisted oldHp
            ['Ally', 'hitPoints'],       // hoisted maxHp attempt -> null -> refuse
        ]);
        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Cannot determine maxHp for Ally (summary.maxHp=undefined, isPlayer=true) — refused, no diamond consumed'],
        ]);
    });

    it('undefined playerStats: caster guard refuses BEFORE consume (#1407a fixed) — diamond untouched, no half-commit, exact bytes', async () => {
        seedPlayer('Ally', 0, 1, 30);
        queueCombat(1, [{ name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' }]);
        const { events, stop } = trackSummaryEvents();

        // Pre-fix golden (flipped honest): the unguarded `playerStats.name` deref
        // in the post-consume log-build threw TypeError AFTER the HP commit —
        // diamond spent, writes landed, hp_change log lost forever, console silent.
        // Validate-before-consume (fix#22) makes the post-consume throw impossible
        // and the spend cannot outlive its audit: nothing is spent, so nothing to log.
        const result = await triggerRevivify(makeSpell('Revivify'), {}, undefined, CAMPAIGN, 'Ally');
        await flush();
        stop();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Revivify',
                automationType: 'revivify',
                description: 'Revivify cannot run: the caster is unknown. No diamond was consumed.',
            },
        });
        expect(consumeMaterial).not.toHaveBeenCalled(); // diamond NEVER spent
        expect(net.diamondChecks).toEqual([]);
        expect(rt.writes).toEqual([]); // no half-commit
        expect(rt.owners.Ally.currentHitPoints).toBe(0); // stays dead
        expect(addEntry).not.toHaveBeenCalled(); // no spend, no spend-audit owed
        expect(events).toEqual([]); // no combat-summary dispatch
        expect(consoleError.mock.calls).toEqual([
            ['[revivify] Caster name missing (playerStats=undefined) — refused, no diamond consumed'],
        ]);
    });

    it('spend-log-never-lost: heal-blocked after the diamond is spent — degraded store still lands the hp_change audit row exactly', async () => {
        // Degraded-store fixture: 'no_healing' te blocks the revive HEAL but the
        // diamond IS consumed (spend happened at :86) — the audit row must still
        // land. Post-consume there are zero fallible derefs: every log slot is a
        // pre-validated local or a proven-truthy applied row (healingBlock.js:40).
        seedPlayer('Ally', 0, 1, 30);
        rt.targetEffects = [{ target: 'Ally', effect: 'no_healing', source: 'Slaad' }];
        queueCombat(1, [{ name: 'Ally', maxHp: 30, currentHp: 0, type: 'player' }]);
        const { events, stop } = trackSummaryEvents();

        const result = await triggerRevivify(makeSpell('Revivify'), {}, makeCaster('Cleric'), CAMPAIGN, 'Ally');
        await flush();
        stop();

        expect(consumeMaterial).toHaveBeenCalledTimes(1); // spend is REAL
        // addEntry census: healingBlock's refusal row, then revivify's audit row —
        // the spend is never unlogged even though the heal was zeroed.
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(addEntry.mock.calls[0][1].type).toBe('automation');
        expect(addEntry.mock.calls[0][1].automationType).toBe('healing_blocked');
        expect(addEntry.mock.calls[1]).toEqual(['TestCampaign', {
            type: 'hp_change', targetName: 'Ally', delta: 0, currentHp: 0, maxHp: 30,
            isHealing: true, sourceName: 'Cleric', note: 'Revivify', timestamp: STAMP_MS,
        }]);
        // Blocked path: modifyHitPoints never runs -> no dispatch, no runtime writes.
        expect(events).toEqual([]);
        expect(rt.writes).toEqual([]);
        expect(result.payload.type).toBe('heal'); // success-shape popup with honest 0 heal
        expect(result.payload.finalHeal).toBe(0);
    });

    it('disk canon BOTH rulesets: Revivify lv3 V/S/M Instantaneous heal 1 HP; consume-key and popup formula are code-normalized literals, not disk bytes (drift detector)', () => {
        const disk5e = JSON.parse(fs.readFileSync('public/data/spells.json', 'utf8'));
        const disk2024 = JSON.parse(fs.readFileSync('public/data/2024/spells.json', 'utf8'));
        const rev5e = disk5e.find((s) => s.index === 'revivify');
        const rev24 = disk2024.find((s) => s.index === 'revivify');

        // 5e canon row (verbatim material byte from disk).
        expect(rev5e.level).toBe(3);
        expect(rev5e.components).toEqual(['V', 'S', 'M']);
        expect(rev5e.duration).toBe('Instantaneous');
        expect(rev5e.concentration).toBe(false);
        expect(rev5e.material).toBe('Diamonds worth 300gp, which the spell consumes.');
        expect(rev5e.description[0]).toMatch(/returns to life with 1 hit point/);

        // 2024 divergences reported honestly: school and material casing differ from 5e.
        expect(rev24.level).toBe(3);
        expect(rev24.school).toBe('Necromancy');
        expect(rev5e.school).toBe('Conjuration');
        expect(rev24.material).toBe('a diamond worth 300+ GP, which the spell consumes');
        expect(rev24.heal_at_slot_level).toEqual({ 3: '1' }); // RAW floor matches literal total 1

        // Drift detector: the consumed-item key and popup formula are HARDCODED in
        // revivifyService.js (:86, :127) and match neither disk material byte — an
        // intentional app normalization ("Diamond (300 gp)"). If either moves, this fails.
        const src = fs.readFileSync('src/services/rules/features/revivifyService.js', 'utf8');
        const consumeKey = src.match(/consumeMaterial\(playerStats, '([^']+)'/)[1];
        expect(consumeKey).toBe('Diamond (300 gp)');
        expect(rev5e.material.includes(consumeKey)).toBe(false);
        expect(rev24.material.includes(consumeKey)).toBe(false);
    });
});
