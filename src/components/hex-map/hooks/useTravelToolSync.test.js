import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTravelToolSync from './useTravelToolSync.js';
import {
    TOOL_TRAVEL,
    TOOL_NONE,
    TOOL_PAINT,
    TOOL_ERASE,
    TOOL_POI,
    TOOL_RIVER,
    TOOL_PAN,
    TOOL_ROAD,
} from '../../../config/outdoorConfig.js';

const NON_TRAVEL_TOOLS = [TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_POI, TOOL_RIVER, TOOL_PAN, TOOL_ROAD];
const ACTIVE_TRAVEL_MODES = ['active', 'planning', 'traveling', 'paused'];

describe('useTravelToolSync', () => {
    // Mirrors useTravelManagement: isTravelActive is derived from travelMode.
    const createTravelMgmt = (travelMode = 'inactive', isTravelActive = travelMode !== 'inactive') => ({
        travelMode,
        isTravelActive,
        startPlanning: vi.fn(),
        cancelTravel: vi.fn(),
    });

    // Threads every hook argument through props (like the real HexMap), so a
    // fresh travelMgmt object can be passed to simulate a travel-state change.
    const renderSync = ({ tool, travelMgmt, handleGenerateWeather = vi.fn(), setTool = vi.fn() }) => {
        const state = { tool, travelMgmt, handleGenerateWeather, setTool };
        const utils = renderHook(
            ({ tool, travelMgmt, weatherHandler, setTool }) =>
                useTravelToolSync(tool, travelMgmt, weatherHandler, setTool),
            { initialProps: { tool, travelMgmt, weatherHandler: handleGenerateWeather, setTool } }
        );
        const rerender = (changes) => {
            Object.assign(state, changes);
            act(() => {
                utils.rerender({
                    tool: state.tool,
                    travelMgmt: state.travelMgmt,
                    weatherHandler: state.handleGenerateWeather,
                    setTool: state.setTool,
                });
            });
        };
        return { ...utils, rerender };
    };

    describe('initial render', () => {
        it.each`
            scenario                                                      | tool           | travelMode
            ${'the travel tool is selected and travel is inactive'}       | ${TOOL_TRAVEL} | ${'inactive'}
            ${'the travel tool is selected and travel is planning'}       | ${TOOL_TRAVEL} | ${'planning'}
            ${'a non-travel tool is selected and travel is active'}       | ${TOOL_PAINT}  | ${'active'}
        `('does not trigger any actions when $scenario', ({ tool, travelMode }) => {
            const travelMgmt = createTravelMgmt(travelMode);
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            renderSync({ tool, travelMgmt, handleGenerateWeather, setTool });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('activating the travel tool', () => {
        it.each(NON_TRAVEL_TOOLS)(
            'starts planning and generates weather when switching from %s to travel while inactive',
            (fromTool) => {
                const travelMgmt = createTravelMgmt('inactive');
                const handleGenerateWeather = vi.fn();
                const setTool = vi.fn();

                const { rerender } = renderSync({
                    tool: fromTool,
                    travelMgmt,
                    handleGenerateWeather,
                    setTool,
                });

                rerender({ tool: TOOL_TRAVEL });

                expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
                expect(handleGenerateWeather).toHaveBeenCalledTimes(1);
                expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
                expect(setTool).not.toHaveBeenCalled();
            }
        );

        it.each(ACTIVE_TRAVEL_MODES)(
            'does not start planning when switching to travel while travelMode is %s',
            (mode) => {
                const travelMgmt = createTravelMgmt(mode);
                const handleGenerateWeather = vi.fn();
                const setTool = vi.fn();

                const { rerender } = renderSync({
                    tool: TOOL_NONE,
                    travelMgmt,
                    handleGenerateWeather,
                    setTool,
                });

                rerender({ tool: TOOL_TRAVEL });

                expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
                expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
                expect(handleGenerateWeather).not.toHaveBeenCalled();
                expect(setTool).not.toHaveBeenCalled();
            }
        );
    });

    describe('switching away from the travel tool', () => {
        it.each(NON_TRAVEL_TOOLS)(
            'cancels travel when switching from travel to %s while travel is active',
            (toTool) => {
                const travelMgmt = createTravelMgmt('active');
                const handleGenerateWeather = vi.fn();
                const setTool = vi.fn();

                const { rerender } = renderSync({
                    tool: TOOL_TRAVEL,
                    travelMgmt,
                    handleGenerateWeather,
                    setTool,
                });

                rerender({ tool: toTool });

                expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
                expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
                expect(handleGenerateWeather).not.toHaveBeenCalled();
                expect(setTool).not.toHaveBeenCalled();
            }
        );

        it('does not cancel travel when switching away while travel is inactive', () => {
            const travelMgmt = createTravelMgmt('inactive');
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: TOOL_TRAVEL,
                travelMgmt,
                handleGenerateWeather,
                setTool,
            });

            rerender({ tool: TOOL_PAINT });

            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });

        it.each`
            travelMode     | isTravelActive | expectedCancelCalls
            ${'inactive'}  | ${true}        | ${1}
            ${'active'}    | ${false}       | ${0}
        `(
            'keys cancellation off isTravelActive (travelMode: $travelMode, isTravelActive: $isTravelActive)',
            ({ travelMode, isTravelActive, expectedCancelCalls }) => {
                const travelMgmt = createTravelMgmt(travelMode, isTravelActive);
                const handleGenerateWeather = vi.fn();
                const setTool = vi.fn();

                const { rerender } = renderSync({
                    tool: TOOL_TRAVEL,
                    travelMgmt,
                    handleGenerateWeather,
                    setTool,
                });

                rerender({ tool: TOOL_PAINT });

                expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(expectedCancelCalls);
            }
        );
    });

    describe('switching between non-travel tools', () => {
        it.each`
            fromTool       | toTool
            ${TOOL_PAINT}  | ${TOOL_ROAD}
            ${TOOL_ROAD}   | ${TOOL_PAINT}
            ${TOOL_PAINT}  | ${TOOL_PAINT}
            ${TOOL_ROAD}   | ${TOOL_ROAD}
        `('does nothing when switching from $fromTool to $toTool', ({ fromTool, toTool }) => {
            const travelMgmt = createTravelMgmt('inactive');
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: fromTool,
                travelMgmt,
                handleGenerateWeather,
                setTool,
            });

            rerender({ tool: toTool });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('travel state changes while the tool stays the same', () => {
        it('forces the travel tool off when travelMode becomes inactive while the travel tool is selected', () => {
            const initialTravelMgmt = createTravelMgmt('active');
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: TOOL_TRAVEL,
                travelMgmt: initialTravelMgmt,
                handleGenerateWeather,
                setTool,
            });

            rerender({ travelMgmt: createTravelMgmt('inactive') });

            expect(setTool).toHaveBeenCalledWith(TOOL_NONE);
            expect(initialTravelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(initialTravelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
        });

        it('does nothing when travelMode becomes active while the travel tool is selected', () => {
            const initialTravelMgmt = createTravelMgmt('inactive');
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: TOOL_TRAVEL,
                travelMgmt: initialTravelMgmt,
                handleGenerateWeather,
                setTool,
            });

            const travelMgmt = createTravelMgmt('planning');
            rerender({ travelMgmt });

            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(initialTravelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(initialTravelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });

        it('cancels travel when travelMode becomes active while a non-travel tool is selected', () => {
            const initialTravelMgmt = createTravelMgmt('inactive');
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: TOOL_PAINT,
                travelMgmt: initialTravelMgmt,
                handleGenerateWeather,
                setTool,
            });

            const travelMgmt = createTravelMgmt('planning');
            rerender({ travelMgmt });

            expect(travelMgmt.cancelTravel).toHaveBeenCalledTimes(1);
            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(handleGenerateWeather).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('handleGenerateWeather callback identity', () => {
        it('uses the latest handleGenerateWeather when its identity changes alongside the tool', () => {
            const travelMgmt = createTravelMgmt('inactive');
            const handleGenerateWeather1 = vi.fn();
            const handleGenerateWeather2 = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: TOOL_NONE,
                travelMgmt,
                handleGenerateWeather: handleGenerateWeather1,
                setTool,
            });

            rerender({ tool: TOOL_TRAVEL, handleGenerateWeather: handleGenerateWeather2 });

            expect(handleGenerateWeather2).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather1).not.toHaveBeenCalled();
            expect(travelMgmt.startPlanning).toHaveBeenCalledTimes(1);
        });

        it('does not trigger actions when only handleGenerateWeather changes', () => {
            const travelMgmt = createTravelMgmt('inactive');
            const handleGenerateWeather1 = vi.fn();
            const handleGenerateWeather2 = vi.fn();
            const setTool = vi.fn();

            const { rerender } = renderSync({
                tool: TOOL_PAINT,
                travelMgmt,
                handleGenerateWeather: handleGenerateWeather1,
                setTool,
            });

            rerender({ handleGenerateWeather: handleGenerateWeather2 });

            expect(handleGenerateWeather1).not.toHaveBeenCalled();
            expect(handleGenerateWeather2).not.toHaveBeenCalled();
            expect(travelMgmt.startPlanning).not.toHaveBeenCalled();
            expect(travelMgmt.cancelTravel).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });

    describe('multiple tool changes in sequence', () => {
        it('stays in sync through a travel -> paint -> travel -> road sequence', () => {
            const handleGenerateWeather = vi.fn();
            const setTool = vi.fn();
            const idle = createTravelMgmt('inactive');
            const active = createTravelMgmt('active');
            const idleAfterCancel = createTravelMgmt('inactive');

            const { rerender } = renderSync({
                tool: TOOL_NONE,
                travelMgmt: idle,
                handleGenerateWeather,
                setTool,
            });

            rerender({ tool: TOOL_TRAVEL });
            expect(idle.startPlanning).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather).toHaveBeenCalledTimes(1);

            rerender({ tool: TOOL_PAINT, travelMgmt: active });
            expect(active.cancelTravel).toHaveBeenCalledTimes(1);

            rerender({ tool: TOOL_TRAVEL, travelMgmt: idleAfterCancel });
            expect(idleAfterCancel.startPlanning).toHaveBeenCalledTimes(1);
            expect(handleGenerateWeather).toHaveBeenCalledTimes(2);

            rerender({ tool: TOOL_ROAD });
            expect(idleAfterCancel.cancelTravel).not.toHaveBeenCalled();
            expect(setTool).not.toHaveBeenCalled();
        });
    });
});
