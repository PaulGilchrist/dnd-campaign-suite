// @maintained-by-ai
// bug-turn-start-automation-double-fires-with-second-client — GM-ownership guard
// on the SSE-mirrored turn START pass. With a GM (localhost) tab and a LAN visitor
// tab both on Initiative, every Next click POSTs the new activeCreatureName BEFORE
// the executor's stamped combatSummary lands, so the visitor's echo passed its own
// (stale) round gate and ran applyTurnStartPass: duplicate automation rows 6 ms
// apart and the visitor POSTing GM-authority keys (__initiative__ gate stamps,
// character buckets, log rows). The pass must execute ONLY on the GM-authoritative
// (localhost) client; visitors keep every mirror/adopt read. Structure mirrors
// sseHandlers-main.test.jsx (same mocks).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSseEventHandler } from './sseHandlers.js';
import * as combatData from '../../services/encounters/combatData.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import * as combatSuperiority from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(),
    getCombatSummary: vi.fn(),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js', () => ({
    applyCommanderStrikeTurnEnd: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const CHARACTERS = [
    { name: 'Alice', computedStats: { hitPoints: 20 } },
    { name: 'Bob', computedStats: { hitPoints: 15 } },
];

describe('turn-start SSE pass — GM-ownership guard', () => {
    let refs;
    let mocks;

    const activeEvent = (name) => ({ key: `change-${campaignName}-activeCreatureName`, data: name });

    const build = (isLocalhost) => createSseEventHandler({
        campaignName,
        characters: CHARACTERS,
        isLocalhost,
        combatSummaryRef: refs.combatSummaryRef,
        activeCreatureNameRef: refs.activeCreatureNameRef,
        lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
        setCombatSummary: mocks.setCombatSummary,
        setCombatSummaryG: mocks.setCombatSummaryG,
        setActiveCreatureNameG: mocks.setActiveCreatureNameG,
        setRuntimeStateTick: mocks.setRuntimeStateTick,
        setOverlays: vi.fn(),
        handleOverlayEvent: vi.fn(),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getActiveCreatureName.mockReturnValue(null);
        combatData.getCombatSummary.mockReturnValue(null);
        expirations.applyTurnStartEffects.mockResolvedValue(undefined);
        expirations.applyTurnEndConditionRemoval.mockResolvedValue(undefined);
        combatSuperiority.applyCommanderStrikeTurnEnd.mockResolvedValue(undefined);

        refs = {
            combatSummaryRef: { current: { round: 1, creatures: [{ name: 'Alice', type: 'player' }] } },
            activeCreatureNameRef: { current: 'Alice' },
            lastAppliedTurnStartCreatureRef: { current: null },
        };
        mocks = {
            setCombatSummary: vi.fn(),
            setCombatSummaryG: vi.fn(),
            setActiveCreatureNameG: vi.fn(),
            setRuntimeStateTick: vi.fn(),
        };
    });

    describe('visitor client (isLocalhost:false)', () => {
        it('runs ZERO GM-authority writes on a fresh turn boundary: no effects, no gate POST, no stamped-summary write', async () => {
            await build(false)(activeEvent('Bob')); // fresh seam — the executor's stamped cs has NOT arrived
            // The whole broken lane: effects + __initiative__ gate stamp + cs stamp.
            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(mocks.setCombatSummary).not.toHaveBeenCalled();
            expect(refs.lastAppliedTurnStartCreatureRef.current).toBeNull();
            expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('keeps every mirror/adopt read: name state, boundary cache write, expiry, CLA-307/MN-003 skipSync turn-end mirrors', async () => {
            await build(false)(activeEvent('Bob'));
            expect(refs.activeCreatureNameRef.current).toBe('Bob');
            expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Bob');
            expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith(
                { round: 1, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Bob' }, campaignName,
            );
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
            expect(expirations.applyTurnEndConditionRemoval).toHaveBeenCalledWith('Alice', { hitPoints: 20 }, campaignName, true);
            expect(combatSuperiority.applyCommanderStrikeTurnEnd).toHaveBeenCalledWith(campaignName, 'Alice', true);
        });
    });

    describe('GM client (isLocalhost:true)', () => {
        it('still fires the turn-start pass exactly once on a fresh boundary', async () => {
            await build(true)(activeEvent('Bob'));
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledTimes(1);
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', { hitPoints: 15 }, campaignName, CHARACTERS);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Bob', campaignName);
            expect(refs.lastAppliedTurnStartCreatureRef.current).toBe('1:Bob');
        });

        it('self-echo of the seam it just applied stays gated (fires-once-not-twice)', async () => {
            const handler = build(true);
            await handler(activeEvent('Bob'));
            await handler(activeEvent('Bob')); // echo of the GM's own POST
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
        });
    });

    it('fail-closed: an omitted isLocalhost option never executes the GM-authority pass', async () => {
        const handler = createSseEventHandler({
            campaignName,
            characters: CHARACTERS,
            combatSummaryRef: refs.combatSummaryRef,
            activeCreatureNameRef: refs.activeCreatureNameRef,
            lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
            setCombatSummary: mocks.setCombatSummary,
            setCombatSummaryG: mocks.setCombatSummaryG,
            setActiveCreatureNameG: mocks.setActiveCreatureNameG,
            setRuntimeStateTick: mocks.setRuntimeStateTick,
            setOverlays: vi.fn(),
            handleOverlayEvent: vi.fn(),
        });
        await handler(activeEvent('Bob'));
        expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Bob');
    });
});
