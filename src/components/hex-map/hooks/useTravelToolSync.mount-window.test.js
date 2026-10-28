// @maintained-by-ai
// Regression lock for bug-hex-mount-window-silent-trip-cancel.md: during the
// fresh-boot mount/hydration window a client could silently DESTROY a live
// trip. Branch 3 of useTravelToolSync fell to its legacy `cancel` action when
// the LOCAL useSyncedState channel (travelMgmt.isTravelActive) still rendered
// a live trip (its declared default `init.travelMode`, e.g. a file-carried or
// just-claimed mode) while the SHARED authority read `getRuntimeValue('campaign',
// 'travel-mode')` momentarily returned null/missing — the boot change-data seed
// had not landed, or a null change-echo REMOVED the key (post 171a9dcbe, where
// cleared-key echoes now mirror as key removals). Two live sightings, both
// landing the exact cancelTravel byte signature (mode 'inactive', destination
// null, path [], travel-started-by released to null) with zero user cancel.
//
// Fix: the shared authority read is THREE-valued — live / CONFIRMED 'inactive'
// / UNKNOWN (missing). An UNKNOWN read is never authority to destroy a trip;
// branch 3 ADOPTs (settles, keeps the trip) instead of cancelling. Only a
// CONFIRMED 'inactive' byte (or the deliberate own-trip exit / the no-lane
// legacy contract) may cancel. Pinned contracts preserved in the sibling files
// (useTravelToolSync.test.js, useTravelToolSync.shared-trip.test.js).
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

describe('useTravelToolSync — mount-window silent trip cancel (authority UNKNOWN ≠ trip-over)', () => {
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

    it('sighting 1: fresh-boot reopen, local active + authority null ⇒ NO cancelTravel (adopts)', () => {
        // Fresh boot: mounted idle (no resume immunity). A trip lands in the
        // LOCAL mirror (isTravelActive true via file/SSE default) while the
        // shared travel-mode read is still missing (boot seed lag / null-echo
        // key removal) — the exact two-channel divergence the clobber rode.
        getRuntimeValue.mockReturnValue(null); // UNKNOWN authority
        const idle = createTravelMgmt('inactive');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, setTool });

        const live = createTravelMgmt('traveling');
        rerender({ travelMgmt: live }); // tool stays NONE, local flips active

        expect(live.cancelTravel).not.toHaveBeenCalled();
        expect(live.startPlanning).not.toHaveBeenCalled();
        expect(setTool).toHaveBeenCalledWith(TOOL_TRAVEL); // adopted, not destroyed
    });

    it('sighting 1b: foreign trip + authority null (owner unreadable) ⇒ NO cancel, adopts', () => {
        // Ownership also unreadable in the same window (getTripOwner returns a
        // foreign token but mode is missing) — still never a cancel.
        getRuntimeValue.mockReturnValue(null);
        getTripOwner.mockReturnValue(FOREIGN);
        const idle = createTravelMgmt('inactive');
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle });

        const live = createTravelMgmt('traveling');
        rerender({ travelMgmt: live });

        expect(live.cancelTravel).not.toHaveBeenCalled();
    });

    it('sighting 2: own-press then desync to NONE while authority null ⇒ NO cancel (recovers the press)', () => {
        // First-press-after-fresh-boot: press runs startPlanning (claims
        // ownership), then mid-churn the tool desyncs back to NONE with the
        // trip still live locally but travel-mode absent — pre-fix the
        // prevTool===TOOL_TRAVEL leg cancelled the just-claimed trip.
        const idle = createTravelMgmt('inactive');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, setTool });

        // Press: local still inactive for the activation branch, owner claim runs.
        getRuntimeValue.mockReturnValue('planning');
        rerender({ tool: TOOL_TRAVEL });
        expect(idle.startPlanning).toHaveBeenCalledTimes(1);

        // Churn: tool desynced to NONE, local renders the just-claimed trip
        // live, but the shared authority key is momentarily missing.
        getRuntimeValue.mockReturnValue(null);
        const planning = createTravelMgmt('planning');
        rerender({ tool: TOOL_NONE, travelMgmt: planning });

        expect(planning.cancelTravel).not.toHaveBeenCalled();
        expect(setTool).toHaveBeenLastCalledWith(TOOL_TRAVEL); // press recovered
    });

    it('CONFIRMED inactive authority still honours the pinned external-start cancel', () => {
        // The tri-state boundary: an explicit 'inactive' byte IS a confirmed
        // trip-over, so the legacy non-resume external-start cancel stands —
        // only UNKNOWN (missing) reads are held inert.
        getRuntimeValue.mockReturnValue('inactive');
        getTripOwner.mockReturnValue(getSessionId());
        const idle = createTravelMgmt('inactive');
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle });

        const external = createTravelMgmt('traveling'); // local says live
        rerender({ travelMgmt: external });

        expect(external.cancelTravel).toHaveBeenCalledTimes(1);
    });

    it('deliberate owner exit (confirmed live trip, tool deselected) still cancels', () => {
        // The intentional-exit contract must survive the UNKNOWN guard: this
        // tab pressed + confirmed-owns the live trip and deselected the tool.
        getRuntimeValue.mockReturnValue('traveling');
        getTripOwner.mockReturnValue(getSessionId());
        const live = createTravelMgmt('traveling');
        const setTool = vi.fn();
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: live, setTool });

        // Press (trip stays live) then leave the tool = deliberate exit.
        rerender({ tool: TOOL_TRAVEL, travelMgmt: live });
        rerender({ tool: TOOL_NONE, travelMgmt: live });

        expect(live.cancelTravel).toHaveBeenCalledTimes(1);
    });
});
