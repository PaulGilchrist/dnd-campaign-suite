import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Lane map: antimagicFieldHandler.js (#1868) ─────────────────────────
// Liveness: index.js registers `antimagic_field: handleAntimagicField`
// (executeHandler table, ~L555); live cast lane is spellGates →
// useAreaEffectHandlers.handleAntimagicFieldConfirm, which builds
// automation `{ type:'antimagic_field', range }` + metaCtx.creatures and
// calls executeHandler with mapName=null. No map/area-effect seam here —
// `_mapName` is ignored (pin below); area suppression is read elsewhere:
// contextBuilder-sync.js reads campaign targetEffects directly, and
// spellCastService/execution checkAntimagicField blocks spells. The te
// registry internals are owned by targetEffectDefinitions.test.js — this
// file pins handler-side delegation only.
//
// Seams pinned (all mocked): buffToggle.toggleBuff (returns wasActive),
// expirations.addExpiration, useRuntimeState get/set, logService.addEntry,
// concentrationService.addConcentration, combatData.getCombatSummary,
// ui/storage.default.set. window.dispatchEvent('combat-summary-updated')
// is real-DOM (benign UI broadcast, no game-state timer) — spied, not mocked.
//
// Quirks pinned as-is (flagged, not cemented as intended):
//  Q1 addConcentration + all log entries hardcode the literal 'Antimagic
//     Field', while toggleBuff/addExpiration/popup use action.name. A
//     renamed cast splits its identity across stores.
//  Q2 toggleBuff stores activeBuffs under action.name, so isAntimagicField-
//     Active (matches name === 'Antimagic Field' literally) misses renamed
//     buffs → false. Suppression lanes read targetEffects instead, so this
//     predicate has no production caller today (only index.js imports the
//     module, for `handle`); pinned as API-surface seam. Exported
//     applyAntimagicField/removeAntimagicField likewise caller-less outside.
//  Q3 isCreatureAffectedByAntimagicField ignores its campaignName param —
//     calls getRuntimeValue('campaign','targetEffects') two-arg.
//  Q4 concentration DC fallback `saveDc || 8 + (proficiency || 2)` is
//     handler-local, unlike the canonical pattern flagged in
//     shapechangeService.js L49 comment.
//  Q5 unpin-clean: getCombatSummary/addExpiration run on activation only;
//     deactivation touches exactly targetEffects (+ conditional log).

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, isAntimagicFieldActive, isCreatureAffectedByAntimagicField } from './antimagicFieldHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as storage from '../../../ui/storage.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWizard',
        level: 10,
        proficiency: 4,
        spellAbilities: { saveDc: 15 },
        ...overrides,
    };
}

// MERGES automation overrides (never replaces the type key) and merges
// top-level action overrides — matches the confirm-lane shape
// { name, spell?, automation: { type, range }, metaCtx: { creatures } }.
function makeAction(overrides = {}, automationOverrides = {}) {
    return {
        name: 'Antimagic Field',
        automation: { type: 'antimagic_field', ...automationOverrides },
        ...overrides,
    };
}

function castWithCreatures(creatures) {
    return makeAction({ metaCtx: { creatures } });
}

// Standard activation stubs: fresh toggle, live combat summary.
function stubActivate({ wasActive = false, summary = { creatures: [] } } = {}) {
    buffToggle.toggleBuff.mockReturnValue({ wasActive });
    combatData.getCombatSummary.mockReturnValue(summary);
}

const amfTe = (target, source = 'TestWizard') => ({
    target,
    effect: 'antimagic_field',
    source,
    duration: 'concentration',
});

const automationLog = (description) => ({
    type: 'automation',
    creatureName: 'TestWizard',
    name: 'Antimagic Field',
    description,
    timestamp: expect.any(Number),
});

// ── Tests ──────────────────────────────────────────────────────

describe('antimagicFieldHandler.handle — activation', () => {
    let dispatchSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
    });

    it('toggles the buff with { ...automation, effect } exact — range passthrough from the confirm lane', async () => {
        // Production auto shape from useAreaEffectHandlers L96.
        const action = makeAction({}, { range: 'Self (10-foot radius)' });
        stubActivate();

        await handle(action, makePlayerStats(), campaignName, null);

        expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
            'TestWizard',
            'Antimagic Field',
            { type: 'antimagic_field', range: 'Self (10-foot radius)', effect: 'antimagic_field' },
            campaignName,
        );
    });

    it('returns the exact activation popup shape and full-string descriptions (with and without creatures)', async () => {
        stubActivate();

        const withCreatures = await handle(castWithCreatures(['Goblin', 'Orc']), makePlayerStats(), campaignName, null);
        expect(withCreatures).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Antimagic Field',
                automationType: 'antimagic_field',
                description: 'Antimagic Field activated — a 10-foot Emanation surrounds you. No magic works here, only weapon attacks.<br>Creatures affected: Goblin, Orc',
                automation: { type: 'antimagic_field' },
            },
        });

        const noneSelected = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(noneSelected.payload.description).toBe('Antimagic Field activated — no creatures selected.');
    });

    it('custom action name flows into toggleBuff, addExpiration, and popup — but NOT into addConcentration or logs (Q1)', async () => {
        const action = makeAction({ name: 'My Custom AMF' });
        const summary = { creatures: [] };
        stubActivate({ summary });

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(buffToggle.toggleBuff.mock.calls[0][1]).toBe('My Custom AMF');
        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestWizard',
            targetName: 'TestWizard',
            effects: [{ type: 'remove_active_buff', buffName: 'My Custom AMF' }],
            campaignName,
        });
        // Q1: concentration + logs keep the literal spell name.
        expect(concentrationService.addConcentration).toHaveBeenCalledWith(summary, 'TestWizard', 'Antimagic Field', 15);
        expect(result.payload.name).toBe('My Custom AMF');
        expect(result.payload.description).toContain('My Custom AMF');
    });

    it('registers concentration from summary saveDc, writes summary back, and dispatches combat-summary-updated', async () => {
        const summary = { creatures: [] };
        stubActivate({ summary });

        await handle(castWithCreatures(['Goblin']), makePlayerStats(), campaignName, null);

        expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
        expect(concentrationService.addConcentration).toHaveBeenCalledWith(summary, 'TestWizard', 'Antimagic Field', 15);
        expect(storage.default.set).toHaveBeenCalledWith('combatSummary', summary, campaignName);
        expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('combat-summary-updated'));
    });

    it('derives the fallback concentration DC locally 8 + proficiency, or 8 + 2 with neither (Q4)', async () => {
        const summary = { creatures: [] };
        stubActivate({ summary });

        await handle(makeAction(), makePlayerStats({ spellAbilities: undefined, proficiency: 2 }), campaignName, null);
        expect(concentrationService.addConcentration).toHaveBeenCalledWith(summary, 'TestWizard', 'Antimagic Field', 10);

        await handle(makeAction(), makePlayerStats({ spellAbilities: undefined, proficiency: undefined }), campaignName, null);
        expect(concentrationService.addConcentration).toHaveBeenLastCalledWith(summary, 'TestWizard', 'Antimagic Field', 10);
    });

    it('skips concentration, summary write, and dispatch entirely when combatSummary is null, but still toggles', async () => {
        stubActivate({ summary: null });
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(concentrationService.addConcentration).not.toHaveBeenCalled();
        expect(storage.default.set).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(buffToggle.toggleBuff).toHaveBeenCalled();
        expect(result.type).toBe('popup');
    });

    it('writes targetEffects exactly: appends new AMF entries in cast order, preserves foreign entries, never writes activeBuffs (that is buffToggle\'s lane)', async () => {
        const action = castWithCreatures(['Goblin', 'Orc']);
        stubActivate({ summary: null });
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
            { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
        ]);

        await handle(action, makePlayerStats(), campaignName, null);

        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
                { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
                amfTe('Goblin'),
                amfTe('Orc'),
            ],
            campaignName,
        );
        expect(useRuntimeState.setRuntimeValue.mock.calls.every(([key]) => key !== 'activeBuffs')).toBe(true);
    });

    it('replaces same-source AMF entries in place — no duplicates — while pushing new targets and keeping foreign entries', async () => {
        const action = castWithCreatures(['Goblin', 'Newbie']);
        stubActivate({ summary: null });
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
            amfTe('Goblin'), // stale same-source entry, position 1
            { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
        ]);

        await handle(action, makePlayerStats(), campaignName, null);

        const [, , written] = useRuntimeState.setRuntimeValue.mock.calls[0];
        expect(written).toEqual([
            { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
            amfTe('Goblin'), // replaced in place at index 1
            { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
            amfTe('Newbie'), // pushed
        ]);
    });

    it('logs one automation entry per creature plus one exact ability_use summary, full strings', async () => {
        const action = castWithCreatures(['Goblin', 'Orc']);
        stubActivate({ summary: null });
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await handle(action, makePlayerStats(), campaignName, null);

        expect(logService.addEntry).toHaveBeenCalledTimes(3);
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, automationLog('Goblin is affected by Antimagic Field.'));
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, automationLog('Orc is affected by Antimagic Field.'));
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Antimagic Field',
            description: 'TestWizard casts Antimagic Field! 2 creature(s) affected. Only weapon attacks allowed.',
        });
    });

    it('survives a rejected per-creature log without dropping the targetEffects write or the ability_use log', async () => {
        const action = castWithCreatures(['Goblin', 'Orc']);
        stubActivate({ summary: null });
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        logService.addEntry.mockRejectedValueOnce(new Error('log down'));

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [amfTe('Goblin'), amfTe('Orc')],
            campaignName,
        );
        // ability_use still attempted after the caught rejection.
        expect(logService.addEntry).toHaveBeenCalledTimes(3);
        expect(logService.addEntry.mock.calls[2][1].type).toBe('ability_use');
    });

    it('with no creatures selected still writes back the store unchanged and logs ability_use with zero affected', async () => {
        stubActivate({ summary: null });
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
        ]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [{ target: 'Goblin', effect: 'silenced', source: 'Enemy' }],
            campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        expect(logService.addEntry.mock.calls[0][1].description).toBe('TestWizard casts Antimagic Field! 0 creature(s) affected. Only weapon attacks allowed.');
    });
});

describe('antimagicFieldHandler.handle — deactivation', () => {
    let dispatchSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
    });

    it('returns the exact ended popup (no automationType, no automation key) and touches exactly one store', async () => {
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Antimagic Field',
                description: 'Antimagic Field ended',
            },
        });
        // No-side-effect guard: concentration, expiration, summary reads/
        // writes, and dispatch are all activation-only.
        expect(combatData.getCombatSummary).not.toHaveBeenCalled();
        expect(concentrationService.addConcentration).not.toHaveBeenCalled();
        expect(expirations.addExpiration).not.toHaveBeenCalled();
        expect(storage.default.set).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('uses the custom action name in the ended description', async () => {
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({ name: 'My Custom AMF' }), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toBe('My Custom AMF ended');
    });

    it('removes only same-source AMF entries with an exact filtered array and one exact removal log naming the affected creatures', async () => {
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
        useRuntimeState.getRuntimeValue.mockReturnValue([
            amfTe('Goblin'),
            amfTe('Orc'),
            { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
            { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
        ]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [
                { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
                { target: 'Goblin', effect: 'silenced', source: 'Enemy' },
            ],
            campaignName,
        );
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledWith(
            campaignName,
            automationLog('Antimagic Field ended. Affected creatures: Goblin, Orc.'),
        );
    });

    it('writes back the unchanged store but logs nothing when the caster owns no AMF entries', async () => {
        buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' },
        ]);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            [{ target: 'Goblin', effect: 'antimagic_field', source: 'Enemy', duration: 'concentration' }],
            campaignName,
        );
        expect(logService.addEntry).not.toHaveBeenCalled();
    });
});

describe('antimagicFieldHandler.isAntimagicFieldActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('matches activeBuffs on literal name AND effect — renamed buffs miss (Q2)', () => {
        isAntimagicFieldActive('TestWizard', campaignName);
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('TestWizard', 'activeBuffs', campaignName);

        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield', effect: 'shield' },
            { name: 'Antimagic Field', effect: 'antimagic_field' },
        ]);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(true);

        // name mismatch (renamed cast, as toggleBuff would store it) → misses
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'My Custom AMF', effect: 'antimagic_field' },
        ]);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(false);

        // effect mismatch → misses
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'Antimagic Field', effect: 'something_else' },
        ]);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(false);

        // null/empty store → false
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(false);

        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        expect(isAntimagicFieldActive('TestWizard', campaignName)).toBe(false);
    });
});

describe('antimagicFieldHandler.isCreatureAffectedByAntimagicField', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads campaign targetEffects ignoring campaignName (Q3) and matches on target only', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'antimagic_field', source: 'TestWizard' },
            { target: 'Orc', effect: 'silenced', source: 'Enemy' },
            { target: 'Orc2', effect: 'antimagic_field', source: 'Enemy' },
        ]);

        expect(isCreatureAffectedByAntimagicField('Goblin', campaignName)).toBe(true);
        expect(isCreatureAffectedByAntimagicField('Orc', campaignName)).toBe(false); // other effect
        expect(isCreatureAffectedByAntimagicField('Orc2', campaignName)).toBe(true); // any source counts
        expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
    });

    it('returns false on null or empty targetEffects', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);
        expect(isCreatureAffectedByAntimagicField('Goblin', campaignName)).toBe(false);

        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        expect(isCreatureAffectedByAntimagicField('Goblin', campaignName)).toBe(false);
    });
});
