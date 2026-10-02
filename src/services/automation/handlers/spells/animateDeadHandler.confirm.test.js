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
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

describe('confirmAnimateDead - basic flow', () => {
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
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
            ],
        });
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('creates skeletons and zombies when counts are provided', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 2 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Skeleton');
        expect(result.payload.description).toContain('Zombies');
        expect(result.payload.description).toContain('right after you');

        const creatures = combatSummary.creatures;
        expect(creatures.find(c => c.name === 'Skeleton 1')).toBeDefined();
        expect(creatures.find(c => c.name === 'Zombie 1')).toBeDefined();
        expect(creatures.find(c => c.name === 'Zombie 2')).toBeDefined();
    });

    it('defaults counts to 0 when both are zero/null', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 0, skeletonCount: 0 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No undead created.');
    });

    it('defaults counts to 0 when undefined', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            {},
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No undead created.');
    });

    it('defaults counts to 0 when only one is provided', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 0 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No undead created.');
    });
});

describe('confirmAnimateDead - combat summary failures', () => {
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

    function makeAction(overrides = {}) {
        return {
            name: 'Animate Dead',
            automation: { type: 'animate_dead', ...overrides.automation },
            ...overrides,
        };
    }

    it('returns error popup when combat summary is null', async () => {
        getCombatSummary.mockReturnValue(null);

        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Failed to load combat summary.');
    });

    it('returns error popup when combat summary is undefined', async () => {
        getCombatSummary.mockReturnValue(undefined);

        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.payload.description).toBe('Failed to load combat summary.');
    });
});

describe('confirmAnimateDead - monster loading failures', () => {
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
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
        });
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

describe('confirmAnimateDead - creature creation', () => {
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
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
            ],
        });
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('creates a skeleton with correct properties', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
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
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 1 },
        );

        const zombie = combatSummary.creatures.find(c => c.name === 'Zombie 1');
        expect(zombie).toBeDefined();
        expect(zombie.name).toBe('Zombie 1');
        expect(zombie.type).toBe('npc');
        expect(zombie.monsterType).toBe('Undead');
        expect(zombie.ac).toBe(8);
        expect(zombie.maxHp).toBe(22);
        expect(zombie.currentHp).toBe(22);
        expect(zombie.monsterIndex).toBe('zombie');
    });

    it('numbers multiple creatures of the same type', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 3 },
        );

        expect(combatSummary.creatures.find(c => c.name === 'Skeleton 1')).toBeDefined();
        expect(combatSummary.creatures.find(c => c.name === 'Skeleton 2')).toBeDefined();
        expect(combatSummary.creatures.find(c => c.name === 'Skeleton 3')).toBeDefined();
    });

    it('numbers multiple zombies correctly', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 2 },
        );

        expect(combatSummary.creatures.find(c => c.name === 'Zombie 1')).toBeDefined();
        expect(combatSummary.creatures.find(c => c.name === 'Zombie 2')).toBeDefined();
    });

    it('sets targetName to null on created creatures', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.targetName).toBeNull();
        expect(skeleton.concentration).toBeNull();
    });

    it('uses monster defaults when properties are missing', async () => {
        const minimalMonster = {
            index: 'skeleton',
            name: 'Skeleton',
        };
        loadMonsters.mockResolvedValue([minimalMonster, mockZombie]);
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestCaster', initiative: '10', initiativeBonus: 0 }],
        });

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const creature = combatSummary.creatures.find(c => c.monsterIndex === 'skeleton');
        expect(creature.type).toBe('npc');
        expect(creature.monsterType).toBe('Undead');
        expect(creature.ac).toBe(10);
        expect(creature.maxHp).toBe(10);
    });

    it('creates summoned target effects for each creature', async () => {
        getRuntimeValue.mockImplementation((_entity, key) => {
            if (key === 'targetEffects') return [];
            return null;
        });

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        const writtenTe = setRuntimeValue.mock.calls.find(call => call[1] === 'targetEffects')[2];
        expect(writtenTe).toHaveLength(2);
        expect(writtenTe.find(te => te.target === 'Skeleton 1')).toMatchObject({
            source: 'TestCaster',
            effect: 'summoned',
        });
        expect(writtenTe.find(te => te.target === 'Zombie 1')).toMatchObject({
            source: 'TestCaster',
            effect: 'summoned',
        });
    });

    it('spawns uniquely-numbered creatures per cast', async () => {
        getRuntimeValue.mockImplementation((_entity, key) => {
            if (key === 'targetEffects') return [];
            return null;
        });

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2 },
        );

        const writtenTe = setRuntimeValue.mock.calls.find(call => call[1] === 'targetEffects')[2];
        expect(writtenTe.filter(te => te.target === 'Skeleton 1')).toHaveLength(1);
        expect(writtenTe.filter(te => te.target === 'Skeleton 2')).toHaveLength(1);
    });
});
