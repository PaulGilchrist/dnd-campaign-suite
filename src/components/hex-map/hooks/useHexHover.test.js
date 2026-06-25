// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useHexHover from './useHexHover.js';

vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    pixelToHexSnapped: vi.fn((x, y, size) => {
        const r = (2 / 3 * y) / size;
        const q = (x / (size * Math.sqrt(3))) - r / 2;
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);
        const dq = Math.abs(rq - q);
        const dr = Math.abs(rr - r);
        const ds = Math.abs(rs - s);
        if (dq > dr && dq > ds) {
            rq = -rr - rs;
        } else if (dr > ds) {
            rr = -rq - rs;
        }
        return { q: rq, r: rr };
    }),
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
            createSVGPoint: () => {
                const pt = { x: 0, y: 0 };
                pt.matrixTransform = function () { return this; };
                return pt;
            },
            ...mockAttrs,
        };
        ref.current = baseAttrs;
        return ref;
    };

    describe('initial state', () => {
        it('returns the correct shape with null hoveredHex and three functions', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            expect(result.current.hoveredHex).toBeNull();
            expect(typeof result.current.setHoveredHex).toBe('function');
            expect(typeof result.current.getHexFromEvent).toBe('function');
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

        it('returns a hex object with q and r when svgRef exists', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 100, clientY: 100 };
            const hex = result.current.getHexFromEvent(mockEvent);

            expect(hex).toHaveProperty('q');
            expect(hex).toHaveProperty('r');
        });

        it('returns { q: 0, r: 0 } when event maps to origin in SVG coordinates', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX: 0, clientY: 0 };
            const hex = result.current.getHexFromEvent(mockEvent);

            expect(hex).toEqual({ q: 0, r: 0 });
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

            const mockEvent = { clientX: -100, clientY: -100 };
            act(() => {
                result.current.handleHexHover(mockEvent);
            });

            expect(result.current.hoveredHex).toBeNull();
        });

        it.each`
            description              | clientX  | clientY
            ${'negative q'}          | ${-500}  | ${100}
            ${'q exceeds grid width'}| ${10000} | ${100}
            ${'r exceeds grid height'}| ${100}  | ${10000}
        `('sets hoveredHex to null when $description', ({ clientX, clientY }) => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const mockEvent = { clientX, clientY };
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

            expect(getHexFromEvent).toBeInstanceOf(Function);
            expect(handleHexHover).toBeInstanceOf(Function);
            expect(result.current.getHexFromEvent).toBe(getHexFromEvent);
            expect(result.current.handleHexHover).toBe(handleHexHover);
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
        it('returns exactly 4 keys: hoveredHex, setHoveredHex, getHexFromEvent, handleHexHover', () => {
            const svgRef = createSvgRef();
            const { result } = renderHook(() => useHexHover(svgRef, 10, 10));

            const keys = Object.keys(result.current);
            expect(keys).toHaveLength(4);
            expect(keys).toContain('hoveredHex');
            expect(keys).toContain('setHoveredHex');
            expect(keys).toContain('getHexFromEvent');
            expect(keys).toContain('handleHexHover');
        });
    });
});
