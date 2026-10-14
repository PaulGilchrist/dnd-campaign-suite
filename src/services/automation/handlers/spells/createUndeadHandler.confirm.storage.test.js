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

import { confirmCreateUndead } from './createUndeadHandler.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

describe('createUndeadHandler - confirmCreateUndead storage/logging', () => {
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

    const mockGhoul = {
        index: 'ghoul',
        name: 'Ghoul',
        type: 'Undead',
        armor_class: 12,
        hit_points: 22,
        damage_resistances: [],
        damage_immunities: [],
        immunities: ['Poison'],
        saving_throws: {},
    };

    function makeAction(overrides = {}) {
        return {
            name: 'Create Undead',
            automation: { type: 'create_undead', ...overrides.automation },
            ...overrides,
        };
    }

    // ── confirmCreateUndead: storage and logging ───────────────

    describe('confirmCreateUndead - storage and logging', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('calls storage.set with combatSummary', async () => {
            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), mockCampaignName);
        });

        it('calls setRuntimeValue with targetEffects', async () => {
            const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
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

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'initiative-rolled',
            }));
            dispatchSpy.mockRestore();
        });

        it('calls addEntry with summons log type', async () => {
            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 2 },
            );

            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Create Undead',
                description: expect.stringContaining('Create Undead'),
                summonedCreatures: expect.any(Array),
                timestamp: expect.any(Number),
            }));
        });

        it('includes logEntries in the return value', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.logEntries).toBeDefined();
            expect(result.logEntries).toHaveLength(1);
            expect(result.logEntries[0]).toMatchObject({
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Create Undead',
            });
        });

        it('updates action metadata with max targets', async () => {
            const action = makeAction();

            await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(action.metadata).toEqual({ createUndeadMaxTargets: 3 });
        });

        it('merges metadata when it already exists', async () => {
            const action = makeAction({ metadata: { existingKey: 'value' } });

            await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(action.metadata).toEqual({
                existingKey: 'value',
                createUndeadMaxTargets: 3,
            });
        });
    });

    // ── confirmCreateUndead: popup description ─────────────────

    describe('confirmCreateUndead - popup description', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('uses singular form for single ghoul', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.description).toContain('Ghoul');
            expect(result.payload.description).not.toContain('Ghouls');
        });

        it('uses plural form for multiple ghouls', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(result.payload.description).toContain('3 Ghouls');
        });

        it('includes "right after you" in description', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.description).toContain('right after you');
        });

        it('includes caster name in description', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.description).toContain('TestCaster');
        });

        it('includes automation in popup payload', async () => {
            const automation = { type: 'create_undead', slotLevel: 5 };
            const action = makeAction({ automation });

            const result = await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.automation).toEqual(automation);
        });

        it('includes slot level in log description', async () => {
            const action = makeAction({ automation: { slotLevel: 7 } });

            const result = await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.logEntries[0].description).toContain('slot level 7');
        });
    });

    // ── confirmCreateUndead: upcast ────────────────────────────

    describe('confirmCreateUndead - upcast', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('respects upcast max targets for slot level 6', async () => {
            const action = makeAction({ automation: { slotLevel: 6 } });
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(combatSummary.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(3);
        });

        it('respects upcast max targets for slot level 7', async () => {
            const action = makeAction({ automation: { slotLevel: 7 } });
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 4 },
            );

            expect(combatSummary.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(4);
        });

        it('respects upcast max targets for slot level 9', async () => {
            const action = makeAction({ automation: { slotLevel: 9 } });
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 6 },
            );

            expect(combatSummary.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(6);
        });

        it('updates metadata with correct max targets for upcast', async () => {
            const action = makeAction({ automation: { slotLevel: 8 } });

            await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(action.metadata.createUndeadMaxTargets).toBe(5);
        });
    });

    // ── confirmCreateUndead: action name in popup ──────────────

    describe('confirmCreateUndead - action name in popup', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('uses custom action name in popup', async () => {
            const action = makeAction({ name: 'Custom Undead Spell' });

            const result = await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.name).toBe('Custom Undead Spell');
        });

        it('uses action name in log entry', async () => {
            const action = makeAction({ name: 'Custom Undead Spell' });

            const result = await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.logEntries[0].summonName).toBe('Create Undead');
        });
    });

    // ── confirmCreateUndead: summoned creatures in log ─────────

    describe('confirmCreateUndead - summoned creatures in log', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('includes summonedCreatures array in log entry', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(result.logEntries[0].summonedCreatures).toEqual(['Ghoul', 'Ghoul 2', 'Ghoul 3']);
        });

        it('includes timestamp in log entry', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.logEntries[0].timestamp).toBeTypeOf('number');
        });
    });

    // ── confirmCreateUndead: existing creatures with same name ─

    describe('confirmCreateUndead - existing creature naming', () => {
        beforeEach(() => {
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('renames ghoul when one already exists', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
                    { name: 'Ghoul', initiative: '10', initiativeBonus: 0 },
                ],
            });

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            // The new ghoul gets renamed to "Ghoul 2" since "Ghoul" already exists
            expect(combatSummary.creatures.find(c => c.name === 'Ghoul 2')).toBeDefined();
            // The original "Ghoul" still exists
            expect(combatSummary.creatures.find(c => c.name === 'Ghoul')).toBeDefined();
        });

        it('handles chain of existing ghouls', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
                    { name: 'Ghoul', initiative: '10', initiativeBonus: 0 },
                    { name: 'Ghoul 2', initiative: '9', initiativeBonus: 0 },
                    { name: 'Ghoul 3', initiative: '8', initiativeBonus: 0 },
                ],
            });

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(combatSummary.creatures.find(c => c.name === 'Ghoul 4')).toBeDefined();
        });
    });
});
