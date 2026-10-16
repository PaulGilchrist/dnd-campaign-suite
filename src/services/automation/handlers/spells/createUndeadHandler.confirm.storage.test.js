// @maintained-by-ai
/**
 * createUndead TRIO seam map — all three lanes share createUndeadHandler.js:
 *  - #1898 confirm (main)       — confirmCreateUndead guards (falsy ghoulCount default,
 *                                   negative-count popup, combat-summary / ghoul-load failure
 *                                   popups), ghoul spawn field spot-checks, summoned te
 *                                   accumulation + source pin, initiative resolve / offset /
 *                                   sort / string-format lanes.
 *  - #1899 handle (main)        — modal/popup dispatch, maxTargets re-entry popup,
 *                                   getSlotLevel chain (automation→metaCtx→spell→default 6),
 *                                   getMaxTargets upcast table via payload.maxTargets,
 *                                   named exports (modalName / confirmType).
 *  - THIS LANE (confirm.storage) — confirm-side persistence: storage.set('combatSummary')
 *                                   detached-clone guard, exact-array setRuntimeValue
 *                                   ('campaign', 'targetEffects') pins incl. pre-existing-te
 *                                   preservation, initiative-rolled CustomEvent dispatch,
 *                                   addEntry summons-log full-string composition, returned
 *                                   logEntries mirror, log-rejection resilience, action.metadata
 *                                   maxTargets write + merge, popup description full strings,
 *                                   automation pass-through identity, unique-name naming of
 *                                   STORED creatures (proves the loop feeds the growing
 *                                   creatures array and stores the result).
 *
 * Different handler from animateDeadHandler (confirmed at source): ghoul-only spawn table,
 * bespoke handle()/confirmCreateUndead() — no shared factory config with animateDead or
 * createMassHeal; animateDead sextet lanes stay separate. No D2-enforcement-style branch
 * exists at this source (no save prompt on summon) — noted honestly.
 *
 * Handoff to later lanes (#1898 / #1899):
 *  - Full-string popup pins below supersede #1898's loose contains-pins in
 *    'creates a ghoul when count is 1' ('Ghoul' / 'right after you').
 *  - Exact-array te pins below supersede #1898's filter-and-length checks in
 *    'creates summoned target effects for each ghoul' / 'does not duplicate summoned
 *    effects for same creature' (dedupe itself stays #1898's — they seed live arrays).
 *  - 'numbers multiple ghouls correctly' (#1898) and this file's removed
 *    'renames ghoul when one already exists' / 'handles chain of existing ghouls'
 *    were characterization tests of the MOCKED getNextUniqueMonsterName — consolidated
 *    into the stored-naming pin here; helper behavior belongs to encounterToInitiative's
 *    own tests.
 *  - Removed upcast trio (6/7/9) + metadata slot-8 test consolidated into one table pin.
 *    NOTE: handler never clamps ghoulCount to maxTargets — old test names overstated it.
 *  - makeAction here now MERGES automation overrides (trio siblings #1898/#1899 still
 *    spread overrides AFTER the automation merge, silently dropping type — fix there too).
 *
 * Deterministic: every external seam mocked, no timers (summon persistence is
 * combat-scoped), full-string description pins and exact-array te pins intentional
 * per house style.
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
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

describe('createUndeadHandler - confirmCreateUndead storage/logging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // clearAllMocks keeps implementations — force te-reader back to empty
        // so getRuntimeValue.mockReturnValue cannot leak between tests.
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

    // ── confirm-side storage & runtime writes ────────────────────

    describe('confirmCreateUndead - storage & runtime writes', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('stores the sorted combat summary as a detached clone', async () => {
            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 2 },
            );

            expect(storage.set).toHaveBeenCalledTimes(1);
            const [key, written, campaign] = storage.set.mock.calls[0];
            expect(key).toBe('combatSummary');
            expect(campaign).toBe(mockCampaignName);

            const summary = getCombatSummary(mockCampaignName);
            expect(written).not.toBe(summary);
            expect(written.creatures).not.toBe(summary.creatures);
            // caster stays first, ghouls follow at caster-initiative - 0.1
            expect(written.creatures.map(c => c.name)).toEqual(['TestCaster', 'Ghoul', 'Ghoul 2']);

            // mutate the live summary AFTER the write — the clone must not track it
            summary.creatures[0].name = 'Mutated';
            expect(written.creatures[0].name).toBe('TestCaster');
        });

        it('writes the exact summoned targetEffects array, preserving pre-existing effects', async () => {
            getRuntimeValue.mockReturnValue([
                { target: 'Goblin', source: 'Enemy', effect: 'restrained' },
            ]);

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 2 },
            );

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: 'Goblin', source: 'Enemy', effect: 'restrained' },
                { target: 'Ghoul', source: 'TestCaster', effect: 'summoned' },
                { target: 'Ghoul 2', source: 'TestCaster', effect: 'summoned' },
            ], mockCampaignName);
        });

        it('dispatches a bare initiative-rolled CustomEvent once', async () => {
            const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(dispatchSpy).toHaveBeenCalledTimes(1);
            const event = dispatchSpy.mock.calls[0][0];
            expect(event).toBeInstanceOf(CustomEvent);
            expect(event.type).toBe('initiative-rolled');
            expect(event.detail).toBeNull();
            dispatchSpy.mockRestore();
        });

        it('stores requested ghouls and slot-derived maxTargets metadata across the upcast table', async () => {
            const table = [
                { slotLevel: 6, count: 3 },
                { slotLevel: 7, count: 4 },
                { slotLevel: 8, count: 5 },
                { slotLevel: 9, count: 6 },
            ];

            for (let i = 0; i < table.length; i++) {
                getCombatSummary.mockReturnValue(defaultCombatSummary());
                const action = makeAction({ automation: { slotLevel: table[i].slotLevel } });

                await confirmCreateUndead(
                    action,
                    mockPlayerStats,
                    mockCampaignName,
                    { ghoulCount: table[i].count },
                );

                // handler never clamps ghoulCount — it stores exactly what was requested
                expect(storage.set).toHaveBeenCalledTimes(i + 1);
                const [, written] = storage.set.mock.calls[i];
                expect(written.creatures.filter(c => c.monsterIndex === 'ghoul')).toHaveLength(table[i].count);
                expect(action.metadata).toEqual({ createUndeadMaxTargets: table[i].count });
            }
        });

        it('writes maxTargets metadata fresh and merged onto existing metadata', async () => {
            const plainAction = makeAction();
            await confirmCreateUndead(plainAction, mockPlayerStats, mockCampaignName, { ghoulCount: 1 });
            expect(plainAction.metadata).toEqual({ createUndeadMaxTargets: 3 });

            const actionWithMeta = makeAction({ metadata: { existingKey: 'value' } });
            await confirmCreateUndead(actionWithMeta, mockPlayerStats, mockCampaignName, { ghoulCount: 1 });
            expect(actionWithMeta.metadata).toEqual({
                existingKey: 'value',
                createUndeadMaxTargets: 3,
            });
        });

        it('stores and badges uniquely numbered names when ghouls already exist', async () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
                    { name: 'Ghoul', initiative: '10', initiativeBonus: 0 },
                    { name: 'Ghoul 2', initiative: '9', initiativeBonus: 0 },
                    { name: 'Ghoul 3', initiative: '8', initiativeBonus: 0 },
                ],
            });

            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 2 },
            );

            const [, written] = storage.set.mock.calls[0];
            // loop feeds the growing creature array: Ghoul 4 and 5 must not collide,
            // and stay sorted right after the caster at 15 - 0.1
            expect(written.creatures.map(c => c.name)).toEqual([
                'TestCaster', 'Ghoul 4', 'Ghoul 5', 'Ghoul', 'Ghoul 2', 'Ghoul 3',
            ]);
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
                { target: 'Ghoul 4', source: 'TestCaster', effect: 'summoned' },
                { target: 'Ghoul 5', source: 'TestCaster', effect: 'summoned' },
            ], mockCampaignName);
        });
    });

    // ── confirm-side log writes ──────────────────────────────────

    describe('confirmCreateUndead - log writes', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('logs a summons entry with the exact composed description and creature list', async () => {
            await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Create Undead',
                description: 'TestCaster casts Create Undead (slot level 6), creating 3 ghouls.',
                summonedCreatures: ['Ghoul', 'Ghoul 2', 'Ghoul 3'],
                timestamp: expect.any(Number),
            });
        });

        it('returns logEntries mirroring the persisted summons entry', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.logEntries).toEqual([{
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Create Undead',
                description: 'TestCaster casts Create Undead (slot level 6), creating 1 ghoul.',
                summonedCreatures: ['Ghoul'],
                timestamp: expect.any(Number),
            }]);
        });

        it('keeps hardcoded summon text when the action has a custom name', async () => {
            const result = await confirmCreateUndead(
                makeAction({ name: 'Custom Undead Spell' }),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.name).toBe('Custom Undead Spell');
            expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'summons',
                characterName: 'TestCaster',
                summonName: 'Create Undead',
                description: 'TestCaster casts Create Undead (slot level 6), creating 1 ghoul.',
                summonedCreatures: ['Ghoul'],
                timestamp: expect.any(Number),
            });
            expect(result.logEntries[0].summonName).toBe('Create Undead');
        });

        it('still completes storage writes and returns popup when addEntry rejects', async () => {
            addEntry.mockRejectedValueOnce(new Error('log service down'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.type).toBe('popup');
            expect(result.logEntries).toHaveLength(1);
            // persistence landed BEFORE the log attempt — summon is not rolled back
            expect(storage.set).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith('[createUndeadHandler:log-error]', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    // ── confirm popup payload composition ──────────────────────────

    describe('confirmCreateUndead - popup payload', () => {
        beforeEach(() => {
            getCombatSummary.mockReturnValue(defaultCombatSummary());
            loadMonsters.mockResolvedValue([mockGhoul]);
        });

        it('composes the exact singular popup description', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.description).toBe(
                'TestCaster casts Create Undead, creating 1 Ghoul. They act on your turn, right after you.'
            );
        });

        it('composes the exact plural popup description', async () => {
            const result = await confirmCreateUndead(
                makeAction(),
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 3 },
            );

            expect(result.payload.description).toBe(
                'TestCaster casts Create Undead, creating 3 Ghouls. They act on your turn, right after you.'
            );
        });

        it('passes the action automation through to the popup payload by reference', async () => {
            const action = makeAction({ automation: { slotLevel: 5 } });

            const result = await confirmCreateUndead(
                action,
                mockPlayerStats,
                mockCampaignName,
                { ghoulCount: 1 },
            );

            expect(result.payload.automation).toBe(action.automation);
            expect(result.payload.automation).toEqual({ type: 'create_undead', slotLevel: 5 });
        });
    });
});
