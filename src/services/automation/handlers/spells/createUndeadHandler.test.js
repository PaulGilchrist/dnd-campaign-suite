// @maintained-by-ai
/**
 * createUndead TRIO lane #1899 (handle main) — shares createUndeadHandler.js with
 * createUndeadHandler.confirm.test.js (#1898 confirm) and
 * createUndeadHandler.confirm.storage.test.js (confirm.storage). See the storage
 * lane header for the full trio seam map.
 *
 * THIS lane owns handle() — pure dispatch surface:
 *  - modal envelope: exact result/payload keys, modalName 'createUndead' (the literal
 *    the modal router consumes; useSpellCastExecutor.modalRouting pins the route),
 *    reference pass-through of action/playerStats/campaignName/maxTargets
 *  - at-max refusal popup: exact envelope + full-string description, recomputed per
 *    upcast slot — stored max must STRICTLY equal the current slot's max, never a
 *    stale, foreign-slot, or stringly-typed value
 *  - getSlotLevel chain: automation.slotLevel > metaCtx.slotLevel > spell.level >
 *    default 6, in precedence order, incl. the truthy-check fallthrough (slotLevel 0
 *    is falsy → next source wins)
 *  - getMaxTargets upcast table 6→3, 7→4, 8→5, 9→6; sub-min/unknown slots → ||3
 *  - purity guard: handle() never loads monsters, reads combat summary, touches
 *    storage/runtime/log/seam helpers, or pre-writes metadata (the metadata
 *    maxTargets write is confirm-side, owned by the storage lane)
 *
 * Guard refusals BEFORE confirm here are just the at-max popup — there is no
 * eligibility guard at this source: rules require a 6th-level slot, but the handler
 * never enforces it (sub-6 slot → modal, maxTargets 3 — actual behavior pinned).
 *
 * Shed to siblings — do NOT re-absorb here:
 *  - confirm guards, count normalization, spawn shape, live te dedupe, initiative →
 *    confirm.test.js (#1898)
 *  - storage.set detached-clone, exact te arrays, initiative event, log full-strings,
 *    metadata write+merge → confirm.storage.test.js
 *  - getNextUniqueMonsterName/getMonsterSaveBonuses inline mock logic deleted:
 *    handle() never calls them (purity guard asserts silence); helper internals
 *    belong to encounterToInitiative's own tests.
 *  - Old loose contains-pins ('3 ghoul(s) created' substring, per-branch modal its)
 *    consolidated into exact-envelope pins + tables here. Old metadata
 *    missing/undefined/null trio → two table rows (same ||undefined branch).
 *
 * makeAction MERGES automation overrides (fix #13 per trio handoff — old version
 * spread overrides AFTER the automation merge, silently dropping type, which broke
 * the registry-dispatch contract automation.type === 'create_undead').
 *
 * Dead-export flag: HANDLER_MODAL/HANDLER_CONFIRM (exported as modalName/confirmType)
 * have NO production importer — index.js imports handle/confirmCreateUndead directly
 * and registers them under create_undead/create_undead_confirm; CharActionModals
 * imports confirmCreateUndead. Kept as convention constants, pinned once.
 *
 * Deterministic: every external seam mocked, no timers (dispatch is turn-based),
 * full-string and exact-key pins intentional per house style.
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

import { handle, modalName, confirmType } from './createUndeadHandler.js';
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

// Canonical upcast table mirrors getMaxTargets in createUndeadHandler.js.
const UPCAST = { 6: 3, 7: 4, 8: 5, 9: 6 };

// makeAction MERGES overrides (automation included) — never replaces wholesale.
function makeAction(overrides = {}) {
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Create Undead',
        ...rest,
        automation: { type: 'create_undead', ...automationOverrides },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('createUndeadHandler.handle - dispatch envelope', () => {
    it('opens createUndead modal with exact payload envelope and identity pass-through', async () => {
        const action = makeAction();

        const result = await handle(action, mockPlayerStats, mockCampaignName);

        expect(Object.keys(result)).toEqual(['type', 'modalName', 'payload']);
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('createUndead');
        expect(Object.keys(result.payload)).toEqual(['action', 'playerStats', 'campaignName', 'maxTargets']);
        expect(result.payload.action).toBe(action);
        expect(result.payload.playerStats).toBe(mockPlayerStats);
        expect(result.payload.campaignName).toBe(mockCampaignName);
        expect(result.payload.maxTargets).toBe(3);
    });

    it('is pure dispatch: neither modal nor refusal path touches load/storage/runtime/log seams', async () => {
        const modalAction = makeAction();
        const refusalAction = makeAction({ metadata: { createUndeadMaxTargets: 3 } });

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
        // The metadata maxTargets write is confirm-side canon (storage lane) — handle must not pre-write it.
        expect(modalAction.metadata).toBeUndefined();
        expect(refusalAction.metadata).toEqual({ createUndeadMaxTargets: 3 });
    });
});

describe('createUndeadHandler.handle - at-max refusal popup', () => {
    it('refuses at max with exact popup envelope and full description string', async () => {
        const action = makeAction({ metadata: { createUndeadMaxTargets: 3 } });

        const result = await handle(action, mockPlayerStats, mockCampaignName);

        expect(Object.keys(result)).toEqual(['type', 'payload']);
        expect(result.type).toBe('popup');
        expect(Object.keys(result.payload)).toEqual(['type', 'name', 'description', 'automation']);
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Create Undead');
        expect(result.payload.description).toBe('Create Undead: 3 ghoul(s) created.');
        expect(result.payload.automation).toBe(action.automation);
    });

    it('recomputes refusal per slot level — strict equality vs the CURRENT slot max, never stale/foreign values', async () => {
        const cases = [
            // Stored value matches the upcast max → refusal, count recomputed for slot 7.
            { label: 'stored matches upcast slot', metadata: { createUndeadMaxTargets: 4 }, automation: { slotLevel: 7 }, expectPopup: true, description: 'Create Undead: 4 ghoul(s) created.' },
            // Stale base-slot value while upcast → modal (must not refuse on mere presence).
            { label: 'stale base-slot value while upcast', metadata: { createUndeadMaxTargets: 3 }, automation: { slotLevel: 7 }, expectPopup: false, maxTargets: 4 },
            // Foreign-slot value at base slot → modal.
            { label: 'foreign-slot value at base slot', metadata: { createUndeadMaxTargets: 5 }, automation: {}, expectPopup: false, maxTargets: 3 },
            // Unknown stored value (never a valid table max) → modal.
            { label: 'unknown stored value', metadata: { createUndeadMaxTargets: 2 }, automation: {}, expectPopup: false, maxTargets: 3 },
            // Zero stored (nothing created yet) → modal.
            { label: 'zero stored count', metadata: { createUndeadMaxTargets: 0 }, automation: {}, expectPopup: false, maxTargets: 3 },
            // Stringly-typed stored value fails strict === → modal.
            { label: 'string stored value never refuses', metadata: { createUndeadMaxTargets: '3' }, automation: {}, expectPopup: false, maxTargets: 3 },
            // Metadata key missing entirely → modal.
            { label: 'metadata key missing', metadata: {}, automation: {}, expectPopup: false, maxTargets: 3 },
            // Nullish metadata (|| undefined branch) → modal.
            { label: 'metadata null', metadata: null, automation: {}, expectPopup: false, maxTargets: 3 },
        ];

        for (const { label, metadata, automation, expectPopup, description, maxTargets } of cases) {
            const action = makeAction({ metadata, automation });
            const result = await handle(action, mockPlayerStats, mockCampaignName);

            if (expectPopup) {
                expect(result.type, label).toBe('popup');
                expect(result.payload.description, label).toBe(description);
            } else {
                expect(result.type, label).toBe('modal');
                expect(result.modalName, label).toBe('createUndead');
                expect(result.payload.maxTargets, label).toBe(maxTargets);
            }
        }
    });
});

describe('createUndeadHandler.handle - getSlotLevel chain', () => {
    it('resolves automation.slotLevel > metaCtx.slotLevel > spell.level > default 6, in precedence order', async () => {
        // Every branch resolves to a distinct slot max (9→6, 8→5, 7→4, default 6→3)
        // so one table pins both branch reachability AND precedence order.
        const chain = [
            { label: 'automation.slotLevel wins over metaCtx and spell', action: makeAction({ automation: { slotLevel: 9 }, metaCtx: { slotLevel: 8 }, spell: { level: 7 } }), expectedMax: 6 },
            { label: 'metaCtx.slotLevel when automation.slotLevel absent', action: makeAction({ automation: {}, metaCtx: { slotLevel: 8 }, spell: { level: 7 } }), expectedMax: 5 },
            { label: 'spell.level when automation and metaCtx lack slotLevel', action: makeAction({ automation: {}, metaCtx: {}, spell: { level: 7 } }), expectedMax: 4 },
            { label: 'falsy slotLevel 0 falls through to next source', action: makeAction({ automation: { slotLevel: 0 }, metaCtx: { slotLevel: 8 } }), expectedMax: 5 },
            { label: 'defaults to slot level 6 when no level info', action: makeAction({ automation: {} }), expectedMax: 3 },
        ];

        for (const { label, action, expectedMax } of chain) {
            const result = await handle(action, mockPlayerStats, mockCampaignName);
            expect(result.type, label).toBe('modal');
            expect(result.payload.maxTargets, label).toBe(expectedMax);
        }
    });
});

describe('createUndeadHandler.handle - getMaxTargets upcast table', () => {
    it('maps slot levels 6-9 to exact counts and sub-min slots to the ||3 fallback (no >=6 eligibility guard)', async () => {
        // Rules require a 6th-level slot, but the handler enforces nothing —
        // slots 1-5 honestly fall to the ||3 base count.
        const table = [...Object.entries(UPCAST), ['1', 3], ['3', 3], ['5', 3]];

        for (const [slotLevel, expectedMax] of table) {
            const action = makeAction({ automation: { slotLevel: Number(slotLevel) } });
            const result = await handle(action, mockPlayerStats, mockCampaignName);
            expect(result.type, `slot ${slotLevel}`).toBe('modal');
            expect(result.payload.maxTargets, `slot ${slotLevel}`).toBe(expectedMax);
        }
    });
});

describe('createUndeadHandler - convention exports', () => {
    it('re-exports modalName/confirmType matching the dispatch and registry literals', () => {
        // Dead-export flag: no production importer of these constants — index.js
        // registers handle/confirmCreateUndead directly under create_undead /
        // create_undead_confirm; CharActionModals imports confirmCreateUndead.
        // Pinned once as a convention flag; the live router contract is the
        // envelope modalName pinned above.
        expect({ modalName, confirmType }).toEqual({
            modalName: 'createUndead',
            confirmType: 'create_undead_confirm',
        });
    });
});
