// @maintained-by-ai
// Marker lifecycle (create/consume/drop buckets) for the pending opportunity-
// attack registry (bug-monster-oa-resolution-auto-missed-by-melee-range-gate).
// Storage doctrine mirrors pendingSavePrompts: campaign-level object keyed by
// DEFENDER, spread-clone writes, drain-to-evict (the last row DELETEs the key
// so no `pendingOAs:{}` dust replays on SSE reconnect). Trigger-seam arming is
// pinned in opportunityTrigger.test.js; card/sheet press lanes are pinned in
// their component siblings. This file owns: arm merge/shape, clear + evict,
// clearAll, mover-liveness matrix (away/dead/off-board), prune, and the melee
// attack-row picker.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
    deleteRuntimeKey: vi.fn(),
}));

import {
    armPendingOas,
    getPendingOa,
    clearPendingOa,
    clearAllPendingOas,
    isPendingOaLive,
    prunePendingOas,
    findMeleeAttackRow,
    buildOaResolutionLog,
    PENDING_OA_KEY,
} from './pendingOpportunityAttacks.js';
import { getRuntimeValue, setRuntimeValue, deleteRuntimeKey } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

const bucketWrites = () => setRuntimeValue.mock.calls.filter(c => c[0] === 'campaign' && c[1] === PENDING_OA_KEY);

/** Seed the stored bucket the runtime mock will hand back on reads. */
function primeBucket(map) {
    getRuntimeValue.mockImplementation((store, key) =>
        (store === 'campaign' && key === PENDING_OA_KEY) ? map : null);
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
});

describe('armPendingOas (trigger seam write)', () => {
    it('arms one marker per defender naming the mover, one merged bucket write', () => {
        primeBucket(null);
        armPendingOas(CAMPAIGN, ['Goblin', 'Ogre'], 'EvasiveFighter');
        const writes = bucketWrites();
        expect(writes).toHaveLength(1);
        const map = writes[0][2]; // value arg (characterKey, key, value, campaignName)
        expect(map.Goblin).toEqual({ defender: 'Goblin', mover: 'EvasiveFighter', promptId: expect.any(String) });
        expect(map.Ogre.defender).toBe('Ogre');
        expect(map.Goblin.promptId).not.toBe(map.Ogre.promptId);
        expect(writes[0][3]).toBe(CAMPAIGN);
    });

    it('spread-clones over existing markers (no in-place mutation, no lost rows)', () => {
        const prior = { Hobgoblin: { defender: 'Hobgoblin', mover: 'X', promptId: 'p-1' } };
        primeBucket(prior);
        armPendingOas(CAMPAIGN, ['Goblin'], 'Y');
        const written = bucketWrites()[0][2];
        expect(written.Hobgoblin).toBe(prior.Hobgoblin);
        expect(written.Goblin.mover).toBe('Y');
        expect(prior.Goblin).toBeUndefined(); // stored reference untouched
    });

    it.each([
        ['no defenders', []],
        ['non-array defenders', 'Goblin'],
    ])('%s ⇒ zero writes', (_desc, defenders) => {
        primeBucket(null);
        armPendingOas(CAMPAIGN, defenders, 'Mover');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('a re-trigger re-arms the same defender with the NEW provoking mover', () => {
        primeBucket({ Goblin: { defender: 'Goblin', mover: 'Old', promptId: 'p-old' } });
        armPendingOas(CAMPAIGN, ['Goblin'], 'New');
        expect(bucketWrites()[0][2].Goblin).toEqual({ defender: 'Goblin', mover: 'New', promptId: expect.any(String) });
    });
});

describe('getPendingOa (read lane)', () => {
    it('returns the defender\'s marker, or null for other defenders / empty store', () => {
        const map = { Goblin: { defender: 'Goblin', mover: 'M', promptId: 'p' } };
        primeBucket(map);
        expect(getPendingOa(CAMPAIGN, 'Goblin')).toBe(map.Goblin);
        expect(getPendingOa(CAMPAIGN, 'Nobody')).toBeNull();
        getRuntimeValue.mockReturnValue(null);
        expect(getPendingOa(CAMPAIGN, 'Goblin')).toBeNull();
    });

    it('a junk stored array is read as empty (shape-trust guard)', () => {
        primeBucket([{ bogus: true }]);
        expect(getPendingOa(CAMPAIGN, 'bogus')).toBeNull();
    });
});

describe('clearPendingOa (consume/drop)', () => {
    it('removes one marker; surviving rows ride a broadcast write', () => {
        primeBucket({ Goblin: { mover: 'A' }, Ogre: { mover: 'B' } });
        expect(clearPendingOa(CAMPAIGN, 'Goblin')).toBe(true);
        const written = bucketWrites()[0][2];
        expect(written).toEqual({ Ogre: { mover: 'B' } });
        expect(deleteRuntimeKey).not.toHaveBeenCalled();
    });

    it('the LAST row evicts the key outright (drain-to-evict — no `pendingOAs:{}` replay dust)', () => {
        primeBucket({ Goblin: { mover: 'A' } });
        expect(clearPendingOa(CAMPAIGN, 'Goblin')).toBe(true);
        expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
        expect(bucketWrites()).toHaveLength(0);
    });

    it('no marker for that defender ⇒ false with ZERO writes (turn seams are cheap no-ops)', () => {
        primeBucket({ Ogre: { mover: 'B' } });
        expect(clearPendingOa(CAMPAIGN, 'Goblin')).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(deleteRuntimeKey).not.toHaveBeenCalled();
        clearPendingOa(CAMPAIGN, 'Goblin'); // empty bucket too
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('clearAllPendingOas (new initiative / Initiative Clear)', () => {
    it('empty or absent bucket ⇒ false, zero writes', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(clearAllPendingOas(CAMPAIGN)).toBe(false);
        primeBucket({});
        expect(clearAllPendingOas(CAMPAIGN)).toBe(false);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(deleteRuntimeKey).not.toHaveBeenCalled();
    });

    it('armed bucket ⇒ one DELETE, no `{}` POST', () => {
        primeBucket({ Goblin: { mover: 'A' }, Ogre: { mover: 'B' } });
        expect(clearAllPendingOas(CAMPAIGN)).toBe(true);
        expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('isPendingOaLive (mover presence truth)', () => {
    const cs = (creatures) => ({ creatures });
    const marker = { defender: 'Goblin', mover: 'Hero', promptId: 'p' };

    it.each([
        ['mover row present with hp', cs([{ name: 'Hero', currentHp: 7 }]), true],
        ['mover row without a currentHp field (hp unknown ≠ dead)', cs([{ name: 'Hero' }]), true],
        ['mover row at 0 hp (dead)', cs([{ name: 'Hero', currentHp: 0 }]), false],
        ['mover row away', cs([{ name: 'Hero', currentHp: 9, away: true }]), false],
        ['mover row missing from the board (left the encounter)', cs([{ name: 'Someone Else' }]), false],
        ['no combat summary (board truth unknown ⇒ never invent a denial)', null, true],
        ['summary without a creatures array (gridless)', { round: 1 }, true],
    ])('%s ⇒ %s', (_desc, summary, expected) => {
        expect(isPendingOaLive(summary, marker)).toBe(expected);
    });

    it('a malformed marker (no mover) is never live', () => {
        expect(isPendingOaLive(cs([{ name: 'Hero' }]), { defender: 'Goblin' })).toBe(false);
        expect(isPendingOaLive(cs([]), null)).toBe(false);
    });
});

describe('prunePendingOas (mover-left-encounter eviction)', () => {
    it('keeps live markers, drops stale movers, one write with the survivors', () => {
        primeBucket({
            Goblin: { defender: 'Goblin', mover: 'Hero', promptId: 'p1' },
            Ogre: { defender: 'Ogre', mover: 'FallenPaladin', promptId: 'p2' },
        });
        const summary = {
            creatures: [
                { name: 'Hero', currentHp: 5 },
                { name: 'FallenPaladin', currentHp: 0 }, // dead
            ],
        };
        expect(prunePendingOas(CAMPAIGN, summary)).toBe(1);
        expect(bucketWrites()[0][2]).toEqual({ Goblin: { defender: 'Goblin', mover: 'Hero', promptId: 'p1' } });
    });

    it('every mover gone ⇒ last bucket evicted (drain-to-evict)', () => {
        primeBucket({ Goblin: { mover: 'Ghost' } });
        expect(prunePendingOas(CAMPAIGN, { creatures: [] })).toBe(1);
        expect(deleteRuntimeKey).toHaveBeenCalledWith('campaign', PENDING_OA_KEY, CAMPAIGN);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('empty bucket ⇒ zero writes, zero count', () => {
        primeBucket(null);
        expect(prunePendingOas(CAMPAIGN, { creatures: [{ name: 'Hero' }] })).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(deleteRuntimeKey).not.toHaveBeenCalled();
    });

    it('nothing stale ⇒ zero writes (turn seams never churn the broadcast)', () => {
        const mark = { defender: 'Goblin', mover: 'Hero', promptId: 'p1' };
        primeBucket({ Goblin: mark });
        expect(prunePendingOas(CAMPAIGN, { creatures: [{ name: 'Hero', currentHp: 3 }] })).toBe(0);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(deleteRuntimeKey).not.toHaveBeenCalled();
    });
});

describe('findMeleeAttackRow (monster OA attack picker)', () => {
    const goblinActions = [
        { name: 'Scimitar', attack_bonus: 4, reach: '5 ft.', description: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.' },
        { name: 'Shortbow', attack_bonus: 4, description: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target.' },
    ];

    it('picks the first authored melee attack row', () => {
        expect(findMeleeAttackRow(goblinActions).name).toBe('Scimitar');
    });

    it('a ranged row listed first does not shadow the melee row', () => {
        expect(findMeleeAttackRow([goblinActions[1], goblinActions[0]]).name).toBe('Scimitar');
    });

    it('rows without an attack_bonus (save/trait rows) and long-reach clauses are handled honestly', () => {
        expect(findMeleeAttackRow([
            { name: 'Rock', save_dc: 12, save_type: 'dex', description: 'Recharge 6.' },
            { name: 'Long Reach', attack_bonus: 9, reach: '15 ft.', description: 'Melee Weapon Attack.' },
        ]).name).toBe('Long Reach');
    });

    it.each([
        ['no actions', undefined],
        ['empty actions', []],
        ['only ranged attacks', [{ name: 'Shortbow', attack_bonus: 4, description: 'Ranged Weapon Attack.' }]],
        ['only save rows', [{ name: 'Breath', save_dc: 15 }]],
    ])('%s ⇒ null (affordance degrades to the manual-adjudication note)', (_desc, actions) => {
        expect(findMeleeAttackRow(actions)).toBeNull();
    });
});

describe('buildOaResolutionLog (provenance row)', () => {
    it('names the trigger exactly: mover + defender reach phrasing', () => {
        const entry = buildOaResolutionLog({ defenderName: 'Goblin', moverName: 'EvasiveFighter' });
        expect(entry.description).toBe('Goblin makes an opportunity attack against EvasiveFighter, who left Goblin\'s reach.');
        expect(entry).toEqual(expect.objectContaining({
            type: 'automation',
            automationType: 'opportunity_attack',
            creatureName: 'Goblin',
            name: 'Opportunity Attack',
            targetName: 'EvasiveFighter',
        }));
    });
});
