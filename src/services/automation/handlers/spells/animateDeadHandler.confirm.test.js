// @maintained-by-ai
/**
 * animateDead SEXTET lane #1865 confirm (main) — per the seam map in
 * animateDeadHandler.confirm.details.test.js, this lane owns:
 *  - confirmAnimateDead happy path: popup envelope + spawn-name presence
 *  - zero-total guard (counts 0 / undefined / partial) — short-circuits
 *    before combat summary or monster data are even touched
 *  - combat-summary missing and skeleton/zombie monster-load failure popups
 *  - spawn field spot-checks (ac/maxHp/type/targetName + missing-field defaults)
 *
 * Handoffs honored (removed as superseded):
 *  - popup prose ('Skeleton'/'Zombies'/'right after you') → details lane full-string pin
 *  - te write content → #1864 confirm.storage exact-array + 4-arg pins
 *  - unique numbering / marker accumulation per cast → #1866 multicast pins
 *  - initiative formula / sort order → #1863 initiative lane
 *  - enforcement.turnLock branch → #1864 storage lane (real resolveEnforcement
 *    defaults turnLock:false on undefined, so this lane stays off that branch)
 *
 * Deterministic: every external seam mocked, no timers, stated caster
 * initiative '15' keeps resolveCasterInitiative roll-free.
 * makeAction MERGES overrides (automation included) — never replaces wholesale.
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

function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Animate Dead',
        ...rest,
        automation: { type: 'animate_dead', ...automationOverrides },
    };
}

// Fresh mutable combat summary; the handler mutates it in place, so re-arm
// via summary() between tests that must not see each other's spawns.
function summary(creatures = [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }]) {
    const cs = { creatures };
    getCombatSummary.mockReturnValue(cs);
    return cs;
}

describe('confirmAnimateDead - happy path and spawn spot-checks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        summary();
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('creates skeletons and zombies when counts are provided', async () => {
        const cs = summary();

        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 2 },
        );

        // Prose is owned by the details lane's full-string pin — envelope + names only.
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');

        const names = cs.creatures.map(c => c.name);
        expect(names).toContain('Skeleton 1');
        expect(names).toContain('Zombie 1');
        expect(names).toContain('Zombie 2');
    });

    it('creates a skeleton with correct properties', async () => {
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = cs.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton).toBeDefined();
        expect(skeleton.name).toBe('Skeleton 1');
        expect(skeleton.type).toBe('npc');
        expect(skeleton.monsterType).toBe('Undead');
        expect(skeleton.ac).toBe(13);
        expect(skeleton.maxHp).toBe(13);
        expect(skeleton.currentHp).toBe(13);
        expect(skeleton.monsterIndex).toBe('skeleton');
    });

    it('creates a zombie with correct properties', async () => {
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 1 },
        );

        const zombie = cs.creatures.find(c => c.name === 'Zombie 1');
        expect(zombie).toBeDefined();
        expect(zombie.name).toBe('Zombie 1');
        expect(zombie.type).toBe('npc');
        expect(zombie.monsterType).toBe('Undead');
        expect(zombie.ac).toBe(8);
        expect(zombie.maxHp).toBe(22);
        expect(zombie.currentHp).toBe(22);
        expect(zombie.monsterIndex).toBe('zombie');
    });

    it('numbers multiple skeletons of the same cast 1..n', async () => {
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 3 },
        );

        expect(cs.creatures.map(c => c.name).filter(n => n.startsWith('Skeleton')))
            .toEqual(['Skeleton 1', 'Skeleton 2', 'Skeleton 3']);
    });

    it('sets targetName to null on created creatures', async () => {
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = cs.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.targetName).toBeNull();
        expect(skeleton.concentration).toBeNull();
    });

    it('uses monster defaults when properties are missing', async () => {
        loadMonsters.mockResolvedValue([{ index: 'skeleton', name: 'Skeleton' }, mockZombie]);
        const cs = summary();

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const creature = cs.creatures.find(c => c.monsterIndex === 'skeleton');
        expect(creature.type).toBe('npc');
        expect(creature.monsterType).toBe('Undead');
        expect(creature.ac).toBe(10);
        expect(creature.maxHp).toBe(10);
    });
});

describe('confirmAnimateDead - guard refusals and load failures', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        summary();
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('returns no-undead popup when counts are zero, missing, or partial — without touching summary', async () => {
        for (const counts of [{ skeletonCount: 0, zombieCount: 0 }, {}, { zombieCount: 0 }]) {
            const result = await confirmAnimateDead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                counts,
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No undead created.');
        }
        // Guard short-circuits before any data access.
        expect(getCombatSummary).not.toHaveBeenCalled();
    });

    it('returns error popup when combat summary is null or undefined — before monster load', async () => {
        for (const missing of [null, undefined]) {
            getCombatSummary.mockReturnValue(missing);

            const result = await confirmAnimateDead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { skeletonCount: 1 },
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Failed to load combat summary.');
        }
        expect(loadMonsters).not.toHaveBeenCalled();
    });

    it('returns error popup when skeleton monster is not found', async () => {
        loadMonsters.mockResolvedValue([mockZombie]);

        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Failed to load skeleton monster data.');
    });

    it('returns error popup when zombie monster is not found', async () => {
        loadMonsters.mockResolvedValue([mockSkeleton]);

        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 1 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('Failed to load zombie monster data.');
    });
});
