import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHexHover from './useHexHover.js';

vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    pixelToHexSnapped: vi.fn((x, y) => ({ q: Math.round(x / 30), r: Math.round(y / 30) })),
}));

vi.mock('../../../config/outdoorConfig.js', () => ({
    HEX_SIZE: 30,
}));

describe('useHexHover', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createSvgRef = (mockAttrs = {}) => {
        const ref = { current: null };
        const baseAttrs = {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 300 }),
            viewBox: { baseVal: { x: 0, y: 0, width: 600, height: 300 } },
            getScreenCTM: () => ({ inverse: () => ({ matrixTransform: (pt) => pt }) }),
            createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) }),
            ...mockAttrs,
        };
        ref.current = baseAttrs;
        return ref;
    };

    describe('initial state', () => {
        it('returns hoveredHex as null initially', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));
            expect(result.current.hoveredHex).toBeNull();
        });

        it('returns setHoveredHex as a function', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));
            expect(typeof result.current.setHoveredHex).toBe('function');
        });

        it('returns getHexFromEvent as a function', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));
            expect(typeof result.current.getHexFromEvent).toBe('function');
        });

        it('returns handleHexHover as a function', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));
            expect(typeof result.current.handleHexHover).toBe('function');
        });
    });

    describe('setHoveredHex', () => {
        it('updates hoveredHex when called with a hex object', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            act(() => {
                result.current.setHoveredHex({ q: 3, r: 5 });
            });

            expect(result.current.hoveredHex).toEqual({ q: 3, r: 5 });
        });

        it('clears hoveredHex when called with null', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            act(() => {
                result.current.setHoveredHex({ q: 2, r: 3 });
            });
            expect(result.current.hoveredHex).toEqual({ q: 2, r: 3 });

            act(() => {
                result.current.setHoveredHex(null);
            });
            expect(result.current.hoveredHex).toBeNull();
        });
    });

    describe('getHexFromEvent', () => {
        it('returns null when svgRef is null', () => {
            const svgRef = { current: null };
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 100, clientY: 100 };
            const hex = result.current.getHexFromEvent(mockEvent);
            expect(hex).toBeNull();
        });

        it('returns a hex object when svgRef exists', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 100, clientY: 100 };
            const hex = result.current.getHexFromEvent(mockEvent);

            expect(hex).toHaveProperty('q');
            expect(hex).toHaveProperty('r');
        });

        it('uses clientX and clientY from the event', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 150, clientY: 90 };
            const hex = result.current.getHexFromEvent(mockEvent);

            expect(hex).toHaveProperty('q');
            expect(hex).toHaveProperty('r');
        });
    });

    describe('handleHexHover', () => {
        it('does nothing when svgRef is null', () => {
            const svgRef = { current: null };
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 100, clientY: 100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it('sets hoveredHex when click is within grid bounds', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 100, clientY: 100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            expect(result.current.hoveredHex).not.toBeNull();
            expect(result.current.hoveredHex.q).toBeGreaterThanOrEqual(0);
            expect(result.current.hoveredHex.q).toBeLessThan(10);
            expect(result.current.hoveredHex.r).toBeGreaterThanOrEqual(0);
            expect(result.current.hoveredHex.r).toBeLessThan(10);
        });

        it('sets hoveredHex to null when click is outside grid bounds', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            // Move mouse to outside the grid (negative coordinates after viewBox conversion)
            const mockEvent = { clientX: -100, clientY: -100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it('sets hoveredHex to null when q is negative', () => {
            const svgRef = createSvgRef({
                viewBox: { baseVal: { x: 0, y: 0, width: 600, height: 300 } },
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 300 }),
            });
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            // Use a mockEvent that would produce a negative q after pixelToHexSnapped
            const mockEvent = { clientX: -500, clientY: 100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            // Should be null because q < 0
            expect(result.current.hoveredHex).toBeNull();
        });

        it('sets hoveredHex to null when q exceeds grid width', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            // Position far to the right, beyond grid width
            const mockEvent = { clientX: 10000, clientY: 100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it('sets hoveredHex to null when r exceeds grid height', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 100, clientY: 10000 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            expect(result.current.hoveredHex).toBeNull();
        });
    });

    describe('function stability', () => {
        it('getHexFromEvent and handleHexHover are stable useCallback references', () => {
            const svgRef = createSvgRef();
            const hookArgs = [svgRef, 10, 10];
            const { result } = renderHook(
                (...args) => useHexHover(args[0], args[1], args[2]),
                { initialProps: hookArgs }
            );
            const getHexFromEvent = result.current.getHexFromEvent;
            const handleHexHover = result.current.handleHexHover;
            expect(typeof getHexFromEvent).toBe('function');
            expect(typeof handleHexHover).toBe('function');
        });
    });

    describe('reacting to prop changes', () => {
        it('updates handleHexHover when hexCols changes', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderHook(
                (args) => useHexHover(args.svgRef, args.hexCols, args.hexRows),
                { initialProps: { svgRef, hexCols: 10, hexRows: 10 } }
            );

            const mockEvent = { clientX: 100, clientY: 100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            rerender({ svgRef, hexCols: 20, hexRows: 10 });

            // After changing hexCols to 20, the same event should still be within bounds
            expect(result.current.hoveredHex).not.toBeNull();
        });

        it('updates handleHexHover when hexRows changes', () => {
            const svgRef = createSvgRef();
            const { result, rerender } = renderHook(
                (args) => useHexHover(args.svgRef, args.hexCols, args.hexRows),
                { initialProps: { svgRef, hexCols: 10, hexRows: 10 } }
            );

            const mockEvent = { clientX: 100, clientY: 100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            rerender({ svgRef, hexCols: 10, hexRows: 20 });

            expect(result.current.hoveredHex).not.toBeNull();
        });
    });

    describe('returned object shape', () => {
        it('returns exactly hoveredHex, setHoveredHex, getHexFromEvent, handleHexHover', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const keys = Object.keys(result.current);
            expect(keys).toContain('hoveredHex');
            expect(keys).toContain('setHoveredHex');
            expect(keys).toContain('getHexFromEvent');
            expect(keys).toContain('handleHexHover');
        });
    });
});
