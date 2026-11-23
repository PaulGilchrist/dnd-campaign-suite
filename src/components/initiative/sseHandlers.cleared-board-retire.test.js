// @maintained-by-ai
// Regression pin — bug-admin-clear-leaves-mounted-boards-stale-resurrects-data.
// POST /api/campaigns/:c/admin/clear-change-data (and full-reset) wipe the
// server store and publish change-<c>-combatSummary with a NULL payload
// specifically so mounted tabs retire (server/routes/campaigns-admin.js). The
// Initiative SSE dispatcher used to drop every null-data event, so the mounted
// board kept rendering the cleared board verbatim and its next Next/Prev
// turn-walk click re-POSTed the whole cleared combatSummary back to disk.
// Pinned here (handler lane): the cleared-key echo nulls the refs + evicts the
// combatData cache + nulls both guarded setters, with ZERO store/board writes;
// every other null echo (activeCreatureName sentinel, foreign campaign,
// character buckets) stays dropped. The component face (mounted board renders
// the empty state) is pinned in Initiative.cleared-board-retire.test.jsx.
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
const CLEARED_EVENT = { key: `change-${campaignName}-combatSummary`, data: null };

const BOARD = { round: 3, creatures: [{ name: 'EvasiveFighter', type: 'player', currentHp: 111 }] };

describe('cleared-key combatSummary null echo retires the mounted board', () => {
    let handler;
    let refs;
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        combatData.getActiveCreatureName.mockReturnValue(null);
        combatData.getCombatSummary.mockReturnValue(null);

        refs = {
            combatSummaryRef: { current: BOARD },
            activeCreatureNameRef: { current: 'EvasiveFighter' },
            lastAppliedTurnStartCreatureRef: { current: '3:EvasiveFighter' },
            lastExpirySweepCreatureRef: { current: '3:EvasiveFighter' },
        };
        mocks = {
            setCombatSummary: vi.fn(),
            setCombatSummaryG: vi.fn(),
            setActiveCreatureNameG: vi.fn(),
            setRuntimeStateTick: vi.fn(),
            setOverlays: vi.fn(),
            handleOverlayEvent: vi.fn(),
        };
        handler = createSseEventHandler({
            campaignName,
            characters: [{ name: 'EvasiveFighter', computedStats: {} }],
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
        });
    });

    it('nulls refs + cache + board state and resets the active-creature/round gates', async () => {
        await handler(CLEARED_EVENT);

        // Stale board is un-POSTable: every read lane the walk/handlers consult is nulled.
        expect(refs.combatSummaryRef.current).toBeNull();
        expect(refs.activeCreatureNameRef.current).toBeNull();
        expect(refs.lastAppliedTurnStartCreatureRef.current).toBeNull();
        expect(refs.lastExpirySweepCreatureRef.current).toBeNull();
        expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith(null, campaignName);

        // The view retires to its empty state (raw set guarantees it even when
        // the equality guard's ref never saw a board; guarded keeps the ref in
        // sync so a later byte-identical re-seed echo is still adopted).
        expect(mocks.setCombatSummary).toHaveBeenCalledWith(null);
        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith(null);
        expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith(null);
    });

    it('retirement performs ZERO store writes — it must not re-create cleared keys', async () => {
        await handler(CLEARED_EVENT);

        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
        expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        expect(expirations.applyTurnEndConditionRemoval).not.toHaveBeenCalled();
        expect(combatSuperiority.applyCommanderStrikeTurnEnd).not.toHaveBeenCalled();
    });

    it('a live board echoed after the clear is still adopted (round gate reset to the default floor)', async () => {
        await handler(CLEARED_EVENT);
        vi.clearAllMocks();

        const reseeded = { round: 1, creatures: [{ name: 'Goblin', type: 'npc' }] };
        await handler({ key: `change-${campaignName}-combatSummary`, data: reseeded });

        expect(mocks.setCombatSummaryG).toHaveBeenCalledWith(reseeded);
        expect(refs.combatSummaryRef.current).toEqual(reseeded);
        expect(combatData.setCombatSummaryCache).toHaveBeenCalledWith(reseeded, campaignName);
    });

    it('every OTHER null echo stays dropped (activeCreatureName sentinel, char buckets, foreign campaign)', async () => {
        await handler({ key: `change-${campaignName}-activeCreatureName`, data: null });
        await handler({ key: `change-${campaignName}-EvasiveFighter`, data: null });
        await handler({ key: 'change-other-campaign-combatSummary', data: null });
        await handler({ key: null, data: null });

        expect(refs.combatSummaryRef.current).toBe(BOARD);
        expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
        expect(mocks.setActiveCreatureNameG).not.toHaveBeenCalled();
        expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
        expect(combatData.setCombatSummaryCache).not.toHaveBeenCalled();
    });
});
