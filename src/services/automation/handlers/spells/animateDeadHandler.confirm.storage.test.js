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
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import storage from '../../../ui/storage.js';

describe('confirmAnimateDead - storage and logging', () => {
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

    it('calls storage.set with combatSummary', async () => {
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), mockCampaignName);
    });

    it('calls setRuntimeValue with targetEffects', async () => {
        const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.any(Array),
            mockCampaignName,
        );
    });

    it('dispatches initiative-rolled event', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'initiative-rolled',
        }));
        dispatchSpy.mockRestore();
    });

    it('calls addEntry with summons log type', async () => {
        await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 2 },
        );

        expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
            type: 'summons',
            characterName: 'TestCaster',
            summonName: 'Animate Dead',
            description: expect.stringContaining('Animate Dead'),
            summonedCreatures: expect.any(Array),
            timestamp: expect.any(Number),
        }));
    });

    it('includes logEntries in the return value', async () => {
        const result = await confirmAnimateDead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1, zombieCount: 1 },
        );

        expect(result.logEntries).toBeDefined();
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0]).toMatchObject({
            type: 'summons',
            characterName: 'TestCaster',
            summonName: 'Animate Dead',
        });
    });

    it('updates action metadata with max targets', async () => {
        const action = makeAction();

        await confirmAnimateDead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { skeletonCount: 1 },
        );

        expect(action.metadata).toEqual({ animateDeadMaxTargets: 1 });
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
});
