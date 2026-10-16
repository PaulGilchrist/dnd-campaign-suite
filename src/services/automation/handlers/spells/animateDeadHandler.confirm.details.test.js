// @maintained-by-ai
/**
 * animateDead SEXTET seam map — all six lanes share animateDeadHandler.js:
 *  - #1863 confirm.initiative — resolveCasterInitiative share/fallback + byInitiativeDesc sort
 *  - #1864 confirm.storage    — storage.set('combatSummary') + setRuntimeValue('targetEffects')
 *                               writes, summons log entry, action.metadata maxTargets write
 *  - #1865 confirm (main)     — confirmAnimateDead happy path, zero-total guard,
 *                               combat-summary / monster-load failure popups, spawn field spot-checks
 *  - #1866 multicast          — multi-cast unique naming, te marker accumulation, write ordering
 *  - #1867 handle (main)      — modal/popup dispatch, getSlotLevel chain, getMaxTargets upcast table
 *  - THIS LANE (confirm.details) — spawn stat assembly in buildCreatureEntry (saveBonuses,
 *                               resistances + damage_immunities→immunities fallback) and the
 *                               confirm popup payload composition: pluralCountLabel description
 *                               full-string pin + automation pass-through.
 *
 * Handoff to later lanes:
 *  - #1865's loose contains-pins in 'creates skeletons and zombies when counts are provided'
 *    ('Skeleton' / 'Zombies' / 'right after you') are superseded by the full-string pin below.
 *  - action.metadata maxTargets on the confirm path is owned by #1864
 *    ('updates action metadata with max targets' + 'merges metadata when it already exists') —
 *    removed from this file as duplicate; initiative pins belong to #1863; spawn ac/maxHp
 *    field spot-checks belong to #1865 ('creates a skeleton/zombie with correct properties',
 *    'uses monster defaults when properties are missing').
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
import { getCombatSummary } from '../../../encounters/combatData.js';
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

    it('composes popup payload: full description string + automation pass-through', async () => {
        const action = makeAction({ automation: { slotLevel: 5 } });

        const result = await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2, zombieCount: 1 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe(
            'TestCaster casts Animate Dead, creating 1 Zombie and 2 Skeletons. They act on your turn, right after you.',
        );
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
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 0, zombieCount: 3 },
        );

        expect(spawnsOf(cs2, 'skeleton')).toHaveLength(0);
        expect(spawnsOf(cs2, 'zombie')).toHaveLength(3);
    });

    it('wires saveBonuses from monster saving_throws onto each spawn entry', async () => {
        const monsterWithSaves = {
            ...mockSkeleton,
            saving_throws: { dex: { modifier: 4 }, con: { modifier: 2 } },
        };
        loadMonsters.mockResolvedValue([monsterWithSaves, mockZombie]);
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        const skeleton = spawnsOf(cs, 'skeleton')[0];
        expect(skeleton.saveBonuses).toMatchObject({ str: 0, dex: 4, con: 2 });

        const zombie = spawnsOf(cs, 'zombie')[0];
        expect(zombie.saveBonuses).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    });

    it('copies damage_resistances and damage_immunities from the monster', async () => {
        loadMonsters.mockResolvedValue([{
            ...mockSkeleton,
            damage_resistances: ['bludgeoning', 'piercing'],
            damage_immunities: ['poison'],
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
        expect(skeleton.immunities).toEqual(['poison']);
    });

    it('falls back to immunities when damage_immunities is missing', async () => {
        const legacyMonster = {
            index: 'skeleton',
            name: 'Skeleton',
            type: 'Undead',
            armor_class: 13,
            hit_points: 13,
            damage_resistances: [],
            immunities: ['poison'],
            saving_throws: {},
        };
        loadMonsters.mockResolvedValue([legacyMonster, mockZombie]);
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = spawnsOf(cs, 'skeleton')[0];
        expect(skeleton.immunities).toEqual(['poison']);
    });
});
