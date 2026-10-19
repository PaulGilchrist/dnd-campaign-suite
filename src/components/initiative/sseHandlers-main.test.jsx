// @maintained-by-ai
// LANE: sseHandlers-main — dispatch table behind the app's ONE shared SSE connection (#app mandate:
// Initiative.jsx registers a single <Subscriber>; this module owns only event→dataKey routing + the
// SSE-mirrored turn seam). Other owners: subscriber registration + combat-summary-updated adoption
// (container #865, Initiative.jsx:526-539); initiative-rolled window seam (#864); overlay event bodies
// (sseHandlers-overlay.test.jsx); local click-driven turn navigation (navigationHandlers.* tests — a
// separate module, the mirror of what is pinned here).
//
// Event → owner (this module, sseHandlers.js):
//   spell-overlay-*                          → handleOverlayEvent (routing byte only)
//   change-{campaign}-combatSummary          → adoption: enrich activeCreatureName, round-regression guard, cache write (:62-81)
//   change-{campaign}-lastAttack             → noop, zero writes (:142)
//   change-{campaign}-activeCreatureName     → turn mirror: name state, CLA-307/MN-003 outgoing turn-end (skipSync), round-scoped turn-start gate (:106-135)
//   change-{campaign}-<other key>            → setRuntimeStateTick catch-all; 'log'/'spell-overlay' excluded (:156-163)
//
// Old→new map (29→15): nullish-key/data→T2 · overlay-delegate→T1 · foreign-campaign→T2 ·
// no/undefined-creatures-skip + empty-adopt→T6 · valid-event→T4 · fill-activeName + no-override→T5 ·
// round-regression + default-round→T7 · lastAttack-noop→T2 · update-refs + expire + cache→T8 ·
// apply-on-change + persist-gate-key + combatSummary-update→T11 · no-apply-prev-same/no-apply-gate-match/
// no-combatSummary-update-when-equal→T9 · CLA-170→T10 · undefined-computedStats→T12 · CLA-307→T13 ·
// fallback-read + null-summary + cs-null-still-applies→T14/T15 · tick-unknown + excluded-keys→T3.
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
// Stub the MN-003 mirror so its real dependency chain (dice, log, damage) never runs here
// and the skipSync=true call can be asserted (zero-network).
vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityUtils.js', () => ({
    applyCommanderStrikeTurnEnd: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const CHARACTERS = [
    { name: 'Alice', computedStats: { hitPoints: 20 } },
    { name: 'Bob', computedStats: { hitPoints: 15 } },
];

describe('createSseEventHandler', () => {
    let handler;
    let refs;
    let mocks;

    const summaryEvent = (data) => ({ key: `change-${campaignName}-combatSummary`, data });
    const activeEvent = (name) => ({ key: `change-${campaignName}-activeCreatureName`, data: name });

    beforeEach(() => {
        vi.clearAllMocks();
        // Explicit per-test defaults (determinism — no reliance on clearAllMocks impl retention, #827)
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
            handleOverlayEvent: vi.fn(),
        };
        handler = createSseEventHandler({
            campaignName,
            characters: CHARACTERS,
            combatSummaryRef: refs.combatSummaryRef,
            activeCreatureNameRef: refs.activeCreatureNameRef,
            lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
            setCombatSummary: mocks.setCombatSummary,
            setCombatSummaryG: mocks.setCombatSummaryG,
            setActiveCreatureNameG: mocks.setActiveCreatureNameG,
            setRuntimeStateTick: mocks.setRuntimeStateTick,
            handleOverlayEvent: mocks.handleOverlayEvent,
        });
    });

    // ---- Routing ----

    it('routes spell-overlay events to handleOverlayEvent and nothing else', async () => {
        const overlayEvent = { key: `spell-overlay-${campaignName}`, data: { action: 'clear' } };
        await handler(overlayEvent);
        expect(mocks.handleOverlayEvent).toHaveBeenCalledWith(overlayEvent);
        expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
        expect(mocks.setActiveCreatureNameG).not.toHaveBeenCalled();
        expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
    });

    it('writes nothing for nullish key/data, foreign campaigns, and the lastAttack echo', async () => {
        await handler({ key: null, data: { creatures: [] } });
        await handler({ key: `change-${campaignName}-combatSummary`, data: null });
        await handler({ key: 'change-other-campaign-combatSummary', data: { round: 2, creatures: [] } });
        await handler({ key: `change-${campaignName}-lastAttack`, data: { attackerName: 'Goblin' } });
        expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
        expect(mocks.setActiveCreatureNameG).not.toHaveBeenCalled();
        expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
        expect(combatData.setCombatSummaryCache).not.toHaveBeenCalled();
    });

    it('ticks a re-render for unrecognised character dataKeys, never for log or spell-overlay', async () => {
        await handler({ key: `change-${campaignName}-someCharacterKey`, data: { foo: 'bar' } });
        expect(mocks.setRuntimeStateTick).toHaveBeenCalledTimes(1);
        expect(mocks.setRuntimeStateTick.mock.calls[0][0](0)).toBe(1);

        await handler({ key: `change-${campaignName}-log`, data: [] });
        await handler({ key: `change-${campaignName}-spell-overlay`, data: {} });
        expect(mocks.setRuntimeStateTick).toHaveBeenCalledTimes(1);
    });

    // ---- combatSummary ----

    it('adopts a valid combatSummary with exact bytes into ref, cache, and state', async () => {
        await handler(summaryEvent({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] }));
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] });
        expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] }, campaignName);
        expect(refs.combatSummaryRef.current).toEqual({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] });
    });

    it('fills a missing activeCreatureName from getActiveCreatureName but preserves the provided one', async () => {
        combatData.getActiveCreatureName.mockReturnValue('Bob');
        await handler(summaryEvent({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] }));
        expect(combatData.getActiveCreatureName).toHaveBeenCalledWith(campaignName);
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith({ round: 2, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Bob' });

        vi.clearAllMocks();
        await handler(summaryEvent({ round: 2, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Alice' }));
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith({ round: 2, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Alice' });
        expect(combatData.getActiveCreatureName).not.toHaveBeenCalled();
    });

    it('skips combatSummary payloads without a creatures array but adopts an empty roster', async () => {
        for (const data of [{ round: 2 }, { round: 2, creatures: undefined }]) {
            await handler(summaryEvent(data));
            expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
            expect(combatData.setCombatSummaryCache).not.toHaveBeenCalled();
        }
        await handler(summaryEvent({ round: 2, creatures: [] }));
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith({ round: 2, creatures: [] });
    });

    it('rejects round regressions (default prev round 1) and adopts same-or-later rounds', async () => {
        refs.combatSummaryRef.current = { round: 5, creatures: [] };
        await handler(summaryEvent({ round: 3, creatures: [] }));
        expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();

        for (const empty of [undefined, null]) {
            refs.combatSummaryRef.current = empty;
            await handler(summaryEvent({ round: 0, creatures: [] }));
        }
        expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();

        refs.combatSummaryRef.current = { round: 2, creatures: [{ name: 'Alice', type: 'player' }] };
        await handler(summaryEvent({ round: 2, creatures: [] }));
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith({ round: 2, creatures: [] });
    });

    // ---- activeCreatureName (SSE-mirrored turn seam) ----

    it('applies an active-creature change: ref, state setter, stale-effect expiry, cache update', async () => {
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob'; // isolate: gate off, no turn-start stamp
        await handler(activeEvent('Bob'));
        expect(refs.activeCreatureNameRef.current).toBe('Bob');
        expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Bob');
        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
        expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith(
            { round: 1, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Bob' }, campaignName,
        );
    });

    it('gates the turn-start pass: no-op when the creature is unchanged or the round-scoped gate already matched', async () => {
        await handler(activeEvent('Alice')); // prev === new: no turn movement at all
        expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        expect(expirations.applyTurnEndConditionRemoval).not.toHaveBeenCalled();
        expect(combatSuperiority.applyCommanderStrikeTurnEnd).not.toHaveBeenCalled();

        vi.clearAllMocks();
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob';
        await handler(activeEvent('Bob')); // gate '1:Bob' already applied this round
        expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('CLA-170: re-applies turn-start effects to the same creature in a new round with exact bytes', async () => {
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob';
        refs.activeCreatureNameRef.current = 'Alice';
        refs.combatSummaryRef.current = { round: 2, creatures: [{ name: 'Bob', type: 'npc' }] };
        await handler(activeEvent('Bob'));
        expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', { hitPoints: 15 }, campaignName, CHARACTERS);
        expect(refs.lastAppliedTurnStartCreatureRef.current).toBe('2:Bob');
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '2:Bob', campaignName);
        expect(mocks.setRuntimeStateTick).toHaveBeenCalledTimes(1);
    });

    it('persists the round-scoped gate key to the runtime store, the ref, and combatSummary on a fresh turn', async () => {
        await handler(activeEvent('Bob'));
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Bob', campaignName);
        expect(refs.lastAppliedTurnStartCreatureRef.current).toBe('1:Bob');
        expect(mocks.setCombatSummary).toHaveBeenCalledWith({
            round: 1, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Bob', lastAppliedTurnStartCreature: '1:Bob',
        });
        expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', { hitPoints: 15 }, campaignName, CHARACTERS);
    });

    it('passes undefined computedStats for an active creature with no matching character', async () => {
        await handler(activeEvent('Zed'));
        expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Zed');
        expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Zed', undefined, campaignName, CHARACTERS);
    });

    it('CLA-307/MN-003: mirrors the outgoing creature turn-end pass with skipSync=true (no SSE echo loop)', async () => {
        refs.lastAppliedTurnStartCreatureRef.current = '1:Bob'; // isolate: gate matched, turn-start pass skipped
        await handler(activeEvent('Bob'));
        expect(expirations.applyTurnEndConditionRemoval).toHaveBeenCalledWith('Alice', { hitPoints: 20 }, campaignName, true);
        expect(combatSuperiority.applyCommanderStrikeTurnEnd).toHaveBeenCalledWith(campaignName, 'Alice', true);
        expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
    });

    it('resolves combatSummary via the cache when the ref is null and adopts the post-effects copy so damage reaches the UI', async () => {
        refs.combatSummaryRef.current = null;
        const fallback = { round: 1, creatures: [], activeCreatureName: 'Alice' };
        const damaged = { round: 1, creatures: [{ name: 'Bob', type: 'player', currentHp: 12 }] };
        combatData.getCombatSummary.mockReturnValueOnce(fallback).mockReturnValue(damaged);

        await handler(activeEvent('Bob'));

        expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
        expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith({ round: 1, creatures: [], activeCreatureName: 'Bob' }, campaignName);
        expect(mocks.setCombatSummary).toHaveBeenCalledWith(damaged);
        expect(refs.combatSummaryRef.current).toBe(damaged);
        expect(mocks.setRuntimeStateTick).toHaveBeenCalledTimes(1);
    });

    it('still applies the turn change with zero cache writes when no combatSummary exists anywhere', async () => {
        refs.combatSummaryRef.current = null;
        await handler(activeEvent('Zed'));
        expect(refs.activeCreatureNameRef.current).toBe('Zed');
        expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Zed');
        expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Zed');
        expect(combatData.setCombatSummaryCache).not.toHaveBeenCalled();
        expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Zed', undefined, campaignName, CHARACTERS);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Zed', campaignName);
    });
});
