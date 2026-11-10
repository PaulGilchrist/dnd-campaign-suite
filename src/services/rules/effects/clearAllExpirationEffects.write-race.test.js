// @maintained-by-ai
/**
 * Write-batch pin for the rest/initiative seam (bug-sheet-initiative-seam-
 * resurrects-rider-conditions, MA-0809 / playbook §5 family).
 *
 * The real setRuntimeValue/setRuntimeObject POST a FULL-REPLACE snapshot of
 * the character's change-data bucket, captured AT CALL TIME, to the same
 * /api/campaigns/:c/<Name> endpoint; same-endpoint requests can reorder
 * network-side, so a snapshot taken BEFORE the condition strip lands can win
 * the last-write race and resurrect purged conditions while the log honestly
 * records the removal (live-proved 2026-11-10: sheet-lane initiative re-roll
 * left ['poisoned','paralyzed'] settled after "10-round clock expired" rows).
 *
 * This harness reproduces the snapshot semantics: every mutation records the
 * full store as ISSUED at that moment. The pinned law:
 *   1. NO snapshot ever issued for the victim's own bucket may carry the
 *      pre-strip condition pair — the clock strips run FIRST, so every later
 *      snapshot already carries the stripped state;
 *   2. the FINAL settled write of the victim's bucket (last issued) carries
 *      the complete truth: conditions [], meta purged, buffs 8-hour-preserved,
 *      outgoing queue stamped empty;
 *   3. the victim's own bucket receives exactly ONE post-strip full-store
 *      snapshot (the merged self write) — siblings never re-POST stale state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const harness = vi.hoisted(() => {
    const stores = new Map();
    const issued = [];
    const norm = (v) => JSON.stringify(v === undefined ? null : v);
    const snap = (name) => JSON.parse(JSON.stringify(Object.fromEntries(stores.get(name) || [])));
    const store = (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        return stores.get(name);
    };
    return {
        issued,
        seed(name, obj) { stores.set(name, new Map(Object.entries(obj))); },
        reset() { stores.clear(); issued.length = 0; },
        postsFor(name) { return issued.filter((p) => p.name === name); },
        getRuntimeValue: (name, key) => {
            const s = store(name);
            return s.has(key) ? s.get(key) : null;
        },
        setRuntimeValue(name, key, value) {
            const s = store(name);
            if (s.has(key) && norm(s.get(key)) === norm(value)) return;
            s.set(key, value);
            issued.push({ name, snapshot: snap(name) });
        },
        setRuntimeObject(name, obj) {
            const s = store(name);
            let changed = false;
            // KEY-presence parity with the real valuesEqual(undefined, null)
            // = false: null-stamping an absent key mutates the store.
            for (const [key, value] of Object.entries(obj)) {
                if (!s.has(key) || norm(s.get(key)) !== norm(value)) { s.set(key, value); changed = true; }
            }
            if (changed) issued.push({ name, snapshot: snap(name) });
        },
        getAllStoreKeys: () => Array.from(stores.keys()),
    };
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: harness.getRuntimeValue,
    setRuntimeValue: harness.setRuntimeValue,
    setRuntimeObject: harness.setRuntimeObject,
    getAllStoreKeys: harness.getAllStoreKeys,
}));

vi.mock('../../ui/utils.js', () => ({
    default: { getName: vi.fn((val) => String(val)) },
}));

vi.mock('../../ui/storage.js', () => ({
    default: { set: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 5),
    getActiveCreatureName: vi.fn(() => 'Goblin'),
    getCombatSummary: vi.fn(() => null),
    loadCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

// Stub the summon sweep (rest-lane semantics owned by
// clearAllExpirationEffects_rest_cleanup.test.js) so the seam's snapshot
// count reflects this file's lane only.
vi.mock('../../combat/summons/summonedCreatureService.js', () => ({
    removeSummonedCreatures: vi.fn(),
}));

import { clearAllExpirationEffects } from './expirations.js';
import { addEntry } from '../../ui/logService.js';
import { removeSummonedCreatures } from '../../combat/summons/summonedCreatureService.js';

const VICTIM = 'AberrantSorcerer';
const ATTACKER = 'Thri-Kreen';
const CAMPAIGN = 'MyCampaign';
const KEY = 'pendingExpirations';
const DIAL_BUFF = { name: 'Warding Bond', effect: 'warding_bond', saveBonus: -25, sourceCharacter: 'ElderPaladin' };

// The live repro bytes: one finite-round rider clock carrying BOTH conditions,
// meta stamped at grant, and the warding_bond dial buff in activeBuffs.
function seedReproState() {
    harness.seed(VICTIM, {
        activeConditions: ['poisoned', 'paralyzed'],
        activeConditionMeta: { poisoned: { dc: 11 }, paralyzed: { dc: 11, source: ATTACKER } },
        activeBuffs: [DIAL_BUFF],
        currentHitPoints: 40,
    });
    harness.seed(ATTACKER, {
        [KEY]: [{
            target: VICTIM,
            effects: [{ type: 'condition', condition: 'poisoned' }, { type: 'condition', condition: 'paralyzed' }],
            appliedRound: 1,
            expiryRounds: 10,
            expireOnCreatureName: null,
        }],
    });
}

describe('clearAllExpirationEffects — same-endpoint snapshot race (§5 MA-0809)', () => {
    beforeEach(() => {
        harness.reset();
        vi.clearAllMocks();
        addEntry.mockResolvedValue(undefined);
    });

    it('never issues a victim-bucket snapshot carrying the pre-strip condition pair', () => {
        seedReproState();

        clearAllExpirationEffects(VICTIM, CAMPAIGN);

        const victimPosts = harness.postsFor(VICTIM);
        expect(victimPosts.length).toBeGreaterThan(0);
        for (const post of victimPosts) {
            const conds = post.snapshot.activeConditions || [];
            // The exact resurrection fingerprint must never reach the wire.
            expect(conds).not.toEqual(expect.arrayContaining(['poisoned', 'paralyzed']));
        }
        // The FIRST victim-bucket write is already a strip: poisoned gone from
        // the moment the bucket starts mutating (siblings run after the sweep).
        expect(victimPosts[0].snapshot.activeConditions).not.toContain('poisoned');
    });

    it('settles: final write strips conditions AND meta, preserves 8-hour buffs, empties the queue', () => {
        harness.seed(VICTIM, {
            activeConditions: ['poisoned', 'paralyzed', 'blinded'],
            activeConditionMeta: { poisoned: { dc: 11 }, paralyzed: { dc: 11 } },
            activeBuffs: [DIAL_BUFF, { name: 'Mage Armor' }],
            mantleOfMajestyActive: true,
        });
        harness.seed(ATTACKER, {
            [KEY]: [{
                target: VICTIM,
                effects: [{ type: 'condition', condition: 'poisoned' }, { type: 'condition', condition: 'paralyzed' }],
                appliedRound: 1,
                expiryRounds: 10,
            }],
        });

        clearAllExpirationEffects(VICTIM, CAMPAIGN);

        const settled = harness.postsFor(VICTIM).at(-1).snapshot;
        expect(settled.activeConditions).toEqual(['blinded']);
        expect(settled.activeConditionMeta).toEqual({});
        expect(settled.activeBuffs).toEqual([{ name: 'Mage Armor' }]);
        expect(settled.mantleOfMajestyActive).toBeNull();
        expect(settled[KEY]).toEqual([]);
        // Honest provenance rows survive the batching (every clock leg logs).
        const removed = addEntry.mock.calls.filter(([, e]) => e.type === 'condition' && e.action === 'removed');
        expect(removed.length).toBe(2);
        expect(removed.map(([, e]) => e.condition)).toEqual(['Poisoned', 'Paralyzed']);
    });

    it('issues exactly ONE post-strip full-store snapshot of the victim bucket (merged self write)', () => {
        seedReproState();
        removeSummonedCreatures.mockClear();

        clearAllExpirationEffects(VICTIM, CAMPAIGN);

        expect(removeSummonedCreatures).toHaveBeenCalledWith(VICTIM, CAMPAIGN);
        // The twin-condition clock strips as ONE atomic snapshot plus
        // exactly ONE merged self write — the pre-fix seam issued a dozen
        // stale clearSelfBuffs/outgoing-stamp snapshots of this endpoint,
        // any of which could arrive last and resurrect the pair.
        const victimPosts = harness.postsFor(VICTIM);
        expect(victimPosts.length).toBe(2);
        expect(victimPosts.at(-1).snapshot.activeConditions).toEqual([]);
        expect(victimPosts.at(-1).snapshot.activeConditionMeta).toEqual({});
        expect(victimPosts.at(-1).snapshot.activeBuffs).toEqual([]);
    });

    it('trims the attacker queue in one write so the fired clock cannot resurrect', () => {
        seedReproState();

        clearAllExpirationEffects(VICTIM, CAMPAIGN);

        const attackerPosts = harness.postsFor(ATTACKER);
        expect(attackerPosts.length).toBe(1);
        expect(attackerPosts[0].snapshot[KEY]).toEqual([]);
        // Last-write-wins on a single snapshot: any arrival order settles trimmed.
        expect(attackerPosts.at(-1).snapshot[KEY]).toEqual([]);
    });

    it('adversarial arrival order: any permutation of the issued victim snapshots settles condition-free', () => {
        seedReproState();

        clearAllExpirationEffects(VICTIM, CAMPAIGN);

        // The atomic per-entry strip + merged self write mean EVERY snapshot
        // of the victim bucket already carries the stripped state — even a
        // full REVERSE-order arrival (the pathological permutation) cannot
        // resurrect the pair.
        const victimPosts = harness.postsFor(VICTIM);
        const reversed = [...victimPosts].reverse();
        for (const post of reversed) {
            expect(post.snapshot.activeConditions).toEqual([]);
            expect(post.snapshot.activeConditionMeta).toEqual({});
        }
        const lastArrival = reversed[0];
        expect(lastArrival.snapshot.activeConditions).toEqual([]);
        expect(lastArrival.snapshot.activeConditionMeta).toEqual({});
    });

    it('short-rest idiom preserved: a second seam run over the settled store issues no stale writes', () => {
        seedReproState();
        clearAllExpirationEffects(VICTIM, CAMPAIGN);
        const firstRun = harness.issued.length;
        harness.issued.length = 0;

        clearAllExpirationEffects(VICTIM, CAMPAIGN);

        // Everything is already at rest: only the coverRefresh + queue/stamp
        // bookkeeping may re-issue, never a condition-carrying snapshot.
        for (const post of harness.postsFor(VICTIM)) {
            expect(post.snapshot.activeConditions || []).toEqual([]);
        }
        expect(firstRun).toBeGreaterThan(0);
    });
});
