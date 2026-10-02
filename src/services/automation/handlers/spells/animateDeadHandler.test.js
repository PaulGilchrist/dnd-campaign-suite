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

import { handle } from './animateDeadHandler.js';

describe('animateDeadHandler', () => {
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

    describe('handle - max targets', () => {
        it('returns popup when already at max targets for current slot level', async () => {
            const action = makeAction({ metadata: { animateDeadMaxTargets: 1 } });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('1 undead creature(s) created');
        });

        it('returns popup when already at max targets for upcast slot level', async () => {
            const action = makeAction({
                metadata: { animateDeadMaxTargets: 3 },
                automation: { slotLevel: 4 },
            });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('3 undead creature(s) created');
        });

        it('returns modal when not at max targets', async () => {
            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('animateDead');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
            expect(result.payload.maxTargets).toBe(1);
        });

        it('returns modal when metadata key is missing', async () => {
            const action = makeAction({ metadata: {} });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
        });

        it('returns modal when metadata is undefined', async () => {
            const action = makeAction({ metadata: undefined });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
        });
    });

    describe('handle - slot level', () => {
        it('uses automation.slotLevel when provided', async () => {
            const action = makeAction({ automation: { slotLevel: 5 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(5);
        });

        it('uses metaCtx.slotLevel when automation.slotLevel is absent', async () => {
            const action = makeAction({ metaCtx: { slotLevel: 6 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(7);
        });

        it('uses spell.level as fallback', async () => {
            const action = makeAction({ spell: { level: 7 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(9);
        });

        it('defaults to slot level 3 when no level info is available', async () => {
            const action = makeAction({ automation: {} });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(1);
        });

        it('respects upcast table for all slot levels', async () => {
            const upcast = { 3: 1, 4: 3, 5: 5, 6: 7, 7: 9, 8: 11, 9: 13 };
            for (const [slotLevel, expectedMax] of Object.entries(upcast)) {
                const action = makeAction({ automation: { slotLevel: Number(slotLevel) } });
                const result = await handle(action, mockPlayerStats, mockCampaignName);
                expect(result.payload.maxTargets).toBe(expectedMax);
            }
        });

        it('defaults to 1 for unknown slot levels', async () => {
            const action = makeAction({ automation: { slotLevel: 1 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(1);
        });
    });
});
