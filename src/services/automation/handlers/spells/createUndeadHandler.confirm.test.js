// @maintained-by-ai
/**
 * createUndead TRIO lane #1898 (confirm main) — shares createUndeadHandler.js with
 * createUndeadHandler.test.js (#1899 handle) and createUndeadHandler.confirm.storage.test.js
 * (confirm.storage). See the storage lane header for the full trio seam map.
 *
 * THIS LANE owns:
 *  - confirmCreateUndead guard refusals (missing caster, combat-summary load failure,
 *    ghoul-data load failure, negative count) as exact-description popups, each pinned
 *    as a no-side-effect guard (no combat read / no spawn / no persistence),
 *  - count normalization (ghoulCount || 1) for missing/0/null,
 *  - confirm happy-path popup envelope (full-string success descriptions are owned by
 *    the storage lane — no contains-pins here),
 *  - exact spawned-creature shape incl. saveBonuses pass-through (getMonsterSaveBonuses
 *    is MOCKED — helper internals belong to encounterToInitiative's own tests),
 *  - monster defaults / resistances / immunities || -chain mapping,
 *  - unique naming THROUGH the loop on the live summary (loop feeds its own growing
 *    creatures array; stored-side uniquification is the storage lane's),
 *  - summoned-targetEffects dedupe via live-array seeding incl. in-place write identity
 *    (happy-path exact te content is the storage lane's),
 *  - initiative resolve (caster init beats bonus), random-fallback roll, caster-0.1
 *    offset shared by all ghouls, and descending sort.
 *
 * Honesty: handler NEVER clamps ghoulCount to maxTargets — it summons exactly what is
 * asked (non-clamp table pinned on the storage lane). makeAction merges automation
 * overrides (trio bug fixed here per handoff). Deterministic: every seam mocked, no
 * timers (summon persistence is combat-scoped), strict pins per house style.
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
    getNextUniqueMonsterName: vi.fn().mockImplementation((baseName, existingCreatures) => {
        const names = new Set(existingCreatures.map(c => c.name));
        if (!names.has(baseName)) return baseName;
        let num = 2;
        while (names.has(`${baseName} ${num}`)) num++;
        return `${baseName} ${num}`;
    }),
}));

import { confirmCreateUndead } from './createUndeadHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import storage from '../../../ui/storage.js';
import { getNextUniqueMonsterName } from '../../../encounters/encounterToInitiative.js';

describe('createUndeadHandler - confirmCreateUndead', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps implementations — force te-reader back to empty
        // so getRuntimeValue.mockImplementation cannot leak between tests.
        getRuntimeValue.mockReturnValue(undefined);
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
            ...overrides,
            automation: { type: 'create_undead', ...overrides.automation },
        };
    }

    function defaultCombatSummary() {
        return {
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
            ],
        };
    }

    // ── guard refusals (no side effects) ──────────────────────────

    describe('guard refusals', () => {
        it('refuses when caster data is missing, touching nothing', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                null,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Create Undead');
            expect(result.payload.description).toBe('Failed to load caster data.');
            expect(getCombatSummary).not.toHaveBeenCalled();
            expect(loadMonsters).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses negative counts before touching combat or storage', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: -1 },
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No undead created.');
            expect(getCombatSummary).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when combat summary is null or undefined, persisting nothing', async () => {
            for (const val of [null, undefined]) {
                getCombatSummary.mockReturnValue(val);

                const result = await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Failed to load combat summary.');
                expect(loadMonsters).not.toHaveBeenCalled();
                expect(storage.set).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });

        it('refuses when ghoul monster data is missing or wrong index, spawning nothing', async () => {
            for (const monsters of [[], [{ index: 'zombie' }]]) {
                getCombatSummary.mockReturnValue(defaultCombatSummary());
                loadMonsters.mockResolvedValue(monsters);
                const summary = getCombatSummary(mockCampaignName);

                const result = await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toBe('Failed to load ghoul monster data.');
                expect(summary.creatures).toHaveLength(1);
                expect(storage.set).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });
    });

    // ── count normalization (ghoulCount || 1) ──────────────────────

    describe('count normalization', () => {
        it('summons exactly one ghoul when count is missing, 0, or null', async () => {
            loadMonsters.mockResolvedValue([mockGhoul]);

            for (const payload of [{}, { ghoulCount: 0 }, { ghoulCount: null }]) {
                getCombatSummary.mockReturnValue(defaultCombatSummary());
                const summary = getCombatSummary(mockCampaignName);

                const result = await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    payload,
                );

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(summary.creatures.filter(c => c.monsterIndex === 'ghoul').map(c => c.name))
                    .toEqual(['Ghoul']);
            }
        });
    });

    // ── happy-path envelope + creature shape ───────────────────────

    describe('confirm happy path', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('returns an automation_info popup naming the action with the ghoul spawned', async () => {
            const summary = getCombatSummary(mockCampaignName);

            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Create Undead');
            expect(summary.creatures.some(c => c.name === 'Ghoul')).toBe(true);
        });

        it('spawns the ghoul with the exact creature shape', async () => {
            const summary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            // empty damage_immunities is truthy — immunities stays [], never ['Poison']
            expect(summary.creatures.find(c => c.name === 'Ghoul')).toEqual({
                name: 'Ghoul',
                type: 'npc',
                monsterType: 'Undead',
                initiative: '14.9',
                targetName: null,
                ac: 12,
                resistances: [],
                immunities: [],
                concentration: null,
                maxHp: 22,
                currentHp: 22,
                saveBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
                monsterIndex: 'ghoul',
            });
        });

        it('maps monster defaults, resistances and immunities through the || -chain', async () => {
            const table = [
                { label: 'missing fields fall back to defaults', monster: { index: 'ghoul' },
                  expectFields: { ac: 10, maxHp: 10, currentHp: 10, monsterType: 'Undead', resistances: [], immunities: [] } },
                { label: 'damage_resistances ride through', monster: { ...mockGhoul, damage_resistances: ['bludgeoning', 'piercing'] },
                  expectFields: { resistances: ['bludgeoning', 'piercing'] } },
                { label: 'damage_immunities ride through', monster: { ...mockGhoul, damage_immunities: ['cold'] },
                  expectFields: { immunities: ['cold'] } },
                { label: 'immunities only serve as fallback', monster: { ...mockGhoul, damage_immunities: undefined, immunities: ['poison'] },
                  expectFields: { immunities: ['poison'] } },
            ];

            for (const { label, monster, expectFields } of table) {
                getCombatSummary.mockReturnValue(defaultCombatSummary());
                loadMonsters.mockResolvedValue([monster]);

                await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

                const summary = getCombatSummary(mockCampaignName);
                expect(summary.creatures.find(c => c.monsterIndex === 'ghoul'), label).toMatchObject(expectFields);
            }
        });

        it('loops summons into the live summary with unique names', async () => {
            const summary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(summary.creatures.filter(c => c.monsterIndex === 'ghoul').map(c => c.name))
                .toEqual(['Ghoul', 'Ghoul 2', 'Ghoul 3']);
            // loop feeds its own growing creatures array to the naming helper
            expect(getNextUniqueMonsterName).toHaveBeenCalledTimes(3);
            expect(getNextUniqueMonsterName.mock.calls[1][1].map(c => c.name)).toContain('Ghoul');
            expect(getNextUniqueMonsterName.mock.calls[2][1].map(c => c.name)).toContain('Ghoul 2');
        });
    });

    // ── summoned target-effects dedupe (live array) ────────────────

    describe('summoned target effects', () => {
        it('does not duplicate a live summoned effect for the same target and source', async () => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);

            const liveEffects = [
                { target: 'Ghoul', source: 'TestCaster', effect: 'summoned' },
            ];
            getRuntimeValue.mockImplementation((_entity, key) =>
                key === 'targetEffects' ? liveEffects : undefined);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 2 },
            );

            // seeded Ghoul te is kept once; only the new name is appended
            expect(liveEffects).toEqual([
                { target: 'Ghoul', source: 'TestCaster', effect: 'summoned' },
                { target: 'Ghoul 2', source: 'TestCaster', effect: 'summoned' },
            ]);
            // handler mutates the runtime-read array in place and writes it back once
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue.mock.calls[0][2]).toBe(liveEffects);
        });
    });

    // ── initiative: resolve, fallback, offset, sort ────────────────

    describe('initiative handling', () => {
        beforeEach(() => {
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('uses caster initiative over bonus, offset by 0.1', async () => {
            const table = [
                { initiative: '12', initiativeBonus: 2, expected: '11.9' },
                { initiative: '10', initiativeBonus: 5, expected: '9.9' },
            ];

            for (const { initiative, initiativeBonus, expected } of table) {
                getCombatSummary.mockReturnValue({
                    creatures: [{ name: 'TestCaster', initiative, initiativeBonus }],
                });
                const summary = getCombatSummary(mockCampaignName);

                await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

                expect(summary.creatures.find(c => c.name === 'Ghoul').initiative).toBe(expected);
            }
        });

        it('rolls initiative value plus bonus when caster initiative is unset', async () => {
            const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
            try {
                // floor(0.5 * 20) + 1 = 11, then + bonus, then - 0.1 per ghoul
                const table = [
                    { initiative: '', initiativeBonus: 3, expected: '13.9' },
                    { initiative: undefined, initiativeBonus: 3, expected: '13.9' },
                    { initiative: undefined, initiativeBonus: 5, expected: '15.9' },
                ];

                for (const { initiative, initiativeBonus, expected } of table) {
                    getCombatSummary.mockReturnValue({
                        creatures: [{ name: 'TestCaster', initiative, initiativeBonus }],
                    });
                    const summary = getCombatSummary(mockCampaignName);

                    await confirmCreateUndead(
                        makeAction(),
                        mockPlayerStats,
                        mockCampaignName,
                        { ghoulCount: 1 },
                    );

                    expect(summary.creatures.find(c => c.name === 'Ghoul').initiative).toBe(expected);
                }
            } finally {
                randomSpy.mockRestore();
            }
        });

        it('gives every ghoul the same caster-minus-0.1 initiative', async () => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            const summary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            const ghoulInits = summary.creatures
                .filter(c => c.monsterIndex === 'ghoul')
                .map(c => c.initiative);
            expect(ghoulInits).toEqual(['14.9', '14.9', '14.9']);
        });

        it('sorts creatures by initiative descending, blank initiative sorts as zero', async () => {
            const goblins = [
                { name: 'Goblin', initiative: '5' },
                { name: 'Goblin', initiative: '' },
                { name: 'Goblin' },
            ];

            for (const goblin of goblins) {
                getCombatSummary.mockReturnValue({
                    creatures: [
                        { name: 'TestCaster', initiative: '15', initiativeBonus: 0 },
                        goblin,
                    ],
                });
                const summary = getCombatSummary(mockCampaignName);

                await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

                expect(summary.creatures.map(c => c.name)).toEqual(['TestCaster', 'Ghoul', 'Goblin']);
            }
        });
    });
});
