// @maintained-by-ai
// Improve JT 2026-11-11 — travel-tool/panel PARITY state machine at the hook
// seam. The desynced faces (pressed=true + panel absent, panel mounted +
// pressed=false) rode on the two-channel split: the toolbar button read the
// LOCAL `tool` useState while the TravelPanel mounted on the SYNCED
// travel-active value, with useTravelToolSync's effect passes reconciling one
// into the other — every settle gap between the two reads was a window where
// a harness/user could sample a lying face (worse: the absorbed-first-press
// flipped .active on without ever landing the trip).
// The fix collapses both faces onto ONE committed boolean the hook RETURNS:
// `travelPanelOpen` — the synced travelMgmt.isTravelActive value, read at
// render (same synced-value pattern as the 0cceb2c36 cross-client backfill;
// never through a ref), fed by HexMap to BOTH the toolbar .active/aria-pressed
// AND the TravelPanel mount. Panel open ⇔ aria-pressed=true is then true BY
// CONSTRUCTION in every commit. Pinned here:
//   • the returned face always equals the synced value, never the tool byte;
//   • a press whose activation has not landed shows the coherent CLOSED face
//     (the absorbed-press law is now aria-honest);
//   • the landing echo opens BOTH faces in the same value;
//   • arrival auto-unpress clears the face AND force-toggles the tool off
//     (so the next press toggles toward TOOL_TRAVEL — single-press re-entry).
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useTravelToolSync from './useTravelToolSync.js';
import { TOOL_TRAVEL, TOOL_NONE, TOOL_PAINT } from '../../../config/outdoorConfig.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../../services/maps/travelSession.js', () => ({
    getSessionId: vi.fn(() => 'tab-MINE'),
    getTripOwner: vi.fn(() => ''),
}));

describe('useTravelToolSync — committed parity face (travelPanelOpen)', () => {
    const createTravelMgmt = (travelMode = 'inactive') => ({
        travelMode,
        isTravelActive: travelMode !== 'inactive',
        startPlanning: vi.fn(),
        cancelTravel: vi.fn(),
    });

    const renderSync = ({ tool, travelMgmt, handleGenerateWeather = vi.fn(), setTool = vi.fn(), hasPersistedWeather = true, hasLoadedTrip = false }) => {
        const initialProps = { tool, travelMgmt, weatherHandler: handleGenerateWeather, setTool, hasPersistedWeather, hasLoadedTrip };
        const utils = renderHook(
            (p) => useTravelToolSync(p.tool, p.travelMgmt, p.weatherHandler, p.setTool, { hasPersistedWeather: p.hasPersistedWeather, hasLoadedTrip: p.hasLoadedTrip }),
            { initialProps }
        );
        const rerender = (changes) => utils.rerender({ ...initialProps, ...changes });
        return { ...utils, rerender };
    };

    it('face tracks the SYNCED value across every tool identity — never the tool byte', () => {
        // Tool pressed while travel is idle reads CLOSED (pending/absorbed
        // press — the pre-fix ghost .active face); tool NONE while the trip
        // is live (adoption pre-mirror) reads OPEN.
        const cases = [
            { tool: TOOL_NONE, mode: 'inactive', open: false },
            { tool: TOOL_TRAVEL, mode: 'inactive', open: false },
            { tool: TOOL_PAINT, mode: 'inactive', open: false },
            { tool: TOOL_NONE, mode: 'planning', open: true },
            { tool: TOOL_PAINT, mode: 'traveling', open: true },
            { tool: TOOL_TRAVEL, mode: 'paused', open: true },
        ];
        for (const { tool, mode, open } of cases) {
            const { result, unmount } = renderSync({ tool, travelMgmt: createTravelMgmt(mode) });
            expect(result.current.travelPanelOpen).toBe(open); // mode
            unmount();
        }
    });

    it('an adopted live trip shows the OPEN face on the MOUNT pass — no mirror-window to sample', () => {
        // File-trip adoption/reopen-resume: the panel mounts on the mount
        // commit; the button must not lag it until the mirror churn lands.
        const { result } = renderSync({ tool: TOOL_NONE, travelMgmt: createTravelMgmt('traveling'), hasLoadedTrip: true });
        expect(result.current.travelPanelOpen).toBe(true);
    });

    it('press → unlanded activation stays CLOSED coherently, then the landing echo OPENS in one value', () => {
        const idle = createTravelMgmt('inactive');
        const setTool = vi.fn();
        const { result, rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, setTool });

        // Press: activation dispatches; until the synced byte commits, BOTH
        // faces (this value feeds toolbar AND panel) stay closed together.
        rerender({ tool: TOOL_TRAVEL, travelMgmt: idle });
        expect(idle.startPlanning).toHaveBeenCalledTimes(1);
        expect(result.current.travelPanelOpen).toBe(false);

        // Activation echo commits planning — the one boolean both faces read.
        rerender({ tool: TOOL_TRAVEL, travelMgmt: createTravelMgmt('planning') });
        expect(result.current.travelPanelOpen).toBe(true);
        expect(idle.cancelTravel).not.toHaveBeenCalled();
    });

    it('arrival auto-unpress clears the face AND force-toggles the tool toward a single-press re-entry', () => {
        // Live trip while pressed → arrival (mode byte flips inactive): the
        // OPEN face closes on the same synced value the panel unmounts on,
        // and the tool is cleared to NONE so the NEXT toolbar press toggles
        // toward TOOL_TRAVEL — press 1 lands (no press-probe-press dance).
        const live = createTravelMgmt('traveling');
        const setTool = vi.fn();
        const { result, rerender } = renderSync({ tool: TOOL_TRAVEL, travelMgmt: live, setTool });
        expect(result.current.travelPanelOpen).toBe(true);

        const arrived = createTravelMgmt('inactive');
        rerender({ tool: TOOL_TRAVEL, travelMgmt: arrived });
        expect(result.current.travelPanelOpen).toBe(false);
        expect(setTool).toHaveBeenCalledWith(TOOL_NONE); // tool re-armed for one-press re-entry

        // Re-entry press: the toolbar applies the force-off (tool → NONE),
        // then the single re-entry press toggles NONE → TOOL_TRAVEL over an
        // idle trip = activation, exactly one press needed.
        rerender({ tool: TOOL_NONE, travelMgmt: arrived });
        rerender({ tool: TOOL_TRAVEL, travelMgmt: arrived });
        expect(arrived.startPlanning).toHaveBeenCalledTimes(1);
    });

    it('the mount-window CLOSED-echo law never flips the face while holding a live press', () => {
        // Press claims the trip; an UNKNOWN authority churn (travel-mode key
        // momentarily absent) must HOLD open (never cancel) and the face
        // keeps mirroring the synced LOCAL value — no desynced sample.
        const idle = createTravelMgmt('inactive');
        const { result, rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle });
        rerender({ tool: TOOL_TRAVEL, travelMgmt: idle });
        expect(idle.startPlanning).toHaveBeenCalledTimes(1);
        const live = createTravelMgmt('planning');
        rerender({ tool: TOOL_TRAVEL, travelMgmt: live });
        expect(result.current.travelPanelOpen).toBe(true);
        expect(live.cancelTravel).not.toHaveBeenCalled();
    });
});
