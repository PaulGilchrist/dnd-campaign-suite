// @maintained-by-ai 2026-11-19
// bug-turn-start-zone-saves-double-arm-via-echo-mirror — the turn-seam expiry sweep
// (expireStaleEffects, recurring zone saves Phases 3–6: Grease/Sleet Storm/Stinking
// Cloud/Web) ran TWICE per GM Next press: once synchronously in the local Next/Prev
// handler (navigationHandlers) and AGAIN, un-deduped, when the GM tab's own
// activeCreatureName SSE echo re-entered sseHandlers.applyEchoBoundaryPasses. Every
// zone carrier answered the identical save twice per seam (prompt header "(1 of 2)",
// two savePrompt-<T>-<uuid> keys, 2 ability_use prompt rows + 4 save_result rows).
// Fix mirrors the established applyTurnStartPass dedupe: a round-scoped
// `${round}:${creature}` gate stamped SYNCHRONOUSLY by the local handler before its
// sweep and consulted (and stamped) by the echo lane. Related lanes pinned here: the
// provably-dead combatSummary-echo expiry branch (sseHandlers :96, compared
// merged.round against the ref already overwritten one line above) is DELETED — the
// activeCreatureName echo lane owns echo-side expiry deliberately; second-turn
// echoes stay inert (CLA-360); visitor mirrors keep sweeping byte-identically (the
// ref is page-local, never persisted/hydrated — a fresh gate always differs), per the
// CLA doctrine in bug-turn-start-automation-double-fires-with-second-client.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSseEventHandler } from './sseHandlers.js';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as combatData from '../../services/encounters/combatData.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as combatSuperiority from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    // L5-001 parity: enforcement null ⇒ turn-state pass and the turn-END feature
    // services no-op, keeping this file zero-network like navigationHandlers.test.jsx.
    getRuntimeValue: vi.fn(() => null),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(),
    getCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
}));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    clearPerRoundMajestyTrackers: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js', () => ({
    applyCommanderStrikeTurnEnd: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const CHARACTERS = [
    { name: 'Alice', computedStats: { hitPoints: 20 } },
    { name: 'Bob', computedStats: { hitPoints: 15 } },
];

const activeEvent = (name) => ({ key: `change-${campaignName}-activeCreatureName`, data: name });
const summaryEvent = (data) => ({ key: `change-${campaignName}-combatSummary`, data });

const baseSummary = () => ({
    round: 1,
    creatures: [
        { name: 'Alice', type: 'player' },
        { name: 'Bob', type: 'player' },
    ],
});

describe('turn-seam zone-save expiry sweep dedupe (double-arm bug)', () => {
    let refs;
    let mocks;

    const makeSseHandler = (overrides = {}) => createSseEventHandler({
        campaignName,
        characters: CHARACTERS,
        // GM (localhost) client — the visitor mirror leg is explicit below.
        isLocalhost: true,
        combatSummaryRef: refs.combatSummaryRef,
        activeCreatureNameRef: refs.activeCreatureNameRef,
        lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
        lastExpirySweepCreatureRef: refs.lastExpirySweepCreatureRef,
        setCombatSummary: mocks.setCombatSummary,
        setCombatSummaryG: mocks.setCombatSummaryG,
        setActiveCreatureNameG: mocks.setActiveCreatureNameG,
        setRuntimeStateTick: mocks.setRuntimeStateTick,
        setOverlays: mocks.setOverlays,
        handleOverlayEvent: mocks.handleOverlayEvent,
        ...overrides,
    });

    const makeNext = (overrides = {}) => createNextCreatureHandler({
        combatSummaryRef: refs.combatSummaryRef,
        activeCreatureName: 'Alice',
        campaignName,
        characters: CHARACTERS,
        roundRef: refs.roundRef,
        lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
        lastExpirySweepCreatureRef: refs.lastExpirySweepCreatureRef,
        setCombatSummary: mocks.setCombatSummary,
        setActiveCreatureName: mocks.setActiveCreatureName,
        setRuntimeStateTick: mocks.setRuntimeStateTick,
        ...overrides,
    });

    const makePrevious = (overrides = {}) => createPreviousCreatureHandler({
        combatSummaryRef: refs.combatSummaryRef,
        activeCreatureName: 'Alice',
        campaignName,
        characters: CHARACTERS,
        roundRef: refs.roundRef,
        lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
        lastExpirySweepCreatureRef: refs.lastExpirySweepCreatureRef,
        setCombatSummary: mocks.setCombatSummary,
        setActiveCreatureName: mocks.setActiveCreatureName,
        setRuntimeStateTick: mocks.setRuntimeStateTick,
        isPreviousDisabled: false,
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getActiveCreatureName.mockReturnValue(null);
        combatData.getCombatSummary.mockReturnValue(null);
        expirations.applyTurnStartEffects.mockResolvedValue(undefined);
        expirations.applyTurnEndConditionRemoval.mockResolvedValue(undefined);
        combatSuperiority.applyCommanderStrikeTurnEnd.mockResolvedValue(undefined);
        refs = {
            combatSummaryRef: { current: baseSummary() },
            activeCreatureNameRef: { current: 'Alice' },
            lastAppliedTurnStartCreatureRef: { current: null },
            lastExpirySweepCreatureRef: { current: null },
            roundRef: { current: 1 },
        };
        mocks = {
            setCombatSummary: vi.fn(),
            setCombatSummaryG: vi.fn(),
            setActiveCreatureNameG: vi.fn(),
            setRuntimeStateTick: vi.fn(),
            setActiveCreatureName: vi.fn(),
            setOverlays: vi.fn(),
            handleOverlayEvent: vi.fn(),
        };
    });

    // ---- local seam (navigationHandlers side): sweep ONCE + gate stamped ----

    it('Next seam sweeps expiry once and stamps the round-scoped expiry gate with exact bytes', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Bob', roundIncrement: false });

        await makeNext()();

        expect(expirations.expireStaleEffects).toHaveBeenCalledTimes(1);
        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob', CHARACTERS);
        expect(refs.lastExpirySweepCreatureRef.current).toBe('1:Bob');
    });

    it('Prev seam stamps the same round-scoped gate before its sweep (rewinds double-arm too)', async () => {
        initiativeService.getPreviousCreatureName.mockReturnValue({ newActiveName: 'Bob', roundDecrement: false });

        await makePrevious()();

        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob', CHARACTERS);
        expect(refs.lastExpirySweepCreatureRef.current).toBe('1:Bob');
    });

    // ---- echo lane (sseHandlers side) ----

    it('GM self-echo of an already-swept seam skips the mirror sweep (the double-arm face)', async () => {
        refs.lastExpirySweepCreatureRef.current = '1:Bob'; // local Next handler already swept this seam
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob'; // isolate: turn-start gate matched

        await makeSseHandler()(activeEvent('Bob'));

        expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
        expect(refs.lastExpirySweepCreatureRef.current).toBe('1:Bob');
    });

    it('an unstamped seam still sweeps and stamps (no under-arming)', async () => {
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob'; // isolate: turn-start gate matched

        await makeSseHandler()(activeEvent('Bob'));

        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob', CHARACTERS);
        expect(refs.lastExpirySweepCreatureRef.current).toBe('1:Bob');
    });

    it('round wrap re-arms the gate: the same creature in a new round sweeps again', async () => {
        refs.lastExpirySweepCreatureRef.current = '1:Bob';
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob';
        refs.combatSummaryRef.current = { round: 2, creatures: [{ name: 'Bob', type: 'player' }] };

        await makeSseHandler()(activeEvent('Bob'));

        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob', CHARACTERS);
        expect(refs.lastExpirySweepCreatureRef.current).toBe('2:Bob');
    });

    it('duplicate echoes of the same seam sweep only once (echo stamps its own gate)', async () => {
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob'; // isolate: turn-start gate matched
        const handler = makeSseHandler();

        await handler(activeEvent('Bob'));
        await handler(activeEvent('Bob'));

        expect(expirations.expireStaleEffects).toHaveBeenCalledTimes(1);
    });

    it('a (Second Turn) echo never sweeps and never stamps the gate (CLA-360 guard intact)', async () => {
        refs.combatSummaryRef.current = { round: 1, creatures: [{ name: 'Bob', type: 'player', secondTurn: true }] };

        await makeSseHandler()(activeEvent('Bob'));

        expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
        expect(refs.lastExpirySweepCreatureRef.current).toBeNull();
    });

    it('the combatSummary echo never runs an expiry sweep (dead round-wrap branch deleted, echo lane owns expiry)', async () => {
        await makeSseHandler()(summaryEvent({
            round: 2,
            creatures: [{ name: 'Bob', type: 'player' }],
            activeCreatureName: 'Bob',
        }));

        expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
        expect(refs.lastExpirySweepCreatureRef.current).toBeNull();
    });

    it('visitor mirror keeps sweeping on a fresh page-local gate while GM-authority stays gated (CLA split)', async () => {
        const handler = makeSseHandler({ isLocalhost: false });

        await handler(activeEvent('Bob'));

        // Expiry mirror untouched (this is what keeps visitors seeing the same board).
        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob', CHARACTERS);
        expect(refs.lastExpirySweepCreatureRef.current).toBe('1:Bob');
        // Turn-start pass stays GM-authority: zero effects, zero __initiative__ stamps.
        expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    // ---- THE seam-pair regression pin: local handler + own echo, one sweep total ----

    it('seam pair (local Next + GM self-echo): ONE expiry sweep and ONE turn-start pass', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Bob', roundIncrement: false });
        const handler = makeSseHandler(); // shares every ref with the local handler

        await makeNext()();              // GM click: local sweep arms the zone save
        await handler(activeEvent('Bob')); // the GM tab's own SSE echo

        expect(expirations.expireStaleEffects).toHaveBeenCalledTimes(1);
        // The adjacent turn-start pass still fires exactly once per seam (not suppressed).
        expect(expirations.applyTurnStartEffects).toHaveBeenCalledTimes(1);
        expect(refs.lastExpirySweepCreatureRef.current).toBe('1:Bob');
        expect(refs.lastAppliedTurnStartCreatureRef.current).toBe('1:Bob');
        expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Bob', campaignName);
        expect(addEntry).not.toHaveBeenCalled(); // legal step stays refusal-log-free
    });
});
