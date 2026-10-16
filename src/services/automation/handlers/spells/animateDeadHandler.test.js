// @maintained-by-ai
/**
 * animateDead SEXTET lane #1867 — handle() (main).
 * Seam map lives in animateDeadHandler.confirm.details.test.js; all six lanes
 * share animateDeadHandler.js. THIS lane owns the handle() dispatch surface:
 *  - modal envelope: exact result/payload keys, modalName 'animateDead',
 *    reference pass-through of action/playerStats/campaignName/maxTargets
 *  - at-max refusal popup: exact envelope + full-string description, recomputed
 *    per upcast slot — stored max must EQUAL the current slot's max, never a
 *    stale or foreign-slot value
 *  - getSlotLevel chain: automation.slotLevel > metaCtx.slotLevel >
 *    spell.level > default 3 (precedence pinned in one table)
 *  - getMaxTargets upcast table 3→1 … 9→13, sub-min/unknown slots → ||1
 *  - purity guard: handle() is pure dispatch — it never loads monsters, reads
 *    combat summary, writes storage/runtime/te, logs, or mutates metadata.
 *    (Refusal happens before load; the metadata maxTargets write is confirm-side.)
 *
 * Shed to siblings — do NOT re-absorb here:
 *  - confirm envelope/guards/spawn spot-checks → confirm.test.js (#1865)
 *  - storage/runtime/te/log/dispatch writes + D2 enforcement branch →
 *    confirm.storage.test.js (#1864)
 *  - initiative formula/sort/no-roll canon → confirm.initiative.test.js (#1863)
 *  - buildCreatureEntry assembly + confirm popup prose → confirm.details.test.js
 *  - multi-cast accumulation + uniqueness mutation-proof → multicast.test.js (#1866)
 * Inline getNextUniqueMonsterName/getMonsterSaveBonuses mock logic from the old
 * version was dropped: handle() never calls them (purity guard asserts silence).
 *
 * Deterministic: every external seam mocked, no timers, full-string pins
 * intentional per house style. Turn-based only — handle() is pure dispatch.
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

// Plain stubs: handle() must never reach these (purity guard asserts not-called).
vi.mock('../../../encounters/encounterToInitiative.js', () => ({
    getMonsterSaveBonuses: vi.fn(),
    getNextUniqueMonsterName: vi.fn(),
}));

import { handle } from './animateDeadHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import storage from '../../../ui/storage.js';
import { loadMonsters } from '../../../ui/dataLoader.js';
import { getMonsterSaveBonuses, getNextUniqueMonsterName } from '../../../encounters/encounterToInitiative.js';

const mockPlayerStats = {
    name: 'TestCaster',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};
const mockCampaignName = 'test-campaign';

// Canonical upcast table mirrors getMaxTargets in animateDeadHandler.js.
const UPCAST = { 3: 1, 4: 3, 5: 5, 6: 7, 7: 9, 8: 11, 9: 13 };

// makeAction MERGES overrides (automation included) — never replaces wholesale.
function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Animate Dead',
        ...rest,
        automation: { type: 'animate_dead', ...automationOverrides },
    };
}

describe('animateDeadHandler.handle - dispatch envelope', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('opens animateDead modal with exact payload envelope and identity pass-through', async () => {
        const action = makeAction();

        const result = await handle(action, mockPlayerStats, mockCampaignName);

        expect(Object.keys(result)).toEqual(['type', 'modalName', 'payload']);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('animateDead');
        expect(Object.keys(result.payload)).toEqual(['action', 'playerStats', 'campaignName', 'maxTargets']);
        expect(result.payload.action).toBe(action);
        expect(result.payload.playerStats).toBe(mockPlayerStats);
        expect(result.payload.campaignName).toBe(mockCampaignName);
        expect(result.payload.maxTargets).toBe(1);
    });

    it('is pure dispatch: neither modal nor refusal path touches load/storage/runtime/log seams', async () => {
        const modalAction = makeAction();
        const refusalAction = makeAction({ metadata: { animateDeadMaxTargets: 1 } });

        await handle(modalAction, mockPlayerStats, mockCampaignName);
        await handle(refusalAction, mockPlayerStats, mockCampaignName);

        expect(loadMonsters).not.toHaveBeenCalled();
        expect(getCombatSummary).not.toHaveBeenCalled();
        expect(storage.get).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(getMonsterSaveBonuses).not.toHaveBeenCalled();
        expect(getNextUniqueMonsterName).not.toHaveBeenCalled();
        // The metadata maxTargets write is confirm-side canon (#1864) — handle must not pre-write it.
        expect(modalAction.metadata).toBeUndefined();
    });
});

describe('animateDeadHandler.handle - at-max refusal popup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refuses at max with exact popup envelope and full description string', async () => {
        const action = makeAction({ metadata: { animateDeadMaxTargets: 1 } });

        const result = await handle(action, mockPlayerStats, mockCampaignName);

        expect(Object.keys(result)).toEqual(['type', 'payload']);
        expect(result.type).toBe('popup');
        expect(Object.keys(result.payload)).toEqual(['type', 'name', 'description', 'automation']);
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Animate Dead');
        expect(result.payload.description).toBe('Animate Dead: 1 undead creature(s) created.');
        expect(result.payload.automation).toBe(action.automation);
    });

    it('recomputes refusal per slot level — equality is against the CURRENT slot max, never stale values', async () => {
        const cases = [
            // Stored value matches the upcast max → refusal popup, count recomputed for slot 4.
            { label: 'stored matches upcast slot', metadata: { animateDeadMaxTargets: 3 }, automation: { slotLevel: 4 }, expectPopup: true },
            // Stale base-slot value while upcast → modal (must not refuse on mere presence).
            { label: 'stale base-slot value while upcast', metadata: { animateDeadMaxTargets: 1 }, automation: { slotLevel: 4 }, expectPopup: false, maxTargets: 3 },
            // Foreign-slot value at base slot → modal.
            { label: 'foreign-slot value at base slot', metadata: { animateDeadMaxTargets: 5 }, automation: {}, expectPopup: false, maxTargets: 1 },
            // Unknown stored value (never a valid table max) → modal.
            { label: 'unknown stored value', metadata: { animateDeadMaxTargets: 2 }, automation: {}, expectPopup: false, maxTargets: 1 },
            // Zero stored (nothing created yet) → modal.
            { label: 'zero stored count', metadata: { animateDeadMaxTargets: 0 }, automation: {}, expectPopup: false, maxTargets: 1 },
            // Metadata key missing entirely → modal.
            { label: 'metadata key missing', metadata: {}, automation: {}, expectPopup: false, maxTargets: 1 },
        ];

        for (const { label, metadata, automation, expectPopup, maxTargets } of cases) {
            const action = makeAction({ metadata, automation });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            if (expectPopup) {
                expect(result.type, label).toBe('popup');
                expect(result.payload.description, label).toBe('Animate Dead: 3 undead creature(s) created.');
            } else {
                expect(result.type, label).toBe('modal');
                expect(result.modalName, label).toBe('animateDead');
                expect(result.payload.maxTargets, label).toBe(maxTargets);
            }
        }
    });
});

describe('animateDeadHandler.handle - getSlotLevel chain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves automation.slotLevel > metaCtx.slotLevel > spell.level > default 3, in precedence order', async () => {
        // Every branch resolves to a distinct slot max (4→3, 6→7, 5→5, default 3→1)
        // so one table pins both branch reachability AND precedence order.
        const chain = [
            { label: 'automation.slotLevel wins over metaCtx and spell', action: makeAction({ automation: { slotLevel: 4 }, metaCtx: { slotLevel: 6 }, spell: { level: 5 } }), expectedMax: 3 },
            { label: 'metaCtx.slotLevel when automation.slotLevel absent', action: makeAction({ metaCtx: { slotLevel: 6 }, spell: { level: 5 } }), expectedMax: 7 },
            { label: 'spell.level when automation and metaCtx absent', action: makeAction({ spell: { level: 5 } }), expectedMax: 5 },
            { label: 'defaults to slot level 3 when no level info', action: makeAction({ automation: {} }), expectedMax: 1 },
        ];

        for (const { label, action, expectedMax } of chain) {
            const result = await handle(action, mockPlayerStats, mockCampaignName);
            expect(result.payload.maxTargets, label).toBe(expectedMax);
        }
    });
});

describe('animateDeadHandler.handle - getMaxTargets upcast table', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('maps every slot level 3-9 to its exact count and sub-min slots to the ||1 fallback', async () => {
        const table = [...Object.entries(UPCAST), ['1', 1], ['2', 1]];

        for (const [slotLevel, expectedMax] of table) {
            const action = makeAction({ automation: { slotLevel: Number(slotLevel) } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);
            expect(result.payload.maxTargets, `slot ${slotLevel}`).toBe(expectedMax);
        }
    });
});
