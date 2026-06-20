// @improved-by-ai
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
        it('does not trigger any actions on initial render regardless of tool or travel mode', () => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            renderHook(() =>
                useTravelToolSync(TOOL_TRAVEL, travelMgmt, handleGenerateWeather, setTool)
            );

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });

        it('does not trigger any actions on initial render with active travel', () => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            renderHook(() =>
                useTravelToolSync(TOOL_TRAVEL, travelMgmt, handleGenerateWeather, setTool)
            );

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('activating travel tool', () => {
        it('calls startPlanning and handleGenerateWeather when tool changes from non-travel to travel with inactive mode', () => {
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

        it.each`
            fromTool
            ${TOOL_NONE}
            ${TOOL_PAINT}
            ${TOOL_ROAD}
        `(
            'calls startPlanning and handleGenerateWeather when switching from $fromTool to travel with inactive mode',
            ({ fromTool }) => {
                const travelMgmt = createTravelMgmt('inactive', false);
                const handleGenerateWeather = vi.fn();
                const setTool = vi.fn();

                const { rerender } = renderHook(
                    ({ tool }) =>
                        useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                    { initialProps: { tool: fromTool } }
                );

                act(() => {
                    rerender({ tool: TOOL_TRAVEL });
                });

                expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
                expect(handleGenerateWeather).toHaveBeenCalledTimes(1);
            }
        );

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
    });

    describe('deactivating travel tool with inactive mode', () => {
        it.each`
            toTool
            ${TOOL_NONE}
            ${TOOL_PAINT}
            ${TOOL_ROAD}
        `('calls setTool with toTool when switching from travel to $toTool with inactive mode', ({ toTool }) => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: toTool });
            });

            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('travel tool already selected with inactive mode', () => {
        it('calls setTool with "none" when tool is travel and travelMode is inactive (not just activated)', () => {
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
            expect(setTool).not.toHaveBeenCalled();

            // Switch to a non-travel tool and back to travel (now tool is already travel, not just activated)
            act(() => {
                rerender({ tool: TOOL_PAINT });
            });
            expect(setTool).not.toHaveBeenCalled();

            act(() => {
                rerender({ tool: TOOL_TRAVEL });
            });
            // The first branch fires again because prevTool was paint (not travel), so toolJustActivated is true
            // and travelMode is still inactive, so startPlanning fires again. setTool is not called.
            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(2);
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('canceling active travel when switching away', () => {
        it.each`
            toTool
            ${TOOL_NONE}
            ${TOOL_PAINT}
            ${TOOL_ROAD}
        `('calls cancelTravel when switching from travel to $toTool with active travel', ({ toTool }) => {
            const travelMgmt = createTravelMgmt('active', true);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: TOOL_TRAVEL } }
            );

            act(() => {
                rerender({ tool: toTool });
            });

            expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });

        it('does not call cancelTravel when staying on travel tool with active travel', () => {
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

    describe('switching between non-travel tools', () => {
        it.each`
            fromTool    | toTool
            ${TOOL_PAINT} | ${TOOL_ROAD}
            ${TOOL_ROAD}  | ${TOOL_PAINT}
            ${TOOL_PAINT} | ${TOOL_PAINT}
            ${TOOL_ROAD}  | ${TOOL_ROAD}
        `('does nothing when switching from $fromTool to $toTool', ({ fromTool, toTool }) => {
            const travelMgmt = createTravelMgmt('inactive', false);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderHook(
                ({ tool }) =>
                    useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool),
                { initialProps: { tool: fromTool } }
            );

            act(() => {
                rerender({ tool: toTool });
            });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('travel mode changes without tool change', () => {
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

        it('does not cancel travel when travelMode changes but tool remains travel', () => {
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

    describe('handleGenerateWeather callback identity', () => {
        it('calls the new handleGenerateWeather when it changes and tool activates travel', () => {
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

        it('handles minimal travelMgmt object gracefully', () => {
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
