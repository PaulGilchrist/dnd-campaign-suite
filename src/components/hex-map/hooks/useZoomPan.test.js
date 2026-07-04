// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useZoomPan from './useZoomPan.js';

vi.mock('../../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
    MIN_ZOOM: 2,
    MAX_ZOOM: 8,
}));

describe('useZoomPan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createSvgRef = (mockAttrs = {}) => {
        const ref = { current: null };
        const baseAttrs = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 300 }),
            viewBox: { baseVal: { x: 0, y: 0, width: 600, height: 300 } },
            ...mockAttrs,
        };
        ref.current = baseAttrs;
        return ref;
    };

    const createArgs = (overrides = {}) => {
        const svgRef = createSvgRef();
        const zoomState = { current: 2 };
        const panXState = { current: 0 };
        const panYState = { current: 0 };
        return {
            svgRef,
            hexCols: 10,
            hexRows: 10,
            zoom: zoomState.current,
            setZoom: vi.fn((val) => {
                const next = typeof val === 'function' ? val(zoomState.current) : val;
                zoomState.current = next;
            }),
            panX: panXState.current,
            setPanX: vi.fn((val) => { panXState.current = val; }),
            panY: panYState.current,
            setPanY: vi.fn((val) => { panYState.current = val; }),
            zoomState,
            panXState,
            panYState,
            ...overrides,
        };
    };

    const renderHookWithArgs = (args) =>
        renderHook(() =>
            useZoomPan(
                args.svgRef, args.hexCols, args.hexRows,
                args.zoom, args.setZoom, args.panX, args.setPanX,
                args.panY, args.setPanY,
            )
        );

    describe('zoomIn', () => {
        it('increases zoom by 1.25x and clamps at MAX_ZOOM', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.zoomIn(); });
            expect(args.zoomState.current).toBe(2.5);
        });

        it('caps zoom at MAX_ZOOM when multiplier would exceed it', () => {
            const args = createArgs();
            args.zoomState.current = 7;
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.zoomIn(); });
            expect(args.zoomState.current).toBe(8);
        });

        it('centers the view and sets panX/panY accordingly', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.zoomIn(); });
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });
    });

    describe('zoomOut', () => {
        it('decreases zoom by 0.8x and clamps at MIN_ZOOM', () => {
            const args = createArgs();
            args.zoomState.current = 3;
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.zoomOut(); });
            expect(args.zoomState.current).toBeCloseTo(2.4, 10);
        });

        it('caps zoom at MIN_ZOOM when multiplier would go below it', () => {
            const args = createArgs();
            args.zoomState.current = 2;
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.zoomOut(); });
            expect(args.zoomState.current).toBe(2);
        });

        it('centers the view and sets panX/panY accordingly', () => {
            const args = createArgs();
            args.zoomState.current = 3;
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.zoomOut(); });
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });
    });

    describe('resetView', () => {
        it('resets zoom to 2 and centers the view', () => {
            const args = createArgs();
            args.zoomState.current = 5;
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.resetView(); });
            expect(args.zoomState.current).toBe(2);
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });
    });

    describe('clampPan', () => {
        it('clamps x and y within grid bounds', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            const clamped = result.current.clampPan(2, 999999, 999999);
            expect(clamped.x).not.toBe(999999);
            expect(clamped.y).not.toBe(999999);
            const negClamped = result.current.clampPan(2, -999999, -999999);
            expect(negClamped.x).not.toBe(-999999);
            expect(negClamped.y).not.toBe(-999999);
        });
    });

    describe('centerView', () => {
        it('returns different center positions for different zoom levels', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            const centered2 = result.current.centerView(2);
            const centered4 = result.current.centerView(4);
            expect(centered2.x).not.toBe(centered4.x);
            expect(centered2.y).not.toBe(centered4.y);
        });
    });

    describe('handlePanStart', () => {
        it('sets panning when left mouse button is clicked', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            const mockEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
            };
            act(() => { result.current.handlePanStart(mockEvent); });
            expect(result.current.panning).not.toBeNull();
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        it('does not set panning for non-left buttons or null svgRef', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => {
                result.current.handlePanStart({
                    button: 1,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(result.current.panning).toBeNull();
            args.svgRef.current = null;
            act(() => {
                result.current.handlePanStart({
                    button: 0,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(result.current.panning).toBeNull();
        });
    });

    describe('handlePanMove', () => {
        it('does nothing when not panning', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => { result.current.handlePanMove({ clientX: 100, clientY: 100, preventDefault: vi.fn() }); });
            expect(args.setPanX).not.toHaveBeenCalled();
            expect(args.setPanY).not.toHaveBeenCalled();
        });

        it('updates panX and panY when panning with mouse movement', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => {
                result.current.handlePanStart({
                    button: 0,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            act(() => {
                result.current.handlePanMove({
                    clientX: 120,
                    clientY: 120,
                    preventDefault: vi.fn(),
                });
            });
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });
    });

    describe('handlePanEnd', () => {
        it('resets panning to null', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => {
                result.current.handlePanStart({
                    button: 0,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(result.current.panning).not.toBeNull();
            act(() => { result.current.handlePanEnd(); });
            expect(result.current.panning).toBeNull();
        });
    });

    describe('handleWheel', () => {
        it('does nothing when metaKey is not pressed', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => {
                result.current.handleWheel({
                    metaKey: false,
                    deltaY: -100,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(args.setZoom).not.toHaveBeenCalled();
        });

        it.each([
            { deltaY: -10, expectedZoom: 2.1, desc: 'zooms in with negative accumulated delta' },
            { deltaY: 10, expectedZoom: 2, desc: 'zooms out with positive accumulated delta' },
        ])('accumulates deltaY and $desc', ({ deltaY, expectedZoom }) => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            for (let i = 0; i < 3; i++) {
                act(() => {
                    result.current.handleWheel({
                        metaKey: true,
                        deltaY,
                        clientX: 100,
                        clientY: 100,
                        preventDefault: vi.fn(),
                    });
                });
            }
            expect(args.setZoom).toHaveBeenCalled();
            expect(args.zoomState.current).toBe(expectedZoom);
        });

        it('does not zoom when accumulated delta is below threshold', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            act(() => {
                result.current.handleWheel({
                    metaKey: true,
                    deltaY: 5,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(args.setZoom).toHaveBeenCalledWith(2);
        });

        it('respects MIN_ZOOM and MAX_ZOOM caps during extended wheel input', () => {
            const args = createArgs();
            args.zoomState.current = 2;
            const { result } = renderHookWithArgs(args);
            for (let i = 0; i < 20; i++) {
                act(() => {
                    result.current.handleWheel({
                        metaKey: true,
                        deltaY: 10,
                        clientX: 100,
                        clientY: 100,
                        preventDefault: vi.fn(),
                    });
                });
            }
            expect(args.zoomState.current).toBeGreaterThanOrEqual(2);
            args.zoomState.current = 8;
            for (let i = 0; i < 20; i++) {
                act(() => {
                    result.current.handleWheel({
                        metaKey: true,
                        deltaY: -10,
                        clientX: 100,
                        clientY: 100,
                        preventDefault: vi.fn(),
                    });
                });
            }
            expect(args.zoomState.current).toBeLessThanOrEqual(8);
        });

        it('does nothing when svgRef is null', () => {
            const args = createArgs();
            args.svgRef.current = null;
            const { result } = renderHookWithArgs(args);
            act(() => {
                result.current.handleWheel({
                    metaKey: true,
                    deltaY: -100,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(args.setZoom).not.toHaveBeenCalled();
        });
    });

    describe('gridPixelBounds', () => {
        it('calculates bounds based on hexCols and hexRows', () => {
            const args = createArgs();
            const { result } = renderHookWithArgs(args);
            const bounds = result.current.gridPixelBounds;
            expect(bounds.width).toBeGreaterThan(0);
            expect(bounds.height).toBeGreaterThan(0);
        });

        it('updates width when hexCols increases', () => {
            const args = createArgs();
            const { result, rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args },
            );
            const bounds1 = result.current.gridPixelBounds;
            args.hexCols = 20;
            rerender(args);
            expect(result.current.gridPixelBounds.width).toBeGreaterThan(bounds1.width);
        });

        it('updates height when hexRows increases', () => {
            const args = createArgs();
            const { result, rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args },
            );
            const bounds1 = result.current.gridPixelBounds;
            args.hexRows = 20;
            rerender(args);
            expect(result.current.gridPixelBounds.height).toBeGreaterThan(bounds1.height);
        });
    });

    describe('reacting to prop changes', () => {
        it.each([
            { prop: 'zoom', stateKey: 'zoomState', value: 4, action: 'zoomIn', expected: 5 },
            { prop: 'panX', stateKey: 'panXState', value: 100, action: 'panMoveX', expected: 100 },
            { prop: 'panY', stateKey: 'panYState', value: 50, action: 'panMoveY', expected: 50 },
        ])('syncs $prop ref and reflects changes on $action', ({ stateKey, value, action, expected }) => {
            const args = createArgs();
            const { result, rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args },
            );
            expect(result.current.panning).toBeNull();
            args[stateKey].current = value;
            rerender(args);
            if (action === 'zoomIn') {
                act(() => { result.current.zoomIn(); });
                expect(args.zoomState.current).toBe(expected);
            } else if (action === 'panMoveX') {
                act(() => {
                    result.current.handlePanStart({
                        button: 0,
                        clientX: 100,
                        clientY: 100,
                        preventDefault: vi.fn(),
                    });
                });
                act(() => {
                    result.current.handlePanMove({
                        clientX: 120,
                        clientY: 100,
                        preventDefault: vi.fn(),
                    });
                });
                expect(args.setPanX).toHaveBeenCalled();
            } else {
                act(() => {
                    result.current.handlePanStart({
                        button: 0,
                        clientX: 100,
                        clientY: 100,
                        preventDefault: vi.fn(),
                    });
                });
                act(() => {
                    result.current.handlePanMove({
                        clientX: 100,
                        clientY: 120,
                        preventDefault: vi.fn(),
                    });
                });
                expect(args.setPanY).toHaveBeenCalled();
            }
        });
    });
});
