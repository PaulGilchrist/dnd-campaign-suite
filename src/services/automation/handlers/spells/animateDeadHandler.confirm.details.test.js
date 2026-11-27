// @maintained-by-ai 2026-11-27
/**
 * animateDead SEXTET seam map — all six lanes share animateDeadHandler.js:
 *  - #1863 confirm.initiative — resolveCasterInitiative share/fallback + byInitiativeDesc sort
 *  - #1864 confirm.storage    — storage.set('combatSummary') + setRuntimeValue('targetEffects')
 *                               writes, summons log entry, logEntries return contract,
 *                               action.metadata maxTargets write
 *  - #1865 confirm (main)     — confirmAnimateDead happy path, zero-total guard,
 *                               combat-summary / monster-load failure popups, spawn ac/maxHp
 *                               field spot-checks
 *  - #1866 multicast          — multi-cast unique naming, te marker accumulation, write ordering
 *  - #1867 handle (main)      — modal/popup dispatch, getSlotLevel chain, getMaxTargets upcast table
 *  - THIS LANE (confirm.details) — spawn stat assembly in buildCreatureEntry (saveBonuses
 *                               wiring, damage_resistances/damage_immunities copy with the
 *                               retired legacy `immunities` key pinned inert) and the confirm
 *                               popup payload composition: pluralCountLabel full-string pin +
 *                               automation pass-through identity.
 *
 * Deferred to stronger owners:
 *  - getMonsterSaveBonuses input semantics (six-key contract, saving_throws vs
 *    ability_score_modifiers precedence, full-name rows) → encounterToInitiative.test.js;
 *    this lane pins only that the helper's output lands on each spawn entry.
 *  - logEntries content → #1864 ('returns logEntries identical to the persisted log entry').
 *  - action.metadata maxTargets on the confirm path → #1864; initiative pins → #1863;
 *    spawn ac/maxHp defaults → #1865.
 *
 * Deterministic: every external seam mocked, no timers (undead persistence is flag-based,
 * combat-scoped), full-string description pin intentional per house style.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
        set: vi.fn(),
    },
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(),
}));

vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    // Sentinel, not a mirror of the real helper (its semantics are owned by
    // encounterToInitiative.test.js): output keyed by monster.index proves
    // per-spawn wiring reads the right monster without re-testing the helper.
    getMonsterSaveBonuses: vi.fn((monster) => ({ wiredFrom: monster.index })),
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
import { getCombatSummary } from '../../../encounters/combatData.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

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
};

// makeAction MERGES overrides (automation included) — never replaces wholesale.
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

function spawnsOf(cs, monsterIndex) {
    return cs.creatures.filter(c => c.monsterIndex === monsterIndex);
}

describe('confirmAnimateDead - spawn details and popup composition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        summary();
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('composes popup payload full-shape: description string + automation pass-through', async () => {
        const action = makeAction({ automation: { slotLevel: 5 } });

        const result = await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2, zombieCount: 1 },
        );

        expect(result.type).toBe('popup');
        // Exact keys — a sneak-added payload field fails here; logEntries
        // content is owned by #1864.
        expect(result.payload).toEqual({
            type: 'automation_info',
            name: 'Animate Dead',
            description: 'TestCaster casts Animate Dead, creating 1 Zombie and 2 Skeletons. They act on your turn, right after you.',
            automation: action.automation,
        });
        // Identity, not just equality: the live automation object is passed
        // through un-cloned so downstream metadata writes stay attached.
        expect(result.payload.automation).toBe(action.automation);
    });

    it('spawns only the requested type when the other count is zero', async () => {
        const cs1 = summary();
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2, zombieCount: 0 },
        );

        expect(spawnsOf(cs1, 'skeleton')).toHaveLength(2);
        expect(spawnsOf(cs1, 'zombie')).toHaveLength(0);

        const cs2 = summary();
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 0, zombieCount: 3 },
        );

        expect(spawnsOf(cs2, 'skeleton')).toHaveLength(0);
        expect(spawnsOf(cs2, 'zombie')).toHaveLength(3);
        // Single-label list: the empty label is filtered, never joined with ' and '.
        expect(result.payload.description).toBe(
            'TestCaster casts Animate Dead, creating 3 Zombies. They act on your turn, right after you.',
        );
    });

    it('wires getMonsterSaveBonuses output onto every spawn entry, once per spawn', async () => {
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2, zombieCount: 1 },
        );

        const skeletons = spawnsOf(cs, 'skeleton');
        expect(skeletons.map(c => c.saveBonuses)).toEqual([
            { wiredFrom: 'skeleton' },
            { wiredFrom: 'skeleton' },
        ]);
        expect(spawnsOf(cs, 'zombie')[0].saveBonuses).toEqual({ wiredFrom: 'zombie' });

        // Ordered census: one call per spawn, skeleton swarm before zombie swarm,
        // each fed its own monster record.
        expect(getMonsterSaveBonuses.mock.calls.map(c => c[0].index)).toEqual([
            'skeleton', 'skeleton', 'zombie',
        ]);
    });

    it('copies damage_resistances/damage_immunities and keeps the retired legacy `immunities` key inert', async () => {
        loadMonsters.mockResolvedValue([{
            ...mockSkeleton,
            damage_resistances: ['bludgeoning', 'piercing'],
            damage_immunities: ['poison'],
            immunities: ['necrotic'],
        }, mockZombie]);
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = spawnsOf(cs, 'skeleton')[0];
        expect(skeleton.resistances).toEqual(['bludgeoning', 'piercing']);
        // Exact-array: with damage_immunities present, the legacy key must
        // neither win nor merge in — no compat branch may return.
        expect(skeleton.immunities).toEqual(['poison']);
    });
});
