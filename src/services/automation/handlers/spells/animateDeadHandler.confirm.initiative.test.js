// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

describe('confirmAnimateDead - initiative', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        return {
            name: 'Animate Dead',
            automation: { type: 'animate_dead', ...overrides.automation },
            ...overrides,
        };
    }

    beforeEach(() => {
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('uses caster initiative from combat summary when available', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '12', initiativeBonus: 2 },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.initiative).toBe('12');
    });

    it('uses initiativeBonus when initiative is set', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '10', initiativeBonus: 5 },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        // initiativeValue = parseInt('10', 10) = 10
        // Then initiativeValue = 10 || (random) = 10
        expect(skeleton.initiative).toBe('10');
    });

    it('falls back to random roll when caster has no initiative', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '', initiativeBonus: 3 },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        // With no initiative, falls back to Math.floor(random * 20) + 1 + bonus
        // The value should be a string of a positive number
        expect(skeleton.initiative).toMatch(/^\d+$/);
    });

    it('falls back to random roll when initiative is undefined', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster' },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.initiative).toMatch(/^\d+$/);
    });

    it('sorts creatures by initiative descending', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
                { name: 'Goblin', initiative: '5', initiativeBonus: 0 },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const indices = combatSummary.creatures.map(c => c.name);
        const skeletonIdx = indices.indexOf('Skeleton 1');
        const goblinIdx = indices.indexOf('Goblin');
        expect(skeletonIdx).toBeLessThan(goblinIdx);
    });
});

describe('confirmAnimateDead - initiative sorting edge cases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        return {
            name: 'Animate Dead',
            automation: { type: 'animate_dead', ...overrides.automation },
            ...overrides,
        };
    }

    beforeEach(() => {
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('handles creatures with empty initiative string', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
                { name: 'Goblin', initiative: '', initiativeBonus: 0 },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const indices = combatSummary.creatures.map(c => c.name);
        const skeletonIdx = indices.indexOf('Skeleton 1');
        const goblinIdx = indices.indexOf('Goblin');
        expect(skeletonIdx).toBeLessThan(goblinIdx);
    });

    it('handles creatures with undefined initiative', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
                { name: 'Goblin' },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const indices = combatSummary.creatures.map(c => c.name);
        const skeletonIdx = indices.indexOf('Skeleton 1');
        const goblinIdx = indices.indexOf('Goblin');
        expect(skeletonIdx).toBeLessThan(goblinIdx);
    });

    it('handles initiativeBonus being 0', async () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '10', initiativeBonus: 0 },
            ],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.initiative).toBe('10');
    });
});
