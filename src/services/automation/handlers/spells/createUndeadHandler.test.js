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
    getNextUniqueMonsterName: vi.fn().mockImplementation((baseName, existingCreatures) => {
        const names = new Set(existingCreatures.map(c => c.name));
        if (!names.has(baseName)) return baseName;
        let num = 2;
        while (names.has(`${baseName} ${num}`)) num++;
        return `${baseName} ${num}`;
    }),
}));

import { handle, modalName, confirmType } from './createUndeadHandler.js';

describe('createUndeadHandler', () => {
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
            name: 'Create Undead',
            automation: { type: 'create_undead', ...overrides.automation },
            ...overrides,
        };
    }

    // ── Named exports ──────────────────────────────────────────

    describe('named exports', () => {
        it('exports modalName as "createUndead"', () => {
            expect(modalName).toBe('createUndead');
        });

        it('exports confirmType as "create_undead_confirm"', () => {
            expect(confirmType).toBe('create_undead_confirm');
        });
    });

    // ── handle: max targets check ──────────────────────────────

    describe('handle - max targets', () => {
        it('returns popup when already at max targets for current slot level', async () => {
            const action = makeAction({ metadata: { createUndeadMaxTargets: 3 } });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('3 ghoul(s) created');
        });

        it('returns popup when already at max targets for upcast slot level', async () => {
            const action = makeAction({
                metadata: { createUndeadMaxTargets: 4 },
                automation: { slotLevel: 7 },
            });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('4 ghoul(s) created');
        });

        it('returns modal when not at max targets', async () => {
            const action = makeAction();

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('createUndead');
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
            expect(result.payload.maxTargets).toBe(3);
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

        it('returns modal when metadata is null', async () => {
            const action = makeAction({ metadata: null });

            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.type).toBe('modal');
        });
    });

    // ── handle: slot level determination ───────────────────────

    describe('handle - slot level', () => {
        it('uses automation.slotLevel when provided', async () => {
            const action = makeAction({ automation: { slotLevel: 7 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(4);
        });

        it('uses metaCtx.slotLevel when automation.slotLevel is absent', async () => {
            const action = makeAction({ metaCtx: { slotLevel: 8 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(5);
        });

        it('uses spell.level as fallback', async () => {
            const action = makeAction({ spell: { level: 7 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(4);
        });

        it('defaults to slot level 6 (maxTargets 3) when no level info is available', async () => {
            const action = makeAction({ automation: {} });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(3);
        });

        it('defaults to 3 for unknown slot levels below 6', async () => {
            const action = makeAction({ automation: { slotLevel: 3 } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            expect(result.payload.maxTargets).toBe(3);
        });

        it('respects upcast table for slot levels 6-9', async () => {
            const upcast = { 6: 3, 7: 4, 8: 5, 9: 6 };
            for (const [slotLevel, expectedMax] of Object.entries(upcast)) {
                const action = makeAction({ automation: { slotLevel: Number(slotLevel) } });
                const result = await handle(action, mockPlayerStats, mockCampaignName);
                expect(result.payload.maxTargets).toBe(expectedMax);
            }
        });
    });
});
