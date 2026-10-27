// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useTravelToolSync from './useTravelToolSync.js';
import { TOOL_TRAVEL, TOOL_NONE, TOOL_PAINT, TOOL_ROAD } from '../../../config/outdoorConfig.js';

// Source contract (useTravelToolSync.js): one effect with four branches after
// a mount guard, keyed ONLY on tool === TOOL_TRAVEL, travelMgmt.travelMode
// === 'inactive', travelMgmt.isTravelActive, and the resume/adoption session
// gate (openedLive || hasLoadedTrip). Other tool identities and other
// travelMode values are indistinguishable to the source, so each branch is
// pinned once instead of per-permutation.
describe('useTravelToolSync', () => {
    // Mirrors useTravelManagement: isTravelActive is derived from travelMode.
    const createTravelMgmt = (travelMode = 'inactive', isTravelActive = travelMode !== 'inactive') => ({
        travelMode,
        isTravelActive,
        startPlanning: vi.fn(),
        cancelTravel: vi.fn(),
    });

    // Threads every hook argument through props (like the real HexMap.jsx:141),
    // so rerender can change any single input while keeping the others stable.
    // hasPersistedWeather defaults false (a map file with no weather object).
    const renderSync = ({ tool, travelMgmt, handleGenerateWeather = vi.fn(), setTool = vi.fn(), hasPersistedWeather = false, hasLoadedTrip = false }) => {
        const initialProps = { tool, travelMgmt, weatherHandler: handleGenerateWeather, setTool, hasPersistedWeather, hasLoadedTrip };
        const utils = renderHook(
            (p) => useTravelToolSync(p.tool, p.travelMgmt, p.weatherHandler, p.setTool, { hasPersistedWeather: p.hasPersistedWeather, hasLoadedTrip: p.hasLoadedTrip }),
            { initialProps }
        );
        const rerender = (changes) => utils.rerender({ ...initialProps, ...changes });
        return { ...utils, rerender };
    };

    const noCalls = (travelMgmt, handleGenerateWeather, setTool) => {
        expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
        expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(handleGenerateWeather).not.toHaveBeenCalled();
        expect(setTool).not.toHaveBeenCalled();
    };

    it.each`
        scenario                                                        | tool           | travelMode
        ${'travel tool pre-selected while travel is inactive'}          | ${TOOL_TRAVEL} | ${'inactive'}
        ${'a non-travel tool pre-selected while travel is active'}     | ${TOOL_PAINT}  | ${'active'}
    `('mount is a no-op even though branch conditions match: $scenario', ({ tool, travelMode }) => {
        // Without the toolInitRef guard, mount would fire setTool('none')
        // (travel+inactive) or cancelTravel (paint+active).
        const travelMgmt = createTravelMgmt(travelMode);
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        renderSync({ tool, travelMgmt, handleGenerateWeather, setTool });

        noCalls(travelMgmt, handleGenerateWeather, setTool);
    });

    it('starts planning and generates weather exactly once when the travel tool activates while inactive', () => {
        const travelMgmt = createTravelMgmt('inactive');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({ tool: TOOL_PAINT, travelMgmt, handleGenerateWeather, setTool });

        rerender({ tool: TOOL_TRAVEL });

        expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
        expect(handleGenerateWeather).toHaveBeenCalledTimes(1);
        expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(setTool).not.toHaveBeenCalled();
    });

    // Backlog 2026-10-26-C: persisted (map-file) weather is deliberate GM state.
    // Tool activation must surface it unchanged, never silently re-roll it.
    it('starts planning WITHOUT re-rolling when the travel tool activates over persisted weather', () => {
        const travelMgmt = createTravelMgmt('inactive');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({
            tool: TOOL_PAINT, travelMgmt, handleGenerateWeather, setTool, hasPersistedWeather: true,
        });

        rerender({ tool: TOOL_TRAVEL });

        expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
        expect(handleGenerateWeather).not.toHaveBeenCalled();
        expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(setTool).not.toHaveBeenCalled();
    });

    it('survives a full close-tool/reopen-tool cycle with persisted weather without ever rolling', () => {
        const travelMgmt = createTravelMgmt('inactive');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({
            tool: TOOL_NONE, travelMgmt, handleGenerateWeather, setTool, hasPersistedWeather: true,
        });

        rerender({ tool: TOOL_TRAVEL });
        rerender({ tool: TOOL_NONE });
        rerender({ tool: TOOL_TRAVEL });

        expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(2);
        expect(handleGenerateWeather).not.toHaveBeenCalled();
    });

    it('re-arms the first-travel auto-roll when the persisted-weather flag flips back to absent', () => {
        // Map reloaded without a weather object (e.g. fresh file) while the
        // travel tool stays selected — activation on the next press must roll.
        const travelMgmt = createTravelMgmt('inactive');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({
            tool: TOOL_NONE, travelMgmt, handleGenerateWeather, setTool, hasPersistedWeather: true,
        });
        rerender({ tool: TOOL_TRAVEL, hasPersistedWeather: false });

        expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
        expect(handleGenerateWeather).toHaveBeenCalledTimes(1);
    });

    it('does not restart planning when the travel tool activates while travel is already in progress', () => {
        // Source compares travelMode === 'inactive' only; any other mode
        // (planning/active/paused) takes the same inert path.
        const travelMgmt = createTravelMgmt('planning');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt, handleGenerateWeather, setTool });

        rerender({ tool: TOOL_TRAVEL });

        noCalls(travelMgmt, handleGenerateWeather, setTool);
    });

    it.each`
        travelMode    | isTravelActive | expectedCancelCalls | expectedTo
        ${'active'}   | ${true}        | ${1}                | ${'cancels running travel'}
        ${'inactive'} | ${false}       | ${0}                | ${'does nothing when travel is inactive'}
        ${'active'}   | ${false}       | ${0}                | ${'does not cancel on travelMode alone'}
        ${'inactive'} | ${true}        | ${1}                | ${'cancels on isTravelActive alone'}
    `('switching travel -> paint $expectedTo ($travelMode/$isTravelActive)', ({ travelMode, isTravelActive, expectedCancelCalls }) => {
        const travelMgmt = createTravelMgmt(travelMode, isTravelActive);
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({ tool: TOOL_TRAVEL, travelMgmt, handleGenerateWeather, setTool });

        rerender({ tool: TOOL_PAINT });

        expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(expectedCancelCalls);
        expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
        expect(handleGenerateWeather).not.toHaveBeenCalled();
        expect(setTool).not.toHaveBeenCalled();
    });

    it('forces the travel tool off with the exact TOOL_NONE byte when travel goes inactive mid-selection', () => {
        const travelMgmt = createTravelMgmt('active');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({ tool: TOOL_TRAVEL, travelMgmt, handleGenerateWeather, setTool });

        rerender({ travelMgmt: createTravelMgmt('inactive') });

        expect(setTool).toHaveBeenCalledTimes(1);
        expect(setTool).toHaveBeenCalledWith(TOOL_NONE);
        expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(handleGenerateWeather).not.toHaveBeenCalled();
    });

    it('does nothing when travel advances externally while the travel tool stays selected, even with fresh collaborator identities', () => {
        // SSE-echo case: travelMgmt and callback identities churn, mode goes
        // inactive -> planning, tool stays selected — no branch may fire.
        const initialTravelMgmt = createTravelMgmt('inactive');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({ tool: TOOL_TRAVEL, travelMgmt: initialTravelMgmt, handleGenerateWeather, setTool });

        const advancedTravelMgmt = createTravelMgmt('planning');
        const freshWeather = vi.fn();
        const freshSetTool = vi.fn();
        rerender({ travelMgmt: advancedTravelMgmt, handleGenerateWeather: freshWeather, setTool: freshSetTool });

        noCalls(initialTravelMgmt, handleGenerateWeather, setTool);
        noCalls(advancedTravelMgmt, freshWeather, freshSetTool);
    });

    it('is session-sticky resume-aware when the loaded file carries a trip', () => {
        // Improve 2026-10-26-D: the file trip materializes into change-data a
        // beat AFTER mount (async loader → adoption effect), and per-value
        // SSE echoes keep re-churning it. In a session that LOADED a file
        // trip, no-press activations survive; only leaving the tool cancels.
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();
        const idle = createTravelMgmt('inactive');
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, handleGenerateWeather, setTool, hasLoadedTrip: true });

        const adopted = createTravelMgmt('traveling');
        rerender({ travelMgmt: adopted });
        const echoed = createTravelMgmt('traveling');
        rerender({ travelMgmt: echoed });
        expect(adopted.cancelTravel).not.toHaveBeenCalled();
        expect(echoed.cancelTravel).not.toHaveBeenCalled();
        expect(adopted.startPlanning).not.toHaveBeenCalled();
        // Toggle-mirror (backlog 2026-10-27-G): the post-mount adoption pass
        // auto-presses TOOL_TRAVEL (while the tool prop stays NONE in this
        // harness) so the toolbar .active/aria-pressed state mirrors the
        // panel the adoption mounted — one press per live pass.
        expect(setTool).toHaveBeenCalledTimes(2);
        expect(setTool).toHaveBeenCalledWith(TOOL_TRAVEL);

        // Intent still cancels: select then leave the travel tool.
        rerender({ tool: TOOL_TRAVEL, travelMgmt: adopted });
        rerender({ tool: TOOL_PAINT, travelMgmt: adopted });
        expect(adopted.cancelTravel).toHaveBeenCalledTimes(1);
    });

    it('cancels externally-started travel when a non-travel tool is selected', () => {
        // Same cancel branch, but triggered by travelMgmt identity (SSE-driven
        // travel start) rather than a tool switch.
        const initialTravelMgmt = createTravelMgmt('inactive');
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();

        const { rerender } = renderSync({ tool: TOOL_PAINT, travelMgmt: initialTravelMgmt, handleGenerateWeather, setTool });

        const startedTravelMgmt = createTravelMgmt('planning');
        rerender({ travelMgmt: startedTravelMgmt });

        expect(startedTravelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
        expect(startedTravelMgmt.startPlanning).not.toHaveBeenCalled();
        expect(initialTravelMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(handleGenerateWeather).not.toHaveBeenCalled();
        expect(setTool).not.toHaveBeenCalled();
    });

    it('never cancels a trip that was already live at mount (reopen-resume), across post-load churn', () => {
        // Improve 2026-10-26-D live repro: mid-trip map reopen / page reload
        // mounts with tool NONE + an active trip (change-data or file travelState
        // resume). Post-load re-renders hand in fresh travelMgmt identities —
        // none of them may cancel the reopened trip.
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();
        const mountMgmt = createTravelMgmt('traveling');
        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: mountMgmt, handleGenerateWeather, setTool });

        const afterLoad = createTravelMgmt('traveling');
        rerender({ travelMgmt: afterLoad });
        const echoed = createTravelMgmt('planning');
        rerender({ travelMgmt: echoed });

        expect(mountMgmt.cancelTravel).not.toHaveBeenCalled();
        expect(afterLoad.cancelTravel).not.toHaveBeenCalled();
        expect(echoed.cancelTravel).not.toHaveBeenCalled();
        expect(mountMgmt.startPlanning).not.toHaveBeenCalled();
        expect(handleGenerateWeather).not.toHaveBeenCalled();
        // Toggle-mirror (backlog 2026-10-27-G): every post-mount pass that sees
        // a live trip with the tool unselected auto-presses TOOL_TRAVEL so the
        // toolbar .active/aria-pressed state mirrors the mounted panel. The
        // mount pass itself stays inert (guard above).
        expect(setTool).toHaveBeenCalledTimes(2);
        expect(setTool).toHaveBeenCalledWith(TOOL_TRAVEL);

        // Intent still cancels: selecting then leaving the travel tool.
        rerender({ tool: TOOL_TRAVEL, travelMgmt: afterLoad });
        rerender({ tool: TOOL_PAINT, travelMgmt: afterLoad });
        expect(afterLoad.cancelTravel).toHaveBeenCalledTimes(1);
    });

    it('re-arms across a full travel -> paint -> travel -> road lifecycle with exact totals', () => {
        const handleGenerateWeather = vi.fn();
        const setTool = vi.fn();
        const idle = createTravelMgmt('inactive');
        const active = createTravelMgmt('active');
        const idleAfterCancel = createTravelMgmt('inactive');

        const { rerender } = renderSync({ tool: TOOL_NONE, travelMgmt: idle, handleGenerateWeather, setTool });

        rerender({ tool: TOOL_TRAVEL });
        expect(idle.startPlanning).toHaveBeenCalledTimes(1);

        rerender({ tool: TOOL_PAINT, travelMgmt: active });
        expect(active.cancelTravel).toHaveBeenCalledTimes(1);

        rerender({ tool: TOOL_TRAVEL, travelMgmt: idleAfterCancel });
        expect(idleAfterCancel.startPlanning).toHaveBeenCalledTimes(1);

        rerender({ tool: TOOL_ROAD });
        expect(idleAfterCancel.cancelTravel).not.toHaveBeenCalled();

        // Exact totals across the whole lifecycle.
        expect(handleGenerateWeather).toHaveBeenCalledTimes(2);
        expect(setTool).not.toHaveBeenCalled();
    });
});
