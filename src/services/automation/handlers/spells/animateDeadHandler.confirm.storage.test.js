// @maintained-by-ai
/**
 * animateDead SEXTET lane #1864 confirm.storage — per the seam map in
 * animateDeadHandler.confirm.details.test.js, this lane owns the confirm
 * path's PERSISTED writes and campaign log:
 *  - storage.set('combatSummary', ...) — detached clone, exact serialised payload
 *  - setRuntimeValue('campaign', 'targetEffects', ...) — stored te preserved +
 *    spawn markers appended; exact 4-arg pin also guards arity (fresh writes
 *    must broadcast — skipSync is for SSE-echoed writes only, server-first)
 *  - §18 D2 enforcement.turnLock branch: off ⇒ zero turnState writes;
 *    on ⇒ spawns registered as companions in the persisted turnState,
 *    pre-existing entries preserved verbatim (built here, not assumed —
 *    no other lane exercises this branch)
 *  - summons log entry via addEntry (full-string description, exact names) +
 *    matching result.logEntries return contract + rejection containment
 *  - initiative-rolled dispatch (UI refresh only — no game timers)
 *  - action.metadata maxTargets write (received via handoff from details lane):
 *    persists slot-derived maxTargets (lv4 ⇒ 3), merges onto existing metadata
 *
 * NOT this lane: write ordering under multi-cast (#1866 multicast), initiative
 * share/fallback/sort (#1863 initiative), spawn stat assembly + popup prose
 * (details lane), zero-total popup prose + spawn field spot-checks (#1865).
 *
 * Deterministic: every external seam mocked, caster's stated initiative '15'
 * makes resolveCasterInitiative roll-free, V8 stable sort keeps tie order.
 * makeAction MERGES overrides (automation included) — never replaces wholesale.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        get: vi.fn(),
        set: vi.fn(),
    },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn().mockImplementation((monster) => {
        const map = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
        for (const [abbr] of Object.entries(map)) {
            if (monster.saving_throws?.[abbr]?.modifier != null) {
                map[abbr] = monster.saving_throws[abbr].modifier;
            }
        }
        return map;
    }),
    getNextUniqueMonsterName: (baseName, creatures) => {
        const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const numberedPattern = new RegExp(`^${escaped} (\\d+)$`);
        let maxNum = 0;
        let hasExact = false;
        for (const c of creatures) {
            if (c.name === baseName) hasExact = true;
            const m = c.name.match(numberedPattern);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
        if (hasExact && maxNum === 0) return `${baseName} 1`;
        return `${baseName} ${maxNum + 1}`;
    },
}));

import { confirmAnimateDead } from './animateDeadHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import storage from '../../../ui/storage.js';

const mockPlayerStats = {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};
const mockCampaignName = 'test-campaign';

const mockSkeleton = {
    index: 'skeleton',
    name: 'Skeleton',
    type: 'Undead',
    armor_class: 13,
    hit_points: 13,
    damage_resistances: [],
    damage_immunities: [],
    immunities: [],
    saving_throws: {},
    initiative_details: '+2',
};

const mockZombie = {
    index: 'zombie',
    name: 'Zombie',
    type: 'Undead',
    armor_class: 8,
    hit_points: 22,
    damage_resistances: [],
    damage_immunities: [],
    immunities: [],
    saving_throws: {},
    initiative_details: '-1',
};

function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Animate Dead',
        ...rest,
        automation: { type: 'animate_dead', ...automationOverrides },
    };
}

// Fresh mutable combat summary; the handler mutates it in place, so re-arm
// via summary() between casts that must not see each other's spawns.
function summary() {
    const cs = {
        creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
    };
    getCombatSummary.mockReturnValue(cs);
    return cs;
}

function storageWritesFor(key) {
    return storage.set.mock.calls.filter(c => c[0] === key);
}

function targetEffectsWrite() {
    const call = setRuntimeValue.mock.calls.find(c => c[1] === 'targetEffects');
    return call && call[2];
}

describe('confirmAnimateDead - storage, runtime writes and campaign log', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks KEEPS mockImplementations — reset so per-test
        // getRuntimeValue fakes (stored te / enforcement) never bleed forward.
        getRuntimeValue.mockReset();
        summary();
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it('persists a detached clone of combatSummary with the spawn serialised', async () => {
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const writes = storageWritesFor('combatSummary');
        expect(writes).toHaveLength(1);
        expect(writes[0][0]).toBe('combatSummary');
        expect(writes[0][2]).toBe(mockCampaignName);

        const payload = writes[0][1];
        expect(payload).not.toBe(cs);
        // Spawn shares the caster's stated 15; stable sort keeps caster first.
        expect(payload).toEqual({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
                {
                    name: 'Skeleton 1',
                    type: 'npc',
                    monsterType: 'Undead',
                    initiative: '15',
                    targetName: null,
                    ac: 13,
                    resistances: [],
                    immunities: [],
                    concentration: null,
                    maxHp: 13,
                    currentHp: 13,
                    saveBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
                    monsterIndex: 'skeleton',
                },
            ],
        });

        // Detached: mutating the live summary after the write cannot rewrite it.
        cs.creatures.push({ name: 'Post-write Phantom' });
        expect(payload.creatures).toHaveLength(2);
        expect(payload.creatures.map(c => c.name)).toEqual(['TestCaster', 'Skeleton 1']);
    });

    it('writes targetEffects: stored entries preserved, spawn markers appended, exact 4 args (fresh write — never skipSync)', async () => {
        const storedTe = [{ target: 'Goblin', source: 'Other', effect: 'bleeding' }];
        getRuntimeValue.mockImplementation((_entity, key) =>
            key === 'targetEffects' ? storedTe : undefined);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        // 4-arg pin fixes arity: a sneak-added skipSync here would desync
        // every client from the SSE broadcast (server-first gotcha).
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Goblin', source: 'Other', effect: 'bleeding' },
                { target: 'Skeleton 1', source: 'TestCaster', effect: 'summoned' },
                { target: 'Zombie 1', source: 'TestCaster', effect: 'summoned' },
            ],
            mockCampaignName,
        );
    });

    it('zero-total cast writes nothing: no storage, no runtime, no log, no event, metadata untouched', async () => {
        const action = makeAction();

        const result = await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 0, zombieCount: 0 },
        );

        expect(result.type).toBe('popup');
        expect(storage.set).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(action.metadata).toBeUndefined();
    });

    it('dispatches exactly one bare initiative-rolled event (UI refresh — no detail payload)', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        const evt = dispatchSpy.mock.calls[0][0];
        expect(evt.type).toBe('initiative-rolled');
        // DOM spec: CustomEvent without a detail init lands on null, not undefined.
        expect(evt.detail).toBeNull();
        dispatchSpy.mockRestore();
    });

    it('logs summons entry: full description string and exact spawn names', async () => {
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 2 },
        );

        expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
            type: 'summons',
            characterName: 'TestCaster',
            summonName: 'Animate Dead',
            description: 'TestCaster casts Animate Dead (slot level 3), creating 3 undead creature(s).',
            summonedCreatures: ['Skeleton 1', 'Zombie 1', 'Zombie 2'],
            timestamp: expect.any(Number),
        });
    });

    it('returns logEntries identical to the persisted log entry', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        expect(result.logEntries).toEqual([
            expect.objectContaining({
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Animate Dead',
                description: 'TestCaster casts Animate Dead (slot level 3), creating 2 undead creature(s).',
                summonedCreatures: ['Skeleton 1', 'Zombie 1'],
                timestamp: expect.any(Number),
            }),
        ]);
        // Same prose as what went to the log service — one composition, two outlets.
        expect(result.logEntries[0].description).toBe(addEntry.mock.calls[0][1].description);
        expect(result.logEntries[0].summonedCreatures).toEqual(addEntry.mock.calls[0][1].summonedCreatures);
    });

    it('persists slot-derived maxTargets onto action.metadata (lv4 upcast ⇒ 3)', async () => {
        const action = makeAction({ automation: { slotLevel: 4 } });

        await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(action.metadata).toEqual({ animateDeadMaxTargets: 3 });
    });

    it('merges metadata when it already exists', async () => {
        const action = makeAction({ metadata: { existingKey: 'value' } });

        await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(action.metadata).toEqual({
            existingKey: 'value',
            animateDeadMaxTargets: 1,
        });
    });

    it('enforcement off (default): combatSummary is the only storage write — zero turnState writes', async () => {
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        expect(storage.set.mock.calls.map(c => c[0])).toEqual(['combatSummary']);
        expect(targetEffectsWrite()).toHaveLength(2);
    });

    it('enforcement.turnLock on: spawns persist as companions, pre-existing turnState entries preserved verbatim', async () => {
        const storedTs = { 'Skeleton 9': { companionOf: 'Other', reactionsUsed: 1 } };
        getRuntimeValue.mockImplementation((_entity, key) => {
            if (key === 'enforcement') return { turnLock: true };
            if (key === 'turnState') return storedTs;
            return undefined;
        });

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        // §18 D2: turnState persists after combatSummary on the engaged branch.
        expect(storage.set.mock.calls.map(c => c[0])).toEqual(['combatSummary', 'turnState']);
        const tsWrite = storageWritesFor('turnState')[0];
        expect(tsWrite[2]).toBe(mockCampaignName);
        const ts = tsWrite[1];
        expect(ts).not.toBe(storedTs);
        expect(ts).toEqual({
            // Untouched raw entry carried through the clone.
            'Skeleton 9': { companionOf: 'Other', reactionsUsed: 1 },
            // Fresh companion entry: own economy, linked to the caster.
            'Skeleton 1': {
                actionsUsed: 0,
                bonusActionsUsed: 0,
                reactionsUsed: 0,
                movementUsedFeet: 0,
                hasMoved: false,
                turnActive: false,
                reactionCap: 1,
                companionOf: 'TestCaster',
            },
        });
    });

    it('log rejection is contained: addEntry failure does not abort confirm or skip metadata write', async () => {
        const action = makeAction();
        addEntry.mockRejectedValueOnce(new Error('log sink down'));

        const result = await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.type).toBe('popup');
        expect(result.logEntries).toHaveLength(1);
        expect(action.metadata).toEqual({ animateDeadMaxTargets: 1 });
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0][0]).toBe('[animateDeadHandler:log-error]');
        expect(consoleSpy.mock.calls[0][1]).toBeInstanceOf(Error);
    });
});
