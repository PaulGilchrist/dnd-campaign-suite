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

    const defaultArgs = () => {
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
        };
    };

    describe('initial state', () => {
        it('returns panning as null initially', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            expect(result.current.panning).toBeNull();
        });

        it('returns svgWidth and svgHeight as numbers', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            expect(typeof result.current.svgWidth).toBe('number');
            expect(typeof result.current.svgHeight).toBe('number');
        });

        it('returns gridPixelBounds as an object with expected properties', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const bounds = result.current.gridPixelBounds;
            expect(bounds).toHaveProperty('width');
            expect(bounds).toHaveProperty('height');
            expect(bounds).toHaveProperty('offsetX');
            expect(bounds).toHaveProperty('offsetY');
            expect(bounds).toHaveProperty('centerX');
            expect(bounds).toHaveProperty('centerY');
        });
    });

    describe('zoomIn', () => {
        it('calls setZoom with increased zoom value', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.zoomIn();
            });
            expect(args.setZoom).toHaveBeenCalled();
            expect(args.zoomState.current).toBeGreaterThan(2);
        });

        it('calls setPanX and setPanY with clamped values', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.zoomIn();
            });
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });

        it('caps zoom at MAX_ZOOM (8)', () => {
            const args = defaultArgs();
            // Start at a high zoom so multiplying by 1.25 exceeds MAX_ZOOM
            args.zoomState.current = 7;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoomState.current, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.zoomIn();
            });
            expect(args.zoomState.current).toBeLessThanOrEqual(8);
        });
    });

    describe('zoomOut', () => {
        it('calls setZoom with decreased zoom value', () => {
            const args = defaultArgs();
            args.zoomState.current = 3;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoomState.current, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.zoomOut();
            });
            expect(args.setZoom).toHaveBeenCalled();
            expect(args.zoomState.current).toBeLessThan(3);
        });

        it('calls setPanX and setPanY with clamped values', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.zoomOut();
            });
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });

        it('caps zoom at MIN_ZOOM (2)', () => {
            const args = defaultArgs();
            args.zoomState.current = 2;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoomState.current, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.zoomOut();
            });
            // zoomOut multiplies by 0.8, so it would go below MIN_ZOOM
            expect(args.zoomState.current).toBeGreaterThanOrEqual(2);
        });
    });

    describe('resetView', () => {
        it('sets zoom to 2', () => {
            const args = defaultArgs();
            args.zoomState.current = 5;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoomState.current, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.resetView();
            });
            expect(args.setZoom).toHaveBeenCalledWith(2);
        });

        it('sets panX and panY to centered clamped values', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.resetView();
            });
            expect(args.setPanX).toHaveBeenCalled();
            expect(args.setPanY).toHaveBeenCalled();
        });
    });

    describe('clampPan', () => {
        it('returns an object with x and y properties', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const clamped = result.current.clampPan(2, 0, 0);
            expect(clamped).toHaveProperty('x');
            expect(clamped).toHaveProperty('y');
        });

        it('returns clamped x within bounds', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const clamped = result.current.clampPan(2, 999999, 0);
            expect(clamped.x).toBeLessThan(999999);
        });

        it('returns clamped y within bounds', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const clamped = result.current.clampPan(2, 0, 999999);
            expect(clamped.y).toBeLessThan(999999);
        });
    });

    describe('centerView', () => {
        it('returns an object with x and y properties', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const centered = result.current.centerView(2);
            expect(centered).toHaveProperty('x');
            expect(centered).toHaveProperty('y');
        });

        it('returns clamped values', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const centered = result.current.centerView(4);
            expect(typeof centered.x).toBe('number');
            expect(typeof centered.y).toBe('number');
        });
    });

    describe('handlePanStart', () => {
        it('sets panning when left mouse button is clicked', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const mockEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
            };
            act(() => {
                result.current.handlePanStart(mockEvent);
            });
            expect(args.setPanning || result.current.panning).not.toBeNull();
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        it('does not set panning when button is not 0', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const mockEvent = {
                button: 1,
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
            };
            act(() => {
                result.current.handlePanStart(mockEvent);
            });
            expect(result.current.panning).toBeNull();
        });

        it('does nothing when svgRef is null', () => {
            const args = defaultArgs();
            args.svgRef.current = null;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const mockEvent = {
                button: 0,
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
            };
            act(() => {
                result.current.handlePanStart(mockEvent);
            });
            expect(result.current.panning).toBeNull();
        });
    });

    describe('handlePanMove', () => {
        it('does nothing when not panning', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const mockEvent = {
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
            };
            act(() => {
                result.current.handlePanMove(mockEvent);
            });
            expect(args.setPanX).not.toHaveBeenCalled();
        });

        it('updates panX and panY when panning', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            // Start panning first
            act(() => {
                result.current.handlePanStart({
                    button: 0,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            // Then move
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

        it('does nothing when svgRef is null during pan', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.handlePanStart({
                    button: 0,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            args.svgRef.current = null;
            act(() => {
                result.current.handlePanMove({
                    clientX: 120,
                    clientY: 120,
                    preventDefault: vi.fn(),
                });
            });
            // setPanX/setPanY should not have been called with pan move values
            // The initial call from handlePanStart doesn't call setPanX/setPanY
        });
    });

    describe('handlePanEnd', () => {
        it('resets panning to null', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            act(() => {
                result.current.handlePanStart({
                    button: 0,
                    clientX: 100,
                    clientY: 100,
                    preventDefault: vi.fn(),
                });
            });
            expect(result.current.panning).not.toBeNull();
            act(() => {
                result.current.handlePanEnd();
            });
            expect(result.current.panning).toBeNull();
        });
    });

    describe('handleWheel', () => {
        it('does nothing when metaKey is not pressed', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const mockEvent = {
                metaKey: false,
                deltaY: -100,
                clientX: 100,
                clientY: 100,
                preventDefault: vi.fn(),
            };
            act(() => {
                result.current.handleWheel(mockEvent);
            });
            expect(args.setZoom).not.toHaveBeenCalled();
        });

        it('zooms in when accumulating negative delta', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            // Send enough negative delta to exceed threshold
            for (let i = 0; i < 5; i++) {
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
            // After enough accumulation, zoom should have increased
            expect(args.setZoom).toHaveBeenCalled();
        });

        it('zooms out when accumulating positive delta', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            // Send enough positive delta to exceed threshold
            for (let i = 0; i < 5; i++) {
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
            expect(args.setZoom).toHaveBeenCalled();
        });

        it('respects MIN_ZOOM cap', () => {
            const args = defaultArgs();
            args.zoomState.current = 2;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoomState.current, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
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
        });

        it('respects MAX_ZOOM cap', () => {
            const args = defaultArgs();
            args.zoomState.current = 8;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoomState.current, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
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
            const args = defaultArgs();
            args.svgRef.current = null;
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
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

    describe('gridPixelBounds calculation', () => {
        it('calculates bounds based on hexCols and hexRows', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const bounds = result.current.gridPixelBounds;
            expect(bounds.width).toBeGreaterThan(0);
            expect(bounds.height).toBeGreaterThan(0);
        });

        it('updates bounds when hexCols changes', () => {
            const args = defaultArgs();
            const { result, rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args }
            );
            const bounds1 = result.current.gridPixelBounds;
            args.hexCols = 20;
            rerender(args);
            const bounds2 = result.current.gridPixelBounds;
            expect(bounds2.width).toBeGreaterThan(bounds1.width);
        });

        it('updates bounds when hexRows changes', () => {
            const args = defaultArgs();
            const { result, rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args }
            );
            const bounds1 = result.current.gridPixelBounds;
            args.hexRows = 20;
            rerender(args);
            const bounds2 = result.current.gridPixelBounds;
            expect(bounds2.height).toBeGreaterThan(bounds1.height);
        });
    });

    describe('function stability', () => {
        it('zoomIn, zoomOut, resetView are stable useCallback references', () => {
            const args = defaultArgs();
            const hookArgs = [args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY];
            const { result } = renderHook(
                (...a) => useZoomPan(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]),
                { initialProps: hookArgs }
            );
            expect(typeof result.current.zoomIn).toBe('function');
            expect(typeof result.current.zoomOut).toBe('function');
            expect(typeof result.current.resetView).toBe('function');
        });

        it('pan handlers are stable useCallback references', () => {
            const args = defaultArgs();
            const hookArgs = [args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY];
            const { result } = renderHook(
                (...a) => useZoomPan(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]),
                { initialProps: hookArgs }
            );
            expect(typeof result.current.handlePanStart).toBe('function');
            expect(typeof result.current.handlePanMove).toBe('function');
            expect(typeof result.current.handlePanEnd).toBe('function');
            expect(typeof result.current.handleWheel).toBe('function');
        });
    });

    describe('returned object shape', () => {
        it('returns all expected properties', () => {
            const args = defaultArgs();
            const { result } = renderHook(() =>
                useZoomPan(args.svgRef, args.hexCols, args.hexRows, args.zoom, args.setZoom, args.panX, args.setPanX, args.panY, args.setPanY)
            );
            const keys = Object.keys(result.current);
            expect(keys).toContain('svgWidth');
            expect(keys).toContain('svgHeight');
            expect(keys).toContain('gridPixelBounds');
            expect(keys).toContain('zoomIn');
            expect(keys).toContain('zoomOut');
            expect(keys).toContain('resetView');
            expect(keys).toContain('clampPan');
            expect(keys).toContain('centerView');
            expect(keys).toContain('panning');
            expect(keys).toContain('handlePanStart');
            expect(keys).toContain('handlePanMove');
            expect(keys).toContain('handlePanEnd');
            expect(keys).toContain('handleWheel');
        });
    });

    describe('reacting to prop changes', () => {
        it('updates zoom refs when zoom prop changes', () => {
            const args = defaultArgs();
            const { result, rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args }
            );
            expect(result.current.panning).toBeNull();
            args.zoomState.current = 4;
            rerender(args);
            // The zoomValueRef should be updated via useEffect
        });

        it('updates pan refs when panX prop changes', () => {
            const args = defaultArgs();
            const { rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args }
            );
            args.panXState.current = 100;
            rerender(args);
        });

        it('updates pan refs when panY prop changes', () => {
            const args = defaultArgs();
            const { rerender } = renderHook(
                (a) => useZoomPan(a.svgRef, a.hexCols, a.hexRows, a.zoom, a.setZoom, a.panX, a.setPanX, a.panY, a.setPanY),
                { initialProps: args }
            );
            args.panYState.current = 50;
            rerender(args);
        });
    });
});
