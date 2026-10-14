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
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

describe('createUndeadHandler - confirmCreateUndead', () => {
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

    function defaultCombatSummary() {
        return {
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
            ],
        };
    }

    // ── confirmCreateUndead: basic flow ────────────────────────

    describe('basic flow', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('creates a ghoul when count is 1', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Ghoul');
            expect(result.payload.description).toContain('right after you');

            const creatures = combatSummary.creatures;
            expect(creatures.find(c => c.name === 'Ghoul')).toBeDefined();
        });

        it('creates multiple ghouls when count > 1', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(combatSummary.creatures.find(c => c.name === 'Ghoul')).toBeDefined();
            expect(combatSummary.creatures.find(c => c.name === 'Ghoul 2')).toBeDefined();
            expect(combatSummary.creatures.find(c => c.name === 'Ghoul 3')).toBeDefined();
        });

        it('defaults ghoulCount to 1 when not provided', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                {},
            );

            expect(result.type).toBe('popup');
            expect(combatSummary.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(1);
        });

        it('creates 1 ghoul when ghoulCount is 0 or null (falsy default)', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 0 },
            );

            expect(result.type).toBe('popup');
            expect(combatSummary.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(1);
        });

        it('creates 1 ghoul when ghoulCount is null (falsy default)', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: null },
            );

            expect(combatSummary.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(1);
        });

        it('returns early when count is negative', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: -1 },
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No undead created.');
        });
    });

    // ── confirmCreateUndead: combat summary failures ───────────

    describe('combat summary failures', () => {
        beforeEach(() => {
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('returns error popup when combat summary is null or undefined', async () => {
            const results = [];
            for (const val of [null, undefined]) {
                getCombatSummary.mockReturnValue(val);
                const result = await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );
                results.push(result);
            }

            for (const result of results) {
                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.description).toBe('Failed to load combat summary.');
            }
        });
    });

    // ── confirmCreateUndead: monster loading failures ──────────

    describe('monster loading failures', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
        });

        it('returns error popup when ghoul monster is not found or has wrong index', async () => {
            const results = [];
            for (const monsters of [[], [{ index: 'zombie' }]]) {
                loadMonsters.mockResolvedValue(monsters);
                const result = await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );
                results.push(result);
            }

            for (const result of results) {
                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Failed to load ghoul monster data.');
            }
        });
    });

    // ── confirmCreateUndead: ghoul creature creation ───────────

    describe('ghoul creature creation', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('creates a ghoul with correct properties', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            expect(ghoul).toBeDefined();
            expect(ghoul.name).toBe('Ghoul');
            expect(ghoul.type).toBe('npc');
            expect(ghoul.monsterType).toBe('Undead');
            expect(ghoul.ac).toBe(12);
            expect(ghoul.maxHp).toBe(22);
            expect(ghoul.currentHp).toBe(22);
            expect(ghoul.monsterIndex).toBe('ghoul');
            expect(ghoul.targetName).toBeNull();
            expect(ghoul.concentration).toBeNull();
        });

        it('numbers multiple ghouls correctly', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(combatSummary.creatures.find(c => c.name === 'Ghoul')).toBeDefined();
            expect(combatSummary.creatures.find(c => c.name === 'Ghoul 2')).toBeDefined();
            expect(combatSummary.creatures.find(c => c.name === 'Ghoul 3')).toBeDefined();
        });

        it('uses monster defaults when properties are missing', async () => {
            const minimalMonster = { index: 'ghoul' };
            loadMonsters.mockResolvedValue([minimalMonster]);
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '10', initiativeBonus: 0 }],
            });

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const creature = combatSummary.creatures.find(c => c.monsterIndex === 'ghoul');
            expect(creature.type).toBe('npc');
            expect(creature.monsterType).toBe('Undead');
            expect(creature.ac).toBe(10);
            expect(creature.maxHp).toBe(10);
        });

        it('uses monster.damage_resistances when present', async () => {
            const monsterWithResistances = {
                ...mockGhoul,
                damage_resistances: ['bludgeoning', 'piercing'],
            };
            loadMonsters.mockResolvedValue([monsterWithResistances]);

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            expect(ghoul.resistances).toEqual(['bludgeoning', 'piercing']);
        });

        it('uses monster.damage_immunities when present', async () => {
            const monsterWithImmunities = {
                ...mockGhoul,
                damage_immunities: ['cold'],
            };
            loadMonsters.mockResolvedValue([monsterWithImmunities]);

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            expect(ghoul.immunities).toEqual(['cold']);
        });

        it('falls back to immunities when damage_immunities is missing', async () => {
            const monsterWithFallback = {
                ...mockGhoul,
                damage_immunities: undefined,
                immunities: ['poison'],
            };
            loadMonsters.mockResolvedValue([monsterWithFallback]);

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            expect(ghoul.immunities).toEqual(['poison']);
        });

        it('sets saveBonuses from monster data', async () => {
            const monsterWithSaves = {
                ...mockGhoul,
                saving_throws: { dex: { modifier: 4 }, con: { modifier: 2 } },
            };
            loadMonsters.mockResolvedValue([monsterWithSaves]);

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            expect(ghoul.saveBonuses).toBeDefined();
            expect(ghoul.saveBonuses.dex).toBe(4);
            expect(ghoul.saveBonuses.con).toBe(2);
        });
    });

    // ── confirmCreateUndead: summoned target effects ────────────

    describe('summoned target effects', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('creates summoned target effects for each ghoul', async () => {
            const targetEffects = [];
            getRuntimeValue.mockImplementation((_entity, key) => {
                if (key === 'targetEffects') return targetEffects;
                return null;
            });

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 2 },
            );

            const ghoulEffects = targetEffects.filter(te => te.target === 'Ghoul');
            expect(ghoulEffects).toHaveLength(1);
            expect(ghoulEffects[0]).toMatchObject({
                source: 'TestCaster',
                effect: 'summoned',
            });

            const ghoul2Effects = targetEffects.filter(te => te.target === 'Ghoul 2');
            expect(ghoul2Effects).toHaveLength(1);
        });

        it('does not duplicate summoned effects for same creature', async () => {
            const targetEffects = [];
            getRuntimeValue.mockImplementation((_entity, key) => {
                if (key === 'targetEffects') return targetEffects;
                return null;
            });

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            const ghoulEffects = targetEffects.filter(te => te.target === 'Ghoul');
            expect(ghoulEffects).toHaveLength(1);

            const ghoul2Effects = targetEffects.filter(te => te.target === 'Ghoul 2');
            expect(ghoul2Effects).toHaveLength(1);

            const ghoul3Effects = targetEffects.filter(te => te.target === 'Ghoul 3');
            expect(ghoul3Effects).toHaveLength(1);
        });

        it('uses the correct source (caster name) in target effects', async () => {
            const targetEffects = [];
            getRuntimeValue.mockImplementation((_entity, key) => {
                if (key === 'targetEffects') return targetEffects;
                return null;
            });

            const casterWithDifferentName = { ...mockPlayerStats, name: 'DarkWizard' };

            await confirmCreateUndead(
                makeAction(),
                casterWithDifferentName,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const effect = targetEffects.find(te => te.target === 'Ghoul');
            expect(effect.source).toBe('DarkWizard');
        });
    });

    // ── confirmCreateUndead: initiative handling ────────────────

    describe('initiative handling', () => {
        beforeEach(() => {
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('uses caster initiative from combat summary when available', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '12', initiativeBonus: 2 }],
            });

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            // Ghoul gets initiativeValue - 0.1 = 12 - 0.1 = 11.9
            expect(ghoul.initiative).toBe('11.9');
        });

        it('falls back to random roll when caster has no initiative (empty string or undefined)', async () => {
            let randomSaved = Math.random;
            Math.random = () => 0.5;

            try {
                const scenarios = [
                    { initiative: '', initiativeBonus: 3 },
                    { initiative: undefined, initiativeBonus: 3 },
                ];

                for (const scenario of scenarios) {
                    getCombatSummary.mockReturnValue({
                        creatures: [{ name: 'TestCaster', ...scenario }],
                    });

                    const combatSummary = getCombatSummary(mockCampaignName);

                    await confirmCreateUndead(
                        makeAction(),
                        mockPlayerStats,
                        mockCampaignName,
                        { ghoulCount: 1 },
                    );

                    const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
                    expect(ghoul.initiative).toMatch(/^\d+\.9$/);
                }
            } finally {
                Math.random = randomSaved;
            }
        });

        it('uses initiativeBonus in random roll when no initiative set', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiativeBonus: 5 }],
            });

            const originalRandom = Math.random;
            Math.random = () => 0.5;

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            // Math.floor(0.5 * 20) + 1 + 5 = 10 + 1 + 5 = 16, then 16 - 0.1 = 15.9
            expect(ghoul.initiative).toBe('15.9');
            Math.random = originalRandom;
        });

        it('uses caster initiative when initiativeBonus exists', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '10', initiativeBonus: 5 }],
            });

            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            // initiativeValue = 10, ghoul gets 10 - 0.1 = 9.9
            expect(ghoul.initiative).toBe('9.9');
        });
    });

    // ── confirmCreateUndead: initiative sorting ────────────────

    describe('initiative sorting', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
                    { name: 'Goblin', initiative: '5', initiativeBonus: 0 },
                ],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('sorts creatures by initiative descending', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const indices = combatSummary.creatures.map(c => c.name);
            const ghoulIdx = indices.indexOf('Ghoul');
            const goblinIdx = indices.indexOf('Goblin');
            expect(ghoulIdx).toBeLessThan(goblinIdx);
        });

        it('handles creatures with empty/undefined initiative string in sort', async () => {
            const scenarios = [
                { name: 'Goblin', initiative: '' },
                { name: 'Goblin' },
            ];

            for (const goblin of scenarios) {
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
                        goblin,
                    ],
                });

                const combatSummary = getCombatSummary(mockCampaignName);

                await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

                const indices = combatSummary.creatures.map(c => c.name);
                const ghoulIdx = indices.indexOf('Ghoul');
                const goblinIdx = indices.indexOf('Goblin');
                expect(ghoulIdx).toBeLessThan(goblinIdx);
            }
        });
    });

    // ── confirmCreateUndead: ghoul initiative offset ───────────

    describe('ghoul initiative offset', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('gives ghouls initiative 0.1 less than caster', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
            // initiativeValue = 15, then ghoul gets String(15 - 0.1) = "14.9"
            expect(ghoul.initiative).toBe('14.9');
        });

        it('gives multiple ghouls the same initiative (same turn)', async () => {
            const combatSummary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            const ghoul1 = combatSummary.creatures.find(c => c.name === 'Ghoul');
            const ghoul2 = combatSummary.creatures.find(c => c.name === 'Ghoul 2');
            const ghoul3 = combatSummary.creatures.find(c => c.name === 'Ghoul 3');
            expect(ghoul1.initiative).toBe(ghoul2.initiative);
            expect(ghoul2.initiative).toBe(ghoul3.initiative);
        });
    });

    // ── confirmCreateUndead: initiative string format ──────────

    describe('initiative string format', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue({
                creatures: [{ name: 'TestCaster', initiative: '15', initiativeBonus: 3 }],
            });
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('stores ghoul initiative as string (with caster initiative and random fallback)', async () => {
            let randomSaved = Math.random;
            Math.random = () => 0.5;
            try {
                const scenarios = [
                    { initiative: '15', initiativeBonus: 3 },
                    { initiative: undefined, initiativeBonus: 3 },
                ];

                for (const scenario of scenarios) {
                    getCombatSummary.mockReturnValue({
                        creatures: [{ name: 'TestCaster', ...scenario }],
                    });

                    const combatSummary = getCombatSummary(mockCampaignName);

                    await confirmCreateUndead(
                        makeAction(),
                        mockPlayerStats,
                        mockCampaignName,
                        { ghoulCount: 1 },
                    );

                    const ghoul = combatSummary.creatures.find(c => c.name === 'Ghoul');
                    expect(typeof ghoul.initiative).toBe('string');
                }
            } finally {
                Math.random = randomSaved;
            }
        });
    });
});
