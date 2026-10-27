// @maintained-by-ai
// Regression lock for bug-hex-trip-clobbered-by-second-client.md: a second
// client opening the outdoor map with a trip ALREADY LIVE elsewhere destroyed
// it — a Travel-tool press over the foreign trip ran startPlanning()
// (travel-destination → null, travel-path → []) and a reopen + toggle-off ran
// cancelTravel() — both silent, zero confirm, zero owner feedback.
//
// Fix: the hook takes `campaignName` and consults the SHARED campaign store
// (travel-mode + the travel-started-by owner stamp — the same bytes the
// server holds) before any destructive press. A trip claimed by ANOTHER tab
// (session token, see services/maps/travelSession.js) is adopted, never
// destroyed. Legacy contracts (own-press flows, no server lane wired) are
// byte-identical — pinned in useTravelToolSync.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useTravelToolSync from './useTravelToolSync.js';
import { TOOL_TRAVEL, TOOL_NONE } from '../../../config/outdoorConfig.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getSessionId } from '../../../services/maps/travelSession.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../../services/maps/travelSession.js', () => ({
    getSessionId: vi.fn(() => 'tab-MINE'),
    getTripOwner: vi.fn(() => ''),
}));

import { getTripOwner } from '../../../services/maps/travelSession.js';

describe('useTravelToolSync — shared-trip authority (second-client clobber)', () => {
    const createTravelMgmt = (travelMode, isTravelActive = travelMode !== 'inactive') => ({
        travelMode,
        isTravelActive,
        startPlanning: vi.fn(),
        cancelTravel: vi.fn(),
    });

    const renderSync = ({ tool, travelMgmt, handleGenerateWeather = vi.fn(), setTool = vi.fn(), hasPersistedWeather = true, hasLoadedTrip = false, campaignName = 'test' }) => {
        const initialProps = { tool, travelMgmt, weatherHandler: handleGenerateWeather, setTool, hasPersistedWeather, hasLoadedTrip, campaignName };
        const utils = renderHook(
            (p) => useTravelToolSync(p.tool, p.travelMgmt, p.weatherHandler, p.setTool, { hasPersistedWeather: p.hasPersistedWeather, hasLoadedTrip: p.hasLoadedTrip, campaignName: p.campaignName }),
            { initialProps }
        );
        return { ...utils, rerender: (changes) => utils.rerender({ ...initialProps, ...changes }) };
    };

    const FOREIGN = 'tab-THEIRS';

    beforeEach(() => {
        getRuntimeValue.mockReset();
        getRuntimeValue.mockReturnValue(undefined);
        getTripOwner.mockReset();
        getTripOwner.mockReturnValue('');
    });

    it('leg 1 press over a foreign live trip adopts: no startPlanning, no destination/path wipe', () => {
        // Fresh viewer: mounted with no trip; the trip reached it via SSE
        // (server-shared mode 'traveling', owner = the other tab) but the
        // LOCAL mirror still reads 'inactive' (hydration race the clobber
        // exploited).
        getRuntimeValue.mockReturnValue('traveling');
        getTripOwner.mockReturnValue(FOREIGN);
        const travelMgmt = createTravelMgmt('inactive');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt, setTool });

        rerender({ tool: TOOL_TRAVEL }); // the destroying press, pre-fix

        expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
        expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(setTool).toHaveBeenCalledWith(TOOL_TRAVEL); // press held, panel adopts
    });

    it('leg 1 late join: SSE lands a foreign trip with the tool unpressed — adopt, never cancel', () => {
        getRuntimeValue.mockReturnValue('traveling');
        getTripOwner.mockReturnValue(FOREIGN);
        const idle = createTravelMgmt('inactive');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, setTool });

        // External (other-tab) start reaches this client; tool never pressed.
        const foreign = createTravelMgmt('traveling');
        rerender({ travelMgmt: foreign });

        expect(foreign.cancelTravel).not.toHaveBeenCalled();
        expect(foreign.startPlanning).not.toHaveBeenCalled();
        expect(setTool).toHaveBeenCalledWith(TOOL_TRAVEL);
    });

    it('leg 2 reopen + toggle-off over a foreign trip keeps travel live', () => {
        // Viewer reopens the map: the foreign trip is live in its mirror at
        // mount (adopted/resume lane). Pre-fix, the mounted-live stamp gave
        // any later toggle-off cancel power over the other tab's journey.
        getRuntimeValue.mockReturnValue('traveling');
        getTripOwner.mockReturnValue(FOREIGN);
        const live = createTravelMgmt('traveling');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: live, setTool });

        rerender({ tool: TOOL_TRAVEL, travelMgmt: live }); // press stays (trip live, tool activates)
        setTool.mockClear();
        rerender({ tool: TOOL_NONE, travelMgmt: live }); // toggle-off = cancelling press, pre-fix

        expect(live.cancelTravel).not.toHaveBeenCalled();
        expect(setTool).toHaveBeenLastCalledWith(TOOL_TRAVEL); // press held; panel Cancel is the explicit exit
        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'travel-mode');
        expect(getTripOwner).toHaveBeenCalledWith('test');
    });

    it('own claimed trip: press plans, toggle-off cancels — normal flow untouched with the lane wired', () => {
        getRuntimeValue.mockReturnValue('inactive');
        getTripOwner.mockReturnValue(getSessionId()); // this tab owns the stamp
        const idle = createTravelMgmt('inactive');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, setTool });

        rerender({ tool: TOOL_TRAVEL });
        expect(idle.startPlanning).toHaveBeenCalledTimes(1);
        expect(idle.cancelTravel).not.toHaveBeenCalled();

        // Own trip live in planning, tool selected — deliberate exit cancels.
        getRuntimeValue.mockReturnValue('planning');
        const planning = createTravelMgmt('planning');
        rerender({ tool: TOOL_TRAVEL, travelMgmt: planning });
        rerender({ tool: TOOL_NONE, travelMgmt: planning });
        expect(planning.cancelTravel).toHaveBeenCalledTimes(1);
    });

    it('unclaimed live trip (stamp absent) keeps the reopen contract: exit cancels (owner default)', () => {
        // No travel-started-by byte (pre-fix server data / own-arrival races):
        // a trip live at mount is treated as THIS session's resumed trip —
        // the pinned reopen-exit cancel (improve 2026-10-26-D) stands.
        // Fresh-mount-while-live needs the mount to read the trip live
        // (mounted-live ⇒ openedLive), then a churn pass, then the exit.
        getRuntimeValue.mockReturnValue('traveling');
        getTripOwner.mockReturnValue('');
        const live = createTravelMgmt('traveling');
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: live });

        rerender({ travelMgmt: live }); // churn — resume immunity
        expect(live.cancelTravel).not.toHaveBeenCalled();

        rerender({ tool: TOOL_TRAVEL, travelMgmt: live }); // press (trip stays live)
        rerender({ tool: TOOL_NONE, travelMgmt: live });   // deliberate exit → cancel
        expect(live.cancelTravel).toHaveBeenCalledTimes(1);
    });

    it('no server lane wired (campaignName empty): legacy external-start cancel contract stands', () => {
        const idle = createTravelMgmt('inactive');
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, campaignName: '' });
        const external = createTravelMgmt('traveling');
        rerender({ travelMgmt: external });
        expect(external.cancelTravel).toHaveBeenCalledTimes(1);
        expect(getRuntimeValue).not.toHaveBeenCalled();
        expect(getTripOwner).not.toHaveBeenCalled();
    });
});
