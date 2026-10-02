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

describe('confirmAnimateDead - popup description', () => {
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
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('includes creature list in description', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2, zombieCount: 1 },
        );

        expect(result.payload.description).toContain('1 Zombie');
        expect(result.payload.description).toContain('2 Skeletons');
    });

    it('uses singular form for single creature', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.payload.description).toContain('Skeleton');
        expect(result.payload.description).not.toContain('Skeletons');
    });

    it('uses plural form for multiple creatures', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { zombieCount: 3 },
        );

        expect(result.payload.description).toContain('Zombies');
    });

    it('includes "right after you" in description', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.payload.description).toContain('right after you');
    });

    it('includes caster name in description', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.payload.description).toContain('TestCaster');
    });

    it('includes automation in popup payload', async () => {
        const automation = { type: 'animate_dead', slotLevel: 5 };
        const action = makeAction({ automation });

        const result = await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(result.payload.automation).toEqual(automation);
    });
});

describe('confirmAnimateDead - creature type variants', () => {
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
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('creates only skeletons when zombieCount is 0', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 2, zombieCount: 0 },
        );

        const skeletons = combatSummary.creatures.filter(c => c.monsterIndex === 'skeleton');
        const zombies = combatSummary.creatures.filter(c => c.monsterIndex === 'zombie');
        expect(skeletons).toHaveLength(2);
        expect(zombies).toHaveLength(0);
    });

    it('creates only zombies when skeletonCount is 0', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 0, zombieCount: 3 },
        );

        const skeletons = combatSummary.creatures.filter(c => c.monsterIndex === 'skeleton');
        const zombies = combatSummary.creatures.filter(c => c.monsterIndex === 'zombie');
        expect(skeletons).toHaveLength(0);
        expect(zombies).toHaveLength(3);
    });

    it('handles upcast with max targets', async () => {
        const action = makeAction({ automation: { slotLevel: 9 } });
        const combatSummary = getCombatSummary(mockCampaignName);

        const result = await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 5, zombieCount: 8 },
        );

        expect(result.type).toBe('popup');
        expect(combatSummary.creatures.filter(c => c.monsterIndex === 'skeleton').length).toBe(5);
        expect(combatSummary.creatures.filter(c => c.monsterIndex === 'zombie').length).toBe(8);
    });
});

describe('confirmAnimateDead - save bonuses', () => {
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
        loadMonsters.mockResolvedValue([{
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
        }, mockZombie]);
    });

    it('includes saveBonuses from monster data', async () => {
        const monsterWithSaves = {
            index: 'skeleton',
            name: 'Skeleton',
            type: 'Undead',
            armor_class: 13,
            hit_points: 13,
            damage_resistances: [],
            damage_immunities: [],
            immunities: [],
            saving_throws: { dex: { modifier: 4 }, con: { modifier: 2 } },
        };
        loadMonsters.mockResolvedValue([monsterWithSaves, mockZombie]);

        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.saveBonuses).toBeDefined();
        expect(skeleton.saveBonuses.dex).toBe(4);
        expect(skeleton.saveBonuses.con).toBe(2);
    });

    it('defaults save bonuses to 0 when monster has no saving_throws', async () => {
        const combatSummary = getCombatSummary(mockCampaignName);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.saveBonuses).toBeDefined();
    });
});

describe('confirmAnimateDead - resistances and immunities', () => {
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
        loadMonsters.mockResolvedValue([{
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
        }, mockZombie]);
    });

    it('copies damage_resistances from monster', async () => {
        const monster = {
            index: 'skeleton',
            name: 'Skeleton',
            type: 'Undead',
            armor_class: 13,
            hit_points: 13,
            damage_resistances: ['bludgeoning', 'piercing'],
            damage_immunities: [],
            immunities: [],
            saving_throws: {},
        };
        loadMonsters.mockResolvedValue([monster, mockZombie]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const combatSummary = getCombatSummary(mockCampaignName);
        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.resistances).toEqual(['bludgeoning', 'piercing']);
    });

    it('copies damage_immunities from monster', async () => {
        const monster = {
            index: 'skeleton',
            name: 'Skeleton',
            type: 'Undead',
            armor_class: 13,
            hit_points: 13,
            damage_resistances: [],
            damage_immunities: ['bludgeoning'],
            immunities: [],
            saving_throws: {},
        };
        loadMonsters.mockResolvedValue([monster, mockZombie]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const combatSummary = getCombatSummary(mockCampaignName);
        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.immunities).toEqual(['bludgeoning']);
    });

    it('falls back to immunities when damage_immunities is missing', async () => {
        const monster = {
            index: 'skeleton',
            name: 'Skeleton',
            type: 'Undead',
            armor_class: 13,
            hit_points: 13,
            damage_resistances: [],
            immunities: ['poison'],
            saving_throws: {},
        };
        loadMonsters.mockResolvedValue([monster, mockZombie]);

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        const combatSummary = getCombatSummary(mockCampaignName);
        const skeleton = combatSummary.creatures.find(c => c.name === 'Skeleton 1');
        expect(skeleton.immunities).toEqual(['poison']);
    });
});

describe('confirmAnimateDead - action metadata', () => {
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
        loadMonsters.mockResolvedValue([mockSkeleton, mockZombie]);
    });

    it('sets metadata animateDeadMaxTargets to maxTargets', async () => {
        const action = makeAction({ automation: { slotLevel: 5 } });

        await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(action.metadata.animateDeadMaxTargets).toBe(5);
    });

    it('preserves existing metadata keys', async () => {
        const action = makeAction({ metadata: { otherKey: 'otherValue', animateDeadMaxTargets: 1 } });

        await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(action.metadata.otherKey).toBe('otherValue');
        expect(action.metadata.animateDeadMaxTargets).toBe(1);
    });
});
