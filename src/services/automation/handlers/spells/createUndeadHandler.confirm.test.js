// @maintained-by-ai 2026-11-27
/**
 * createUndead TRIO lane #1898 (confirm main) — shares createUndeadHandler.js with
 * createUndeadHandler.test.js (#1899 handle) and createUndeadHandler.confirm.storage.test.js
 * (confirm.storage). See the storage lane header for the full trio seam map.
 *
 * THIS LANE owns:
 *  - confirmCreateUndead guard refusals (missing caster, negative count, combat-summary
 *    load failure, ghoul-data load failure) as exact full-shape popup toEquals, each
 *    pinned as a no-side-effect guard (no combat read / no spawn / no persistence).
 *    The refusals carry NO logEntries key — the full-shape pin catches any leak.
 *  - count normalization (ghoulCount || 1) for missing/0/null,
 *  - exact spawned-creature shape incl. saveBonuses pass-through,
 *  - monster defaults / resistances / immunities || -chain mapping,
 *  - unique naming THROUGH the loop on the live summary (loop feeds its own growing
 *    creatures array; stored-side uniquification is the storage lane's), one shared
 *    initiative across the loop, and per-spawn saveBonuses wiring,
 *  - summoned-targetEffects dedupe via live-array seeding incl. in-place write identity
 *    (happy-path exact te content is the storage lane's),
 *  - initiative resolve (caster init beats bonus), random-fallback roll, descending sort.
 *
 * Mock strategy (run3 sweep 2026-11-27, mirroring animateDeadHandler.confirm.details):
 *  - getMonsterSaveBonuses is a SENTINEL (output keyed by monster.index), not a mirror —
 *    its six-key input semantics belong to encounterToInitiative.test.js; this lane pins
 *    only that each spawn's wiring reads the right monster.
 *  - getNextUniqueMonsterName is the REAL pure helper via importOriginal. The trio's old
 *    mirror was STALE: since the 2026-11-09 series-renumbering law the first spawn is
 *    'Ghoul 1', never plain 'Ghoul'. With the real helper, a growing-array feed failure
 *    (stale snapshot) surfaces as duplicate names — no mock introspection needed.
 *    CROSS-FILE: createUndeadHandler.confirm.storage.test.js still mocks the stale
 *    mirror ('Ghoul', 'Ghoul 2', …) — reported, not edited here.
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

vi.mock('../../../encounters/encounterToInitiative.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        // Sentinel, not a mirror of the real helper (its semantics are owned by
        // encounterToInitiative.test.js): output keyed by monster.index proves
        // per-spawn wiring reads the right monster without re-testing the helper.
        getMonsterSaveBonuses: vi.fn((monster) => ({ wiredFrom: monster.index })),
    };
});

import { confirmCreateUndead } from './createUndeadHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import storage from '../../../ui/storage.js';
import { getMonsterSaveBonuses } from '../../../encounters/encounterToInitiative.js';

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
        // Pre-combat guards: refuse before ANY combat read, monster load or write.
        it.each([
            { label: 'caster data is missing', stats: null, ghoulCount: 1,
              description: 'Failed to load caster data.' },
            { label: 'count is negative', stats: mockPlayerStats, ghoulCount: -1,
              description: 'No undead created.' },
        ])('refuses when $label with an exact refusal popup and zero spend', async ({ stats, ghoulCount, description }) => {
            const action = makeAction();

            const result = await confirmCreateUndead(action, stats, mockCampaignName, { ghoulCount });

            // full shape: refusals carry no logEntries key
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Create Undead',
                    description,
                    automation: action.automation,
                },
            });
            expect(getCombatSummary).not.toHaveBeenCalled();
            expect(loadMonsters).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when combat summary is null or undefined, before loading monsters', async () => {
            for (const val of [null, undefined]) {
                getCombatSummary.mockReturnValue(val);

                const result = await confirmCreateUndead(
                    makeAction(),
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: 1 },
                );

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

                expect(result.payload.description).toBe('Failed to load ghoul monster data.');
                expect(summary.creatures).toHaveLength(1);
                expect(storage.set).not.toHaveBeenCalled();
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });
    });

    // ── count normalization (ghoulCount || 1) ──────────────────────

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
                .toEqual(['Ghoul 1']);
        }
    });

    // ── happy-path shape ───────────────────────────────────────────

    describe('confirm happy path', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('spawns the ghoul with the exact creature shape behind an automation_info popup', async () => {
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
            // empty damage_immunities is truthy — immunities stays [], never ['Poison'];
            // saveBonuses sentinel proves the spawn read the ghoul monster
            expect(summary.creatures.find(c => c.monsterIndex === 'ghoul')).toEqual({
                name: 'Ghoul 1',
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
                saveBonuses: { wiredFrom: 'ghoul' },
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
                { label: 'retired legacy immunities key is ignored (no-legacy sweep)', monster: { ...mockGhoul, damage_immunities: undefined, immunities: ['poison'] },
                  expectFields: { immunities: [] } },
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

        it('loops summons into the live summary: unique names, shared initiative, per-spawn save wiring', async () => {
            const summary = getCombatSummary(mockCampaignName);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            // real naming helper: a stale (non-growing) array feed would repeat 'Ghoul 1'
            const ghouls = summary.creatures.filter(c => c.monsterIndex === 'ghoul');
            expect(ghouls.map(c => c.name)).toEqual(['Ghoul 1', 'Ghoul 2', 'Ghoul 3']);
            // ONE caster-resolved initiative offset onto every ghoul (15 - 0.1)
            expect(ghouls.map(c => c.initiative)).toEqual(['14.9', '14.9', '14.9']);
            expect(getMonsterSaveBonuses.mock.calls.map(c => c[0].index)).toEqual(['ghoul', 'ghoul', 'ghoul']);
        });
    });

    // ── summoned target-effects dedupe (live array) ────────────────

    it('does not duplicate a live summoned effect for the same target and source', async () => {
        getCombatSummary.mockReturnValue(defaultCombatSummary());
        loadMonsters.mockResolvedValue([mockGhoul]);

        const liveEffects = [
            { target: 'Ghoul 1', source: 'TestCaster', effect: 'summoned' },
        ];
        getRuntimeValue.mockImplementation((_entity, key) =>
            key === 'targetEffects' ? liveEffects : undefined);

        await confirmCreateUndead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount: 2 },
        );

        // seeded Ghoul 1 te is kept once; only the new name is appended
        expect(liveEffects).toEqual([
            { target: 'Ghoul 1', source: 'TestCaster', effect: 'summoned' },
            { target: 'Ghoul 2', source: 'TestCaster', effect: 'summoned' },
        ]);
        // handler mutates the runtime-read array in place and writes it back once
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue.mock.calls[0][2]).toBe(liveEffects);
    });

    // ── initiative: resolve, fallback, sort ────────────────────────

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

                expect(summary.creatures.find(c => c.monsterIndex === 'ghoul').initiative).toBe(expected);
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

                    expect(summary.creatures.find(c => c.monsterIndex === 'ghoul').initiative).toBe(expected);
                }
            } finally {
                randomSpy.mockRestore();
            }
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

                expect(summary.creatures.map(c => c.name)).toEqual(['TestCaster', 'Ghoul 1', 'Goblin']);
            }
        });
    });
});
