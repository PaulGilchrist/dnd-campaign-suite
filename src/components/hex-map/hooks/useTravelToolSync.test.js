import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelToolSync from './useTravelToolSync.js';
import {
    TOOL_TRAVEL,
    TOOL_NONE,
    TOOL_PAINT,
    TOOL_ROAD,
} from '../../../config/outdoorConfig.js';

describe('useTravelToolSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createTravelMgmt = (travelMode = 'inactive', isTravelActive = false) => ({
        travelMode,
        isTravelActive,
        startPlanning: vi.fn(),
        cancelTravel: vi.fn(),
    });

    describe('initial render', () => {
        it('does not call startPlanning on initial render', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            renderHook(() =>
                useTravelToolSync(TOOL_TRAVEL, travelMgmt, handleGenerateWeather, setTool)
            );

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });

        it('does not call cancelTravel on initial render with active travel', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            renderHook(() =>
                useTravelToolSync(TOOL_TRAVEL, travelMgmt, handleGenerateWeather, setTool)
            );

            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        });

        it('does nothing when tool is not travel on initial render', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            renderHook(() =>
                useTravelToolSync(TOOL_NONE, travelMgmt, handleGenerateWeather, setTool)
            );

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('tool activation to travel', () => {
        it('calls startPlanning and handleGenerateWeather when activating travel with inactive mode', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_NONE } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });

            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather).toHaveBeenCalledTimes(1);
        });

        it('does not call startPlanning when travelMode is already active', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_NONE } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });

        it('does not call startPlanning when travelMode is planning', () => {
            const travelMgmt = createTravelMgmt('planning', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_NONE } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });

        it('does not call startPlanning when tool is not travel', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: TOOL_PAINT });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });
    });

    describe('tool deactivation from travel with inactive mode', () => {
        it('does not call setTool when switching from travel to paint with inactive mode', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: TOOL_PAINT });
            });

            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('canceling active travel when switching away', () => {
        it('calls cancelTravel when switching from travel to another tool with active travel', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: TOOL_PAINT });
            });

            expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });

        it('calls cancelTravel when switching from travel to none with active travel', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: TOOL_NONE });
            });

            expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
        });

        it('does not call cancelTravel when tool is travel and travel is active', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });

            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        });

        it('does not call cancelTravel when switching from travel to paint with inactive mode', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: TOOL_PAINT });
            });

            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        });
    });

    describe('tool switching between non-travel tools', () => {
        it('does nothing when switching between non-travel tools', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_PAINT } }
            );

            act(() => {
                rerender({ tool: TOOL_ROAD });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });

        it('does nothing when switching from one non-travel tool to the same non-travel tool', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_PAINT } }
            );

            act(() => {
                rerender({ tool: TOOL_PAINT });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('travel mode transitions', () => {
        it('does not trigger actions when travelMode changes but tool is not travel', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_PAINT } }
            );

            act(() => {
                travelMgmt.travelMode = 'planning';
                rerender({ tool: TOOL_PAINT });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });

        it('does not cancel travel when travel mode changes but tool remains travel', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                travelMgmt.travelMode = 'inactive';
                rerender({ tool: TOOL_TRAVEL });
            });

            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
        });
    });

    describe('handleGenerateWeather dependency', () => {
        it('calls new handleGenerateWeather when it changes and tool activates travel', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather1 = vi.fn();
            const handleGenerateWeather2 = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool, weatherHandler }) =>
                    useTravelToolSync(tool, travelMgmt, weatherHandler, setTool),
                { initialProps: { tool: TOOL_NONE, weatherHandler: handleGenerateWeather1 } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL, weatherHandler: handleGenerateWeather2 });
            });

            expect(handleGenerateWeather2).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather1).not.toHaveBeenCalled();
        });
    });

    describe('multiple tool changes in sequence', () => {
        it('handles travel -> paint -> travel sequence correctly', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_NONE } }
            );

            // Activate travel
            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });
            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather).toHaveBeenCalledTimes(1);

            // Switch to paint (travel is active, so cancel)
            act(() => {
                travelMgmt.travelMode = 'active';
                travelMgmt.isTravelActive = true;
                rerender({ tool: TOOL_PAINT });
            });
            expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);

            // Reactivate travel
            act(() => {
                travelMgmt.travelMode = 'inactive';
                travelMgmt.isTravelActive = false;
                rerender({ tool: TOOL_TRAVEL });
            });
            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(2);
            expect(handleGenerateWeather).toHaveBeenCalledTimes(2);

            // Switch to road (travel is inactive, nothing happens)
            act(() => {
                rerender({ tool: TOOL_ROAD });
            });
            expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
        });
    });

    describe('edge cases', () => {
        it('handles rapid tool changes without issues', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_NONE } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });
            act(() => {
                rerender({ tool: TOOL_PAINT });
            });
            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });
            act(() => {
                rerender({ tool: TOOL_ROAD });
            });

            // First travel activation triggers startPlanning + weather
            // Second travel activation triggers startPlanning + weather again
            // paint and road switches with inactive mode do nothing
            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(2);
            expect(handleGenerateWeather).toHaveBeenCalledTimes(2);
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });

        it('handles undefined-like travelMgmt gracefully', () => {
            const travelMgmt = {
                travelMode: 'inactive',
                isTravelActive: false,
                startPlanning: vi.fn(),
                cancelTravel: vi.fn(),
            };
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_NONE } }
            );

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });

            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
        });
    });
});
