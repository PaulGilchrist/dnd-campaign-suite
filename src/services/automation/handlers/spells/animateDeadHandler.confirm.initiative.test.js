// @maintained-by-ai
/**
 * animateDead SEXTET lane #1863 confirm.initiative — per the seam map in
 * animateDeadHandler.confirm.details.test.js, this lane owns:
 *  - resolveCasterInitiative share/fallback (initiateDeadHandler.js)
 *  - byInitiativeDesc sort applied to combatSummary.creatures after summoning
 *  - the initiative value assigned onto each spawn entry (String-cast share)
 *
 * Canonical pins received via handoff from the shed lane:
 *  - 'initiative fallback uses d20 + initiativeBonus' — Math.random spied at
 *    both d20 bounds (1 and 20) so the formula is pinned, not just "a number".
 *  - 'initiative values sorted descending' — full-order table pins, relying
 *    on stable sort for ties (V8 sort is stable).
 *  - initiative assigned from encounterToInitiative: spawn entries carry the
 *    caster's resolved initiative as a string; the prod import path
 *    (encounters/encounterToInitiative.js → getMonsterSaveBonuses +
 *    getNextUniqueMonsterName) is verified against animateDeadHandler.js.
 *
 * Deterministic: every external seam mocked, Math.random spied where the
 * fallback is exercised, spies restored in afterEach. No timers (undead
 * persistence is flag-based, combat-scoped).
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
function summary(creatures) {
    const cs = { creatures };
    getCombatSummary.mockReturnValue(cs);
    return cs;
}

function spawnOf(cs, name) {
    return cs.creatures.find(c => c.name === name);
}

describe('confirmAnimateDead - initiative share, fallback, and sort', () => {
    let randomSpy = null;

    beforeEach(() => {
        vi.clearAllMocks();
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    afterEach(() => {
        if (randomSpy) {
            randomSpy.mockRestore();
            randomSpy = null;
        }
    });

    it('summons share the caster stated initiative, stringified onto every spawn', async () => {
        // No-roll guard: a stated initiative must never trigger a fresh roll.
        randomSpy = vi.spyOn(Math, 'random');

        const cs = summary([
            { name: 'TestCaster', initiative: '12', initiativeBonus: 2 },
        ]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        expect(spawnOf(cs, 'Skeleton 1').initiative).toBe('12');
        expect(spawnOf(cs, 'Zombie 1').initiative).toBe('12');

        // Stated initiative stored as a number still lands as a string.
        const cs2 = summary([
            { name: 'TestCaster', initiative: 9, initiativeBonus: 2 },
        ]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(spawnOf(cs2, 'Skeleton 1').initiative).toBe('9');
        expect(randomSpy).not.toHaveBeenCalled();
    });

    it('initiative fallback uses d20 + initiativeBonus when stated initiative is empty', async () => {
        randomSpy = vi.spyOn(Math, 'random');

        // Roll floor: Math.floor(0 * 20) + 1 + 3 = 4
        randomSpy.mockReturnValue(0);
        const csLow = summary([
            { name: 'TestCaster', initiative: '', initiativeBonus: 3 },
        ]);
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );
        expect(spawnOf(csLow, 'Skeleton 1').initiative).toBe('4');

        // Roll ceiling: Math.floor(0.9999... * 20) + 1 + 3 = 23
        randomSpy.mockReturnValue(0.9999999999);
        const csHigh = summary([
            { name: 'TestCaster', initiative: '', initiativeBonus: 3 },
        ]);
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 1 },
        );
        expect(spawnOf(csHigh, 'Zombie 1').initiative).toBe('23');
    });

    it('falls back to a raw d20 roll when initiative and bonus are both missing', async () => {
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const cs = summary([{ name: 'TestCaster' }]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        // Math.floor(0 * 20) + 1 + (undefined || 0) = 1
        expect(spawnOf(cs, 'Skeleton 1').initiative).toBe('1');
    });

    it('treats a stated initiative of 0 as missing and rolls fresh', async () => {
        randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const cs = summary([
            { name: 'TestCaster', initiative: '0', initiativeBonus: 2 },
        ]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        // parseInt('0') is falsy, so the share branch is skipped:
        // Math.floor(0 * 20) + 1 + 2 = 3
        expect(spawnOf(cs, 'Skeleton 1').initiative).toBe('3');
    });

    it('initiative values sorted descending after summoning', async () => {
        const cs = summary([
            { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
            { name: 'Goblin', initiative: '5', initiativeBonus: 0 },
        ]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        // Spawn shares caster's 15; stable sort keeps caster ahead of spawn.
        expect(cs.creatures.map(c => c.name)).toEqual([
            'TestCaster',
            'Skeleton 1',
            'Goblin',
        ]);
    });

    it('sorts creatures with empty or undefined initiative to the bottom as zero', async () => {
        const cs = summary([
            { name: 'Goblin', initiative: '' },
            { name: 'Orc' },
            { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
        ]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(cs.creatures.map(c => c.name)).toEqual([
            'TestCaster',
            'Skeleton 1',
            'Goblin',
            'Orc',
        ]);
    });
});
