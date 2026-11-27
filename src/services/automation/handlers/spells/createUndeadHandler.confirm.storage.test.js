// @maintained-by-ai 2026-11-27
/**
 * createUndead TRIO seam map — all three lanes share createUndeadHandler.js:
 *  - #1898 confirm (main)       — confirmCreateUndead guard refusals (missing caster,
 *                                   negative count, combat-summary / ghoul-load failure),
 *                                   count normalization, live spawn wiring, summoned-te
 *                                   dedupe, initiative resolve / fallback / sort.
 *  - #1899 handle (main)        — modal/popup dispatch, getSlotLevel chain,
 *                                   getMaxTargets table via payload.maxTargets, named
 *                                   exports (modalName / confirmType), purity guard.
 *  - THIS LANE (confirm.storage) — confirm-side PERSISTED writes + campaign log:
 *                                   storage.set('combatSummary') detached clone with
 *                                   full-row honest pins, exact-array setRuntimeValue
 *                                   ('campaign', 'targetEffects') incl. pre-existing-te
 *                                   preservation and 4-arg arity, combat-summary-updated
 *                                   CustomEvent dispatch (board refresh — never
 *                                   initiative-rolled), addEntry summons-log full-string
 *                                   composition + byte-identical logEntries mirror,
 *                                   log-rejection containment, action.metadata
 *                                   slot-derived maxTargets (unclamped table) + merge.
 *
 * run2#1821 defect FIXED here: this lane previously MOCKED both encounterToInitiative
 * helpers with a stale inline mirror. Since the 2026-11-09 series-renumbering law the
 * REAL getNextUniqueMonsterName names the FIRST spawn 'Ghoul 1' — never plain
 * 'Ghoul' — so the old mirror pinned bytes the handler can never persist. Both mocks
 * are now the run2#1820/#1848 importOriginal pass-through: the REAL pure helpers
 * produce the persisted rows (their input semantics stay owned by
 * encounterToInitiative.test.js), and every full-row toEqual below is honest. The
 * mockGhoul row carries a real saving_throws.modifier so the persisted saveBonuses
 * pin proves the real helper (mirror missed the full-name rows +
 * ability_score_modifiers fallback) lands in the stored bytes.
 *
 * run2#1821 seam note carried: the persisted entry timestamp (:192) and the
 * returned logEntries timestamp (:211) are TWO Date.now() calls in source. Date.now
 * is frozen, so both outlets pin to the exact FROZEN_TS (no expect.any(Number)
 * hiding a skew), and the mirror is pinned as byte-identity against the actual
 * addEntry call — the strongest statement the one-composition-two-outlets contract
 * allows without asserting aliasing the source does not promise.
 *
 * Honesty: handler NEVER clamps ghoulCount to maxTargets — it stores exactly what
 * is requested and separately persists the slot-derived max. The unclamp + upcast
 * table here over-requests by 1 per slot (old same-count pins never exercised
 * non-clamp). The existing-series test also characterizes an honest gap: this lane
 * does NOT re-normalize a legacy plain 'Ghoul' row (that law lives on the
 * encounter-join lane only) — plain and suffixed rows coexist after this cast.
 *
 * Consolidations (this sweep): log trio (exact entry / logEntries mirror / custom
 * name) → one it.each with full-shape pin + byte-identity mirror; popup
 * singular/plural → one it.each; metadata fresh-write case folded into the
 * unclamped table (every row pins a fresh write); the table's cumulative
 * times(i+1) census replaced by a per-case times(1) census. Deterministic: every
 * external seam mocked, no timers (summon persistence is combat-scoped), Date.now
 * and console.error harnessed per test and restored, makeAction MERGES automation
 * overrides — never replaces wholesale.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(),
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

// REAL pure helpers, not mirrors: the persisted-row toEqual pins below only mean
// something against the source of truth. Pass-through keeps the mock
// resolve-verified while delegating both functions to the real module (cf.
// run2#1820 details lane, run2#1848 animateDead storage lane).
vi.mock('../../../encounters/encounterToInitiative.js', async (importOriginal) => ({
    ...(await importOriginal()),
}));

import { confirmCreateUndead } from './createUndeadHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';

const mockPlayerStats = {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};
const mockCampaignName = 'test-campaign';
const FROZEN_TS = 1700000000000;

const mockGhoul = {
    index: 'ghoul',
    name: 'Ghoul',
    type: 'Undead',
    armor_class: 12,
    hit_points: 22,
    damage_resistances: [],
    damage_immunities: [],
    immunities: ['Poison'],
    // Real save modifier on the row: the persisted saveBonuses pins below prove
    // the REAL helper's output (dex 2, five zeros) lands in the stored bytes.
    saving_throws: { dex: { modifier: 2 } },
};

// Full ghoul row as the handler + REAL helpers persist it, given the caster's
// stated initiative 15 (spawn acts at 15 - 0.1). name/count vary per call site.
function ghoulRow(name) {
    return {
        name,
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
        saveBonuses: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
        monsterIndex: 'ghoul',
    };
}

function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Create Undead',
        ...rest,
        automation: { type: 'create_undead', ...automationOverrides },
    };
}

// Fresh mutable combat summary; the handler mutates it in place, so re-arm
// between casts that must not see each other's spawns.
function summary(creatureNames) {
    const creatures = (creatureNames ?? ['TestCaster']).map((name, i) =>
        name === 'TestCaster'
            ? { name: 'TestCaster', initiative: '15', initiativeBonus: 3 }
            : { name, initiative: String(10 - i), initiativeBonus: 0 },
    );
    const cs = { creatures };
    getCombatSummary.mockReturnValue(cs);
    return cs;
}

describe('createUndeadHandler - confirmCreateUndead storage/logging', () => {
    let consoleSpy;
    let dateNowSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        // resetAllMocks strips implementations — re-install ALL defaults.
        addEntry.mockResolvedValue({});
        getRuntimeValue.mockReturnValue(undefined);
        loadMonsters.mockResolvedValue([mockGhoul]);
        summary();
        dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FROZEN_TS);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
        consoleSpy.mockRestore();
    });

    // ── confirm-side storage & runtime writes ────────────────────

    it('persists a detached clone of combatSummary with real-helper ghoul rows', async () => {
        const cs = summary();

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
        expect(written).not.toBe(cs);
        expect(written.creatures).not.toBe(cs.creatures);

        // Full-shape honest pin: series-renumbering law names the FIRST spawn
        // 'Ghoul 1' (the retired mirror pinned plain 'Ghoul' — bytes the real
        // helper can never produce). Caster stays first at 15, ghouls follow at
        // 14.9 in stable insertion order, and the REAL getMonsterSaveBonuses
        // output (dex 2) is in the stored bytes.
        expect(written).toEqual({
            creatures: [
                { name: 'TestCaster', initiative: '15', initiativeBonus: 3 },
                ghoulRow('Ghoul 1'),
                ghoulRow('Ghoul 2'),
            ],
        });

        // Detached: mutating the live summary after the write cannot rewrite it.
        cs.creatures[0].name = 'Mutated';
        expect(written.creatures[0].name).toBe('TestCaster');
    });

    it('writes the exact summoned targetEffects array, preserving pre-existing effects, as a 4-arg broadcast (never skipSync)', async () => {
        const storedTe = [{ target: 'Goblin', source: 'Enemy', effect: 'restrained' }];
        getRuntimeValue.mockReturnValue(storedTe);

        await confirmCreateUndead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount: 2 },
        );

        // 4-arg pin fixes arity: a sneak-added skipSync here would desync every
        // client from the SSE broadcast (server-first gotcha).
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Goblin', source: 'Enemy', effect: 'restrained' },
                { target: 'Ghoul 1', source: 'TestCaster', effect: 'summoned' },
                { target: 'Ghoul 2', source: 'TestCaster', effect: 'summoned' },
            ],
            mockCampaignName,
        );
    });

    it('dispatches a bare combat-summary-updated CustomEvent once (never initiative-rolled)', async () => {
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
        // Owner decision 2026-11-10 (bug-summon-lanes-initiative-rolled-board-refresh):
        // a mid-combat summon is a PURE board refresh — the new-combat-reset
        // event must never fire from this lane.
        expect(event.type).toBe('combat-summary-updated');
        // DOM spec: CustomEvent without a detail init lands on null, not undefined.
        expect(event.detail).toBeNull();
        dispatchSpy.mockRestore();
    });

    it.each([
        { slotLevel: 6, maxTargets: 3 },
        { slotLevel: 7, maxTargets: 4 },
        { slotLevel: 8, maxTargets: 5 },
        { slotLevel: 9, maxTargets: 6 },
    ])('slot $slotLevel: stores maxTargets+1 ghouls UNCLAMPED and writes fresh slot-derived metadata (expect $maxTargets)', async ({ slotLevel, maxTargets }) => {
        const requested = maxTargets + 1;
        const action = makeAction({ automation: { slotLevel } });

        await confirmCreateUndead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount: requested },
        );

        // Per-case commit census: exactly one summary write + one te write.
        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);

        // Handler never clamps to maxTargets — it stores exactly what was
        // requested (over-request by 1; the old equal-count pin never proved
        // this), named Ghoul 1..n by the real helper.
        const [, written] = storage.set.mock.calls[0];
        expect(written.creatures.map(c => c.name)).toEqual([
            'TestCaster',
            ...Array.from({ length: requested }, (_, i) => `Ghoul ${i + 1}`),
        ]);

        // ...while the persisted metadata is the SLOT-derived max (fresh write,
        // no existing metadata to clobber).
        expect(action.metadata).toEqual({ createUndeadMaxTargets: maxTargets });
    });

    it('merges createUndeadMaxTargets onto existing action.metadata without dropping keys', async () => {
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

    it('numbers new ghouls past an existing series in both stored rows and badge names', async () => {
        summary(['TestCaster', 'Ghoul', 'Ghoul 2', 'Ghoul 3']);

        await confirmCreateUndead(
            makeAction(),
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount: 2 },
        );

        const [, written] = storage.set.mock.calls[0];
        // Loop feeds the growing creature array: Ghoul 4 and 5 must not collide,
        // and sort right after the caster at 15 - 0.1. Honest gap: the legacy
        // plain 'Ghoul' row is NOT re-normalized — that law is join-lane-only,
        // so plain and suffixed rows coexist after this cast.
        expect(written.creatures.map(c => c.name)).toEqual([
            'TestCaster', 'Ghoul 4', 'Ghoul 5', 'Ghoul', 'Ghoul 2', 'Ghoul 3',
        ]);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Ghoul 4', source: 'TestCaster', effect: 'summoned' },
                { target: 'Ghoul 5', source: 'TestCaster', effect: 'summoned' },
            ],
            mockCampaignName,
        );
    });

    // ── confirm-side log writes ──────────────────────────────────

    it.each([
        {
            label: 'default-named action, plural count',
            actionName: 'Create Undead',
            ghoulCount: 3,
            expectDescription: 'TestCaster casts Create Undead (slot level 6), creating 3 ghouls.',
            expectCreatures: ['Ghoul 1', 'Ghoul 2', 'Ghoul 3'],
        },
        {
            label: 'renamed action keeps hardcoded summon text, singular count',
            actionName: 'Custom Undead Spell',
            ghoulCount: 1,
            expectDescription: 'TestCaster casts Create Undead (slot level 6), creating 1 ghoul.',
            expectCreatures: ['Ghoul 1'],
        },
    ])('logs an exact summons entry and returns a byte-identical logEntries mirror — $label', async ({ actionName, ghoulCount, expectDescription, expectCreatures }) => {
        const result = await confirmCreateUndead(
            makeAction({ name: actionName }),
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount },
        );

        expect(addEntry).toHaveBeenCalledTimes(1);
        // Frozen Date.now => exact timestamp pin (no expect.any(Number)).
        expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
            type: 'summons',
            characterName: 'TestCaster',
            // summonName is hardcoded: an action rename must not leak into the log.
            summonName: 'Create Undead',
            description: expectDescription,
            summonedCreatures: expectCreatures,
            timestamp: FROZEN_TS,
        });
        // One composition, two outlets: the returned entry deep-equals exactly
        // what was persisted — the source's two Date.now() calls both read the
        // frozen clock, so any future skew or divergence fails byte-identity.
        expect(result.logEntries).toEqual([addEntry.mock.calls[0][1]]);
        // The popup echoes the CALLER's name even though the log hardcodes it.
        expect(result.payload.name).toBe(actionName);
    });

    it('contains a log rejection: persistence, metadata and popup all survive', async () => {
        const action = makeAction();
        const logError = new Error('log service down');
        addEntry.mockRejectedValueOnce(logError);

        const result = await confirmCreateUndead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount: 1 },
        );

        expect(result.type).toBe('popup');
        expect(result.logEntries).toHaveLength(1);
        // Persistence landed BEFORE the log attempt — summon is not rolled back,
        // and the post-log metadata write still runs.
        expect(storage.set).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(action.metadata).toEqual({ createUndeadMaxTargets: 3 });
        // Exact sink + exact rejected error, logged once.
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('[createUndeadHandler:log-error]', logError);
    });

    // ── confirm popup payload composition ──────────────────────────

    it.each([
        { count: 1, expectDescription: 'TestCaster casts Create Undead, creating 1 Ghoul. They act on your turn, right after you.' },
        { count: 3, expectDescription: 'TestCaster casts Create Undead, creating 3 Ghouls. They act on your turn, right after you.' },
    ])('returns the exact full-shape popup payload for count $count', async ({ count, expectDescription }) => {
        const action = makeAction();

        const result = await confirmCreateUndead(
            action,
            mockPlayerStats,
            mockCampaignName,
            { ghoulCount: count },
        );

        expect(result.type).toBe('popup');
        expect(result.payload).toEqual({
            type: 'automation_info',
            name: 'Create Undead',
            description: expectDescription,
            automation: { type: 'create_undead' },
        });
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
    });
});
